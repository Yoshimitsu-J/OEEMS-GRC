const express = require('express');
const StudentProfile = require('../_models/StudentProfile');
const { createApplicantId } = require('../_scripts/authSecurity');
const { requireAuthenticated } = require('../_middleware/studentAccess');
const { requireSameOrigin } = require('../_middleware/sameOrigin');

const router = express.Router();

function text(value, maxLength = 160) {
	return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function makeProfileInput(body) {
	const address = body.address && typeof body.address === 'object' ? body.address : body;
	const guardian = body.guardian && typeof body.guardian === 'object' ? body.guardian : body;
	const birthday = new Date(body.birthday);
	const phone = text(body.phone, 32);
	const profile = {
		lastName: text(body.lastName),
		givenName: text(body.givenName),
		middleName: text(body.middleName),
		sex: text(body.sex, 16).toLowerCase(),
		birthday,
		phone,
		address: {
			country: text(address.country),
			region: text(address.region),
			city: text(address.city),
			barangay: text(address.barangay),
			street: text(address.street || address.streetAddress)
		},
		guardian: {
			name: text(guardian.name || guardian.guardianName),
			phone: text(guardian.phone || guardian.guardianPhone, 32)
		},
		photo: text(body.photo, 2048)
	};

	const phonePattern = /^\+?[0-9][0-9().\s-]{6,30}$/;
	const validBirthday = Number.isFinite(birthday.getTime()) && birthday < new Date();
	const validPhone = phonePattern.test(profile.phone) && phonePattern.test(profile.guardian.phone);
	const complete = Boolean(
		profile.lastName && profile.givenName &&
		['male', 'female'].includes(profile.sex) && validBirthday && validPhone &&
		profile.address.country && profile.address.region && profile.address.city &&
		profile.address.barangay && profile.address.street &&
		profile.guardian.name && profile.guardian.phone && body.termsAccepted === true
	);

	return { profile, complete };
}

router.post('/profile', requireSameOrigin, requireAuthenticated, async (request, response) => {
	const { profile, complete } = makeProfileInput(request.body || {});
	if (!complete) {
		return response.status(400).json({ error: 'Complete all required profile fields and accept the terms.' });
	}

	try {
		const userId = response.locals.authUser._id;
		let savedProfile;
		for (let attempt = 0; attempt < 3; attempt += 1) {
			try {
				savedProfile = await StudentProfile.findOneAndUpdate(
					{ userId },
					{
						$set: profile,
						$setOnInsert: {
							userId,
							applicantId: createApplicantId(),
							termsAcceptedAt: new Date()
						}
					},
					{ returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true }
				);
				break;
			} catch (error) {
				if (error.code !== 11000 || attempt === 2) throw error;
				if (await StudentProfile.exists({ userId })) {
					savedProfile = await StudentProfile.findOneAndUpdate(
						{ userId },
						{ $set: profile },
						{ returnDocument: 'after', runValidators: true }
					);
					break;
				}
			}
		}

		response.json({
			ok: true,
			applicantId: savedProfile.applicantId,
			redirectUrl: '/public/student-dashboard.html'
		});
	} catch (error) {
		console.error('Student profile save failed:', error.message);
		response.status(500).json({ error: 'Could not save the student profile. Please try again.' });
	}
});

module.exports = router;