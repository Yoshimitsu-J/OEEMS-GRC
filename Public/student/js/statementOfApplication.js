document.addEventListener('oeems:profile-loaded', (event) => {
  const qrContainer = document.getElementById('soappQrCode');
  if (!qrContainer || typeof QRCode === 'undefined') return;

  const profile = event.detail.profile;
  const address = profile.address || {};
  const fullAddress = [address.streetAddress || address.street, address.barangay, address.city, address.region, address.country].filter(Boolean).join(', ');
  const fullName = [profile.givenName, profile.middleName, profile.lastName, profile.suffix].filter(Boolean).join(' ');
  qrContainer.replaceChildren();
  new QRCode(qrContainer, {
    text: JSON.stringify({
      type: 'OEEMS_SOAPP',
      applicationCode: profile.applicantId,
      applicantId: profile.applicantId,
      name: fullName,
      address: fullAddress,
      contactNumber: profile.phone || '',
      email: event.detail.email || '',
      examDate: document.querySelector('[data-application="examDate"]')?.textContent || null,
      examBatch: document.querySelector('[data-application="batch"]')?.textContent || null,
      examTime: document.querySelector('[data-application="examTime"]')?.textContent || null
    }),
    width: 216,
    height: 216,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
});