/* =========================================
   DISCLAIMER MODAL
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  const disclaimerModal = document.getElementById('disclaimerModal');
  const openDisclaimerBtn = document.getElementById('openDisclaimer');
  const closeDisclaimerBtn = document.getElementById('closeDisclaimer');
  const okDisclaimerBtn = document.getElementById('okDisclaimer');

  if (openDisclaimerBtn && disclaimerModal) {
    openDisclaimerBtn.addEventListener('click', () => {
      disclaimerModal.classList.remove('hidden');
    });
  }

  if (closeDisclaimerBtn && disclaimerModal) {
    closeDisclaimerBtn.addEventListener('click', () => {
      disclaimerModal.classList.add('hidden');
    });
  }

  if (okDisclaimerBtn && disclaimerModal) {
    okDisclaimerBtn.addEventListener('click', () => {
      disclaimerModal.classList.add('hidden');
    });
  }
});