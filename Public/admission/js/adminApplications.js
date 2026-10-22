document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('applicationsTableBody');
  const documentDialog = document.getElementById('applicationDocumentDialog');
  const documentTitle = document.getElementById('applicationDocumentTitle');
  const documentEmpty = document.getElementById('applicationDocumentEmpty');
  const documentImage = document.getElementById('applicationDocumentImage');
  const summaryDialog = document.getElementById('applicationSummaryDialog');
  const summaryContent = document.getElementById('applicationSummaryModalContent');
  const rejectDialog = document.getElementById('rejectApplicationDialog');
  const rejectTitle = document.getElementById('rejectApplicationTitle');
  const reviewError = document.getElementById('reviewActionError');
  const rejectButton = document.getElementById('confirmRejectApplication');
  const documentTypes = [
    { key: 'form138', label: 'Form-138 / Report Card' },
    { key: 'psa_birth_certificate', label: 'PSA Birth Certificate' },
    { key: 'good_moral', label: 'Good Moral' }
  ];
  let applications = [];
  let sort = { field: 'date', direction: 'desc' };
  let pendingReject = null;
  let previewUrl = '';

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: { ...(options.headers || {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.assign('/admission/adminLoginPage.html');
      throw new Error('Admission administrator authentication required.');
    }
    if (!response.ok) throw new Error(result.error || 'Request failed.');
    return result;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-PH', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Manila'
    });
  }

  function sortedApplications() {
    return [...applications].sort((left, right) => {
      const direction = sort.direction === 'asc' ? 1 : -1;
      if (sort.field === 'name') return (left.name || '').localeCompare(right.name || '') * direction;
      return (new Date(left.submittedAt) - new Date(right.submittedAt)) * direction;
    });
  }

  function renderTable() {
    tableBody.replaceChildren();
    const rows = sortedApplications();
    if (!rows.length) {
      const row = element('tr');
      const cell = element('td', 'applications-empty', 'No submitted applications are awaiting review.');
      cell.colSpan = 7;
      row.appendChild(cell);
      tableBody.appendChild(row);
      return;
    }

    rows.forEach((application) => {
      const row = element('tr');
      row.dataset.applicantId = application.applicantId;
      row.append(
        element('td', 'col-name', application.name || application.applicantId),
        element('td', 'col-date', formatDate(application.submittedAt))
      );

      documentTypes.forEach((type) => {
        const cell = element('td', 'col-doc');
        const preview = element('button', 'document-preview-btn', 'PREVIEW');
        preview.type = 'button';
        preview.setAttribute('aria-label', `Preview ${type.label} for ${application.name}`);
        preview.addEventListener('click', () => previewDocument(application, type));
        cell.appendChild(preview);
        row.appendChild(cell);
      });

      const summaryCell = element('td');
      const summaryButton = element('button', 'application-review-btn', 'REVIEW');
      summaryButton.type = 'button';
      summaryButton.addEventListener('click', () => openSummary(application));
      summaryCell.appendChild(summaryButton);
      row.appendChild(summaryCell);

      const actionCell = element('td', 'col-approval');
      const actionGroup = element('div', 'action-btn-group');
      const approve = element('button', 'btn-approve', 'APPROVE');
      approve.type = 'button';
      approve.addEventListener('click', () => reviewApplication(application, 'approve'));
      const reject = element('button', 'btn-decline', 'REJECT');
      reject.type = 'button';
      reject.addEventListener('click', () => askToReject(application));
      actionGroup.append(approve, reject);
      actionCell.appendChild(actionGroup);
      row.appendChild(actionCell);
      tableBody.appendChild(row);
    });
  }

  async function loadApplications() {
    tableBody.innerHTML = '<tr><td colspan="7" class="applications-empty">Loading submitted applications...</td></tr>';
    try {
      const result = await api('/api/admin/applications');
      applications = result.applications || [];
      renderTable();
    } catch (error) {
      tableBody.replaceChildren();
      const row = element('tr');
      const cell = element('td', 'applications-empty', error.message);
      cell.colSpan = 7;
      row.appendChild(cell);
      tableBody.appendChild(row);
    }
  }

  async function previewDocument(application, type) {
    documentTitle.textContent = `${type.label} — ${application.name}`;
    documentEmpty.hidden = true;
    documentImage.hidden = true;
    documentImage.removeAttribute('src');
    documentDialog.showModal();
    try {
      const url = `/api/admin/applications/${encodeURIComponent(application.applicantId)}/documents/${type.key}`;
      const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) {
        documentEmpty.textContent = 'No uploaded image is available. This document may be submitted physically to the Admission Office.';
        documentEmpty.hidden = false;
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(await response.blob());
      documentImage.src = previewUrl;
      documentImage.alt = `${type.label} for ${application.name}`;
      documentImage.hidden = false;
    } catch {
      documentEmpty.textContent = 'Could not load the document preview. Please try again.';
      documentEmpty.hidden = false;
    }
  }

  function addSummaryField(container, label, value) {
    const row = element('p');
    row.append(element('strong', '', `${label}: `), document.createTextNode(value || '—'));
    container.appendChild(row);
  }

  async function openSummary(application) {
    summaryContent.replaceChildren(element('p', '', 'Loading application details...'));
    summaryDialog.showModal();
    try {
      const result = await api(`/api/admin/applications/${encodeURIComponent(application.applicantId)}/summary`);
      const profile = result.profile || {};
      const address = profile.address || {};
      const schedule = result.schedule || {};
      summaryContent.replaceChildren();
      addSummaryField(summaryContent, 'Application ID', result.applicantId);
      addSummaryField(summaryContent, 'Last Name', profile.lastName);
      addSummaryField(summaryContent, 'Given Name', profile.givenName);
      addSummaryField(summaryContent, 'Middle Name', profile.middleName || 'N/A');
      addSummaryField(summaryContent, 'Suffix', profile.suffix || 'N/A');
      addSummaryField(summaryContent, 'Country', address.country);
      addSummaryField(summaryContent, 'Region', address.region);
      addSummaryField(summaryContent, 'City/Municipality', address.city);
      addSummaryField(summaryContent, 'Barangay', address.barangay);
      addSummaryField(summaryContent, 'Home Address', address.streetAddress || address.street);
      addSummaryField(summaryContent, 'Mobile Number', result.phone || profile.phone);
      addSummaryField(summaryContent, 'Email Address', result.email);
      addSummaryField(summaryContent, 'Exam Date', formatDate(schedule.examDate));
      addSummaryField(summaryContent, 'Batch', String(schedule.batch || '').replace(/^batch_/, 'Batch '));
      addSummaryField(summaryContent, 'Exam Time', `${schedule.startTime || '—'} - ${schedule.endTime || '—'}`);
      addSummaryField(summaryContent, 'Submission Date', formatDate(result.submittedAt));
    } catch (error) {
      summaryContent.replaceChildren(element('p', '', error.message));
    }
  }

  function askToReject(application) {
    pendingReject = application;
    rejectTitle.textContent = `Reject ${application.name}?`;
    reviewError.textContent = '';
    rejectDialog.showModal();
  }

  async function reviewApplication(application, decision) {
    try {
      await api(`/api/admin/applications/${encodeURIComponent(application.applicantId)}/review`, {
        method: 'PUT',
        body: JSON.stringify({ decision })
      });
      applications = applications.filter((item) => item.applicantId !== application.applicantId);
      renderTable();
      return true;
    } catch (error) {
      if (decision === 'reject') reviewError.textContent = error.message;
      else window.alert(error.message);
      return false;
    }
  }

  rejectButton.addEventListener('click', async () => {
    if (!pendingReject) return;
    rejectButton.disabled = true;
    const rejected = await reviewApplication(pendingReject, 'reject');
    if (rejected) rejectDialog.close();
    rejectButton.disabled = false;
    if (rejected) pendingReject = null;
  });

  document.getElementById('cancelRejectApplication').addEventListener('click', () => rejectDialog.close());
  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog).close());
  });
  document.querySelectorAll('.applications-sort').forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.dataset.sort;
      sort.direction = sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc';
      sort.field = field;
      renderTable();
    });
  });
  documentDialog.addEventListener('close', () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    documentImage.removeAttribute('src');
  });

  loadApplications();
});