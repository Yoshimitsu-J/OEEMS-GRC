const express = require('express');
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const studentRoutes = require('./student');

const router = express.Router();

async function requireFacilitator(request, response, next) {
	if (!request.session?.facilitator?.accessCode) return response.status(401).json({ error: 'Facilitator login required.' });
	next();
}

router.post('/facilitator/login', async (request, response) => {
	const accessCode = String(request.body?.accessCode || '').trim();
	try {
		const db = require('../_scripts/mongodb_connection').getDatabaseConnection('OEEMS_Admission').db;
		const facilitator = await db.collection('facilitators').findOne({ accessCode, status: 'active' });
		if (!facilitator) return response.status(401).json({ error: 'Invalid facilitator access code.' });
		request.session.facilitator = { id: String(facilitator._id), name: facilitator.name, role: facilitator.role, accessCode: facilitator.accessCode };
		request.session.save((error) => {
			if (error) return response.status(500).json({ error: 'Could not create facilitator session.' });
			response.json({ ok: true, facilitator: { name: facilitator.name, role: facilitator.role } });
		});
	} catch (error) {
		console.error('Facilitator login failed:', error.message);
		response.status(500).json({ error: 'Could not verify facilitator access.' });
	}
});

router.post('/facilitator/logout', requireFacilitator, (request, response) => {
	delete request.session.facilitator;
	request.session.save(() => response.json({ ok: true }));
});

router.get('/facilitator/me', requireFacilitator, (request, response) => {
	response.json({ facilitator: request.session.facilitator });
});

router.get('/facilitator/applicant/:applicationId', requireFacilitator, async (request, response) => {
	const applicationId = String(request.params.applicationId || '').trim().toUpperCase();
	try {
		const admissionDb = require('../_scripts/mongodb_connection').getDatabaseConnection('OEEMS_Admission').db;
		const studentDb = require('../_scripts/mongodb_connection').getDatabaseConnection('OEEMS_Student').db;
		const application = await admissionDb.collection('applications').findOne({ $or: [{ applicantId: applicationId }, { applicationNumber: applicationId }] });
		if (!application) return response.status(404).json({ error: 'Application ID not found.' });
		const profile = await studentDb.collection('student_profiles').findOne({ applicantId: application.applicantId });
		const schedule = await studentDb.collection('student_schedules').findOne({ applicantId: application.applicantId, bookingStatus: { $in: ['reserved', 'confirmed'] } });
		response.set('Cache-Control', 'no-store');
		response.json({
			applicantId: application.applicantId,
			applicationId: application.applicationNumber || application.applicantId,
			name: profile ? [profile.lastName, profile.givenName, profile.middleName, profile.suffix].filter(Boolean).join(', ') : application.name || 'Applicant',
			address: profile?.address ? Object.values(profile.address).filter(Boolean).join(', ') : application.profile?.address || 'Not provided',
			mobileNumber: profile?.phone || application.profile?.phone || 'Not provided',
			email: application.email || profile?.email || '',
			examDate: schedule?.examDate || null,
			examBatch: schedule?.batch || null,
			examTime: schedule?.startTime && schedule?.endTime ? `${schedule.startTime} - ${schedule.endTime}` : null,
			approvalStatus: application.status === 'declined' ? 'rejected' : application.status === 'approved' || application.status === 'exam_completed' || application.status === 'result_released' ? 'approved' : 'pending'
		});
	} catch (error) {
		console.error('Facilitator applicant lookup failed:', error.message);
		response.status(500).json({ error: 'Could not load applicant information.' });
	}
});

router.post('/facilitator/arrived', requireFacilitator, async (request, response) => {
	const applicantId = String(request.body?.applicantId || '').trim().toUpperCase();
	if (!applicantId) return response.status(400).json({ error: 'Application information is required.' });
	try {
		const admissionDb = require('../_scripts/mongodb_connection').getDatabaseConnection('OEEMS_Admission').db;
		const studentDb = require('../_scripts/mongodb_connection').getDatabaseConnection('OEEMS_Student').db;
		const application = await admissionDb.collection('applications').findOne({ $or: [{ applicantId }, { applicationNumber: applicantId }] });
		if (!application) return response.status(404).json({ error: 'Application ID not found.' });
		const profile = await studentDb.collection('student_profiles').findOne({ applicantId: application.applicantId });
		const approvalStatus = application.status === 'declined' ? 'rejected' : application.status === 'approved' || application.status === 'exam_completed' || application.status === 'result_released' ? 'approved' : 'pending';
		await admissionDb.collection('exam_arrivals').updateOne({ applicantId: application.applicantId }, {
			$set: { applicationId: application.applicationNumber || application.applicantId, name: profile ? [profile.lastName, profile.givenName, profile.middleName, profile.suffix].filter(Boolean).join(', ') : application.name || 'Applicant', email: application.email || profile?.email || '', approvalStatus, arrivedAt: new Date(), facilitatedBy: request.session.facilitator, updatedAt: new Date() },
			$setOnInsert: { applicantId: application.applicantId, createdAt: new Date() }
		}, { upsert: true });
		request.app.get('io')?.emit('admission:arrival-updated', { applicantId: application.applicantId });
		response.json({ ok: true, arrived: true });
	} catch (error) {
		console.error('Exam arrival confirmation failed:', error.message);
		response.status(500).json({ error: 'Could not confirm applicant arrival.' });
	}
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/student', studentRoutes);

router.get('/examination/questionnaire', async (request, response) => {
	try {
		const admissionDb = require('../_scripts/mongodb_connection').getDatabaseConnection('OEEMS_Admission').db;
		const configuration = await admissionDb.collection('questionnaire_questions').findOne({ documentType: 'questionnaire_configuration' }, { projection: { configuration: 1 } });
		const allQuestions = [];
		for (const [category, questions] of Object.entries(configuration?.configuration?.questionsByCategory || {})) {
			for (const question of questions || []) {
				allQuestions.push({
					questionId: question.id,
					category,
					text: question.text,
					image: question.image || null,
					options: (question.options || []).map((option, index) => ({ optionId: option.id || `${question.id}-option-${index + 1}`, text: option.text }))
				});
			}
		}
		for (let index = allQuestions.length - 1; index > 0; index -= 1) {
			const randomIndex = Math.floor(Math.random() * (index + 1));
			[allQuestions[index], allQuestions[randomIndex]] = [allQuestions[randomIndex], allQuestions[index]];
		}
		response.set('Cache-Control', 'no-store');
		response.json({ questions: allQuestions, durationSeconds: 180 });
	} catch (error) {
		console.error('Examination questionnaire read failed:', error.message);
		response.status(500).json({ error: 'Could not load examination questions.' });
	}
});

router.post('/examination/start', async (request, response) => {
	const applicationCode = typeof request.body?.applicationCode === 'string' ? request.body.applicationCode.trim().toUpperCase() : '';
	if (!applicationCode) return response.status(400).json({ error: 'Enter your Application Code.' });
	try {
		const admissionDb = require('../_scripts/mongodb_connection').getDatabaseConnection('OEEMS_Admission').db;
		const studentDb = require('../_scripts/mongodb_connection').getDatabaseConnection('OEEMS_Student').db;
		const application = await admissionDb.collection('applications').findOne({ $or: [{ applicantId: applicationCode }, { applicationNumber: applicationCode }], status: 'approved' });
		if (!application) return response.status(404).json({ error: 'Approved application code not found.' });
		const submittedAttempt = await studentDb.collection('student_exam_attempts').findOne({ applicantId: application.applicantId, status: { $in: ['submitted', 'disqualified', 'expired'] } }, { sort: { submittedAt: -1, createdAt: -1 } });
		if (submittedAttempt) {
			try {
				const profile = await studentDb.collection('student_profiles').findOne({ applicantId: application.applicantId });
				const user = await studentDb.collection('users').findOne({ applicantId: application.applicantId });
				const { sendDuplicateExamAttempt } = require('../_scripts/nodeEmailer');
				await sendDuplicateExamAttempt({
					email: application.email || profile?.email || user?.email || '',
					applicantName: profile ? [profile.givenName, profile.middleName, profile.lastName, profile.suffix].filter(Boolean).join(' ') : application.name || 'Applicant',
					applicationId: application.applicationNumber || application.applicantId
				});
			} catch (emailError) {
				console.error('Duplicate exam attempt email failed:', emailError.message);
			}
			return response.status(409).json({ error: 'This applicant has already submitted an examination attempt.', applicationId: application.applicationNumber || application.applicantId, alreadySubmitted: true });
		}
		const existing = await studentDb.collection('student_exam_attempts').findOne({ applicantId: application.applicantId, status: 'in_progress' });
		if (existing) {
			const durationSeconds = 180;
			const elapsedSeconds = existing.startedAt ? Math.max(0, Math.floor((Date.now() - new Date(existing.startedAt).getTime()) / 1000)) : 0;
			const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
			if (remainingSeconds > 0) {
				return response.json({ ok: true, attemptId: existing.attemptId, durationSeconds: remainingSeconds, resumed: true });
			}
			await studentDb.collection('student_exam_attempts').updateOne({ _id: existing._id }, {
				$set: { status: 'expired', submittedAt: new Date(), disqualified: false, updatedAt: new Date() }
			});
		}
		const now = new Date();
		const crypto = require('node:crypto');
		const version = await admissionDb.collection('exam_versions').findOne({ active: true });
		await studentDb.collection('student_exam_attempts').insertOne({
			attemptId: crypto.randomUUID(), applicantId: application.applicantId, applicationNumber: application.applicationNumber || application.applicantId,
			examVersionId: version?.version || 'default', status: 'in_progress', startedAt: now, submittedAt: null, violations: [], answers: {}, score: null, createdAt: now, updatedAt: now
		});
		const attempt = await studentDb.collection('student_exam_attempts').findOne({ applicantId: application.applicantId, status: 'in_progress' }, { sort: { startedAt: -1 } });
		response.status(201).json({ ok: true, attemptId: attempt.attemptId, durationSeconds: 180, resumed: false });
	} catch (error) {
		console.error('Exam attempt start failed:', error.message);
		response.status(500).json({ error: 'Could not start the examination.' });
	}
});

router.post('/examination/violation', async (request, response) => {
	const { attemptId, violation, timestamp } = request.body || {};
	if (!attemptId || !violation) return response.status(400).json({ error: 'Attempt and violation are required.' });
	try {
		const studentDb = require('../_scripts/mongodb_connection').getDatabaseConnection('OEEMS_Student').db;
		await studentDb.collection('student_exam_attempts').updateOne({ attemptId, status: 'in_progress' }, {
			$push: { violations: { type: String(violation).slice(0, 120), timestamp: timestamp ? new Date(timestamp) : new Date() } },
			$set: { updatedAt: new Date() }
		});
		response.json({ ok: true });
	} catch (error) {
		response.status(500).json({ error: 'Could not record the security violation.' });
	}
});

router.post('/examination/submit', async (request, response) => {
	const { attemptId, answers, forceDisqualification } = request.body || {};
	if (!attemptId || !answers || typeof answers !== 'object') return response.status(400).json({ error: 'Attempt and answers are required.' });
	try {
		const admissionDb = require('../_scripts/mongodb_connection').getDatabaseConnection('OEEMS_Admission').db;
		const studentDb = require('../_scripts/mongodb_connection').getDatabaseConnection('OEEMS_Student').db;
		const attempt = await studentDb.collection('student_exam_attempts').findOne({ attemptId });
		if (!attempt) return response.status(404).json({ error: 'Active examination attempt not found.' });
		if (attempt.status !== 'in_progress') return response.json({ ok: true, alreadySubmitted: true, score: attempt.score || 0, totalItems: attempt.totalItems || 0 });
		const configuration = await admissionDb.collection('questionnaire_questions').findOne({ documentType: 'questionnaire_configuration' });
		let total = 0;
		let correct = 0;
		const categoryScores = {};
		for (const [category, questions] of Object.entries(configuration?.configuration?.questionsByCategory || {})) {
			categoryScores[category] = { correct: 0, total: 0 };
			for (const question of questions || []) {
				total += 1;
				categoryScores[category].total += 1;
				const selected = answers[question.id];
				const selectedOptionIndex = (question.options || []).findIndex((option, index) =>
					option.id === selected || selected === `${question.id}-option-${index + 1}`
				);
				if (selectedOptionIndex >= 0 && question.options[selectedOptionIndex]?.correct === true) {
					correct += 1;
					categoryScores[category].correct += 1;
				}
			}
		}
		const now = new Date();
		await studentDb.collection('student_exam_attempts').updateOne({ _id: attempt._id }, {
			$set: { status: forceDisqualification ? 'disqualified' : 'submitted', submittedAt: now, answers, score: correct, totalItems: total, categoryScores, disqualified: forceDisqualification === true, updatedAt: now }
		});
		await studentDb.collection('student_applications').updateOne({ applicantId: attempt.applicantId }, { $set: { status: 'exam_completed', examAttemptId: attemptId, updatedAt: now } });
		response.json({ ok: true, score: correct, totalItems: total });
	} catch (error) {
		console.error('Exam submission failed:', error.message);
		response.status(500).json({ error: 'Could not submit the examination.' });
	}
});

router.post('/examination/verify', async (request, response) => {
	const applicationCode = typeof request.body?.applicationCode === 'string' ? request.body.applicationCode.trim().toUpperCase() : '';
	if (!applicationCode) return response.status(400).json({ error: 'Enter your Application Code.' });
	try {
		const admissionDb = require('../_scripts/mongodb_connection').getDatabaseConnection('OEEMS_Admission').db;
		const application = await admissionDb.collection('applications').findOne({ $or: [{ applicantId: applicationCode }, { applicationNumber: applicationCode }], status: 'approved' });
		if (!application) return response.status(404).json({ error: 'Approved application code not found.' });
		const studentDb = require('../_scripts/mongodb_connection').getDatabaseConnection('OEEMS_Student').db;
		const submittedAttempt = await studentDb.collection('student_exam_attempts').findOne({ applicantId: application.applicantId, status: { $in: ['submitted', 'disqualified', 'expired'] } }, { sort: { submittedAt: -1, createdAt: -1 } });
		if (submittedAttempt) {
			const profile = await studentDb.collection('student_profiles').findOne({ applicantId: application.applicantId });
			const user = await studentDb.collection('users').findOne({ applicantId: application.applicantId });
			try {
				const { sendDuplicateExamAttempt } = require('../_scripts/nodeEmailer');
				await sendDuplicateExamAttempt({ email: application.email || profile?.email || user?.email || '', applicantName: profile ? [profile.givenName, profile.middleName, profile.lastName, profile.suffix].filter(Boolean).join(' ') : application.name || 'Applicant', applicationId: application.applicationNumber || application.applicantId });
			} catch (emailError) {
				console.error('Duplicate examination verification email failed:', emailError.message);
			}
			response.set('Cache-Control', 'no-store');
			return response.status(409).json({ alreadySubmitted: true, applicationId: application.applicationNumber || application.applicantId, error: 'This Application ID has already submitted an examination attempt.' });
		}
		const profile = await studentDb.collection('student_profiles').findOne({ applicantId: applicationCode });
		response.set('Cache-Control', 'no-store');
		response.json({ verified: true, applicant: {
			applicationCode,
			applicantId: application.applicantId,
			name: profile ? [profile.lastName, profile.givenName, profile.middleName, profile.suffix].filter(Boolean).join(', ') : application.name || 'Applicant',
			email: application.email || profile?.email || ''
		} });
	} catch (error) {
		console.error('Application code verification failed:', error.message);
		response.status(500).json({ error: 'Could not verify the Application Code.' });
	}
});

router.get('/health', (request, response) => {
	response.json({
		status: 'ok',
		service: 'OEEMS',
		timestamp: new Date().toISOString()
	});
});

module.exports = router;
