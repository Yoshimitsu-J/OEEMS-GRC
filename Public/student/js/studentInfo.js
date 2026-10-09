/* =========================================
   STUDENT INFO — Load data + Real QR Code
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Student Info JS Initialized.');

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value || '—';
  };

  Promise.all([
    fetch('/api/student/profile', { credentials: 'same-origin', cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error('Could not load student profile.');
      return response.json();
    }),
    fetch('/api/student/application-status', { credentials: 'same-origin', cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error('Could not load application status.');
      return response.json();
    })
  ]).then(([profileResult, status]) => {
    const profile = profileResult.profile;
    const data = {
      applicantId: profile.applicantId,
      firstName: profile.givenName,
      middleName: profile.middleName,
      lastName: profile.lastName,
      email: profileResult.email,
      sex: profile.sex,
      birthday: profile.birthday,
      phone: profile.phone,
      country: profile.address.country,
      region: profile.address.region,
      city: profile.address.city,
      barangay: profile.address.barangay,
      street: profile.address.streetAddress,
      guardianName: profile.guardian.name,
      guardianPhone: profile.guardian.phone
    };
    const fullName = `${data.firstName} ${data.middleName ? `${data.middleName} ` : ''}${data.lastName}`.trim();

    setText('applicantId', data.applicantId);
    setText('studentName', fullName);
    setText('studentEmail', data.email);
    setText('studentStatus', status.applicationStatus);
    setText('infoSex', data.sex);
    setText('infoBirthday', formatDate(data.birthday));
    setText('infoPhone', data.phone);
    setText('infoCountry', data.country);
    setText('infoRegion', data.region);
    setText('infoCity', data.city);
    setText('infoBarangay', data.barangay);
    setText('infoStreet', data.street);
    setText('infoGuardianName', data.guardianName);
    setText('infoGuardianPhone', data.guardianPhone);
    generateRealQRCode(data);
  }).catch((error) => {
    console.error(error.message);
  });

  window.addEventListener('oeems:student-update', async () => {
    try {
      const response = await fetch('/api/student/application-status', {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (response.ok) setText('studentStatus', (await response.json()).applicationStatus);
    } catch (error) {
      console.error('Could not refresh student status:', error.message);
    }
  });

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' });
  }

  function generateRealQRCode(data) {
    const qrContainer = document.getElementById('qrcode');
    if (!qrContainer) return;

    if (typeof QRCode === 'undefined') {
      console.error('QRCode library not loaded.');
      qrContainer.innerHTML = '<p style="color:#999;font-size:11px;">QR unavailable</p>';
      return;
    }

    qrContainer.innerHTML = '';

    const qrData = JSON.stringify({ type: 'OEEMS_APPLICANT', applicantId: data.applicantId });

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
    }
  }
});