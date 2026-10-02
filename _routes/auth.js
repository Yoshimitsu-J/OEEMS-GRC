const crypto = require('node:crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const OtpRequest = require('../_models/OtpRequest');
const StudentProfile = require('../_models/StudentProfile');
const User = require('../_models/User');
const { isSmtpConfigured, sendOtp } = require('../_scripts/nodeEmailer');
const { isProfileComplete, requireAuthenticated } = require('../_middleware/studentAccess');
const { requireSameOrigin } = require('../_middleware/sameOrigin');
const {
	compareOtp,
	createStudentId,
	hashOtp,
	hashPassword,
	verifyPassword
} = require('../_scripts/authSecurity');

const router = express.Router();
const googleClient = new OAuth2Client(
	process.env.GOOGLE_CLIENT_ID,
	process.env.GOOGLE_CLIENT_SECRET
);
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 15,
	standardHeaders: true,
	legacyHeaders: false
});
const OTP_RESEND_DELAY_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function hasGoogleConfiguration() {
	return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function normalizeEmail(value) {
	return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isLocalDevelopment(request) {
	if (process.env.NODE_ENV === 'production') return false;
	if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') return true;
	return ['localhost', '127.0.0.1', '::1'].includes(request.hostname);
}

function regenerateSession(request) {
	return new Promise((resolve, reject) => {
		request.session.regenerate((error) => error ? reject(error) : resolve());
	});
}

function saveSession(request) {
	return new Promise((resolve, reject) => {
		request.session.save((error) => error ? reject(error) : resolve());
	});
}

async function establishSession(request, user) {
	await regenerateSession(request);
	request.session.user = {
		id: user.id,
		email: user.email,
		role: 'Student'
	};
	await saveSession(request);
}

async function profileRedirect(userId) {
	const profile = await StudentProfile.findOne({ userId }).lean();
	return isProfileComplete(profile) ? '/public/student-dashboard.html' : '/public/setup-account.html';
}

function googleRedirectUri(request) {
	const callbackPath = '/api/auth/google/callback';
	if (process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '::1'].includes(request.hostname)) {
		return `http://${request.get('host')}${callbackPath}`;
	}
	return process.env.GOOGLE_REDIRECT_URI || null;
}

function matchesOAuthState(expectedState, actualState) {
	if (typeof expectedState !== 'string' || typeof actualState !== 'string') return false;
	const expected = Buffer.from(expectedState);
	const actual = Buffer.from(actualState);
	return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

async function issueOtp(user, purpose, allowDevFallback) {
	const cutoff = new Date(Date.now() - OTP_RESEND_DELAY_MS);
	const recentRequest = await OtpRequest.exists({
		userId: user._id,
		purpose,
		createdAt: { $gt: cutoff }
	});
	if (recentRequest) {
		const error = new Error('Please wait before requesting another verification code.');
		error.status = 429;
		throw error;
	}

	const now = new Date();
	await OtpRequest.updateMany({
		userId: user._id,
		purpose,
		consumedAt: null
	}, { $set: { consumedAt: now } });

	const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
	const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
	const otpRequest = await OtpRequest.create({
		userId: user._id,
		purpose,
		codeHash: hashOtp(code),
		expiresAt
	});

	try {
		if (!isSmtpConfigured()) {
			if (!allowDevFallback) throw new Error('SMTP is not configured for production OTP delivery.');
			console.info(`[DEV MODE] Generated OTP for ${user.email}: ${code}`);
			return { isDevMode: true, expiresAt };
		}

		await sendOtp(user.email, code, purpose);
		return { isDevMode: false, expiresAt };
	} catch (error) {
		await OtpRequest.updateOne({ _id: otpRequest._id }, { $set: { consumedAt: new Date() } });
		console.error('OTP email delivery failed:', error.code || error.message);
		error.status = error.status || 503;
		error.isEmailDeliveryError = true;
		throw error;
	}
}

async function consumeOtp(userId, purpose, code) {
	const otpRequest = await OtpRequest.findOne({
		userId,
		purpose,
		consumedAt: null,
		attemptCount: { $lt: OTP_MAX_ATTEMPTS }
	}).select('+codeHash').sort({ createdAt: -1 });
	if (!otpRequest) return { ok: false, expired: true };

	const expiresAt = otpRequest.expiresAt.getTime();
	if (Date.now() > expiresAt) return { ok: false, expired: true };

	if (!compareOtp(code, otpRequest.codeHash)) {
		await OtpRequest.updateOne({
			_id: otpRequest._id,
			consumedAt: null,
			attemptCount: { $lt: OTP_MAX_ATTEMPTS }
		}, { $inc: { attemptCount: 1 } });
		return { ok: false, expired: false };
	}
	if (Date.now() > expiresAt) return { ok: false, expired: true };

	const consumed = await OtpRequest.findOneAndUpdate({
		_id: otpRequest._id,
		consumedAt: null,
		attemptCount: { $lt: OTP_MAX_ATTEMPTS }
	}, {
		$set: { consumedAt: new Date() },
		$inc: { attemptCount: 1 }
	}, { returnDocument: 'after' });
	return consumed
		? { ok: true, expired: false }
		: { ok: false, expired: Date.now() > expiresAt };
}

async function findOrCreateGoogleUser(profile) {
	const email = normalizeEmail(profile.email);
	let user = await User.findOne({ googleId: profile.sub }).select('+googleId');
	if (!user) user = await User.findOne({ email }).select('+googleId');

	if (!user) {
		try {
			user = await User.create({
				studentId: createStudentId(),
				email,
				googleId: profile.sub,
				isEmailVerified: true,
				authProvider: 'google',
				accountStatus: 'active'
			});
		} catch (error) {
			if (error.code !== 11000) throw error;
			user = await User.findOne({ $or: [{ googleId: profile.sub }, { email }] }).select('+googleId');
			if (!user) throw error;
		}
	}

	if (user.accountStatus === 'locked' || user.accountStatus === 'disabled') {
		const error = new Error('This account cannot sign in. Contact support.');
		error.status = 403;
		throw error;
	}
	if (user.googleId && user.googleId !== profile.sub) {
		const error = new Error('This email is linked to another Google account.');
		error.status = 409;
		throw error;
	}

	user.googleId = profile.sub;
	user.emailVerified = true;
	user.authProvider = 'google';
	user.accountStatus = 'active';
	user.lastLoginAt = new Date();
	await user.save();
	return user;
}

router.post('/signup', requireSameOrigin, authLimiter, async (request, response) => {
	try {
		const email = normalizeEmail(request.body.email);
		const password = request.body.password;
		if (!isValidEmail(email) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
			return response.status(400).json({ error: 'Enter a valid email and a password of 8 to 128 characters.' });
		}

		let user = await User.findOne({ email });
		if (user?.emailVerified) {
			return response.status(409).json({ error: 'Email already registered. Please log in.' });
		}
		if (user?.accountStatus === 'locked' || user?.accountStatus === 'disabled') {
			return response.status(403).json({ error: 'This account cannot be used. Contact support.' });
		}

		const passwordHash = await hashPassword(password);
		if (user) {
			user.passwordHash = passwordHash;
			user.accountStatus = 'pending';
			await user.save();
		} else {
			try {
				user = await User.create({
					studentId: createStudentId(),
					email,
					passwordHash,
					emailVerified: false,
					accountStatus: 'pending'
				});
			} catch (error) {
				if (error.code === 11000) {
					return response.status(409).json({ error: 'Email already registered. Please log in.' });
				}
				throw error;
			}
		}

		const delivery = await issueOtp(user, 'signup_verification', isLocalDevelopment(request));
		response.status(202).json({
			ok: true,
			isDevMode: delivery.isDevMode,
			expiresAt: delivery.expiresAt.toISOString(),
			expiresInMs: Math.max(0, delivery.expiresAt.getTime() - Date.now()),
			message: delivery.isDevMode
				? 'Development Mode: OTP logged to server terminal.'
				: 'A verification code was sent to your email.'
		});
	} catch (error) {
		if (error.status === 429) {
			return response.status(429).json({ error: error.message });
		}
		if (error.isEmailDeliveryError) {
			return response.status(503).json({ error: 'Could not send the verification email. Check the mail server configuration and try again.' });
		}
		console.error('Signup request failed:', error.code || error.message);
		response.status(500).json({ error: 'Could not create the account. Please try again.' });
	}
});

router.post('/resend-otp', requireSameOrigin, authLimiter, async (request, response) => {
	const email = normalizeEmail(request.body.email);
	if (!isValidEmail(email)) {
		return response.status(400).json({ error: 'Enter a valid email address.' });
	}

	try {
		const user = await User.findOne({ email, emailVerified: false, accountStatus: 'pending' });
		if (!user) {
			return response.status(404).json({ error: 'No pending verification was found for that email.' });
		}

		const delivery = await issueOtp(user, 'signup_verification', isLocalDevelopment(request));
		response.status(202).json({
			ok: true,
			isDevMode: delivery.isDevMode,
			expiresAt: delivery.expiresAt.toISOString(),
			expiresInMs: Math.max(0, delivery.expiresAt.getTime() - Date.now()),
			message: delivery.isDevMode
				? 'Development Mode: OTP logged to server terminal.'
				: 'A new verification code was sent to your email.'
		});
	} catch (error) {
		if (error.status === 429) {
			return response.status(429).json({ error: error.message });
		}
		if (error.isEmailDeliveryError) {
			return response.status(503).json({ error: 'Could not send a new verification email. Please try again.' });
		}
		console.error('OTP resend failed:', error.code || error.message);
		response.status(500).json({ error: 'Could not create a new verification code.' });
	}
});

router.post('/verify-otp', requireSameOrigin, authLimiter, async (request, response) => {
	const email = normalizeEmail(request.body.email);
	const code = typeof request.body.code === 'string' ? request.body.code.trim() : '';
	if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
		return response.status(400).json({ error: 'Enter the email address and six-digit verification code.' });
	}

	try {
		const user = await User.findOne({ email });
		if (!user || user.emailVerified || user.accountStatus !== 'pending') {
			return response.status(400).json({ error: 'This verification request is invalid or already used.' });
		}

		const verification = await consumeOtp(user._id, 'signup_verification', code);
		if (!verification.ok) {
			return response.status(400).json({
				error: verification.expired ? 'The verification code expired. Request a new one.' : 'The verification code is incorrect.',
				expired: verification.expired
			});
		}

		user.emailVerified = true;
		user.accountStatus = 'active';
		user.lastLoginAt = new Date();
		await user.save();
		await establishSession(request, user);
		response.json({ ok: true, redirectUrl: await profileRedirect(user._id) });
	} catch (error) {
		console.error('OTP verification failed:', error.message);
		response.status(500).json({ error: 'Could not verify the code. Please try again.' });
	}
});

router.post('/login', requireSameOrigin, authLimiter, async (request, response) => {
	const email = normalizeEmail(request.body.email);
	const password = request.body.password;
	if (!isValidEmail(email) || typeof password !== 'string' || password.length > 128) {
		return response.status(400).json({ error: 'Enter a valid email and password.' });
	}

	try {
		const user = await User.findOne({ email }).select('+passwordHash');
		if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
			return response.status(401).json({ error: 'Invalid email or password.' });
		}
		if (!user.emailVerified) {
			return response.status(403).json({ error: 'Verify your email before signing in.' });
		}
		if (user.accountStatus !== 'active') {
			return response.status(403).json({ error: 'This account is not active. Contact support.' });
		}

		user.lastLoginAt = new Date();
		await user.save();
		await establishSession(request, user);
		response.json({ ok: true, redirectUrl: await profileRedirect(user._id) });
	} catch (error) {
		console.error('Student login failed:', error.message);
		response.status(500).json({ error: 'Could not sign in. Please try again.' });
	}
});

router.post('/password-reset/request', requireSameOrigin, authLimiter, async (request, response) => {
	const email = normalizeEmail(request.body.email);
	if (!isValidEmail(email)) {
		return response.status(400).json({ error: 'Enter a valid email address.' });
	}

	const genericMessage = 'If an active account exists for that email, a reset code has been sent.';
	try {
		const user = await User.findOne({ email, emailVerified: true, accountStatus: 'active' });
		if (user) {
			try {
				await issueOtp(user, 'password_reset', isLocalDevelopment(request));
			} catch (error) {
				if (error.status !== 429) console.error('Password reset email failed:', error.message);
			}
		}
		response.status(202).json({ ok: true, message: genericMessage });
	} catch (error) {
		console.error('Password reset request failed:', error.message);
		response.status(202).json({ ok: true, message: genericMessage });
	}
});

router.post('/password-reset/confirm', requireSameOrigin, authLimiter, async (request, response) => {
	const email = normalizeEmail(request.body.email);
	const code = typeof request.body.code === 'string' ? request.body.code.trim() : '';
	const password = request.body.password;
	if (!isValidEmail(email) || !/^\d{6}$/.test(code) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
		return response.status(400).json({ error: 'Enter a valid email, six-digit code, and an 8 to 128 character password.' });
	}

	try {
		const user = await User.findOne({ email, emailVerified: true, accountStatus: 'active' });
		const verification = user ? await consumeOtp(user._id, 'password_reset', code) : { ok: false };
		if (!user || !verification.ok) {
			return response.status(400).json({ error: 'The reset code is incorrect, expired, or already used.' });
		}
		user.passwordHash = await hashPassword(password);
		await user.save();
		response.json({ ok: true, message: 'Password reset. Please sign in with your new password.' });
	} catch (error) {
		console.error('Password reset failed:', error.message);
		response.status(500).json({ error: 'Could not reset the password. Please try again.' });
	}
});

router.get('/me', requireAuthenticated, async (request, response) => {
	const profile = await StudentProfile.findOne({ userId: response.locals.authUser._id }).lean();
	response.json({
		user: {
			id: response.locals.authUser.id,
			email: response.locals.authUser.email,
			studentId: response.locals.authUser.studentId
		},
		profile
	});
});

router.get('/google', async (request, response) => {
	try {
		if (!hasGoogleConfiguration()) throw new Error('Google OAuth credentials are not configured.');
		const redirectUri = googleRedirectUri(request);
		if (!redirectUri) throw new Error('GOOGLE_REDIRECT_URI must be configured in production.');

		const state = crypto.randomBytes(32).toString('hex');
		request.session.googleOAuthState = state;
		request.session.googleOAuthRedirectUri = redirectUri;
		await saveSession(request);
		response.redirect(googleClient.generateAuthUrl({
			access_type: 'online',
			prompt: 'select_account',
			scope: ['openid', 'email', 'profile'],
			redirect_uri: redirectUri,
			state
		}));
	} catch (error) {
		console.error('Google OAuth initialization failed:', error.message);
		response.redirect('/public/index.html?error=google_auth_failed');
	}
});

router.get('/google/callback', async (request, response) => {
	try {
		const expectedState = request.session?.googleOAuthState;
		const redirectUri = request.session?.googleOAuthRedirectUri;
		delete request.session.googleOAuthState;
		delete request.session.googleOAuthRedirectUri;
		if (!matchesOAuthState(expectedState, request.query.state)) {
			throw new Error('Google OAuth state validation failed.');
		}
		if (request.query.error || typeof request.query.code !== 'string') {
			throw new Error('Google OAuth authorization was cancelled or did not return a code.');
		}
		if (!hasGoogleConfiguration() || !redirectUri) {
			throw new Error('Google OAuth configuration is incomplete.');
		}

		const { tokens } = await googleClient.getToken({
			code: request.query.code,
			redirect_uri: redirectUri
		});
		if (!tokens.id_token) throw new Error('Google did not return an identity token.');

		const ticket = await googleClient.verifyIdToken({
			idToken: tokens.id_token,
			audience: process.env.GOOGLE_CLIENT_ID
		});
		const profile = ticket.getPayload();
		if (!profile?.sub || !profile.email || profile.email_verified !== true) {
			return response.status(403).send('A Google-verified email address is required.');
		}

		const user = await findOrCreateGoogleUser(profile);
		await establishSession(request, user);
		response.redirect(await profileRedirect(user._id));
	} catch (error) {
		console.error('Google OAuth callback failed:', error.message);
		response.redirect('/public/index.html?error=google_auth_failed');
	}
});

router.post('/logout', requireSameOrigin, (request, response, next) => {
	request.session.destroy((error) => {
		if (error) return next(error);
		response.clearCookie(process.env.SESSION_COOKIE_NAME || 'connect.sid', { path: '/' });
		response.json({ ok: true, redirectUrl: '/public/index.html' });
	});
});

router.get('/logout', (request, response, next) => {
	request.session.destroy((error) => {
		if (error) return next(error);
		response.clearCookie(process.env.SESSION_COOKIE_NAME || 'connect.sid', { path: '/' });
		response.redirect('/public/index.html');
	});
});

module.exports = router;
