document.addEventListener('oeems:profile-loaded', (event) => {
  const qrContainer = document.getElementById('soappQrCode');
  if (!qrContainer || typeof QRCode === 'undefined') return;

  const applicantId = event.detail.profile.applicantId;
  qrContainer.replaceChildren();
  new QRCode(qrContainer, {
    text: JSON.stringify({ type: 'OEEMS_SOAPP', applicantId }),
    width: 100,
    height: 100,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
});