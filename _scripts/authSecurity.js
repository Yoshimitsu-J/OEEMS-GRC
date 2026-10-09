const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const User = require('../_models/User');
const StudentProfile = require('../_models/StudentProfile');

const scrypt = promisify(crypto.scrypt);
const sessionSecretPath = path.join(__dirname, '..', '_confidentials', 'session_secret.txt');

async function hashPassword(password) {
	const salt = crypto.randomBytes(16);
	const derivedKey = await scrypt(password, salt, 64, {
		N: 16384,
		r: 8,
		p: 1,
		maxmem: 64 * 1024 * 1024
	});
	return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, encodedHash) {
	const [algorithm, saltHex, keyHex] = (encodedHash || '').split('$');
	if (algorithm !== 'scrypt' || !saltHex || !keyHex) return false;

	const salt = Buffer.from(saltHex, 'hex');
	const expectedKey = Buffer.from(keyHex, 'hex');
	if (!salt.length || !expectedKey.length) return false;

	const actualKey = await scrypt(password, salt, expectedKey.length, {
		N: 16384,
		r: 8,
		p: 1,
		maxmem: 64 * 1024 * 1024
	});
	return crypto.timingSafeEqual(actualKey, expectedKey);
}

function hashOtp(code) {
	const secret = process.env.OTP_HASH_SECRET || process.env.SESSION_SECRET || fs.readFileSync(sessionSecretPath, 'utf8').trim();
	if (!secret) throw new Error('OTP_HASH_SECRET or SESSION_SECRET must be configured.');
	return crypto.createHmac('sha256', secret).update(code).digest('hex');
}

function compareOtp(code, expectedHash) {
	const actualHash = Buffer.from(hashOtp(code), 'hex');
	const expected = Buffer.from(expectedHash || '', 'hex');
	return actualHash.length === expected.length && crypto.timingSafeEqual(actualHash, expected);
}

function createStudentId() {
	return `STU-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function createApplicantId() {
	for (let attempt = 0; attempt < 10; attempt += 1) {
		const applicantId = `APP${new Date().getFullYear()}${crypto.randomInt(0, 1000000).toString().padStart(6, '0')}`;
		const [userExists, profileExists] = await Promise.all([
			User.exists({ applicantId }),
			StudentProfile.exists({ applicantId })
		]);
		if (!userExists && !profileExists) return applicantId;
	}
	throw new Error('Could not generate a unique applicant ID. Please try again.');
}

module.exports = {
	hashPassword,
	verifyPassword,
	hashOtp,
	compareOtp,
	createStudentId,
	createApplicantId
};