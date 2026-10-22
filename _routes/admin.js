const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const path = require('node:path');
const crypto = require('node:crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const StudentApplication = require('../_models/StudentApplication');
const { getDatabaseConnection } = require('../_scripts/mongodb_connection');
const { requireSameOrigin } = require('../_middleware/sameOrigin');
const { requireAdmin } = require('../_middleware/adminAccess');
const { verifyPassword } = require('../_scripts/authSecurity');
const { sendAdmissionDecision } = require('../_scripts/nodeEmailer');

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

function saveSession(request) {
	return new Promise((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()));
}

router.post('/auth/login', requireSameOrigin, loginLimiter, async (request, response) => {
	const login = typeof request.body.login === 'string' ? request.body.login.trim() : '';
	const password = typeof request.body.password === 'string' ? request.body.password : '';
	if (!login || !password || login.length > 254 || password.length > 128) {
		return response.status(400).json({ error: 'Enter your Admission email or admin ID and password.' });
	}

	try {
		const db = getDatabaseConnection('OEEMS_Admission').db;
		const admin = await db.collection('admin_users').findOne({
			$or: [{ adminId: login }, { email: login.toLowerCase() }],
			status: 'active'
		});
		if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
			return response.status(401).json({ error: 'Invalid administrator credentials.' });
		}

		const studentSession = request.session.user;
		await new Promise((resolve, reject) => request.session.regenerate((error) => error ? reject(error) : resolve()));
		request.session.admin = { id: admin._id.toString(), adminId: admin.adminId, role: admin.role };
		if (studentSession) request.session.user = studentSession;
		await saveSession(request);
		await db.collection('admin_users').updateOne({ _id: admin._id }, { $set: { lastLoginAt: new Date() } });
		await db.collection('admin_audit_logs').insertOne({
			adminId: admin.adminId,
			action: 'admin_login',
			resourceType: 'admin_session',
			resourceId: admin._id.toString(),
			details: {},
			ipAddress: request.ip || null,
			userAgent: request.get('user-agent') || null,
			createdAt: new Date()
		});
		response.json({ ok: true, redirectUrl: '/admission/adminSchedules.html' });
	} catch (error) {
		console.error('Admission login failed:', error.message);
		response.status(500).json({ error: 'Could not sign in to the Admission portal.' });
	}
});

router.post('/auth/logout', requireSameOrigin, requireAdmin, (request, response, next) => {
	delete request.session.admin;
	if (request.session.user) {
		request.session.save((error) => {
			if (error) return next(error);
			response.json({ ok: true, redirectUrl: '/student/' });
		});
		return;
	}
	request.session.destroy((error) => {
		if (error) return next(error);
		response.clearCookie(process.env.SESSION_COOKIE_NAME || 'connect.sid', { path: '/' });
		response.json({ ok: true, redirectUrl: '/admission/adminLoginPage.html' });
	});
});

router.get('/questionnaire/config', requireAdmin, async (request, response) => {
	try {
		const admissionDb = getDatabaseConnection('OEEMS_Admission').db;
		const configuration = await admissionDb.collection('questionnaire_questions').findOne({ documentType: 'questionnaire_configuration' });
		response.set('Cache-Control', 'no-store');
		response.json({ configuration: configuration?.configuration || { categories: ['Logical reasoning', 'Abstract', 'Filipino', 'English', 'Math'], questionsByCategory: {} } });
	} catch (error) {
		console.error('Questionnaire configuration read failed:', error.message);
		response.status(500).json({ error: 'Could not load questionnaire configuration.' });
	}
});

router.put('/questionnaire/config', requireSameOrigin, requireAdmin, async (request, response) => {
	const configuration = request.body?.configuration;
	if (!configuration || !Array.isArray(configuration.categories) || !configuration.questionsByCategory || typeof configuration.questionsByCategory !== 'object') {
		return response.status(400).json({ error: 'Provide a valid questionnaire JSON configuration.' });
	}
	try {
		const admissionDb = getDatabaseConnection('OEEMS_Admission').db;
		const categories = configuration.categories.map((name, index) => ({ categoryId: String(name).trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase(), name: String(name).trim(), order: index })).filter((category) => category.name);
		const now = new Date();
		await admissionDb.collection('questionnaire_questions').updateOne({ documentType: 'questionnaire_configuration' }, {
			$set: { configuration, version: String(now.getTime()), updatedAt: now, updatedByAdminId: response.locals.authAdmin.adminId },
			$setOnInsert: { createdAt: now }
		}, { upsert: true });
		await admissionDb.collection('questionnaire_categories').deleteMany({});
		if (categories.length) await admissionDb.collection('questionnaire_categories').insertMany(categories.map((category) => ({ ...category, status: 'active', updatedAt: now })));
		await admissionDb.collection('exam_versions').updateOne({ active: true }, { $set: { active: false, updatedAt: now } }, { upsert: false });
		await admissionDb.collection('exam_versions').insertOne({ version: String(now.getTime()), configurationVersion: String(now.getTime()), active: true, durationMinutes: 3, createdAt: now, createdByAdminId: response.locals.authAdmin.adminId });
		response.json({ ok: true, version: String(now.getTime()) });
	} catch (error) {
		console.error('Questionnaire configuration save failed:', error.message);
		response.status(500).json({ error: 'Could not save questionnaire configuration.' });
	}
});

router.get('/auth/me', requireAdmin, (request, response) => {
	const admin = response.locals.authAdmin;
	response.json({ adminId: admin.adminId, email: admin.email, name: admin.name, role: admin.role });
});

// Future hook for the Facilitator Access verification module.
router.get('/facilitator/status', requireAdmin, (request, response) => {
	response.json({ available: false, module: 'facilitator-access', mode: 'pending-integration' });
});

router.get('/applications', requireAdmin, async (request, response) => {
	try {
		const admissionDb = getDatabaseConnection('OEEMS_Admission').db;
		const requestedStatus = ['approved', 'rejected', 'declined'].includes(request.query.status)
			? (request.query.status === 'rejected' ? 'declined' : request.query.status)
			: null;
		const query = requestedStatus
			? { status: requestedStatus }
			: request.query.queue === 'restored'
				? { status: 'pending', restoredAt: { $exists: true } }
				: { status: 'pending', restoredAt: { $exists: false } };
		const applications = await admissionDb.collection('applications').find(query)
			.sort({ submittedAt: -1, createdAt: -1 }).toArray();
		response.set('Cache-Control', 'no-store');
		response.json({ applications: applications.map((application) => ({
			applicantId: application.applicantId,
			name: application.name || [application.profile?.lastName, application.profile?.givenName, application.profile?.middleName, application.profile?.suffix].filter(Boolean).join(' '),
			submittedAt: application.submittedAt || application.createdAt,
			status: application.status,
			restoredAt: application.restoredAt || null,
			documents: application.documentTypes || ['form138', 'picture_2x2', 'good_moral']
		})) });
	} catch (error) {
		console.error('Admission applications list failed:', error.message);
		response.status(500).json({ error: 'Could not load submitted applications.' });
	}
});

router.get('/applications/activity-log', requireAdmin, async (request, response) => {
	try {
		const admissionDb = getDatabaseConnection('OEEMS_Admission').db;
		const entries = await admissionDb.collection('application_reviews').find({}).sort({ createdAt: -1 }).toArray();
		response.set('Cache-Control', 'no-store');
		response.json({ entries: entries.map((entry) => ({
			applicantId: entry.applicantId,
			applicationId: entry.applicationId?.toString() || null,
			adminId: entry.adminId || '—',
			adminName: entry.adminName || null,
			action: entry.action,
			fromStatus: entry.fromStatus || null,
			toStatus: entry.toStatus || null,
			createdAt: entry.createdAt,
			details: entry.details || {}
		})) });
	} catch (error) {
		console.error('Application activity log read failed:', error.message);
		response.status(500).json({ error: 'Could not load the application activity log.' });
	}
});

router.get('/applications/:applicantId/summary', requireAdmin, async (request, response) => {
	const applicantId = request.params.applicantId.trim();
	try {
		const admissionDb = getDatabaseConnection('OEEMS_Admission').db;
		const studentDb = getDatabaseConnection('OEEMS_Student').db;
		const application = await admissionDb.collection('applications').findOne({ applicantId });
		if (!application) return response.status(404).json({ error: 'Application not found.' });
		const [profile, schedule, user] = await Promise.all([
			studentDb.collection('student_profiles').findOne({ applicantId }),
			studentDb.collection('student_schedules').findOne({ applicantId, bookingStatus: { $in: ['reserved', 'confirmed'] } }),
			studentDb.collection('users').findOne({ applicantId }, { projection: { email: 1 } })
		]);
		response.set('Cache-Control', 'no-store');
		response.json({
			applicantId,
			name: application.name || [profile?.lastName, profile?.givenName, profile?.middleName, profile?.suffix].filter(Boolean).join(' '),
			email: application.email || user?.email || '',
			profile: application.profile || profile || {},
			schedule: application.schedule || schedule || null,
			submittedAt: application.submittedAt || application.createdAt,
			status: application.status
		});
	} catch (error) {
		console.error('Admission application summary read failed:', error.message);
		response.status(500).json({ error: 'Could not load the application summary.' });
	}
});

router.get('/applications/:applicantId/documents/:documentType', requireAdmin, async (request, response) => {
	const applicantId = request.params.applicantId.trim();
	const documentType = request.params.documentType;
	const allowedDocuments = new Set(['form138', 'picture_2x2', 'good_moral']);
	if (!allowedDocuments.has(documentType)) return response.status(404).end();
	try {
		const studentDb = getDatabaseConnection('OEEMS_Student').db;
		const uploaded = await studentDb.collection('student_documents').findOne({
			applicantId,
			documentType,
			verificationStatus: { $in: ['submitted', 'under_review', 'accepted', 'rejected'] }
		}, { projection: { storageKey: 1, contentType: 1, originalName: 1 } });
		if (!uploaded?.storageKey || !mongoose.isValidObjectId(uploaded.storageKey) || !['image/jpeg', 'image/png'].includes(uploaded.contentType)) {
			return response.status(404).json({ error: 'No uploaded preview is available for this document.' });
		}
		response.set({
			'Content-Type': uploaded.contentType,
			'Content-Disposition': `inline; filename="${path.basename(uploaded.originalName || 'document')}"`,
			'Cache-Control': 'no-store, private',
			'X-Content-Type-Options': 'nosniff'
		});
		const bucket = new mongoose.mongo.GridFSBucket(studentDb, { bucketName: 'student_uploads' });
		const stream = bucket.openDownloadStream(new mongoose.Types.ObjectId(uploaded.storageKey));
		stream.once('error', () => {
			if (!response.headersSent) response.status(404).end();
		});
		stream.pipe(response);
	} catch (error) {
		console.error('Admission document preview failed:', error.message);
		if (!response.headersSent) response.status(500).json({ error: 'Could not load this document preview.' });
	}
});

async function createStatementPermit(application, profile, schedule, applicationNumber) {
	const address = profile?.address || application.profile?.address || {};
	const fullAddress = [address.streetAddress || address.street, address.barangay, address.city, address.region, address.country].filter(Boolean).join(', ') || 'Not provided';
	const fullName = [profile?.givenName || application.profile?.givenName, profile?.middleName || application.profile?.middleName, profile?.lastName || application.profile?.lastName, profile?.suffix || application.profile?.suffix].filter(Boolean).join(' ') || application.name || 'Not provided';
	const statementInformation = {
		applicationCode: applicationNumber,
		applicantId: application.applicantId,
		name: fullName,
		address: fullAddress,
		contactNumber: profile?.phone || application.profile?.phone || '',
		email: application.email || profile?.email || '',
		examDate: schedule?.examDate || null,
		examBatch: schedule?.batch || null,
		examTime: schedule?.startTime && schedule?.endTime ? `${schedule.startTime} - ${schedule.endTime}` : null
	};
	const qrImage = await QRCode.toDataURL(JSON.stringify(statementInformation), { errorCorrectionLevel: 'H', margin: 1, width: 432 });
	return await new Promise((resolve, reject) => {
		const document = new PDFDocument({ size: 'A4', margin: 50 });
		const chunks = [];
		document.on('data', (chunk) => chunks.push(chunk));
		document.on('end', () => resolve(Buffer.concat(chunks)));
		document.on('error', reject);

		document.fontSize(18).fillColor('#800000').text('GLOBAL RECIPROCAL COLLEGES', { align: 'center' });
		document.moveDown(0.2);
		document.fontSize(13).fillColor('#333333').text('Statement of Application', { align: 'center' });
		document.moveDown(1);

		const qrSize = 216;
		const qrX = (document.page.width - qrSize) / 2;
		document.image(qrImage, qrX, document.y, { width: qrSize, height: qrSize });
		document.y += qrSize + 12;

		document.fontSize(10).fillColor('#111111');
		document.text(`Application Code: ${applicationNumber}`, { align: 'center' });
		document.moveDown(1);
		document.fontSize(9).text('Present your Statement of Account (Hardcopy/Softcopy) or QR Code, along with your official Payment slip from the Cashier, to the Examination Facilitator for application code verification.', { align: 'justify' });
		document.moveDown(1.2);

		function section(title, rows) {
			document.fontSize(12).fillColor('#800000').text(title, { underline: true });
			document.moveDown(0.35);
			document.fillColor('#111111').fontSize(10);
			for (const [label, value] of rows) {
				document.text(label, 50, document.y, { continued: true });
				document.text(`  ${value || 'Not provided'}`, { align: 'left' });
			}
			document.moveDown(0.8);
		}

		section('APPLICATION INFORMATION', [
			['Applicant ID:', applicationNumber],
			['Exam Date:', schedule?.examDate ? new Date(schedule.examDate).toLocaleDateString('en-PH') : 'To be assigned'],
			['Exam Batch:', schedule?.batch ? String(schedule.batch).replace(/^batch_/, 'Batch ') : 'To be assigned'],
			['Exam Time:', schedule?.startTime && schedule?.endTime ? `${schedule.startTime} - ${schedule.endTime}` : 'To be assigned']
		]);
		section('APPLICANT INFORMATION', [
			['Name:', fullName],
			['Address:', fullAddress],
			['Contact Number:', profile?.phone || application.profile?.phone || 'Not provided'],
			['Email:', application.email || profile?.email || 'Not provided']
		]);
		document.end();
	});
}

router.put('/applications/:applicantId/review', requireSameOrigin, requireAdmin, async (request, response) => {
	const applicantId = request.params.applicantId.trim();
	const decision = request.body?.decision;
	const rejectionCause = typeof request.body?.rejectionCause === 'string' ? request.body.rejectionCause.trim() : '';
	const rejectionMessage = typeof request.body?.rejectionMessage === 'string' ? request.body.rejectionMessage.trim().slice(0, 1000) : '';
	const allowedRejectionCauses = new Set([
		'Incomplete or Missing Required Documents', 'Blurred or Illegible', 'Failure to Meet Academic Prerequisites',
		'Altered or Modified Documents', 'Unprofessional Use', 'Others'
	]);
	if (!applicantId || !['approve', 'reject'].includes(decision)) {
		return response.status(400).json({ error: 'Choose approve or reject.' });
	}
	if (decision === 'reject' && !allowedRejectionCauses.has(rejectionCause)) {
		return response.status(400).json({ error: 'Select a valid rejection cause.' });
	}
	if (decision === 'reject' && rejectionCause === 'Others' && !rejectionMessage) {
		return response.status(400).json({ error: 'Enter a personalized rejection message.' });
	}
	const admissionDb = getDatabaseConnection('OEEMS_Admission').db;
	const studentDb = getDatabaseConnection('OEEMS_Student').db;
	const session = mongoose.connection.getClient().startSession();
	const reviewedAt = new Date();
	const nextStatus = decision === 'approve' ? 'approved' : 'declined';
	let emailContext = null;
	try {
		await session.withTransaction(async () => {
			const application = await admissionDb.collection('applications').findOne({ applicantId, status: 'pending' }, { session });
			if (!application) {
				const error = new Error('This application is no longer pending review. Refresh the table.');
				error.status = 409;
				throw error;
			}
			const applicationNumber = decision === 'approve'
				? (application.applicationNumber || `APP2026${crypto.randomInt(100000, 1000000)}`)
				: null;
			await admissionDb.collection('applications').updateOne({ _id: application._id, status: 'pending' }, {
				$set: {
					status: nextStatus,
					admissionStatus: nextStatus,
					reviewedAt,
					reviewedByAdminId: response.locals.authAdmin.adminId,
					updatedAt: reviewedAt,
					...(applicationNumber ? { applicationNumber } : {})
				}
			}, { session });
			await admissionDb.collection('document_reviews').updateMany({ applicantId }, {
				$set: { reviewStatus: nextStatus, reviewedAt, reviewedByAdminId: response.locals.authAdmin.adminId, updatedAt: reviewedAt }
			}, { session });

			const studentApplicationStatus = decision === 'approve' ? 'approved' : 'declined';
			const studentWorkflowStatus = decision === 'approve' ? 'approved' : 'draft';
			const studentUpdate = await StudentApplication.updateOne({ applicantId, status: 'under_review' }, {
				$set: {
					status: studentWorkflowStatus,
					admissionStatus: studentApplicationStatus,
					approval: {
						status: studentApplicationStatus,
						reviewedAt,
						reviewedByAdminId: response.locals.authAdmin.adminId,
						reason: decision === 'reject' ? (rejectionMessage || rejectionCause) : null
					},
					admissionApplicationId: application._id.toString(),
					...(decision === 'reject' ? { scheduleId: null, documentSubmissionId: null } : {})
				}
			}, { session, runValidators: true });
			if (studentUpdate.matchedCount !== 1) {
				const error = new Error('Student application is no longer pending review.');
				error.status = 409;
				throw error;
			}

			await studentDb.collection('student_documents').updateMany({ applicantId }, {
				$set: {
					verificationStatus: decision === 'approve' ? 'accepted' : 'submitted',
					reviewedAt,
					reviewedByAdminId: response.locals.authAdmin.adminId,
					...(decision === 'reject' ? { rejectionReason: rejectionMessage || rejectionCause } : {})
				}
			}, { session });
			if (decision === 'reject') {
				await studentDb.collection('student_schedules').updateMany({ applicantId, bookingStatus: { $in: ['reserved', 'confirmed'] } }, {
					$set: { bookingStatus: 'cancelled', cancelledAt: reviewedAt, updatedAt: reviewedAt }
				}, { session });
			}
			await studentDb.collection('student_notifications').insertOne({
				applicantId,
				type: decision === 'approve' ? 'application_approved' : 'application_rejected',
				title: decision === 'approve' ? 'Application Approved' : 'Application Requires Revision',
				message: decision === 'approve'
					? 'Your application was approved. Your Statement of Application is being sent to your email.'
					: `Your application was declined. Cause: ${rejectionMessage || rejectionCause}. Please restart at Schedule Exam.`,
				read: false,
				createdAt: reviewedAt,
				updatedAt: reviewedAt
			}, { session });
			await admissionDb.collection('application_reviews').insertOne({
				applicantId,
				applicationId: application._id,
				adminId: response.locals.authAdmin.adminId,
				adminName: response.locals.authAdmin.name || null,
				action: decision,
				fromStatus: 'pending',
				toStatus: nextStatus,
				createdAt: reviewedAt,
				details: decision === 'reject' ? { rejectionCause, rejectionMessage: rejectionMessage || null } : { applicationNumber }
			}, { session });
			await admissionDb.collection('admin_audit_logs').insertOne({
				adminId: response.locals.authAdmin.adminId,
				action: `application_${decision}d`,
				resourceType: 'application',
				resourceId: applicantId,
				details: { decision },
				ipAddress: request.ip || null,
				userAgent: request.get('user-agent') || null,
				createdAt: reviewedAt
			}, { session });
		});
		let emailContext;
		try {
			const [profile, schedule, user] = await Promise.all([
				studentDb.collection('student_profiles').findOne({ applicantId }),
				studentDb.collection('student_schedules').findOne({ applicantId, bookingStatus: { $in: ['reserved', 'confirmed'] } }),
				studentDb.collection('users').findOne({ applicantId }, { projection: { email: 1 } })
			]);
			const application = await admissionDb.collection('applications').findOne({ applicantId });
			const applicantName = application?.name || [profile?.lastName, profile?.givenName, profile?.middleName, profile?.suffix].filter(Boolean).join(' ');
			const email = application?.email || user?.email || '';
			const applicationNumber = application?.applicationNumber || null;
			let pdfBuffer = null;
			if (decision === 'approve' && applicationNumber) pdfBuffer = await createStatementPermit(application, profile, schedule || application.schedule, applicationNumber);
			await sendAdmissionDecision({ email, applicantName, decision: nextStatus, applicantId, applicationNumber, rejectionCause, rejectionMessage, pdfBuffer });
		} catch (emailError) {
			console.error('Admission decision email failed:', emailError.message);
		}
		response.json({ ok: true, applicantId, status: nextStatus });
		request.app.get('io')?.emit('admission:application-reviewed', { applicantId, status: nextStatus });
	} catch (error) {
		if (error.status) return response.status(error.status).json({ error: error.message });
		console.error('Admission application review failed:', error.message);
		response.status(500).json({ error: 'Could not update the application review.' });
	} finally {
		await session.endSession();
	}
});

router.put('/applications/:applicantId/restore', requireSameOrigin, requireAdmin, async (request, response) => {
	const applicantId = request.params.applicantId.trim();
	const admissionDb = getDatabaseConnection('OEEMS_Admission').db;
	const studentDb = getDatabaseConnection('OEEMS_Student').db;
	const session = mongoose.connection.getClient().startSession();
	const restoredAt = new Date();
	try {
		await session.withTransaction(async () => {
			const application = await admissionDb.collection('applications').findOne({
				applicantId,
				status: { $in: ['approved', 'declined'] }
			}, { session });
			if (!application) {
				const error = new Error('This application cannot be restored. Refresh the activity list.');
				error.status = 409;
				throw error;
			}
			const previousStatus = application.status;
			await admissionDb.collection('applications').updateOne({ _id: application._id, status: previousStatus }, {
				$set: {
					status: 'pending',
					restoredAt,
					restoredByAdminId: response.locals.authAdmin.adminId,
					updatedAt: restoredAt
				}
			}, { session });
			const studentUpdate = await StudentApplication.updateOne({ applicantId, status: { $in: ['approved', 'declined'] } }, {
				$set: {
					status: 'under_review',
					admissionStatus: 'pending',
					approval: { status: 'pending', reviewedAt: null, reviewedByAdminId: null, reason: null }
				}
			}, { session, runValidators: true });
			if (studentUpdate.matchedCount !== 1) {
				const error = new Error('Student application is no longer eligible for restoration.');
				error.status = 409;
				throw error;
			}
			await admissionDb.collection('document_reviews').updateMany({ applicantId }, {
				$set: { reviewStatus: 'pending', reviewedAt: null, reviewedByAdminId: null, updatedAt: restoredAt }
			}, { session });
			await studentDb.collection('student_documents').updateMany({ applicantId }, {
				$set: { verificationStatus: 'under_review', reviewedAt: null, reviewedByAdminId: null, rejectionReason: null }
			}, { session });
			await admissionDb.collection('application_reviews').insertOne({
				applicantId,
				applicationId: application._id,
				adminId: response.locals.authAdmin.adminId,
				adminName: response.locals.authAdmin.name || null,
				action: 'restore',
				fromStatus: previousStatus,
				toStatus: 'pending',
				createdAt: restoredAt,
				details: {}
			}, { session });
			await admissionDb.collection('admin_audit_logs').insertOne({
				adminId: response.locals.authAdmin.adminId,
				action: 'application_restored',
				resourceType: 'application',
				resourceId: applicantId,
				details: { fromStatus: previousStatus, toStatus: 'pending' },
				ipAddress: request.ip || null,
				userAgent: request.get('user-agent') || null,
				createdAt: restoredAt
			}, { session });
		});
		response.json({ ok: true, applicantId, status: 'pending', restoredAt });
		request.app.get('io')?.emit('admission:application-restored', { applicantId });
	} catch (error) {
		if (error.status) return response.status(error.status).json({ error: error.message });
		console.error('Application restore failed:', error.message);
		response.status(500).json({ error: 'Could not restore the application.' });
	} finally {
		await session.endSession();
	}
});

function getMonthWindow(year, month) {
	const start = new Date(Date.UTC(year, month - 1, 1));
	const end = new Date(Date.UTC(year, month, 1));
	return { start, end };
}

router.get('/schedules/config', requireAdmin, async (request, response) => {
	const year = Number(request.query.year) || new Date().getFullYear();
	const month = Number(request.query.month) || new Date().getMonth() + 1;
	if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
		return response.status(400).json({ error: 'Choose a valid calendar month and year.' });
	}

	try {
		const db = getDatabaseConnection('OEEMS_Admission').db;
		const { start, end } = getMonthWindow(year, month);
		const [facilities, computers, slots] = await Promise.all([
			db.collection('facilities').find({}).sort({ facilityId: 1 }).toArray(),
			db.collection('facility_computers').find({}).sort({ facilityId: 1, computerNumber: 1 }).toArray(),
			db.collection('schedule_slots').find({ examDate: { $gte: start, $lt: end } }).sort({ examDate: 1, batch: 1, facilityId: 1 }).toArray()
		]);
		const byFacility = new Map();
		computers.forEach((computer) => {
			if (!byFacility.has(computer.facilityId)) byFacility.set(computer.facilityId, []);
			byFacility.get(computer.facilityId).push({ computerNumber: computer.computerNumber, computerName: computer.computerName || null, status: computer.status });
		});
		response.set('Cache-Control', 'no-store');
		response.json({
			year,
			month,
			cycle: `${year}-${year + 1}`,
			facilities: facilities.map((facility) => ({
				facilityId: facility.facilityId,
				name: facility.name || 'Not yet configured',
				building: facility.building || 'Not yet configured',
				floor: facility.floor || 'Not yet configured',
				capacity: Number.isFinite(facility.capacity) ? facility.capacity : null,
				status: facility.status || 'Not yet configured',
				computers: byFacility.get(facility.facilityId) || []
			})),
			computers,
			slots: slots.map((slot) => ({
				scheduleId: slot.scheduleId || 'Not yet configured',
				cycle: slot.cycle || 'Not yet configured',
				examDate: slot.examDate,
				batch: slot.batch || 'Not yet configured',
				startTime: slot.startTime || 'Not yet configured',
				endTime: slot.endTime || 'Not yet configured',
				facilityId: slot.facilityId || 'Not yet configured',
				capacity: Number.isFinite(slot.capacity) ? slot.capacity : null,
				bookedCount: Number.isFinite(slot.bookedCount) ? slot.bookedCount : 0,
				status: slot.status || 'unavailable'
			}))
		});
	} catch (error) {
		console.error('Admission schedule configuration read failed:', error.message);
		response.status(500).json({ error: 'Could not load schedule configuration.' });
	}
});

router.post('/facilities', requireSameOrigin, requireAdmin, async (request, response) => {
	const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
	const computerCount = Number(request.body?.computerCount);
	if (!name || name.length > 80 || !Number.isInteger(computerCount) || computerCount < 0 || computerCount > 200) {
		return response.status(400).json({ error: 'Enter a facility name and a PC count from 0 to 200.' });
	}

	const db = getDatabaseConnection('OEEMS_Admission').db;
	const baseId = name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'FACILITY';
	let facilityId = baseId;
	for (let suffix = 2; await db.collection('facilities').findOne({ facilityId }); suffix += 1) {
		facilityId = `${baseId.slice(0, 58)}-${suffix}`;
	}
	const now = new Date();
	const facility = { facilityId, name, status: 'active', capacity: computerCount, createdAt: now, updatedAt: now };
	const session = mongoose.connection.getClient().startSession();
	try {
		await session.withTransaction(async () => {
			await db.collection('facilities').insertOne(facility, { session });
			if (computerCount) {
				await db.collection('facility_computers').insertMany(Array.from({ length: computerCount }, (_, index) => ({
					facilityId,
					computerNumber: index + 1,
					status: 'working',
					lastUpdatedByAdminId: response.locals.authAdmin.adminId,
					lastUpdatedAt: now
				})), { session });
			}
			await db.collection('admin_audit_logs').insertOne({
				adminId: response.locals.authAdmin.adminId,
				action: 'facility_created',
				resourceType: 'facility',
				resourceId: facilityId,
				details: { name, computerCount },
				ipAddress: request.ip || null,
				userAgent: request.get('user-agent') || null,
				createdAt: now
			}, { session });
		});
		response.status(201).json({ ok: true, facility: { ...facility, computers: Array.from({ length: computerCount }, (_, index) => ({ computerNumber: index + 1, computerName: null, status: 'working' })) } });
		request.app.get('io')?.emit('admission:facilities-updated', { facilityId });
	} catch (error) {
		console.error('Facility creation failed:', error.message);
		response.status(500).json({ error: 'Could not create the facility.' });
	} finally {
		await session.endSession();
	}
});

router.put('/facilities/:facilityId/status', requireSameOrigin, requireAdmin, async (request, response) => {
	const facilityId = request.params.facilityId.trim();
	const status = request.body?.status;
	if (!facilityId || !['active', 'inactive'].includes(status)) {
		return response.status(400).json({ error: 'Choose Available or Unavailable.' });
	}
	try {
		const db = getDatabaseConnection('OEEMS_Admission').db;
		const result = await db.collection('facilities').updateOne({ facilityId }, { $set: { status, updatedAt: new Date() } });
		if (!result.matchedCount) return response.status(404).json({ error: 'Facility not found.' });
		await db.collection('admin_audit_logs').insertOne({
			adminId: response.locals.authAdmin.adminId,
			action: 'facility_status_changed',
			resourceType: 'facility',
			resourceId: facilityId,
			details: { status },
			ipAddress: request.ip || null,
			userAgent: request.get('user-agent') || null,
			createdAt: new Date()
		});
		response.json({ ok: true, facilityId, status });
		request.app.get('io')?.emit('admission:facilities-updated', { facilityId });
	} catch (error) {
		console.error('Facility status update failed:', error.message);
		response.status(500).json({ error: 'Could not update facility status.' });
	}
});

router.delete('/facilities/:facilityId', requireSameOrigin, requireAdmin, async (request, response) => {
	const facilityId = request.params.facilityId.trim();
	if (!facilityId) return response.status(400).json({ error: 'Facility ID is required.' });
	const db = getDatabaseConnection('OEEMS_Admission').db;
	const session = mongoose.connection.getClient().startSession();
	try {
		await session.withTransaction(async () => {
			const facility = await db.collection('facilities').findOne({ facilityId }, { session });
			if (!facility) {
				const error = new Error('Facility not found.');
				error.status = 404;
				throw error;
			}
			const bookedSlot = await db.collection('schedule_slots').findOne({ facilityId, bookedCount: { $gt: 0 } }, { session, projection: { _id: 1 } });
			if (bookedSlot) {
				const error = new Error('This facility has booked exam slots and cannot be deleted yet.');
				error.status = 409;
				throw error;
			}
			await db.collection('facility_computers').deleteMany({ facilityId }, { session });
			await db.collection('schedule_slots').deleteMany({ facilityId }, { session });
			await db.collection('facilities').deleteOne({ facilityId }, { session });
			await db.collection('admin_audit_logs').insertOne({
				adminId: response.locals.authAdmin.adminId,
				action: 'facility_deleted',
				resourceType: 'facility',
				resourceId: facilityId,
				details: {},
				ipAddress: request.ip || null,
				userAgent: request.get('user-agent') || null,
				createdAt: new Date()
			}, { session });
		});
		response.json({ ok: true, facilityId });
		request.app.get('io')?.emit('admission:facilities-updated', { facilityId });
	} catch (error) {
		if (error.status) return response.status(error.status).json({ error: error.message });
		console.error('Facility deletion failed:', error.message);
		response.status(500).json({ error: 'Could not delete facility.' });
	} finally {
		await session.endSession();
	}
});

router.put('/schedules/computers/:facilityId', requireSameOrigin, requireAdmin, async (request, response) => {
	const facilityId = typeof request.params.facilityId === 'string' ? request.params.facilityId.trim() : '';
	const computers = request.body?.computers;
	const allowedStatuses = new Set(['working', 'unavailable', 'maintenance']);
	if (!facilityId || !Array.isArray(computers) || computers.some((computer) =>
		!Number.isInteger(computer.computerNumber) || computer.computerNumber < 1 || !allowedStatuses.has(computer.status) ||
		(computer.computerName != null && (typeof computer.computerName !== 'string' || computer.computerName.trim().length > 5))
	) || new Set(computers.map((computer) => computer.computerNumber)).size !== computers.length) {
		return response.status(400).json({ error: 'Provide each PC once with a valid name (up to 5 characters) and status.' });
	}

	const db = getDatabaseConnection('OEEMS_Admission').db;
	const session = mongoose.connection.getClient().startSession();
	try {
		await session.withTransaction(async () => {
			const facility = await db.collection('facilities').findOne({ facilityId }, { session });
			if (!facility) {
				const error = new Error('Facility not found.');
				error.status = 404;
				throw error;
			}
			await db.collection('facility_computers').deleteMany({ facilityId }, { session });
			if (computers.length) {
				await db.collection('facility_computers').insertMany(computers.map((computer) => ({
					facilityId,
					computerNumber: computer.computerNumber,
					...(computer.computerName?.trim() ? { computerName: computer.computerName.trim() } : {}),
					status: computer.status,
					lastUpdatedByAdminId: response.locals.authAdmin.adminId,
					lastUpdatedAt: new Date()
				})), { session });
			}
			await db.collection('facilities').updateOne({ facilityId }, { $set: { capacity: computers.length, updatedAt: new Date() } }, { session });
			await db.collection('admin_audit_logs').insertOne({
				adminId: response.locals.authAdmin.adminId,
				action: 'facility_computers_overwritten',
				resourceType: 'facility_computers',
				resourceId: facilityId,
				details: { computerCount: computers.length },
				ipAddress: request.ip || null,
				userAgent: request.get('user-agent') || null,
				createdAt: new Date()
			}, { session });
		});
		response.json({ ok: true, facilityId, computerCount: computers.length });
		request.app.get('io')?.emit('admission:facility-computers-updated', { facilityId });
	} catch (error) {
		if (error.status) return response.status(error.status).json({ error: error.message });
		console.error('Facility computer save failed:', error.message);
		response.status(500).json({ error: 'Could not save facility computer statuses.' });
	} finally {
		await session.endSession();
	}
});

router.put('/schedules/config', requireSameOrigin, requireAdmin, async (request, response) => {
	const year = Number(request.body?.year);
	const month = Number(request.body?.month);
	const cycle = typeof request.body?.cycle === 'string' ? request.body.cycle : '';
	const examDates = request.body?.examDates;
	const batches = request.body?.batches;
	const allowedBatches = new Set(['batch_1', 'batch_2', 'batch_3']);
	const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
	if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12 ||
		cycle !== `${year}-${year + 1}` || !Array.isArray(examDates) || !Array.isArray(batches) || batches.length > 3 ||
		batches.some((batch) => !allowedBatches.has(batch.batch) || !timePattern.test(batch.startTime) || !timePattern.test(batch.endTime) || batch.endTime <= batch.startTime) ||
		new Set(batches.map((batch) => batch.batch)).size !== batches.length ||
		new Set(examDates).size !== examDates.length ||
		examDates.some((date) => typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0, 4)) !== year || Number(date.slice(5, 7)) !== month || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date)
	) {
		return response.status(400).json({ error: 'Provide valid examination dates and up to three distinct batch time ranges.' });
	}
	if (batches.length > 0 && examDates.length === 0) {
		return response.status(400).json({ error: 'Select at least one exam date before configuring batches.' });
	}

	const db = getDatabaseConnection('OEEMS_Admission').db;
	const { start, end } = getMonthWindow(year, month);
	const session = mongoose.connection.getClient().startSession();
	try {
		let writtenCount = 0;
		await session.withTransaction(async () => {
			const facilities = await db.collection('facilities').find({ status: 'active' }, { session }).toArray();
			const computers = await db.collection('facility_computers').find({ status: 'working' }, { session }).toArray();
			const workingCounts = new Map();
			computers.forEach((computer) => workingCounts.set(computer.facilityId, (workingCounts.get(computer.facilityId) || 0) + 1));
			const eligibleFacilities = facilities.map((facility) => ({
				...facility,
				capacity: Math.min(Number(facility.capacity) || 0, workingCounts.get(facility.facilityId) || 0)
			})).filter((facility) => facility.capacity > 0);
			if (examDates.length > 0 && eligibleFacilities.length === 0) {
				const error = new Error('No active facilities have working computers. Configure facilities and computer status first.');
				error.status = 409;
				throw error;
			}
			const slots = [];
			for (const date of examDates) {
				for (const batch of batches) {
					for (const facility of eligibleFacilities) {
						const examDate = new Date(`${date}T00:00:00.000Z`);
						const scheduleId = `${cycle}-${date}-${batch.batch}-${facility.facilityId}`;
						slots.push({ scheduleId, cycle, examDate, batch: batch.batch, startTime: batch.startTime, endTime: batch.endTime, facilityId: facility.facilityId, capacity: facility.capacity });
					}
				}
			}

			const bookedOutsideSelection = await db.collection('schedule_slots').findOne({
				cycle,
				examDate: { $gte: start, $lt: end },
				bookedCount: { $gt: 0 },
				scheduleId: { $nin: slots.map((slot) => slot.scheduleId) }
			}, { session });
			if (bookedOutsideSelection) {
				const error = new Error('Existing booked exam slots cannot be removed from configuration.');
				error.status = 409;
				throw error;
			}

			const ops = slots.map((slot) => ({
				updateOne: {
					filter: { scheduleId: slot.scheduleId },
					update: {
						$set: {
							cycle: slot.cycle,
							examDate: slot.examDate,
							batch: slot.batch,
							startTime: slot.startTime,
							endTime: slot.endTime,
							facilityId: slot.facilityId,
							capacity: Math.max(slot.capacity, 0),
							status: 'available',
							updatedAt: new Date()
						},
						$setOnInsert: { scheduleId: slot.scheduleId, bookedCount: 0, createdByAdminId: response.locals.authAdmin.adminId }
					},
					upsert: true
				}
			}));
			const bookedSlots = await db.collection('schedule_slots').find({
				cycle,
				examDate: { $gte: start, $lt: end },
				bookedCount: { $gt: 0 },
				scheduleId: { $in: slots.map((slot) => slot.scheduleId) }
			}, { session }).toArray();
			const configuredById = new Map(slots.map((slot) => [slot.scheduleId, slot]));
			for (const booked of bookedSlots) {
				const next = configuredById.get(booked.scheduleId);
				if (!next || next.startTime !== booked.startTime || next.endTime !== booked.endTime || next.facilityId !== booked.facilityId || next.capacity < booked.bookedCount) {
					const error = new Error('Booked slots cannot be changed or reduced below their reserved capacity.');
					error.status = 409;
					throw error;
				}
			}
			if (ops.length) await db.collection('schedule_slots').bulkWrite(ops, { session, ordered: true });
			const keepIds = slots.map((slot) => slot.scheduleId);
			const deleteFilter = { cycle, examDate: { $gte: start, $lt: end }, bookedCount: 0 };
			if (keepIds.length) deleteFilter.scheduleId = { $nin: keepIds };
			await db.collection('schedule_slots').deleteMany(deleteFilter, { session });
			writtenCount = slots.length;
			await db.collection('admin_audit_logs').insertOne({
				adminId: response.locals.authAdmin.adminId,
				action: 'schedule_configuration_overwritten',
				resourceType: 'schedule_slots',
				resourceId: `${cycle}-${year}-${month}`,
				details: { cycle, year, month, examDates: examDates.length, batchCount: batches.length, slotCount: slots.length },
				ipAddress: request.ip || null,
				userAgent: request.get('user-agent') || null,
				createdAt: new Date()
			}, { session });
		});
		request.app.get('io')?.emit('admission:schedule-updated', { cycle, year, month });
		response.json({ ok: true, cycle, slotCount: writtenCount, message: writtenCount ? 'Schedule configuration saved.' : 'No active facilities with working computers are configured.' });
	} catch (error) {
		if (error.status) return response.status(error.status).json({ error: error.message });
		console.error('Schedule configuration save failed:', error.message);
		response.status(500).json({ error: 'Could not save schedule configuration.' });
	} finally {
		await session.endSession();
	}
});

module.exports = router;