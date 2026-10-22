const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const path = require('node:path');
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

function receiveDocumentUpload(request, response, next) {
	upload.single('file')(request, response, (error) => {
		if (!error) return next();
		if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
			return response.status(413).json({ error: 'Each document must be 10 MB or smaller.' });
		}
		if (error instanceof multer.MulterError) {
			return response.status(400).json({ error: 'Could not receive this document. Choose one JPG or PNG file.' });
		}
		console.error('Document upload request failed:', error.message);
		return response.status(400).json({ error: 'Could not receive this document. Please try again.' });
	});
}

function currentCycle() {
	if (process.env.APPLICATION_CYCLE) return process.env.APPLICATION_CYCLE;
	const year = new Date().getFullYear();
	return `${year}-${year + 1}`;
}

function todayExamDateStart() {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
	}).formatToParts(new Date());
	const value = (type) => parts.find((part) => part.type === type).value;
	return new Date(`${value('year')}-${value('month')}-${value('day')}T00:00:00.000Z`);
}

async function syncStudentProgress(applicantId, progress, session) {
	const db = getDatabaseConnection('OEEMS_Student').db;
	await db.collection('student_progress').updateOne({ applicantId }, {
		$set: { ...progress, updatedAt: new Date() },
		$setOnInsert: { applicantId, createdAt: new Date() }
	}, { upsert: true, ...(session ? { session } : {}) });
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
		else if (documentCount < REQUIRED_UPLOADS.length || application?.status !== 'documents_submitted') nextStep = { number: 3, title: 'Upload Documents', href: 'uploadDocuments.html' };
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
		suffix: text(body.suffix, 24),
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
		const application = await StudentApplication.findOne({ applicantId: response.locals.studentProfile.applicantId }).lean();
		const requestedCycle = typeof request.query.cycle === 'string' && /^\d{4}-\d{4}$/.test(request.query.cycle)
			? request.query.cycle
			: null;
		const cycle = application?.cycle || requestedCycle || currentCycle();
		const schedules = await db.collection('schedule_slots').find({
			cycle,
			status: 'available',
			examDate: { $gte: todayExamDateStart() },
			batch: { $in: ['batch_1', 'batch_2', 'batch_3'] },
			$expr: { $lt: [{ $ifNull: ['$bookedCount', 0] }, '$capacity'] }
		}, {
			projection: { _id: 1, scheduleId: 1, cycle: 1, examDate: 1, batch: 1, startTime: 1, endTime: 1, facilityId: 1, capacity: 1, bookedCount: 1, status: 1 }
		}).sort({ examDate: 1, batch: 1 }).toArray();
		const availableSchedules = schedules.filter((schedule) => new Date(schedule.examDate).getUTCDay() !== 0);
		const months = [...new Set(availableSchedules.map((schedule) => {
			const date = new Date(schedule.examDate);
			return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
		}))];

		response.set('Cache-Control', 'no-store');
		response.json({ cycle, months, schedules: availableSchedules.map((schedule) => ({
			scheduleId: String(schedule.scheduleId),
			cycle: schedule.cycle,
			examDate: schedule.examDate,
			batch: schedule.batch,
			startTime: schedule.startTime || 'Not yet configured',
			endTime: schedule.endTime || 'Not yet configured',
			facilityId: schedule.facilityId || 'Not yet configured',
			remainingSeats: schedule.capacity - (schedule.bookedCount || 0)
		})) });
	} catch (error) {
		console.error('Available exam schedules could not be read:', error.message);
		response.status(500).json({ error: 'Could not load available exam schedules.' });
	}
});

router.post('/schedule/reschedule', requireSameOrigin, requireAuthenticated, requireCompletedProfile, async (request, response) => {
	const profile = response.locals.studentProfile;
	const applicantId = profile.applicantId;
	const session = await mongoose.startSession();
	try {
		let cycle;
		await session.withTransaction(async () => {
			const application = await StudentApplication.findOne({ applicantId }).session(session);
			if (!application || !['draft', 'scheduled', 'documents_submitted'].includes(application.status)) {
				const error = new Error('This application can no longer change its exam schedule.');
				error.status = 409;
				throw error;
			}
			cycle = application.cycle;
			const booking = await StudentSchedule.findOne({
				applicantId,
				cycle,
				bookingStatus: { $in: ['reserved', 'confirmed'] }
			}).session(session);
			if (!booking) {
				const error = new Error('No active exam schedule was found. Refresh and try again.');
				error.status = 409;
				throw error;
			}

			const admissionDb = getDatabaseConnection('OEEMS_Admission').db;
			await admissionDb.collection('schedule_slots').updateOne({
				scheduleId: booking.scheduleId,
				bookedCount: { $gt: 0 }
			}, { $inc: { bookedCount: -1 } }, { session });
			booking.bookingStatus = 'cancelled';
			booking.cancelledAt = new Date();
			await booking.save({ session });

			await StudentDocument.updateMany({ applicantId }, {
				$set: {
					verificationStatus: 'not_submitted',
					reviewedAt: null,
					reviewedByAdminId: null,
					rejectionReason: null
				}
			}, { session });
			application.status = 'draft';
			application.scheduleId = null;
			await application.save({ session });
			await syncStudentProgress(applicantId, {
				documentCount: 0,
				requiredDocumentCount: REQUIRED_UPLOADS.length,
				documentsComplete: false,
				currentStep: 2,
				nextStep: 'scheduleExam'
			}, session);
		});

		try {
			request.app.get('io')?.to(`student:${response.locals.authUser._id}`).emit('student:application-updated', { applicantId });
		} catch (error) {
			console.error('Student schedule notification failed:', error.message);
		}
		response.json({ ok: true, cycle, message: 'Schedule progress reset. Choose a new exam date and batch.' });
	} catch (error) {
		if (error.status === 409) return response.status(409).json({ error: error.message });
		console.error('Exam schedule reschedule reset failed:', error.message);
		response.status(500).json({ error: 'Could not reset your exam schedule. Please try again.' });
	} finally {
		await session.endSession();
	}
});

router.post('/schedule', requireSameOrigin, requireAuthenticated, requireCompletedProfile, async (request, response) => {
	const scheduleId = text(request.body?.scheduleId, 120);
	if (!scheduleId) return response.status(400).json({ error: 'Select an available exam schedule.' });

	const profile = response.locals.studentProfile;
	const applicantId = profile.applicantId;
	const session = await mongoose.startSession();
	let booking;
	try {
		await session.withTransaction(async () => {
			const application = await StudentApplication.findOne({ applicantId }).session(session);
			if (!application || !['draft', 'scheduled'].includes(application.status)) {
				const error = new Error('This application can no longer change its exam schedule.');
				error.status = 409;
				throw error;
			}
			const cycle = application.cycle;
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
				examDate: { $gte: todayExamDateStart() },
				batch: { $in: ['batch_1', 'batch_2', 'batch_3'] },
				$expr: { $lt: [{ $ifNull: ['$bookedCount', 0] }, '$capacity'] }
			}, { $inc: { bookedCount: 1 } }, {
				session,
				returnDocument: 'after',
				includeResultMetadata: false
			});
			if (!slot || !['batch_1', 'batch_2', 'batch_3'].includes(slot.batch) || new Date(slot.examDate).getUTCDay() === 0) {
				const error = new Error('That exam slot is no longer available. Refresh the schedule list and choose another slot.');
				error.status = 409;
				throw error;
			}

			const savedBooking = await StudentSchedule.findOneAndUpdate({ applicantId, cycle }, {
				$set: {
					scheduleId: String(slot.scheduleId),
					examDate: slot.examDate,
					batch: slot.batch,
					startTime: slot.startTime,
					endTime: slot.endTime,
					facilityId: slot.facilityId || null,
					bookingStatus: 'confirmed',
					bookedAt: new Date(),
					cancelledAt: null
				}
			}, {
				session,
				upsert: true,
				new: true,
				runValidators: true,
				setDefaultsOnInsert: true
			});
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

	response.status(201).json({ ok: true, schedule: booking, redirectUrl: '/student/uploadDocuments.html' });
	try {
		request.app.get('io')?.to(`student:${response.locals.authUser._id}`).emit('student:application-updated', { applicantId });
	} catch (error) {
		console.error('Student schedule notification failed:', error.message);
	}
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

router.post('/documents/re-edit', requireSameOrigin, requireAuthenticated, requireCompletedProfile, async (request, response) => {
	const applicantId = response.locals.studentProfile.applicantId;
	const session = await mongoose.startSession();
	try {
		await session.withTransaction(async () => {
			const application = await StudentApplication.findOne({ applicantId }).session(session);
			if (!application || !['scheduled', 'documents_submitted'].includes(application.status)) {
				const error = new Error('Documents cannot be edited at this application stage.');
				error.status = 409;
				throw error;
			}
			application.status = 'scheduled';
			await application.save({ session });
			const documents = await StudentDocument.find({
				applicantId,
				verificationStatus: { $in: ['submitted', 'under_review', 'accepted'] }
			}).session(session).select('documentType').lean();
			await syncStudentProgress(applicantId, {
				documentCount: new Set(documents.map((document) => document.documentType)).size,
				requiredDocumentCount: REQUIRED_UPLOADS.length,
				documentsComplete: false,
				currentStep: 3,
				nextStep: 'uploadDocuments'
			}, session);
		});
		response.json({ ok: true });
	} catch (error) {
		if (error.status === 409) return response.status(409).json({ error: error.message });
		console.error('Document re-edit authorization failed:', error.message);
		response.status(500).json({ error: 'Could not reopen document editing.' });
	} finally {
		await session.endSession();
	}
});

router.post('/documents/apply', requireSameOrigin, requireAuthenticated, requireCompletedProfile, async (request, response) => {
	const applicantId = response.locals.studentProfile.applicantId;
	const session = await mongoose.startSession();
	try {
		await session.withTransaction(async () => {
			const application = await StudentApplication.findOne({ applicantId }).session(session);
			if (!application || !['scheduled', 'documents_submitted'].includes(application.status)) {
				const error = new Error('Complete exam scheduling before applying documents.');
				error.status = 409;
				throw error;
			}
			const schedule = await StudentSchedule.findOne({
				_id: application.scheduleId,
				applicantId,
				bookingStatus: { $in: ['reserved', 'confirmed'] }
			}).session(session).select('_id').lean();
			if (!schedule) {
				const error = new Error('Your exam schedule is no longer active. Please schedule your exam again.');
				error.status = 409;
				throw error;
			}
			const documents = await StudentDocument.find({
				applicantId,
				documentType: { $in: REQUIRED_UPLOADS },
				verificationStatus: { $in: ['submitted', 'under_review', 'accepted'] }
			}).session(session).select('documentType').lean();
			const completedTypes = new Set(documents.map((document) => document.documentType));
			if (REQUIRED_UPLOADS.some((type) => !completedTypes.has(type))) {
				const error = new Error('Please upload all three required documents before applying.');
				error.status = 400;
				throw error;
			}
			application.status = 'documents_submitted';
			await application.save({ session });
			await syncStudentProgress(applicantId, {
				documentCount: REQUIRED_UPLOADS.length,
				requiredDocumentCount: REQUIRED_UPLOADS.length,
				documentsComplete: true,
				currentStep: 4,
				nextStep: 'applicationSummary'
			}, session);
		});
		response.json({ ok: true, redirectUrl: '/student/applicationSummary.html' });
	} catch (error) {
		if (error.status) return response.status(error.status).json({ error: error.message });
		console.error('Document application failed:', error.message);
		response.status(500).json({ error: 'Could not apply your documents. Please try again.' });
	} finally {
		await session.endSession();
	}
});

router.delete('/documents/:documentType', requireSameOrigin, requireAuthenticated, requireCompletedProfile, async (request, response) => {
	const { documentType } = request.params;
	if (!REQUIRED_UPLOADS.includes(documentType)) return response.status(400).json({ error: 'Unsupported document type.' });

	const applicantId = response.locals.studentProfile.applicantId;
	const session = await mongoose.startSession();
	let storageKey;
	try {
		await session.withTransaction(async () => {
			const application = await StudentApplication.findOne({ applicantId }).session(session);
			if (!application || application.status !== 'scheduled') {
				const error = new Error('Confirm document re-editing before removing saved files.');
				error.status = 409;
				throw error;
			}
			const document = await StudentDocument.findOne({ applicantId, documentType }).session(session);
			if (!document) {
				const error = new Error('This document is not currently uploaded.');
				error.status = 404;
				throw error;
			}
			storageKey = document.storageKey;
			await StudentDocument.deleteOne({ _id: document._id }, { session });
			const remainingDocuments = await StudentDocument.find({ applicantId })
				.session(session).select('documentType verificationStatus').lean();
			const completed = new Set(remainingDocuments
				.filter((item) => ['submitted', 'under_review', 'accepted'].includes(item.verificationStatus))
				.map((item) => item.documentType));
			await syncStudentProgress(applicantId, {
				documentCount: REQUIRED_UPLOADS.filter((type) => completed.has(type)).length,
				requiredDocumentCount: REQUIRED_UPLOADS.length,
				documentsComplete: false,
				currentStep: 3,
				nextStep: 'uploadDocuments'
			}, session);
		});
	} catch (error) {
		if (error.status) return response.status(error.status).json({ error: error.message });
		console.error('Student document removal failed:', error.message);
		return response.status(500).json({ error: 'Could not remove this document. Please try again.' });
	} finally {
		await session.endSession();
	}

	await deleteGridFsFile(storageKey);
	response.json({ ok: true, documentType });
});

router.post('/documents/:documentType', requireSameOrigin, requireAuthenticated, requireCompletedProfile, receiveDocumentUpload, async (request, response) => {
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
	if (!application || application.status !== 'scheduled') {
		return response.status(409).json({ error: 'Complete exam scheduling before uploading documents.' });
	}

	let storageKey;
	let previousStorageKey;
	const session = await mongoose.startSession();
	try {
		storageKey = await saveGridFsFile(file, { applicantId, documentType });
		await session.withTransaction(async () => {
			const currentApplication = await StudentApplication.findOne({ applicantId }).session(session);
			if (!currentApplication || currentApplication.status !== 'scheduled') {
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
			await syncStudentProgress(applicantId, {
				documentCount: REQUIRED_UPLOADS.filter((type) => completed.has(type)).length,
				requiredDocumentCount: REQUIRED_UPLOADS.length,
				documentsComplete: false,
				currentStep: 3,
				nextStep: 'uploadDocuments'
			}, session);
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
	response.status(201).json({ ok: true, documentType, originalName: path.basename(file.originalname).slice(0, 180) });
	try {
		request.app.get('io')?.to(`student:${response.locals.authUser._id}`).emit('student:application-updated', { applicantId });
	} catch (error) {
		console.error('Student document notification failed:', error.message);
	}
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
			'Content-Disposition': `${request.query.download === '1' ? 'attachment' : 'inline'}; filename="${profile.applicantId}-application-summary.pdf"`,
			'Cache-Control': 'no-store'
		});
		const document = new PDFDocument({ size: 'A4', margin: 52, info: { Title: 'OEEMS Application Summary' } });
		document.pipe(response);
		const fullName = [profile.givenName, profile.middleName, profile.lastName, profile.suffix].filter(Boolean).join(' ');
		const address = profile.address || {};
		const section = (title) => {
			document.moveDown(1).font('Helvetica-Bold').fontSize(11).fillColor('#800000').text(title);
			document.moveDown(0.35).moveTo(52, document.y).lineTo(543, document.y).strokeColor('#555555').lineWidth(0.7).stroke();
			document.moveDown(0.5).font('Helvetica').fontSize(10).fillColor('#111111');
		};
		const detail = (label, value) => document.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(String(value || '—'));

		document.font('Helvetica-Bold').fontSize(17).fillColor('#800000').text('GLOBAL RECIPROCAL COLLEGES', { align: 'center' });
		document.moveDown(0.35).font('Helvetica').fontSize(13).fillColor('#222222').text('Application Summary', { align: 'center' });
		document.moveDown(1.6);
		detail('Application ID', profile.applicantId);
		section('APPLICANT INFORMATION');
		detail('Name', fullName);
		detail('Last Name', profile.lastName);
		detail('Given Name', profile.givenName);
		detail('Middle Name', profile.middleName || 'N/A');
		detail('Suffix', profile.suffix || 'N/A');
		section('ADDRESS');
		detail('Country', address.country);
		detail('Region', address.region);
		detail('City / Municipality', address.city);
		detail('Barangay', address.barangay);
		detail('Home Address', address.streetAddress || address.street);
		section('EXAM SCHEDULE');
		detail('Date', new Date(workflow.schedule.examDate).toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' }));
		detail('Batch', workflow.schedule.batch.replace(/^batch_/, 'Batch '));
		detail('Time', `${workflow.schedule.startTime} - ${workflow.schedule.endTime}`);
		section('APPLICANT CONTACT INFORMATION');
		detail('Mobile Number', profile.phone);
		detail('Email Address', response.locals.authUser.email);
		document.moveDown(1.4).fontSize(9).fillColor('#666666').text('This summary is for review. Your application remains subject to verification by the Admission Office.', { align: 'justify' });
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
	const cycle = (await StudentApplication.findOne({ applicantId }).select('cycle').lean())?.cycle || currentCycle();
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

			const admissionDb = getDatabaseConnection('OEEMS_Admission').db;
			const submittedAt = submittedApplication.updatedAt || new Date();
			const fullName = [profile.lastName, profile.givenName, profile.middleName, profile.suffix].filter(Boolean).join(' ');
			const admissionApplication = {
				applicantId,
				studentId: profile.studentId,
				name: fullName,
				email: user.email,
				phone: profile.phone,
				cycle,
				status: 'pending',
				submittedAt,
				profile: {
					lastName: profile.lastName,
					givenName: profile.givenName,
					middleName: profile.middleName || '',
					suffix: profile.suffix || '',
					address: profile.address
				},
				schedule: {
					scheduleId: schedule.scheduleId,
					examDate: schedule.examDate,
					batch: schedule.batch,
					startTime: schedule.startTime,
					endTime: schedule.endTime,
					facilityId: schedule.facilityId || null
				},
				updatedAt: new Date()
			};
			await admissionDb.collection('applications').updateOne({ applicantId }, {
				$set: admissionApplication,
				$setOnInsert: { createdAt: new Date() }
			}, { upsert: true, session });

			for (const document of documents) {
				await admissionDb.collection('document_reviews').updateOne({ applicantId, documentType: document.documentType }, {
					$set: {
						studentId: profile.studentId,
						documentId: document._id,
						originalName: document.originalName || null,
						storageKey: document.storageKey || null,
						contentType: document.contentType || null,
						verificationStatus: document.verificationStatus,
						reviewStatus: 'pending',
						reviewedAt: null,
						reviewedByAdminId: null,
						updatedAt: new Date()
					},
					$setOnInsert: { applicantId, documentType: document.documentType, createdAt: new Date() }
				}, { upsert: true, session });
			}
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
			middleName: profile.middleName,
			suffix: profile.suffix,
			submittedAt,
			targetAcademicYear: cycle,
			schedule: {
				batch: schedule.batch.replace(/^batch_/, 'Batch '),
				date: examDate.toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' }),
				time: `${schedule.startTime} - ${schedule.endTime}`,
				facility: schedule.facilityId || 'To be assigned'
			},
			portalUrl,
			admissionEmail: process.env.ADMISSION_EMAIL || 'admissions@grc.edu.ph',
			contactNumber: process.env.ADMISSION_CONTACT_NUMBER || '09123456789'
		});
		emailSent = true;
	} catch (error) {
		console.error('Application confirmation email could not be sent:', error.code || error.message);
	}

	response.status(202).json({ ok: true, applicationStatus: 'Pending', emailSent, redirectUrl: '/student/' });
	try {
		request.app.get('io')?.to(`student:${user._id}`).emit('student:application-submitted', {
			applicantId,
			applicationStatus: 'Pending',
			progressPercent: 100
		});
	} catch (error) {
		console.error('Student submission notification failed:', error.message);
	}
});

module.exports = router;