/* =========================================
   APPLICANT UPLOAD — Track uploaded files
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Applicant Upload JS Initialized.');

  const documentTypes = ['form138', 'good_moral', 'picture_2x2'];
  const uploaded = new Set();
  const fileInputs = document.querySelectorAll('.btn-upload input[type="file"]');
  const applyBtn = document.getElementById('applyUploadBtn');

  async function readProgress() {
    const response = await fetch('/api/student/application-status', {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('Could not load saved document status.');
    const status = await response.json();
    status.documentStatuses.forEach((document) => {
      if (['submitted', 'under_review', 'accepted'].includes(document.verificationStatus)) {
        uploaded.add(document.documentType);
        const index = documentTypes.indexOf(document.documentType);
        const statusEl = fileInputs[index]?.closest('.upload-controls')?.querySelector('.upload-status');
        if (statusEl) statusEl.textContent = document.originalName || 'Uploaded';
      }
    });
  }

  fileInputs.forEach((input, index) => {
    input.accept = '.jpg,.jpeg,.png,image/jpeg,image/png';
    input.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const documentType = documentTypes[index];
      const statusEl = input.closest('.upload-controls')?.querySelector('.upload-status');
      if (statusEl) statusEl.textContent = 'Uploading...';

      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await fetch(`/api/student/documents/${documentType}`, {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
          cache: 'no-store'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not upload this file.');
        uploaded.add(documentType);
        if (statusEl) statusEl.textContent = result.originalName;
      } catch (error) {
        if (statusEl) statusEl.textContent = error.message;
      }
    });
  });

  if (applyBtn) {
    applyBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        await readProgress();
      } catch (error) {
        const note = document.querySelector('.upload-required');
        if (note) note.textContent = error.message;
        return;
      }
      if (uploaded.size !== documentTypes.length) {
        const note = document.querySelector('.upload-required');
        if (note) note.textContent = `Please upload all ${documentTypes.length} required documents. Uploaded: ${uploaded.size} of ${documentTypes.length}.`;
        return;
      }

      window.location.assign('applicationSummary.html');
    });
  }

  readProgress().catch((error) => console.error(error.message));
  window.addEventListener('oeems:student-update', () => {
    readProgress().catch((error) => console.error(error.message));
  });
});