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

async function sendApplicationSubmissionConfirmation({ email, applicantId, lastName, givenName, submittedAt, schedule, portalUrl }) {
	const submittedDate = new Intl.DateTimeFormat('en-PH', {
		dateStyle: 'long',
		timeZone: 'Asia/Manila'
	}).format(submittedAt);
	const scheduleText = `${schedule.batch} / ${schedule.date} / ${schedule.time} / ${schedule.facility}`;
	const subject = `Entrance Examination Application Received – ${applicantId} | Global Reciprocal Colleges`;
	const text = `Dear ${lastName}, ${givenName},

Thank you for submitting your application for the Global Reciprocal Colleges Entrance Examination. We have successfully received your application details and uploaded documents through the Student Services Online Entrance Examination Registration System (OEEMS).

Application Details
Applicant Name: ${lastName}, ${givenName}
Applicant ID: ${applicantId}
Application Date Submitted: ${submittedDate}
Selected Exam Schedule: ${scheduleText}

Next Steps
1. Document Verification:
Our Admissions Staff is currently reviewing your uploaded requirements.

2. Download Your SOApp:
Once your submitted documents and selected schedule are verified and approved by the Admissions Department, your Statement of Application (SOApp) document will become available for download directly in your portal.

3. Monitor Your Status:
You may track the real-time progress of your application and verification status at any time by logging into your Student Dashboard and checking the Application Status.

Access Your Portal: ${portalUrl}

If you have any questions or need to make corrections to your application, please reach out to the GRC Admissions Department or use the "Report a Problem" feature inside your student account.

Best regards,
Admission Office
Global Reciprocal Colleges
Student Services - Online Entrance Examination Registration`;

	await getTransporter().sendMail({
		from: process.env.MAIL_FROM || process.env.SMTP_USER,
		to: email,
		subject,
		text
	});
}

module.exports = { isSmtpConfigured, sendOtp, sendApplicationSubmissionConfirmation };
