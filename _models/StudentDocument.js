const mongoose = require('mongoose');

const studentDocumentSchema = new mongoose.Schema({
	applicantId: { type: String, required: true },
	documentType: {
		type: String,
		enum: ['form138', 'psa_birth_certificate', 'good_moral', 'picture_2x2', 'form137', 'other'],
		required: true
	},
	submissionMode: { type: String, enum: ['online_upload', 'physical_submission'], required: true },
	originalName: { type: String, default: null },
	storageKey: { type: String, default: null },
	contentType: { type: String, default: null },
	sizeBytes: { type: Number, default: null },
	uploadedAt: { type: Date, default: null },
	verificationStatus: {
		type: String,
		enum: ['not_submitted', 'submitted', 'under_review', 'accepted', 'rejected', 'to_follow'],
		default: 'not_submitted'
	},
	reviewedAt: { type: Date, default: null },
	reviewedByAdminId: { type: String, default: null },
	rejectionReason: { type: String, default: null }
}, {
	collection: 'student_documents',
	timestamps: true
});

studentDocumentSchema.index({ applicantId: 1, documentType: 1 }, { unique: true });
studentDocumentSchema.index({ verificationStatus: 1 });

module.exports = mongoose.models.StudentDocument || mongoose.model('StudentDocument', studentDocumentSchema);