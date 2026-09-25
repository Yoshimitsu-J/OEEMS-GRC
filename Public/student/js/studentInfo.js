/* =========================================
   STUDENT INFO — Load data + Real QR Code
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Student Info JS Initialized.');

  const applicantData = JSON.parse(localStorage.getItem('applicantData') || '{}');
  const accountInfo   = JSON.parse(localStorage.getItem('accountInfo')   || '{}');

  const data = {
    applicantId: applicantData.applicantId || accountInfo.applicantId || '012345',
    firstName:  applicantData.givenName  || accountInfo.givenName  || 'Juan',
    lastName:   applicantData.lastName   || accountInfo.lastName   || 'Dela Cruz',
    middleName: applicantData.middleName || accountInfo.middleName || '',
    email:      applicantData.email      || 'juandelacruz1@gmail.com',
    sex:        applicantData.sex        || 'Male',
    birthday:   applicantData.birthday   || '2006-01-15',
    phone:      applicantData.phone      || '9123456789',
    country:    applicantData.country    || 'Philippines',
    region:     applicantData.region     || 'NCR',
    city:       applicantData.city       || 'Caloocan',
    barangay:   applicantData.barangay   || 'Barangay 81',
    street:     applicantData.streetAddress || '81 10th Avenue, Ext. Cor. Grace Park',
    guardianName:  applicantData.guardianName  || 'Maria D. Bee',
    guardianPhone: applicantData.guardianPhone || '9987654321'
  };

  const fullName = `${data.firstName} ${data.middleName ? data.middleName + ' ' : ''}${data.lastName}`;

  document.getElementById('applicantId').textContent = data.applicantId;
  document.getElementById('studentName').textContent = fullName;
  document.getElementById('studentEmail').textContent = data.email;
  document.getElementById('studentStatus').textContent = 'Application Submitted';

  document.getElementById('infoSex').textContent = data.sex;
  document.getElementById('infoBirthday').textContent = formatDate(data.birthday);
  document.getElementById('infoPhone').textContent = '+63 ' + formatPhone(data.phone);
  document.getElementById('infoCountry').textContent = data.country;

  document.getElementById('infoRegion').textContent = data.region;
  document.getElementById('infoCity').textContent = data.city + ' City';
  document.getElementById('infoBarangay').textContent = data.barangay;
  document.getElementById('infoStreet').textContent = data.street;

  document.getElementById('infoGuardianName').textContent = data.guardianName;
  document.getElementById('infoGuardianPhone').textContent = '+63 ' + formatPhone(data.guardianPhone);

  const studentPhoto = document.getElementById('studentPhoto');
  const savedPhoto = localStorage.getItem('studentPhoto');
  if (savedPhoto && studentPhoto) studentPhoto.src = savedPhoto;

  // GENERATE REAL QR
  generateRealQRCode(data);

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function formatPhone(phone) {
    if (!phone) return '—';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
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

    const qrData = JSON.stringify({
      type: 'GRC_APPLICANT',
      applicantId: data.applicantId,
      name: `${data.lastName}, ${data.firstName}${data.middleName ? ' ' + data.middleName : ''}`,
      email: data.email,
      phone: data.phone,
      examDate: '2026-04-15',
      examTime: '07:30',
      examFacility: 'COMLAB1 2F',
      verifyUrl: `https://grc.edu.ph/verify/${data.applicantId}`
    });

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