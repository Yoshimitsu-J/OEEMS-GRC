const StudentApplication = require('../_models/StudentApplication');
const StudentDocument = require('../_models/StudentDocument');
const StudentProfile = require('../_models/StudentProfile');
const StudentSchedule = require('../_models/StudentSchedule');

function watchStudentChanges(io) {
	const streams = [
		StudentApplication.watch([], { fullDocument: 'updateLookup' }),
		StudentDocument.watch([], { fullDocument: 'updateLookup' }),
		StudentSchedule.watch([], { fullDocument: 'updateLookup' })
	];

	streams.forEach((stream) => {
		stream.on('change', async (change) => {
			const applicantId = change.fullDocument?.applicantId;
			if (!applicantId) return;

			try {
				const profile = await StudentProfile.findOne({ applicantId }).select('userId').lean();
				if (profile) {
					io.to(`student:${profile.userId}`).emit('student:application-updated', { applicantId });
				}
			} catch (error) {
				console.error('Student change notification failed:', error.message);
			}
		});
		stream.on('error', (error) => {
			console.error('Student MongoDB change stream stopped:', error.message);
		});
	});

	return async () => Promise.all(streams.map((stream) => stream.close()));
}

module.exports = { watchStudentChanges };