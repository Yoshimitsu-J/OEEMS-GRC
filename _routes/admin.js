const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { getDatabaseConnection } = require('../_scripts/mongodb_connection');
const { requireSameOrigin } = require('../_middleware/sameOrigin');
const { requireAdmin } = require('../_middleware/adminAccess');
const { verifyPassword } = require('../_scripts/authSecurity');

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

		await new Promise((resolve, reject) => request.session.regenerate((error) => error ? reject(error) : resolve()));
		request.session.admin = { id: admin._id.toString(), adminId: admin.adminId, role: admin.role };
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
	request.session.destroy((error) => {
		if (error) return next(error);
		response.clearCookie(process.env.SESSION_COOKIE_NAME || 'connect.sid', { path: '/' });
		response.json({ ok: true, redirectUrl: '/admission/adminLoginPage.html' });
	});
});

router.get('/auth/me', requireAdmin, (request, response) => {
	const admin = response.locals.authAdmin;
	response.json({ adminId: admin.adminId, email: admin.email, name: admin.name, role: admin.role });
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
			byFacility.get(computer.facilityId).push({ computerNumber: computer.computerNumber, status: computer.status });
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

router.put('/schedules/computers/:facilityId', requireSameOrigin, requireAdmin, async (request, response) => {
	const facilityId = typeof request.params.facilityId === 'string' ? request.params.facilityId.trim() : '';
	const computers = request.body?.computers;
	const allowedStatuses = new Set(['working', 'unavailable', 'maintenance']);
	if (!facilityId || !Array.isArray(computers) || computers.some((computer) =>
		!Number.isInteger(computer.computerNumber) || computer.computerNumber < 1 || !allowedStatuses.has(computer.status)
	) || new Set(computers.map((computer) => computer.computerNumber)).size !== computers.length) {
		return response.status(400).json({ error: 'Provide each computer number once with a valid PC status.' });
	}

	const db = getDatabaseConnection('OEEMS_Admission').db;
	const session = mongoose.connection.getClient().startSession();
	try {
		await session.withTransaction(async () => {
			const facility = await db.collection('facilities').findOne({ facilityId, status: 'active' }, { session });
			if (!facility) {
				const error = new Error('Facility not found or inactive.');
				error.status = 404;
				throw error;
			}
			await db.collection('facility_computers').deleteMany({ facilityId }, { session });
			if (computers.length) {
				await db.collection('facility_computers').insertMany(computers.map((computer) => ({
					facilityId,
					computerNumber: computer.computerNumber,
					status: computer.status,
					lastUpdatedByAdminId: response.locals.authAdmin.adminId,
					lastUpdatedAt: new Date()
				})), { session });
			}
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