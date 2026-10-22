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

async function sendApplicationSubmissionConfirmation({ email, applicantId, lastName, givenName, middleName, suffix, submittedAt, targetAcademicYear, schedule, portalUrl, admissionEmail, contactNumber }) {
	const submittedDate = new Intl.DateTimeFormat('en-PH', {
		dateStyle: 'long',
		timeZone: 'Asia/Manila'
	}).format(submittedAt);
	const fullName = [givenName, middleName, lastName, suffix].filter(Boolean).join(' ');
	const subject = `Application Received – Pending Verification | [Applicant ID: ${applicantId}]`;
	const text = `Dear ${fullName},

Thank you for submitting your application for the upcoming entrance examination at Global Reciprocal Colleges. We are writing to confirm that we have successfully received your application details and uploaded documents.

Application Overview:
Applicant ID: ${applicantId}
Submission Date: ${submittedDate}
Target Academic Year: SY ${targetAcademicYear.replace('-', '–')}

Your application and submitted documents are currently placed under official review by the Admission Office.

Review Timeline: Document verification typically takes 3–5 business days.
Status Updates: You can check the real-time status of your application by logging into your Application portal.
Further Action: Once your documents are verified and approved, your Statement of Application / Examination Permit will be sent to your registered email ${email}.

Please note: If any of your submitted documents require clarification or re-uploading, you will receive a notification via email and through your portal dashboard.

Should you have any urgent questions or concerns, please reach out to the Admission Office at ${admissionEmail} or ${contactNumber} with your Applicant ID referenced.

Access your portal: ${portalUrl}

Best regards,
Admissions Office
Global Reciprocal Colleges
${contactNumber}`;

	await getTransporter().sendMail({
		from: process.env.MAIL_FROM || process.env.SMTP_USER,
		to: email,
		subject,
		text
	});
}

async function sendAdmissionDecision({ email, applicantName, decision, applicantId, applicationNumber, rejectionCause, rejectionMessage, pdfBuffer, admissionEmail, contactNumber }) {
	if (!email) throw new Error('Applicant email is unavailable.');
	const fullName = applicantName || 'Applicant';
	if (decision === 'rejected' || decision === 'declined') {
		const reason = rejectionMessage || rejectionCause || 'The application did not meet the required criteria.';
		await getTransporter().sendMail({
			from: process.env.MAIL_FROM || process.env.SMTP_USER,
			to: email,
			subject: `Application Update – Documents or Requirements Require Revision | [Applicant ID: ${applicantId}]`,
			text: `Dear ${fullName},\n\nWe regret to inform you that your application has been declined after review.\n\nReason: ${reason}\n\nPlease review the cause above, make the necessary revisions, and restart your application from the Schedule Exam step. Your application progress must begin again from that stage.\n\nShould you have questions, contact the Admissions Office at ${admissionEmail || process.env.ADMISSION_EMAIL || 'the Admissions Office'} or ${contactNumber || '09123456789'} and reference your Applicant ID.\n\nBest regards,\nAdmissions Office\nGlobal Reciprocal Colleges\n09123456789`
		});
		return;
	}
	await getTransporter().sendMail({
		from: process.env.MAIL_FROM || process.env.SMTP_USER,
		to: email,
		subject: `Application Approved – Statement of Application & Examination Permit | [Applicant ID: ${applicationNumber}]`,
		text: `Dear ${fullName},\n\nWe are pleased to inform you that your application for the upcoming entrance examination at Global Reciprocal Colleges has been officially approved by the Admissions Office.\n\nAttached to this email is your official Statement of Application (A4-sized PDF), which includes your verified details, examination schedule, and a secure QR code containing your full application information and unique Application ID (${applicationNumber}).\n\nImportant Reminders for Your Examination:\n1. Required Items to Bring: Please present your printed Statement of Application (featuring your QR Code) along with your official Payment Slip from the Cashier and a valid ID to the Examination Facilitator upon entry for verification.\n2. Venue & Schedule: Please arrive at least 30 minutes before your scheduled batch time indicated in your Statement of Application.\n\nShould you have any questions or require further assistance, please reach out to the Admissions Office at ${admissionEmail || process.env.ADMISSION_EMAIL || 'the Admissions Office'} or ${contactNumber || '09123456789'} with your Applicant ID referenced.\n\nCongratulations, and we wish you the best on your entrance examination!\n\nBest regards,\nAdmissions Office\nGlobal Reciprocal Colleges\n09123456789`,
		attachments: pdfBuffer ? [{ filename: `Statement-of-Application-${applicationNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }] : []
	});
}

module.exports = { isSmtpConfigured, sendOtp, sendApplicationSubmissionConfirmation, sendAdmissionDecision };
