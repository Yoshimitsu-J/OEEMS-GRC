const StudentApplication = require('../_models/StudentApplication');
const User = require('../_models/User');

const RETENTION_DELAY_MS = 14 * 24 * 60 * 60 * 1000;
const COMPLETED_STATUSES = ['approved', 'declined', 'exam_completed', 'result_released'];

async function disableExpiredCompletedAccounts(io) {
	const cutoff = new Date(Date.now() - RETENTION_DELAY_MS);
	const completedApplications = await StudentApplication.find({
		status: { $in: COMPLETED_STATUSES },
		updatedAt: { $lte: cutoff }
	}).select('studentId').lean();
	const studentIds = completedApplications.map((application) => application.studentId);
	if (studentIds.length === 0) return 0;

	const users = await User.find({ studentId: { $in: studentIds }, accountStatus: 'active' }).select('_id studentId').lean();
	const result = await User.updateMany({
		studentId: { $in: studentIds },
		accountStatus: 'active'
	}, { $set: { accountStatus: 'disabled' } });
	users.forEach((user) => io?.in(`student:${user._id}`).disconnectSockets(true));
	return result.modifiedCount;
}

function startStudentRetentionJob(io) {
	const run = () => disableExpiredCompletedAccounts(io)
		.then((count) => {
			if (count > 0) console.info(`Disabled ${count} completed student account(s) after the 14-day retention window.`);
		})
		.catch((error) => console.error('Student account retention task failed:', error.message));

	run();
	const timer = setInterval(run, 60 * 60 * 1000);
	timer.unref();
	return timer;
}

module.exports = { disableExpiredCompletedAccounts, startStudentRetentionJob };