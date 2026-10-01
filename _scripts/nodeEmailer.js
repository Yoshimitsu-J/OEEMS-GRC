const nodemailer = require('nodemailer');

let transporter;

function isConfiguredValue(value) {
	return Boolean(value && !/(?:^your_|example\.com|change[_ -]?me|replace[_ -]?me)/i.test(value.trim()));
}

function isSmtpConfigured() {
	const port = Number(process.env.SMTP_PORT);
	return Boolean(
		isConfiguredValue(process.env.SMTP_HOST) &&
		isConfiguredValue(process.env.SMTP_USER) &&
		isConfiguredValue(process.env.SMTP_PASS) &&
		Number.isInteger(port) && port > 0 && port <= 65535
	);
}

function getTransporter() {
	if (transporter) return transporter;

	if (!isSmtpConfigured()) {
		throw new Error('SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS must be configured.');
	}

	const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
	transporter = nodemailer.createTransport({
		host: SMTP_HOST,
		port: Number(SMTP_PORT),
		secure: process.env.SMTP_SECURE === 'true' || Number(SMTP_PORT) === 465,
		auth: { user: SMTP_USER, pass: SMTP_PASS }
	});
	return transporter;
}


async function sendOtp(email, code, purpose) {
	const isPasswordReset = purpose === 'password_reset';
	await getTransporter().sendMail({
		from: process.env.MAIL_FROM || process.env.SMTP_USER,
		to: email,
		subject: isPasswordReset ? 'OEEMS password reset code' : 'OEEMS email verification code',
		text: `Your OEEMS ${isPasswordReset ? 'password reset' : 'verification'} code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
		html: `<p>Your OEEMS ${isPasswordReset ? 'password reset' : 'verification'} code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:5px">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`
	});
}

module.exports = { isSmtpConfigured, sendOtp };
