const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
	status: { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending' },
	reviewedAt: { type: Date, default: null },
	reviewedByAdminId: { type: String, default: null },
	reason: { type: String, default: null }
}, { _id: false });

const studentApplicationSchema = new mongoose.Schema({
	applicantId: { type: String, required: true, unique: true, immutable: true },
	studentId: { type: String, required: true, immutable: true },
	cycle: { type: String, required: true },
	status: {
		type: String,
		enum: ['draft', 'scheduled', 'documents_submitted', 'under_review', 'approved', 'declined', 'exam_completed', 'result_released'],
		default: 'draft',
		required: true
	},
	admissionStatus: { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending', required: true },
	admissionApplicationId: { type: String, default: null },
	approval: { type: approvalSchema, default: null },
	scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentSchedule', default: null },
	documentSubmissionId: { type: mongoose.Schema.Types.ObjectId, default: null },
	examAttemptId: { type: String, default: null },
	resultId: { type: String, default: null }
}, {
	collection: 'student_applications',
	timestamps: true
});

studentApplicationSchema.index({ status: 1 });
studentApplicationSchema.index({ cycle: 1 });
studentApplicationSchema.index({ admissionStatus: 1 });

module.exports = mongoose.models.StudentApplication || mongoose.model('StudentApplication', studentApplicationSchema);