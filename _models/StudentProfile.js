const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
	country: { type: String, required: true, trim: true },
	region: { type: String, required: true, trim: true },
	city: { type: String, required: true, trim: true },
	barangay: { type: String, required: true, trim: true },
	street: { type: String, required: true, trim: true }
}, { _id: false });

const guardianSchema = new mongoose.Schema({
	name: { type: String, required: true, trim: true },
	phone: { type: String, required: true, trim: true }
}, { _id: false });

const studentProfileSchema = new mongoose.Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
		unique: true,
		immutable: true
	},
	applicantId: { type: String, required: true, unique: true, immutable: true },
	lastName: { type: String, required: true, trim: true },
	givenName: { type: String, required: true, trim: true },
	middleName: { type: String, default: '', trim: true },
	sex: { type: String, enum: ['male', 'female'], required: true },
	birthday: { type: Date, required: true },
	phone: { type: String, required: true, trim: true },
	address: { type: addressSchema, required: true },
	guardian: { type: guardianSchema, required: true },
	photo: { type: String, default: '' },
	termsAcceptedAt: { type: Date, required: true, immutable: true }
}, {
	collection: 'student_profiles',
	timestamps: true
});

module.exports = mongoose.models.StudentProfile || mongoose.model('StudentProfile', studentProfileSchema);