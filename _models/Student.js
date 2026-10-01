const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
	googleId: { type: String, unique: true, sparse: true },
	email: { type: String, required: true, unique: true, lowercase: true, trim: true },
	name: { type: String, required: true, trim: true },
	picture: { type: String, default: '' },
	emailVerified: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);