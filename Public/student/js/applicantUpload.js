document.addEventListener('DOMContentLoaded', () => {
  const requiredDocumentTypes = ['form138', 'good_moral', 'picture_2x2'];
  const fileInputs = [...document.querySelectorAll('.btn-upload input[type="file"]')];
  const uploadButton = document.getElementById('uploadDocumentsBtn');
  const uploadNote = document.querySelector('.upload-required');
  const progressCount = document.getElementById('uploadProgressCount');
  const progressBar = document.getElementById('uploadProgressBar');
  const progressFill = document.getElementById('uploadProgressFill');
  const editDialog = document.getElementById('documentEditDialog');
  const editError = document.getElementById('documentEditError');
  const beginEditButton = document.getElementById('beginDocumentEdit');
  const keepDocumentsButton = document.getElementById('keepDocuments');
  const uploadSubmitDialog = document.getElementById('uploadSubmitDialog');
  const uploadSubmitError = document.getElementById('uploadSubmitError');
  const confirmUploadSubmitButton = document.getElementById('confirmUploadSubmit');
  const cancelUploadSubmitButton = document.getElementById('cancelUploadSubmit');
  const uploaded = new Set();
  const pendingUploads = new Set();

  async function readApiResponse(response, fallbackMessage) {
    const bodyText = await response.text();
    try {
      return bodyText ? JSON.parse(bodyText) : {};
    } catch {
      throw new Error(`${fallbackMessage} (server returned HTTP ${response.status}).`);
    }
  }

  function updateProgress() {
    const count = uploaded.size;
    progressCount.textContent = `${count}/${requiredDocumentTypes.length}`;
    progressBar.setAttribute('aria-valuenow', String(count));
    progressFill.style.width = `${(count / requiredDocumentTypes.length) * 100}%`;
    uploadButton.disabled = count !== requiredDocumentTypes.length || pendingUploads.size > 0;
  }

  function statusElement(input) {
    return input.closest('.upload-controls')?.querySelector('.upload-status');
  }

  async function readProgress(promptForReEdit = false) {
    const response = await fetch('/api/student/application-status', {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const status = await readApiResponse(response, 'Could not load saved document status');
    if (!response.ok) throw new Error(status.error || 'Could not load saved document status.');

    uploaded.clear();
    fileInputs.forEach((input) => {
      const existing = status.documentStatuses?.find((document) => document.documentType === input.dataset.documentType);
      const statusEl = statusElement(input);
      const removeButton = document.querySelector(`[data-remove-document="${input.dataset.documentType}"]`);
      if (existing && ['submitted', 'under_review', 'accepted'].includes(existing.verificationStatus)) {
        uploaded.add(existing.documentType);
        if (statusEl) statusEl.textContent = existing.originalName || 'Uploaded';
        if (removeButton) removeButton.hidden = false;
      } else if (statusEl && !pendingUploads.has(input.dataset.documentType)) {
        statusEl.textContent = 'No file selected';
        if (removeButton) removeButton.hidden = true;
      }
    });

    updateProgress();
    if (promptForReEdit && uploaded.size > 0 && !editDialog.open) editDialog.showModal();
    return status;
  }

  fileInputs.forEach((input) => {
    const documentType = input.dataset.documentType;
    input.accept = '.jpg,.jpeg,.png,image/jpeg,image/png';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file || !requiredDocumentTypes.includes(documentType)) return;
      if (file.size > 10 * 1024 * 1024) {
        if (statusElement(input)) statusElement(input).textContent = 'File exceeds the 10 MB limit.';
        input.value = '';
        return;
      }
      pendingUploads.add(documentType);
      if (uploadNote) uploadNote.textContent = 'Uploading selected documents...';
      if (statusElement(input)) statusElement(input).textContent = 'Uploading...';
      updateProgress();

      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await fetch(`/api/student/documents/${documentType}`, {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
          cache: 'no-store'
        });
        const result = await readApiResponse(response, 'Could not upload this file');
        if (!response.ok) throw new Error(result.error || 'Could not upload this file.');
        uploaded.add(documentType);
        if (statusElement(input)) statusElement(input).textContent = result.originalName || 'Uploaded';
        const removeButton = document.querySelector(`[data-remove-document="${documentType}"]`);
        if (removeButton) removeButton.hidden = false;
        if (uploadNote) uploadNote.textContent = 'Required documents saved. Select UPLOAD when all three are ready.';
      } catch (error) {
        if (statusElement(input)) statusElement(input).textContent = error.message;
      } finally {
        pendingUploads.delete(documentType);
        input.value = '';
        updateProgress();
      }
    });
  });

  document.querySelectorAll('[data-remove-document]').forEach((removeButton) => {
    removeButton.addEventListener('click', async () => {
      const documentType = removeButton.dataset.removeDocument;
      const statusEl = document.querySelector(`[data-document-type="${documentType}"]`)?.closest('.upload-controls')?.querySelector('.upload-status');
      removeButton.disabled = true;
      pendingUploads.add(documentType);
      updateProgress();
      if (statusEl) statusEl.textContent = 'Removing...';
      try {
        const response = await fetch(`/api/student/documents/${documentType}`, {
          method: 'DELETE',
          credentials: 'same-origin',
          cache: 'no-store'
        });
        const result = await readApiResponse(response, 'Could not remove this document');
        if (!response.ok) throw new Error(result.error || 'Could not remove this document.');
        uploaded.delete(documentType);
        if (statusEl) statusEl.textContent = 'No file selected';
        removeButton.hidden = true;
        if (uploadNote) uploadNote.textContent = 'Select another file for this required document.';
        updateProgress();
        window.dispatchEvent(new CustomEvent('oeems:student-update'));
      } catch (error) {
        if (statusEl) statusEl.textContent = error.message;
      } finally {
        removeButton.disabled = false;
        pendingUploads.delete(documentType);
        updateProgress();
      }
    });
  });

  async function submitDocuments() {
    if (uploadButton.disabled) return;
    confirmUploadSubmitButton.disabled = true;
    cancelUploadSubmitButton.disabled = true;
    uploadSubmitError.textContent = '';
    if (uploadNote) uploadNote.textContent = 'Saving document progress...';
    try {
      const response = await fetch('/api/student/documents/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({})
      });
      const result = await readApiResponse(response, 'Could not save document progress');
      if (!response.ok) throw new Error(result.error || 'Could not save document progress.');
      window.location.assign(result.redirectUrl || '/student/applicationSummary.html');
    } catch (error) {
      uploadSubmitError.textContent = error.message;
      confirmUploadSubmitButton.disabled = false;
      cancelUploadSubmitButton.disabled = false;
      if (uploadNote) uploadNote.textContent = error.message;
    }
  }

  uploadButton.addEventListener('click', (event) => {
    event.preventDefault();
    if (uploadButton.disabled) return;
    uploadSubmitDialog.showModal();
  });

  confirmUploadSubmitButton.addEventListener('click', submitDocuments);
  cancelUploadSubmitButton.addEventListener('click', () => {
    uploadSubmitDialog.close();
    confirmUploadSubmitButton.disabled = false;
    cancelUploadSubmitButton.disabled = false;
  });

  keepDocumentsButton.addEventListener('click', () => {
    editDialog.close();
    window.location.assign('/student/');
  });

  beginEditButton.addEventListener('click', async () => {
    beginEditButton.disabled = true;
    keepDocumentsButton.disabled = true;
    editError.textContent = '';
    try {
      const response = await fetch('/api/student/documents/re-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({})
      });
      const result = await readApiResponse(response, 'Could not reopen document editing');
      if (!response.ok) throw new Error(result.error || 'Could not reopen document editing.');
      editDialog.close();
      if (uploadNote) uploadNote.textContent = 'You may now edit your documents. Select UPLOAD again to continue to Application Summary.';
      window.dispatchEvent(new CustomEvent('oeems:student-update'));
    } catch (error) {
      editError.textContent = error.message;
      beginEditButton.disabled = false;
      keepDocumentsButton.disabled = false;
    }
  });

  readProgress(true).catch((error) => {
    if (uploadNote) uploadNote.textContent = error.message;
    uploadButton.disabled = true;
  });
  window.addEventListener('oeems:student-update', () => {
    readProgress(false).catch((error) => console.error(error.message));
  });
});