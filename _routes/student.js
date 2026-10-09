const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const User = require('../_models/User');
const StudentProfile = require('../_models/StudentProfile');
const StudentApplication = require('../_models/StudentApplication');
const StudentSchedule = require('../_models/StudentSchedule');
const StudentDocument = require('../_models/StudentDocument');
const { getDatabaseConnection } = require('../_scripts/mongodb_connection');
const { createApplicantId } = require('../_scripts/authSecurity');
const { sendApplicationSubmissionConfirmation } = require('../_scripts/nodeEmailer');
const { requireAuthenticated, requireCompletedProfile } = require('../_middleware/studentAccess');
const { requireSameOrigin } = require('../_middleware/sameOrigin');

const router = express.Router();
const REQUIRED_UPLOADS = ['form138', 'good_moral', 'picture_2x2'];
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

function currentCycle() {
	if (process.env.APPLICATION_CYCLE) return process.env.APPLICATION_CYCLE;
	const year = new Date().getFullYear();
	return `${year}-${year + 1}`;
}

function workflowStatus(application) {
	if (!application) return 'In Progress';
	if (application.status === 'under_review' && application.admissionStatus === 'pending') return 'Pending';
	if (['approved', 'declined', 'exam_completed', 'result_released'].includes(application.status)) return 'Completed';
	return 'In Progress';
}

async function getWorkflow(profile) {
	const application = await StudentApplication.findOne({ applicantId: profile.applicantId }).lean();
	const schedule = application?.scheduleId
		? await StudentSchedule.findById(application.scheduleId).lean()
		: await StudentSchedule.findOne({ applicantId: profile.applicantId, bookingStatus: { $in: ['reserved', 'confirmed'] } }).lean();
	const documents = await StudentDocument.find({ applicantId: profile.applicantId }).lean();
	const submittedTypes = new Set(documents
		.filter((document) => ['submitted', 'under_review', 'accepted'].includes(document.verificationStatus))
		.map((document) => document.documentType));
	const documentCount = REQUIRED_UPLOADS.filter((type) => submittedTypes.has(type)).length;
	const isSubmitted = workflowStatus(application) !== 'In Progress';
	const progressPercent = isSubmitted ? 100 : schedule ? (documentCount === REQUIRED_UPLOADS.length ? 75 : 50) : 25;
	let nextStep = null;

	if (!isSubmitted) {
		if (!schedule) nextStep = { number: 2, title: 'Schedule Exam', href: 'scheduleExam.html' };
		else if (documentCount < REQUIRED_UPLOADS.length) nextStep = { number: 3, title: 'Upload Documents', href: 'uploadDocuments.html' };
		else nextStep = { number: 4, title: 'Review and Submit Application', href: 'applicationSummary.html' };
	} else if (application?.status === 'approved') {
		nextStep = { number: 5, title: 'Take Exam', href: 'takeExam.html' };
	}

	return {
		application,
		schedule,
		documents,
		applicationStatus: workflowStatus(application),
		progressPercent,
		documentCount,
		documentTotal: REQUIRED_UPLOADS.length,
		scheduleMessage: schedule
			? null
			: "Unavailable, please proceed to Step 2: 'Schedule Exam' first",
		nextStep,
		isSubmitted
	};
}

function getUploadBucket() {
	return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'student_uploads' });
}

function isAllowedImage(file) {
	if (!['image/jpeg', 'image/png'].includes(file.mimetype)) return false;
	if (file.mimetype === 'image/png') return file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
	return file.buffer.length >= 3 && file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
}

function saveGridFsFile(file, metadata) {
	return new Promise((resolve, reject) => {
		const stream = getUploadBucket().openUploadStream(path.basename(file.originalname).slice(0, 180), {
			contentType: file.mimetype,
			metadata
		});
		stream.once('error', reject);
		stream.once('finish', () => resolve(stream.id.toString()));
		stream.end(file.buffer);
	});
}

function deleteGridFsFile(storageKey) {
	if (!storageKey || !mongoose.isValidObjectId(storageKey)) return Promise.resolve();
	return getUploadBucket().delete(new mongoose.Types.ObjectId(storageKey)).catch(() => {});
}

function text(value, maxLength = 160) {
	return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function makeProfileInput(body) {
	const address = body.address && typeof body.address === 'object' ? body.address : body;
	const guardian = body.guardian && typeof body.guardian === 'object' ? body.guardian : body;
	const birthday = new Date(body.birthday);
	const phone = text(body.phone, 32);
	const profile = {
		lastName: text(body.lastName),
		givenName: text(body.givenName),
		middleName: text(body.middleName),
		sex: text(body.sex, 16).toLowerCase(),
		birthday,
		phone,
		address: {
			country: text(address.country),
			region: text(address.region),
			city: text(address.city),
			barangay: text(address.barangay),
			streetAddress: text(address.streetAddress || address.street)
		},
		guardian: {
			name: text(guardian.name || guardian.guardianName),
			phone: text(guardian.phone || guardian.guardianPhone, 32)
		},
	};

	const phonePattern = /^\+?[0-9][0-9().\s-]{6,30}$/;
	const validBirthday = Number.isFinite(birthday.getTime()) && birthday < new Date();
	const validPhone = phonePattern.test(profile.phone) && phonePattern.test(profile.guardian.phone);
	const complete = Boolean(
		profile.lastName && profile.givenName &&
		['male', 'female'].includes(profile.sex) && validBirthday && validPhone &&
		profile.address.country && profile.address.region && profile.address.city &&
		profile.address.barangay && profile.address.streetAddress &&
		profile.guardian.name && profile.guardian.phone && body.termsAccepted === true
	);

	return { profile, complete };
}

router.get('/profile', requireAuthenticated, async (request, response) => {
	try {
		const user = response.locals.authUser;
		const profile = await StudentProfile.findOne({ userId: user._id }).lean();
		if (!profile) return response.status(404).json({ error: 'Student profile has not been completed.' });

		response.set('Cache-Control', 'no-store');
		response.json({
			profile: {
				...profile,
				address: {
					...profile.address,
					streetAddress: profile.address?.streetAddress || profile.address?.street || ''
				}
			},
			email: user.email,
			studentId: user.studentId
		});
	} catch (error) {
		console.error('Student profile read failed:', error.message);
		response.status(500).json({ error: 'Could not load the student profile.' });
	}
});

router.get('/profile/photo', requireAuthenticated, requireCompletedProfile, async (request, response) => {
	const photo = response.locals.studentProfile.photo;
	if (!photo?.storageKey || !mongoose.isValidObjectId(photo.storageKey)) {
		return response.status(404).end();
	}
	if (!['image/jpeg', 'image/png'].includes(photo.contentType)) {
		return response.status(404).end();
	}

	response.set({
		'Content-Type': photo.contentType,
		'Cache-Control': 'no-store, private',
		'X-Content-Type-Options': 'nosniff'
	});
	const stream = getUploadBucket().openDownloadStream(new mongoose.Types.ObjectId(photo.storageKey));
	stream.once('error', () => {
		if (!response.headersSent) response.status(404).end();
	});
	stream.pipe(response);
});

router.get('/application-status', requireAuthenticated, requireCompletedProfile, async (request, response) => {
	try {
		const workflow = await getWorkflow(response.locals.studentProfile);
		response.set('Cache-Control', 'no-store');
		response.json({
			applicantId: response.locals.studentProfile.applicantId,
			applicationStatus: workflow.applicationStatus,
			workflowStatus: workflow.application?.status || 'draft',
			cycle: workflow.application?.cycle || currentCycle(),
			submittedAt: workflow.application?.status === 'under_review' ? workflow.application.updatedAt : null,
			applicationCreatedAt: workflow.application?.createdAt || null,
			approval: workflow.application?.approval || null,
			progressPercent: workflow.progressPercent,
			currentStep: workflow.nextStep?.number || (workflow.applicationStatus === 'Pending' ? 5 : null),
			nextStep: workflow.nextStep,
			schedule: workflow.schedule,
			scheduleMessage: workflow.scheduleMessage,
			documentStatuses: workflow.documents.map(({ documentType, verificationStatus, originalName }) => ({
				documentType,
				verificationStatus,
				originalName
			})),
			documentCount: workflow.documentCount,
			documentTotal: workflow.documentTotal,
			isSubmitted: workflow.isSubmitted
		});
	} catch (error) {
		console.error('Student application status read failed:', error.message);
		response.status(500).json({ error: 'Could not load application progress.' });
	}
});

router.get('/schedules', requireAuthenticated, requireCompletedProfile, async (request, response) => {
	try {
		const db = getDatabaseConnection('OEEMS_Admission').db;
		const schedules = await db.collection('schedule_slots').find({
			cycle: currentCycle(),
			status: 'available',
			examDate: { $gte: new Date() },
			$expr: { $lt: [{ $ifNull: ['$bookedCount', 0] }, '$capacity'] }
		}, {
			projection: { _id: 1, scheduleId: 1, cycle: 1, examDate: 1, batch: 1, startTime: 1, endTime: 1, facilityId: 1, capacity: 1, bookedCount: 1, status: 1 }
		}).sort({ examDate: 1, batch: 1 }).toArray();

		response.set('Cache-Control', 'no-store');
		response.json({ schedules: schedules.map((schedule) => ({
			scheduleId: String(schedule.scheduleId),
			cycle: schedule.cycle,
			examDate: schedule.examDate,
			batch: `batch_${schedule.batch}`,
			startTime: schedule.startTime,
			endTime: schedule.endTime,
			facilityId: schedule.facilityId,
			remainingSeats: schedule.capacity - (schedule.bookedCount || 0)
		})) });
	} catch (error) {
		console.error('Available exam schedules could not be read:', error.message);
		response.status(500).json({ error: 'Could not load available exam schedules.' });
	}
});

router.post('/schedule', requireSameOrigin, requireAuthenticated, requireCompletedProfile, async (request, response) => {
	const scheduleId = text(request.body?.scheduleId, 120);
	if (!scheduleId) return response.status(400).json({ error: 'Select an available exam schedule.' });

	const profile = response.locals.studentProfile;
	const applicantId = profile.applicantId;
	const cycle = currentCycle();
	const session = await mongoose.startSession();
	let booking;
	try {
		await session.withTransaction(async () => {
			const application = await StudentApplication.findOne({ applicantId, cycle }).session(session);
			if (!application || !['draft', 'scheduled'].includes(application.status)) {
				const error = new Error('This application can no longer change its exam schedule.');
				error.status = 409;
				throw error;
			}
			if (application.scheduleId || await StudentSchedule.exists({ applicantId, cycle, bookingStatus: { $in: ['reserved', 'confirmed'] } }).session(session)) {
				const error = new Error('An exam schedule is already booked for this application.');
				error.status = 409;
				throw error;
			}

			const admissionDb = getDatabaseConnection('OEEMS_Admission').db;
			const slot = await admissionDb.collection('schedule_slots').findOneAndUpdate({
				scheduleId,
				cycle,
				status: 'available',
				examDate: { $gte: new Date() },
				$expr: { $lt: [{ $ifNull: ['$bookedCount', 0] }, '$capacity'] }
			}, { $inc: { bookedCount: 1 } }, {
				session,
				returnDocument: 'after',
				includeResultMetadata: false
			});
			if (!slot || ![1, 2, 3].includes(Number(slot.batch))) {
				const error = new Error('That exam slot is no longer available. Refresh the schedule list and choose another slot.');
				error.status = 409;
				throw error;
			}

			const [savedBooking] = await StudentSchedule.create([{
				scheduleId: String(slot.scheduleId),
				applicantId,
				cycle,
				examDate: slot.examDate,
				batch: `batch_${Number(slot.batch)}`,
				startTime: slot.startTime,
				endTime: slot.endTime,
				facilityId: slot.facilityId || null,
				bookingStatus: 'confirmed'
			}], { session });
			application.status = 'scheduled';
			application.scheduleId = savedBooking._id;
			await application.save({ session });
			booking = savedBooking;
		});
	} catch (error) {
		if (error.status === 409) return response.status(409).json({ error: error.message });
		console.error('Exam schedule booking failed:', error.message);
		return response.status(500).json({ error: 'Could not reserve this exam schedule.' });
	} finally {
		await session.endSession();
	}

	request.app.get('io')?.to(`student:${response.locals.authUser._id}`).emit('student:application-updated', { applicantId });
	response.status(201).json({ ok: true, schedule: booking, redirectUrl: '/student/uploadDocuments.html' });
});

router.post('/profile', requireSameOrigin, requireAuthenticated, async (request, response) => {
	const { profile, complete } = makeProfileInput(request.body || {});
	if (!complete) {
		return response.status(400).json({ error: 'Complete all required profile fields and accept the terms.' });
	}

	try {
		const user = response.locals.authUser;
		const userId = user._id;
		const existingProfile = await StudentProfile.findOne({ userId }).lean();
		if (existingProfile) {
			const existingApplication = await StudentApplication.findOne({ applicantId: existingProfile.applicantId }).lean();
			if (existingApplication && existingApplication.status !== 'draft') {
				return response.status(409).json({ error: 'Profile changes are locked after application progress begins.' });
			}
		}
		let savedProfile;
		for (let attempt = 0; attempt < 3; attempt += 1) {
			const applicantIdCandidate = existingProfile?.applicantId || user.applicantId || await createApplicantId();
			const session = await mongoose.startSession();
			try {
				await session.withTransaction(async () => {
					savedProfile = await StudentProfile.findOne({ userId }).session(session);
					if (user.applicantId && savedProfile?.applicantId && user.applicantId !== savedProfile.applicantId) {
						throw new Error('The account and profile Applicant IDs do not match.');
					}
					const applicantId = savedProfile?.applicantId || user.applicantId || applicantIdCandidate;

					if (savedProfile) {
						await StudentProfile.collection.updateOne({ _id: savedProfile._id }, {
							$set: { ...profile, studentId: user.studentId, applicantId },
							$unset: { 'address.street': '' }
						}, { session });
						savedProfile = await StudentProfile.findById(savedProfile._id).session(session);
					} else {
						[savedProfile] = await StudentProfile.create([{
							...profile,
							userId,
							studentId: user.studentId,
							applicantId,
							termsAcceptedAt: new Date()
						}], { session });
					}

					const userIdUpdate = await User.collection.updateOne({
						_id: userId,
						$or: [{ applicantId: { $exists: false } }, { applicantId }]
					}, { $set: { applicantId } }, { session });
					if (userIdUpdate.matchedCount !== 1) {
						throw new Error('Could not synchronize the Applicant ID to the user account.');
					}

					await StudentApplication.updateOne({ applicantId: savedProfile.applicantId }, {
						$setOnInsert: {
							applicantId: savedProfile.applicantId,
							studentId: user.studentId,
							cycle: currentCycle(),
							status: 'draft',
							admissionStatus: 'pending'
						}
					}, { upsert: true, session, runValidators: true });
				});
				break;
			} catch (error) {
				if (error.code !== 11000 || attempt === 2) throw error;
			} finally {
				await session.endSession();
			}
		}

		request.app.get('io')?.to(`student:${userId}`).emit('student:profile-updated', {
			applicantId: savedProfile.applicantId
		});

		response.json({
			ok: true,
			applicantId: savedProfile.applicantId,
			redirectUrl: '/public/student-dashboard.html'
		});
	} catch (error) {
		console.error('Student profile save failed:', {
			name: error.name,
			code: error.code || null,
			message: error.message,
		errorLabels: error.errorLabels || []
		});
		response.status(500).json({ error: 'Could not save the student profile. Please try again.' });
	}
});

router.post('/documents/:documentType', requireSameOrigin, requireAuthenticated, requireCompletedProfile, upload.single('file'), async (request, response) => {
	const { documentType } = request.params;
	const file = request.file;
	if (!REQUIRED_UPLOADS.includes(documentType)) {
		return response.status(400).json({ error: 'Unsupported document type.' });
	}
	if (!file || !isAllowedImage(file)) {
		return response.status(400).json({ error: 'Upload a valid JPG or PNG image.' });
	}

	const profile = response.locals.studentProfile;
	const applicantId = profile.applicantId;
	const application = await StudentApplication.findOne({ applicantId });
	if (!application || !['scheduled', 'documents_submitted'].includes(application.status)) {
		return response.status(409).json({ error: 'Complete exam scheduling before uploading documents.' });
	}

	let storageKey;
	let previousStorageKey;
	const session = await mongoose.startSession();
	try {
		storageKey = await saveGridFsFile(file, { applicantId, documentType });
		await session.withTransaction(async () => {
			const currentApplication = await StudentApplication.findOne({ applicantId }).session(session);
			if (!currentApplication || !['scheduled', 'documents_submitted'].includes(currentApplication.status)) {
				const error = new Error('Application is locked for changes.');
				error.status = 409;
				throw error;
			}

			const existing = await StudentDocument.findOne({ applicantId, documentType }).session(session);
			previousStorageKey = existing?.storageKey || null;
			await StudentDocument.updateOne({ applicantId, documentType }, {
				$set: {
					submissionMode: 'online_upload',
					originalName: path.basename(file.originalname).slice(0, 180),
					storageKey,
					contentType: file.mimetype,
					sizeBytes: file.size,
					uploadedAt: new Date(),
					verificationStatus: 'submitted'
				}
			}, { upsert: true, session, runValidators: true });

			const docs = await StudentDocument.find({ applicantId }).session(session).select('documentType verificationStatus').lean();
			const completed = new Set(docs
				.filter((document) => ['submitted', 'under_review', 'accepted'].includes(document.verificationStatus))
				.map((document) => document.documentType));
			if (REQUIRED_UPLOADS.every((type) => completed.has(type))) {
				currentApplication.status = 'documents_submitted';
				await currentApplication.save({ session });
			}
		});
	} catch (error) {
		await deleteGridFsFile(storageKey);
		if (error.status === 409) return response.status(409).json({ error: error.message });
		console.error('Student document upload failed:', error.message);
		return response.status(500).json({ error: 'Could not save this document. Please try again.' });
	} finally {
		await session.endSession();
	}

	if (previousStorageKey && previousStorageKey !== storageKey) await deleteGridFsFile(previousStorageKey);
	request.app.get('io')?.to(`student:${response.locals.authUser._id}`).emit('student:application-updated', { applicantId });
	response.status(201).json({ ok: true, documentType, originalName: path.basename(file.originalname).slice(0, 180) });
});

router.get('/application/summary.pdf', requireAuthenticated, requireCompletedProfile, async (request, response) => {
	try {
		const profile = response.locals.studentProfile;
		const workflow = await getWorkflow(profile);
		if (workflow.isSubmitted) {
			return response.status(403).json({ error: 'The application summary is locked after submission.' });
		}
		if (!workflow.schedule || workflow.documentCount !== workflow.documentTotal) {
			return response.status(409).json({ error: 'Complete the schedule and required documents before downloading the summary.' });
		}

		response.set({
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="${profile.applicantId}-application-summary.pdf"`,
			'Cache-Control': 'no-store'
		});
		const document = new PDFDocument({ size: 'A4', margin: 52, info: { Title: 'OEEMS Application Summary' } });
		document.pipe(response);
		document.fontSize(19).fillColor('#800000').text('GLOBAL RECIPROCAL COLLEGES', { align: 'center' });
		document.moveDown(0.35).fontSize(14).fillColor('#222222').text('Entrance Examination Application Summary', { align: 'center' });
		document.moveDown(1.4).fontSize(11).fillColor('#800000').text('APPLICANT DETAILS');
		document.moveDown(0.5).fillColor('#222222');
		[
			['Applicant ID', profile.applicantId],
			['Applicant Name', `${profile.lastName}, ${profile.givenName}${profile.middleName ? ` ${profile.middleName}` : ''}`],
			['Email', response.locals.authUser.email],
			['Sex', profile.sex],
			['Date of Birth', new Date(profile.birthday).toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })],
			['Phone', profile.phone],
			['Address', `${profile.address.streetAddress}, ${profile.address.barangay}, ${profile.address.city}, ${profile.address.region}, ${profile.address.country}`],
			['Guardian', `${profile.guardian.name} (${profile.guardian.phone})`]
		].forEach(([label, value]) => document.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(String(value || '—')));
		document.moveDown(1).font('Helvetica-Bold').fontSize(11).fillColor('#800000').text('EXAMINATION SCHEDULE');
		document.moveDown(0.5).font('Helvetica').fontSize(10).fillColor('#222222');
		document.text(`Date: ${new Date(workflow.schedule.examDate).toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })}`);
		document.text(`Batch: ${workflow.schedule.batch.replace(/^batch_/, 'Batch ')}`);
		document.text(`Time: ${workflow.schedule.startTime} - ${workflow.schedule.endTime}`);
		document.text(`Facility: ${workflow.schedule.facilityId || 'To be assigned'}`);
		document.moveDown(1).fontSize(9).fillColor('#666666').text('This summary is for application reference and is not valid for taking the entrance examination until approved by the Admissions Department.', { align: 'justify' });
		document.end();
	} catch (error) {
		console.error('Application summary PDF failed:', error.message);
		if (!response.headersSent) response.status(500).json({ error: 'Could not generate the application summary.' });
	}
});

router.post('/application/submit', requireSameOrigin, requireAuthenticated, requireCompletedProfile, async (request, response) => {
	const profile = response.locals.studentProfile;
	const user = response.locals.authUser;
	const applicantId = profile.applicantId;
	const cycle = currentCycle();
	const existingApplication = await StudentApplication.findOne({ applicantId, cycle }).lean();
	if (existingApplication?.status === 'under_review' && existingApplication.admissionStatus === 'pending') {
		return response.status(200).json({ ok: true, applicationStatus: 'Pending', alreadySubmitted: true, redirectUrl: '/student/' });
	}
	const session = await mongoose.startSession();
	let submittedApplication;
	let schedule;

	try {
		await session.withTransaction(async () => {
			const application = await StudentApplication.findOne({ applicantId, cycle }).session(session);
			schedule = application?.scheduleId
				? await StudentSchedule.findById(application.scheduleId).session(session).lean()
				: await StudentSchedule.findOne({ applicantId, cycle, bookingStatus: { $in: ['reserved', 'confirmed'] } }).session(session).lean();
			const documents = await StudentDocument.find({ applicantId }).session(session).lean();
			const submittedTypes = new Set(documents
				.filter((document) => ['submitted', 'under_review', 'accepted'].includes(document.verificationStatus))
				.map((document) => document.documentType));

			if (!schedule || !REQUIRED_UPLOADS.every((type) => submittedTypes.has(type))) {
				const error = new Error('Complete the exam schedule and all required uploads before submitting.');
				error.status = 409;
				throw error;
			}
			if (!application || !['scheduled', 'documents_submitted'].includes(application.status)) {
				const error = new Error('This application has already been submitted or is not ready to submit.');
				error.status = 409;
				throw error;
			}

			application.status = 'under_review';
			application.admissionStatus = 'pending';
			application.approval = { status: 'pending', reviewedAt: null, reviewedByAdminId: null, reason: null };
			submittedApplication = await application.save({ session });
		});
	} catch (error) {
		if (error.status === 409) return response.status(409).json({ error: error.message });
		console.error('Student application submission failed:', error.message);
		return response.status(500).json({ error: 'Could not submit the application. Please try again.' });
	} finally {
		await session.endSession();
	}

	let emailSent = false;
	try {
		const examDate = new Date(schedule.examDate);
		const submittedAt = submittedApplication.updatedAt || new Date();
		const portalUrl = `${request.protocol}://${request.get('host')}/public/index.html?openLogin=true`;
		await sendApplicationSubmissionConfirmation({
			email: user.email,
			applicantId,
			lastName: profile.lastName,
			givenName: profile.givenName,
			submittedAt,
			schedule: {
				batch: schedule.batch.replace(/^batch_/, 'Batch '),
				date: examDate.toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' }),
				time: `${schedule.startTime} - ${schedule.endTime}`,
				facility: schedule.facilityId || 'To be assigned'
			},
			portalUrl
		});
		emailSent = true;
	} catch (error) {
		console.error('Application confirmation email could not be sent:', error.code || error.message);
	}

	request.app.get('io')?.to(`student:${user._id}`).emit('student:application-submitted', {
		applicantId,
		applicationStatus: 'Pending',
		progressPercent: 100
	});
	response.status(202).json({ ok: true, applicationStatus: 'Pending', emailSent, redirectUrl: '/student/' });
});

module.exports = router;