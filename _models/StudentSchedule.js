const mongoose = require('mongoose');

const studentScheduleSchema = new mongoose.Schema({
	scheduleId: { type: String, required: true },
	applicantId: { type: String, required: true },
	cycle: { type: String, required: true },
	examDate: { type: Date, required: true },
	batch: { type: String, enum: ['batch_1', 'batch_2', 'batch_3'], required: true },
	startTime: { type: String, required: true },
	endTime: { type: String, required: true },
	facilityId: { type: String, default: null },
	bookingStatus: { type: String, enum: ['reserved', 'confirmed', 'cancelled', 'completed'], default: 'reserved' },
	bookedAt: { type: Date, default: Date.now },
	cancelledAt: { type: Date, default: null }
}, {
	collection: 'student_schedules',
	timestamps: true
});

studentScheduleSchema.index(
	{ applicantId: 1, cycle: 1 },
	{ unique: true, partialFilterExpression: { bookingStatus: { $in: ['reserved', 'confirmed'] } } }
);
studentScheduleSchema.index({ scheduleId: 1 });
studentScheduleSchema.index({ examDate: 1 });

module.exports = mongoose.models.StudentSchedule || mongoose.model('StudentSchedule', studentScheduleSchema);