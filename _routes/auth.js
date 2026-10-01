const crypto = require('node:crypto');
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const Student = require('../_models/Student');

const router = express.Router();
const callbackUrl = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
const googleClient = new OAuth2Client(
	process.env.GOOGLE_CLIENT_ID,
	process.env.GOOGLE_CLIENT_SECRET,
	callbackUrl
);

function hasGoogleConfiguration() {
	return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
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

router.get('/google', (request, response) => {
	if (!hasGoogleConfiguration()) {
		return response.status(503).send('Google sign-in is not configured.');
	}

	const intent = request.query.intent === 'login' ? 'login' : 'signup';
	const state = crypto.randomBytes(32).toString('hex');
	request.session.googleOAuthState = state;
	request.session.googleOAuthIntent = intent;

	response.redirect(googleClient.generateAuthUrl({
		access_type: 'online',
		prompt: 'select_account',
		scope: ['openid', 'email', 'profile'],
		state
	}));
});

router.get('/google/callback', async (request, response) => {
	const expectedState = request.session.googleOAuthState;
	const actualState = request.query.state;
	delete request.session.googleOAuthState;

	if (!expectedState || typeof actualState !== 'string' || expectedState !== actualState) {
		return response.status(400).send('Invalid OAuth state. Please try signing in again.');
	}
	if (request.query.error || typeof request.query.code !== 'string') {
		return response.redirect('/login?error=google_sign_in_cancelled');
	}
	if (!hasGoogleConfiguration()) {
		return response.status(503).send('Google sign-in is not configured.');
	}

	try {
		const { tokens } = await googleClient.getToken(request.query.code);
		if (!tokens.id_token) {
			return response.status(401).send('Google did not return an identity token.');
		}

		const ticket = await googleClient.verifyIdToken({
			idToken: tokens.id_token,
			audience: process.env.GOOGLE_CLIENT_ID
		});
		const profile = ticket.getPayload();
		if (!profile?.sub || !profile.email || profile.email_verified !== true) {
			return response.status(403).send('A Google-verified email address is required.');
		}

		const email = profile.email.toLowerCase();
		let student = await Student.findOne({ googleId: profile.sub });
		if (!student) student = await Student.findOne({ email });

		if (!student && request.session.googleOAuthIntent === 'login') {
			return response.redirect('/login?error=account_not_found');
		}
		if (!student) {
			student = await Student.create({
				googleId: profile.sub,
				email,
				name: profile.name || email,
				picture: profile.picture || '',
				emailVerified: true
			});
		} else {
			if (student.googleId && student.googleId !== profile.sub) {
				return response.status(409).send('This email is already linked to another Google account.');
			}
			student.googleId = profile.sub;
			student.emailVerified = true;
			student.name = profile.name || student.name;
			student.picture = profile.picture || student.picture;
			await student.save();
		}

		await regenerateSession(request);
		request.session.user = {
			id: student.id,
			name: student.name,
			email: student.email,
			picture: student.picture,
			role: 'Student'
		};
		await saveSession(request);
		response.redirect('/student/');
	} catch (error) {
		console.error('Google OAuth callback failed:', error.message);
		response.redirect('/login?error=google_auth_failed');
	}
});

router.get('/logout', (request, response, next) => {
	request.session.destroy((error) => {
		if (error) return next(error);
		response.clearCookie('connect.sid');
		response.redirect('/login');
	});
});

module.exports = router;