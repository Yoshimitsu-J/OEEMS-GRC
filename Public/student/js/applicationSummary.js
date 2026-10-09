/* =========================================
   APPLICATION SUMMARY — Real QR Code Generator
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  const nameEl = document.getElementById('summaryName');
  const emailEl = document.getElementById('summaryEmail');
  const rows = document.querySelectorAll('.summary-table tr');
  const downloadButton = document.getElementById('downloadSummaryBtn');
  const submitButton = document.getElementById('submitApplicationBtn');

  const showValue = (row, value) => {
    const cell = rows[row]?.querySelector('td:last-child');
    if (cell) cell.textContent = value || '—';
  };
  const formatDate = (value) => value
    ? new Date(value).toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })
    : '—';

  async function loadSummary() {
    const [profileResponse, statusResponse] = await Promise.all([
      fetch('/api/student/profile', { credentials: 'same-origin', cache: 'no-store' }),
      fetch('/api/student/application-status', { credentials: 'same-origin', cache: 'no-store' })
    ]);
    if (!profileResponse.ok || !statusResponse.ok) throw new Error('Could not load your application summary.');
    const profileResult = await profileResponse.json();
    const status = await statusResponse.json();
    const profile = profileResult.profile;
    const fullName = `${profile.givenName} ${profile.middleName ? `${profile.middleName} ` : ''}${profile.lastName}`.trim();
    nameEl.textContent = fullName;
    emailEl.textContent = profileResult.email;
    document.title = `Application Summary - ${profile.applicantId}`;

    showValue(0, profile.sex);
    showValue(1, [profile.address.streetAddress, profile.address.barangay, profile.address.city,
      profile.address.region, profile.address.country].filter(Boolean).join(', '));
    showValue(2, profile.phone);
    showValue(3, formatDate(profile.createdAt));
    showValue(4, formatDate(status.schedule?.bookedAt));
    showValue(5, 'See Admissions Department');
    showValue(6, formatDate(status.schedule?.examDate));
    showValue(7, status.schedule ? `${status.schedule.startTime} - ${status.schedule.endTime}` : '—');
    showValue(8, status.schedule?.facilityId || 'To be assigned');

    const qrContainer = document.getElementById('summaryQrCode');
    if (qrContainer && typeof QRCode !== 'undefined') {
      qrContainer.replaceChildren();
      new QRCode(qrContainer, {
        text: JSON.stringify({ type: 'OEEMS_APPLICATION', applicantId: profile.applicantId }),
        width: 130,
        height: 130,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    }
    return status;
  }

  downloadButton?.addEventListener('click', () => {
    window.location.assign('/api/student/application/summary.pdf');
  });

  submitButton?.addEventListener('click', async () => {
    submitButton.disabled = true;
    try {
      const response = await fetch('/api/student/application/submit', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not submit the application.');
      if (!result.emailSent && !result.alreadySubmitted) {
        window.alert('Your application was received, but the confirmation email could not be sent. Please contact the Admissions Department.');
      }
      window.location.replace(result.redirectUrl || '/student/');
    } catch (error) {
      window.alert(error.message);
      submitButton.disabled = false;
    }
  });

  loadSummary().catch((error) => {
    console.error(error.message);
    window.alert(error.message);
  });
  window.addEventListener('oeems:student-update', () => {
    loadSummary().catch((error) => console.error(error.message));
  });
});