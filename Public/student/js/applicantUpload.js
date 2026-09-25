/* =========================================
   APPLICANT UPLOAD — Track uploaded files
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Applicant Upload JS Initialized.');

  const uploaded = {
    form138: false,
    goodMoral: false,
    picture: false
  };

  const fileInputs = document.querySelectorAll('.btn-upload input[type="file"]');

  fileInputs.forEach((input, index) => {
    input.addEventListener('change', (e) => {
      const fileName = e.target.files[0]?.name || 'No file selected';
      const statusEl = e.target.closest('.upload-controls')?.querySelector('.upload-status');
      if (statusEl) statusEl.textContent = fileName;

      // Mark as uploaded
      const keys = ['form138', 'goodMoral', 'picture'];
      if (keys[index]) uploaded[keys[index]] = !!e.target.files[0];

      // I-save sa localStorage
      const uploadedCount = Object.values(uploaded).filter(Boolean).length;
      localStorage.setItem('uploadedDocuments', JSON.stringify({
        ...uploaded,
        count: uploadedCount,
        updatedAt: new Date().toISOString()
      }));

      console.log('Uploaded:', uploadedCount, 'of 3');
    });
  });

  // =========================================
  // CHECK APPLY BUTTON — kailangan kumpleto
  // =========================================
  const applyBtn = document.querySelector('.upload-form-wrapper .btn-primary');
  if (applyBtn) {
    applyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const uploadedCount = Object.values(uploaded).filter(Boolean).length;

      if (uploadedCount < 3) {
        alert(`⚠️ Please upload all 3 required documents.\n\nNaka-upload: ${uploadedCount} of 3`);
        return;
      }

      window.location.href = 'applicationSummary.html';
    });
  }
});