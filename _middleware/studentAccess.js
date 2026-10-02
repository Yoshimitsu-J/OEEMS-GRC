const User = require('../_models/User');
const StudentProfile = require('../_models/StudentProfile');

function isProfileComplete(profile) {
	return Boolean(
		profile &&
		profile.givenName?.trim() &&
		profile.lastName?.trim() &&
		['male', 'female'].includes(profile.sex) &&
		profile.birthday &&
		profile.phone?.trim() &&
		profile.address?.country?.trim() &&
		profile.address?.region?.trim() &&
		profile.address?.city?.trim() &&
		profile.address?.barangay?.trim() &&
		profile.address?.street?.trim() &&
		profile.guardian?.name?.trim() &&
		profile.guardian?.phone?.trim() &&
		profile.termsAcceptedAt
	);
}

function unauthenticated(request, response) {
	if (request.originalUrl.startsWith('/api/')) {
		return response.status(401).json({ error: 'Authentication required.' });
	}
	return response.redirect('/public/index.html?openLogin=true');
}

async function requireAuthenticated(request, response, next) {
	response.set({
		'Cache-Control': 'no-store, no-cache, must-revalidate, private',
		Pragma: 'no-cache',
		Expires: '0'
	});

	try {
		const userId = request.session?.user?.id;
		if (!userId) return unauthenticated(request, response);

		const user = await User.findOne({
			_id: userId,
			emailVerified: true,
			accountStatus: 'active'
		});
		if (!user) {
			request.session.destroy(() => {});
			return unauthenticated(request, response);
		}

		response.locals.authUser = user;
		next();
	} catch (error) {
		next(error);
	}
}

async function requireCompletedProfile(request, response, next) {
	try {
		const user = response.locals.authUser;
		if (!user) return unauthenticated(request, response);

		const profile = await StudentProfile.findOne({ userId: user._id }).lean();
		if (!isProfileComplete(profile)) {
			if (request.originalUrl.startsWith('/api/')) {
				return response.status(403).json({
				error: 'Complete your student profile before accessing this resource.',
				redirectUrl: '/account-setup.html'
				});
			}
			return response.redirect('/account-setup.html');
		}

		response.locals.studentProfile = profile;
		next();
	} catch (error) {
		next(error);
	}
}

module.exports = {
	isProfileComplete,
	requireAuthenticated,
	requireCompletedProfile
};