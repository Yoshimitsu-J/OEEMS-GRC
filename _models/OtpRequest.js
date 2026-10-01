const mongoose = require('mongoose');

const otpRequestSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	purpose: {
		type: String,
		enum: ['signup_verification', 'password_reset'],
		required: true
	},
	codeHash: { type: String, required: true, select: false },
	expiresAt: { type: Date, required: true },
	consumedAt: { type: Date, default: null },
	attemptCount: { type: Number, default: 0, min: 0 },
	createdAt: { type: Date, default: Date.now, immutable: true }
}, {
	collection: 'otp_requests',
	versionKey: false
});

otpRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpRequestSchema.index({ userId: 1, purpose: 1, createdAt: -1 });

module.exports = mongoose.models.OtpRequest || mongoose.model('OtpRequest', otpRequestSchema);