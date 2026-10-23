const express = require('express');
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const studentRoutes = require('./student');

const router = express.Router();

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
