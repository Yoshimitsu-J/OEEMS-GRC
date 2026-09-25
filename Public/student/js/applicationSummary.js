/* =========================================
   APPLICATION SUMMARY — Real QR Code Generator
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Application Summary JS Initialized.');

  // =========================================
  // 1. LOAD SAVED DATA
  // =========================================
  const applicantData = JSON.parse(localStorage.getItem('applicantData') || '{}');
  const accountInfo   = JSON.parse(localStorage.getItem('accountInfo')   || '{}');

  const firstName  = applicantData.givenName  || accountInfo.givenName  || 'Juan';
  const middleName = applicantData.middleName || accountInfo.middleName || '';
  const lastName   = applicantData.lastName   || accountInfo.lastName   || 'Delacruz';
  const applicantId = applicantData.applicantId || '012345';
  const email       = applicantData.email       || 'juandelacruz1@gmail.com';

  // =========================================
  // 2. UPDATE SUMMARY HEADER (Name + Email)
  // =========================================
  const nameEl  = document.getElementById('summaryName');
  const emailEl = document.getElementById('summaryEmail');

  if (nameEl) {
    const fullName = `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.trim();
    nameEl.textContent = fullName;
  }

  if (emailEl) {
    emailEl.textContent = email;
  }

  // =========================================
  // 3. GENERATE REAL QR CODE
  // =========================================
  const qrContainer = document.getElementById('summaryQrCode');
  if (!qrContainer) return;

  // Check kung naka-load ang QRCode library
  if (typeof QRCode === 'undefined') {
    console.error('QRCode library not loaded. Check the CDN link.');
    qrContainer.innerHTML = '<p style="color:#999;font-size:11px;">QR unavailable</p>';
    return;
  }

  // Clear container
  qrContainer.innerHTML = '';

  // =========================================
  // QR DATA — JSON payload with verification URL
  // =========================================
  const qrData = JSON.stringify({
    type: 'GRC_APPLICATION_SUMMARY',
    applicantId: applicantId,
    name: `${lastName}, ${firstName}${middleName ? ' ' + middleName : ''}`,
    email: email,
    examDate: '2026-04-15',
    examTime: '07:30 - 09:30 AM',
    examFacility: 'Computer Lab 1, 2nd Floor',
    amount: 'Php 200.00',
    verifyUrl: `https://grc.edu.ph/verify/${applicantId}`
  });

  // =========================================
  // GENERATE QR CODE
  // =========================================
  try {
    new QRCode(qrContainer, {
      text: qrData,
      width: 130,
      height: 130,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  } catch (err) {
    console.error('QR generation failed:', err);
    qrContainer.innerHTML = '<p style="color:#999;font-size:11px;">QR error</p>';
  }
});