document.addEventListener('DOMContentLoaded', () => {
  const documentDialog = document.getElementById('applicationDocumentDialog');
  const documentTitle = document.getElementById('applicationDocumentTitle');
  const documentEmpty = document.getElementById('applicationDocumentEmpty');
  const documentImage = document.getElementById('applicationDocumentImage');
  const documentViewport = document.getElementById('applicationDocumentViewport');
  const documentZoomOut = document.getElementById('documentZoomOut');
  const documentZoomIn = document.getElementById('documentZoomIn');
  const documentZoomReset = document.getElementById('documentZoomReset');
  const documentZoomLevel = document.getElementById('documentZoomLevel');
  const summaryDialog = document.getElementById('applicationSummaryDialog');
  const summaryContent = document.getElementById('applicationSummaryModalContent');
  const rejectDialog = document.getElementById('rejectApplicationDialog');
  const rejectTitle = document.getElementById('rejectApplicationTitle');
  const reviewError = document.getElementById('reviewActionError');
  const rejectButton = document.getElementById('confirmRejectApplication');
  const documentTypes = [
    { key: 'form138', label: 'Form-138 / Report Card' },
    { key: 'picture_2x2', label: '2x2 Picture' },
    { key: 'good_moral', label: 'Good Moral' }
  ];
  const pageSize = 10;
  const queues = {
    active: { items: [], page: 0, body: document.getElementById('applicationsTableBody'), prev: document.getElementById('applicationsPrev'), next: document.getElementById('applicationsNext'), label: document.getElementById('applicationsPageLabel') },
    restored: { items: [], page: 0, body: document.getElementById('restoredTableBody'), prev: document.getElementById('restoredPrev'), next: document.getElementById('restoredNext'), label: document.getElementById('restoredPageLabel') }
  };
  const activityPanel = document.getElementById('activitiesListPanel');
  const activityTitle = document.getElementById('activitiesListTitle');
  const activityBody = document.getElementById('activitiesListBody');
  const activityPrev = document.getElementById('activitiesPrev');
  const activityNext = document.getElementById('activitiesNext');
  const activityPageLabel = document.getElementById('activitiesPageLabel');
  let activityItems = [];
  let activityPage = 0;
  let activityStatus = '';
  let sort = { field: 'date', direction: 'desc' };
  let pendingReject = null;
  let pendingApprove = null;
  let previewUrl = '';
  let documentZoom = 1;

  function setDocumentZoom(nextZoom) {
    documentZoom = Math.min(4, Math.max(1, nextZoom));
    if (documentImage) documentImage.style.transform = `scale(${documentZoom})`;
    if (documentZoomLevel) documentZoomLevel.textContent = `${Math.round(documentZoom * 100)}%`;
    if (documentZoomOut) documentZoomOut.disabled = documentZoom <= 1;
    if (documentZoomIn) documentZoomIn.disabled = documentZoom >= 4;
  }

  function resetDocumentZoom() {
    setDocumentZoom(1);
    if (documentViewport?.scrollTo) documentViewport.scrollTo({ left: 0, top: 0 });
  }

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

  function sortedItems(items) {
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...items].sort((left, right) => sort.field === 'name'
      ? (left.name || '').localeCompare(right.name || '') * direction
      : (new Date(left.submittedAt) - new Date(right.submittedAt)) * direction);
  }

  function makePreviewButton(application, type) {
    const button = element('button', 'document-preview-btn', 'PREVIEW');
    button.type = 'button';
    button.setAttribute('aria-label', `Preview ${type.label} for ${application.name}`);
    button.addEventListener('click', () => previewDocument(application, type));
    return button;
  }

  function makeSummaryButton(application) {
    const button = element('button', 'application-review-btn', 'REVIEW');
    button.type = 'button';
    button.addEventListener('click', () => openSummary(application));
    return button;
  }

  function makeApprovalActions(application) {
    const group = element('div', 'action-btn-group');
    const approve = element('button', 'btn-approve', 'APPROVE');
    approve.type = 'button';
    approve.addEventListener('click', () => askToApprove(application));
    const reject = element('button', 'btn-decline', 'REJECT');
    reject.type = 'button';
    reject.addEventListener('click', () => askToReject(application));
    group.append(approve, reject);
    return group;
  }

  function renderQueue(key) {
    const queue = queues[key];
    const rows = sortedItems(queue.items);
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    queue.page = Math.min(queue.page, pageCount - 1);
    const start = queue.page * pageSize;
    queue.body.replaceChildren();
    if (!rows.length) {
      const row = element('tr');
      const cell = element('td', 'applications-empty', key === 'active' ? 'No active applications.' : 'No restored applications.');
      cell.colSpan = 7;
      row.appendChild(cell);
      queue.body.appendChild(row);
    } else {
      rows.slice(start, start + pageSize).forEach((application) => {
        const row = element('tr');
        row.dataset.applicantId = application.applicantId;
        row.append(
          element('td', 'col-name', application.name || application.applicantId),
          element('td', 'col-date', formatDate(application.submittedAt))
        );
        documentTypes.forEach((type) => {
          const cell = element('td', 'col-doc');
          cell.appendChild(makePreviewButton(application, type));
          row.appendChild(cell);
        });
        const summaryCell = element('td');
        summaryCell.appendChild(makeSummaryButton(application));
        row.appendChild(summaryCell);
        const actionCell = element('td', 'col-approval');
        actionCell.appendChild(makeApprovalActions(application));
        row.appendChild(actionCell);
        queue.body.appendChild(row);
      });
    }
    queue.label.textContent = `Page ${queue.page + 1} of ${pageCount}`;
    queue.prev.disabled = queue.page === 0;
    queue.next.disabled = queue.page >= pageCount - 1;
  }

  async function loadQueues() {
    for (const queue of Object.values(queues)) {
      queue.body.innerHTML = '<tr><td colspan="7" class="applications-empty">Loading applications...</td></tr>';
    }
    try {
      const [active, restored] = await Promise.all([
        api('/api/admin/applications?queue=active'),
        api('/api/admin/applications?queue=restored')
      ]);
      queues.active.items = active.applications || [];
      queues.restored.items = restored.applications || [];
      renderQueue('active');
      renderQueue('restored');
    } catch (error) {
      Object.values(queues).forEach((queue) => {
        const row = element('tr');
        const cell = element('td', 'applications-empty', error.message);
        cell.colSpan = 7;
        row.replaceChildren(cell);
        queue.body.replaceChildren(row);
      });
    }
  }

  function renderActivities() {
    const pageCount = Math.max(1, Math.ceil(activityItems.length / pageSize));
    activityPage = Math.min(activityPage, pageCount - 1);
    const rows = sortedItems(activityItems).slice(activityPage * pageSize, (activityPage + 1) * pageSize);
    activityBody.replaceChildren();
    if (!rows.length) {
      const row = element('tr');
      const cell = element('td', 'applications-empty', `No ${activityStatus} applications.`);
      cell.colSpan = 4;
      row.appendChild(cell);
      activityBody.appendChild(row);
    } else {
      rows.forEach((application) => {
        const row = element('tr');
        row.append(
          element('td', 'col-name', application.name || application.applicantId),
          element('td', 'col-date', formatDate(application.submittedAt)),
          element('td', '', activityStatus.toUpperCase())
        );
        const actionCell = element('td');
        const restore = element('button', 'btn-restore-application', 'RESTORE');
        restore.type = 'button';
        restore.addEventListener('click', () => restoreApplication(application));
        actionCell.appendChild(restore);
        row.appendChild(actionCell);
        activityBody.appendChild(row);
      });
    }
    activityPageLabel.textContent = `Page ${activityPage + 1} of ${pageCount}`;
    activityPrev.disabled = activityPage === 0;
    activityNext.disabled = activityPage >= pageCount - 1;
  }

  async function showActivities(status) {
    activityStatus = status;
    activityPage = 0;
    activityPanel.hidden = false;
    activityTitle.textContent = `${status[0].toUpperCase()}${status.slice(1)} Applications`;
    activityBody.innerHTML = '<tr><td colspan="4" class="applications-empty">Loading activities...</td></tr>';
    try {
      const result = await api(`/api/admin/applications?status=${status}`);
      activityItems = result.applications || [];
      renderActivities();
    } catch (error) {
      activityItems = [];
      activityBody.replaceChildren();
      const row = element('tr');
      const cell = element('td', 'applications-empty', error.message);
      cell.colSpan = 4;
      row.appendChild(cell);
      activityBody.appendChild(row);
    }
  }

  async function restoreApplication(application) {
    try {
      await api(`/api/admin/applications/${encodeURIComponent(application.applicantId)}/restore`, { method: 'PUT', body: '{}' });
      await Promise.all([loadQueues(), showActivities(activityStatus)]);
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function previewDocument(application, type) {
    documentTitle.textContent = `${type.label} — ${application.name}`;
    documentEmpty.hidden = true;
    documentImage.hidden = true;
    documentImage.removeAttribute('src');
    resetDocumentZoom();
    documentDialog.showModal();
    try {
      const url = `/api/admin/applications/${encodeURIComponent(application.applicantId)}/documents/${type.key}`;
      const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) {
        documentEmpty.textContent = 'No uploaded image is available.';
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

  function askToApprove(application) {
    pendingApprove = application;
    document.getElementById('approveApplicationTitle').textContent = `Approve ${application.name}?`;
    document.getElementById('approveApplicationNotice').textContent = `Approve ${application.name} - Application will send the approved application notice via email with the attached 'Statement of Application' PDF. This action cannot be undone.`;
    document.getElementById('approveApplicationDialog').showModal();
  }

  function askToReject(application) {
    pendingReject = application;
    rejectTitle.textContent = `Reject ${application.name}?`;
    reviewError.textContent = '';
    rejectDialog.querySelectorAll('[name="rejectionCause"]').forEach((input) => { input.checked = false; });
    document.getElementById('otherRejectionMessage').value = '';
    document.getElementById('otherRejectionWrap').hidden = true;
    rejectDialog.showModal();
  }

  async function reviewApplication(application, decision, rejection) {
    try {
      await api(`/api/admin/applications/${encodeURIComponent(application.applicantId)}/review`, {
        method: 'PUT', body: JSON.stringify({ decision, ...rejection })
      });
      await loadQueues();
      if (activityStatus) await showActivities(activityStatus);
      return true;
    } catch (error) {
      if (decision === 'reject') reviewError.textContent = error.message;
      else window.alert(error.message);
      return false;
    }
  }

  rejectDialog.querySelectorAll('[name="rejectionCause"]').forEach((input) => {
    input.addEventListener('change', () => {
      const otherWrap = document.getElementById('otherRejectionWrap');
      otherWrap.hidden = input.value !== 'Others';
      if (input.value !== 'Others') document.getElementById('otherRejectionMessage').value = '';
      reviewError.textContent = '';
    });
  });
  rejectButton.addEventListener('click', async () => {
    if (!pendingReject) return;
    const selected = rejectDialog.querySelector('[name="rejectionCause"]:checked');
    if (!selected) {
      reviewError.textContent = 'Select a rejection cause.';
      return;
    }
    const rejection = { rejectionCause: selected.value };
    if (selected.value === 'Others') {
      rejection.rejectionMessage = document.getElementById('otherRejectionMessage').value.trim();
      if (!rejection.rejectionMessage) {
        reviewError.textContent = 'Enter a personalized rejection message.';
        return;
      }
    }
    rejectButton.disabled = true;
    const rejected = await reviewApplication(pendingReject, 'reject', rejection);
    if (rejected) rejectDialog.close();
    rejectButton.disabled = false;
    if (rejected) pendingReject = null;
  });

  document.getElementById('cancelRejectApplication').addEventListener('click', () => rejectDialog.close());
  document.getElementById('cancelApproveApplication').addEventListener('click', () => document.getElementById('approveApplicationDialog').close());
  document.getElementById('confirmApproveApplication').addEventListener('click', async () => {
    if (!pendingApprove) return;
    const confirmButton = document.getElementById('confirmApproveApplication');
    confirmButton.disabled = true;
    const approved = await reviewApplication(pendingApprove, 'approve');
    if (approved) document.getElementById('approveApplicationDialog').close();
    confirmButton.disabled = false;
    if (approved) pendingApprove = null;
  });
  document.getElementById('closeActivitiesList').addEventListener('click', () => {
    activityPanel.hidden = true;
    activityStatus = '';
  });
  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog).close());
  });
  document.querySelectorAll('.applications-sort').forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.dataset.sort;
      sort.direction = sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc';
      sort.field = field;
      Object.keys(queues).forEach(renderQueue);
    });
  });
  document.querySelectorAll('.activity-filter-btn').forEach((button) => {
    button.addEventListener('click', () => showActivities(button.dataset.activityStatus));
  });
  Object.entries(queues).forEach(([key, queue]) => {
    queue.prev.addEventListener('click', () => { queue.page -= 1; renderQueue(key); });
    queue.next.addEventListener('click', () => { queue.page += 1; renderQueue(key); });
  });
  activityPrev.addEventListener('click', () => { activityPage -= 1; renderActivities(); });
  activityNext.addEventListener('click', () => { activityPage += 1; renderActivities(); });
  documentZoomOut?.addEventListener('click', () => setDocumentZoom(documentZoom - 0.25));
  documentZoomIn?.addEventListener('click', () => setDocumentZoom(documentZoom + 0.25));
  documentZoomReset?.addEventListener('click', resetDocumentZoom);
  documentViewport?.addEventListener('wheel', (event) => {
    event.preventDefault();
    setDocumentZoom(documentZoom + (event.deltaY < 0 ? 0.25 : -0.25));
  }, { passive: false });
  documentDialog.addEventListener('close', () => {
    resetDocumentZoom();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    documentImage.removeAttribute('src');
  });

  loadQueues();
});
/* Legacy duplicate application-script block removed; active implementation is above.
if (false) document.addEventListener('DOMContentLoaded', () => {
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
    { key: 'picture_2x2', label: '2x2 Picture' },
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
    resetDocumentZoom();
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

  async function legacyReviewApplication() {
    throw new Error('Legacy application review handler is disabled.');
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
*/