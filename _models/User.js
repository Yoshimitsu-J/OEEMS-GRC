const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
	studentId: { type: String, required: true, unique: true, immutable: true },
	email: { type: String, required: true, unique: true, lowercase: true, trim: true },
	passwordHash: { type: String, select: false },
	googleId: { type: String, unique: true, sparse: true, select: false },
	emailVerified: { type: Boolean, default: false, required: true, alias: 'isEmailVerified' },
	authProvider: { type: String, enum: ['password', 'google'], default: 'password', required: true },
	accountStatus: {
		type: String,
		enum: ['pending', 'active', 'locked', 'disabled'],
		default: 'pending',
		required: true
	},
	lastLoginAt: { type: Date, default: null }
}, {
	collection: 'users',
	timestamps: true
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);