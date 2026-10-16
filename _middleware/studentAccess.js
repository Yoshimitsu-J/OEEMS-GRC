const User = require('../_models/User');
const StudentProfile = require('../_models/StudentProfile');
const StudentApplication = require('../_models/StudentApplication');
const StudentSchedule = require('../_models/StudentSchedule');
const StudentDocument = require('../_models/StudentDocument');

const REQUIRED_UPLOADS = ['form138', 'good_moral', 'picture_2x2'];

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
		(profile.address?.streetAddress?.trim() || profile.address?.street?.trim()) &&
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

async function requireIncompleteProfile(request, response, next) {
	try {
		const profile = await StudentProfile.findOne({ userId: response.locals.authUser._id }).lean();
		if (isProfileComplete(profile)) return response.redirect('/student/');
		next();
	} catch (error) {
		next(error);
	}
}

async function checkStepAccess(request, response, next) {
	const page = request.path.split('/').pop().toLowerCase();
	const studentProfile = response.locals.studentProfile;
	if (!studentProfile || /\.(?:css|js|png|jpe?g|webp|svg|ico|woff2?)$/i.test(page)) return next();

	const restrictedPages = new Set([
		'scheduleexam.html', 'uploaddocuments.html', 'applicationsummary.html',
		'myapplication.html', 'statementofapplication.html', 'takeexam.html', 'examresult.html',
		'application', 'exam', 'schedule.html', 'documents.html', 'summary.html'
	]);

	try {
		const applicantId = studentProfile.applicantId;
		const application = await StudentApplication.findOne({ applicantId }).lean();
		const submitted = application?.status === 'under_review' && application.admissionStatus === 'pending';
		if (submitted && !['', 'index.html', 'studentinformation.html'].includes(page)) {
			return response.redirect('/student/?access=previous-step');
		}
		if (!restrictedPages.has(page)) return next();

		const schedule = application?.scheduleId
			? await StudentSchedule.findById(application.scheduleId).lean()
			: await StudentSchedule.findOne({ applicantId, bookingStatus: { $in: ['reserved', 'confirmed'] } }).lean();
		const documents = await StudentDocument.find({ applicantId }).select('documentType verificationStatus').lean();
		const uploaded = new Set(documents
			.filter((document) => ['submitted', 'under_review', 'accepted'].includes(document.verificationStatus))
			.map((document) => document.documentType));
		const allDocumentsSubmitted = REQUIRED_UPLOADS.every((type) => uploaded.has(type));
		const reviewLocked = ['under_review', 'approved', 'declined', 'exam_completed', 'result_released'].includes(application?.status);
		const protectedPage = page === 'application' ? 'myapplication.html'
			: page === 'exam' ? 'takeexam.html'
				: page === 'schedule.html' ? 'scheduleexam.html'
					: page === 'documents.html' ? 'uploaddocuments.html'
						: page === 'summary.html' ? 'applicationsummary.html' : page;
		let redirect = null;

		if (reviewLocked && ['scheduleexam.html', 'uploaddocuments.html', 'applicationsummary.html', 'myapplication.html'].includes(protectedPage)) {
			redirect = '/student/';
		} else if (protectedPage === 'scheduleexam.html' && !['draft', 'scheduled', 'documents_submitted'].includes(application?.status || 'draft')) {
			redirect = '/student/';
		} else if (protectedPage === 'uploaddocuments.html' && (!schedule || !['scheduled', 'documents_submitted'].includes(application?.status))) {
			redirect = '/student/scheduleExam.html';
		} else if (protectedPage === 'applicationsummary.html' && (!allDocumentsSubmitted || application?.status !== 'documents_submitted')) {
			redirect = schedule ? '/student/uploadDocuments.html' : '/student/scheduleExam.html';
		} else if (protectedPage === 'statementofapplication.html' && application?.status !== 'approved') {
			redirect = '/student/';
		} else if (protectedPage === 'takeexam.html' && application?.status !== 'approved') {
			redirect = '/student/';
		} else if (protectedPage === 'examresult.html' && application?.status !== 'result_released') {
			redirect = '/student/';
		}

		if (redirect) {
			return response.redirect(`${redirect}?access=previous-step`);
		}
		next();
	} catch (error) {
		next(error);
	}
}

module.exports = {
	isProfileComplete,
	requireAuthenticated,
	requireCompletedProfile,
	requireIncompleteProfile,
	checkStepAccess
};