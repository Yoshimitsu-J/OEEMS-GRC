document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('resultsTableBody');
  const selectAll = document.getElementById('selectAllCheckbox');
  const nameFilter = document.getElementById('filterName');
  const resultFilter = document.getElementById('filterResult');
  const sortSelect = document.getElementById('sortBy');
  const passingInput = document.getElementById('passingScoreInput');
  const maxScoreLabel = document.getElementById('maxScoreLabel');
  const passingLabel = document.getElementById('passingScoreLabel');
  const failureDialog = document.getElementById('failureResultDialog');
  const antiCheatingDialog = document.getElementById('antiCheatingDialog');
  const reasons = document.getElementById('failureReasonSelect');
  const customMessage = document.getElementById('failureCustomMessage');
  const failureApplicant = document.getElementById('failureResultApplicant');
  const bulkPassed = document.getElementById('bulkMarkPassedBtn');
  const bulkFailed = document.getElementById('bulkMarkFailedBtn');
  const bulkRestore = document.getElementById('bulkRestoreBtn');
  const bulkDelete = document.getElementById('bulkDeleteBtn');
  const completedBulkBar = document.getElementById('notifiedBulkBar');
  const resultsBulkBar = document.getElementById('bulkActionsBar');
  const filtersRow = document.getElementById('filtersRow');
  const resultsPanel = document.getElementById('resultsTablePanel');
  const summaryPanel = document.getElementById('resultsSummaryPanel');
  const arrivedPanel = document.getElementById('arrivedPanel');
  let results = [];
  let arrivals = [];
  let selected = new Set();
  let currentView = 'results';
  let pendingFailureIds = [];

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: { ...(options.headers || {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) window.location.assign('/admission/adminLoginPage.html');
    if (!response.ok) throw new Error(result.error || 'Request failed.');
    return result;
  }

  function escapeHtml(value) {
    const element = document.createElement('span');
    element.textContent = String(value ?? '');
    return element.innerHTML;
  }

  function visibleResults() {
    const name = nameFilter?.value.trim().toLowerCase() || '';
    const outcome = resultFilter?.value || '';
    const archived = currentView === 'archived';
    let rows = results.filter((item) => item.archived === archived);
    if (name) rows = rows.filter((item) => item.name.toLowerCase().includes(name));
    if (outcome) rows = rows.filter((item) => item.result === outcome);
    const sort = sortSelect?.value || 'name-asc';
    rows.sort((left, right) => {
      if (sort === 'name-desc') return right.name.localeCompare(left.name);
      if (sort === 'score-desc') return right.score - left.score;
      if (sort === 'score-asc') return left.score - right.score;
      if (sort === 'name-asc') return left.name.localeCompare(right.name);
      return 0;
    });
    return rows;
  }

  function updateSelectionControls() {
    const bulkSelected = selected.size;
    const pendingEligible = currentView === 'results' && bulkSelected >= 2;
    if (bulkPassed) bulkPassed.disabled = !pendingEligible;
    if (bulkFailed) bulkFailed.disabled = !pendingEligible;
    if (bulkRestore) bulkRestore.disabled = !(currentView === 'archived' && bulkSelected >= 1);
    if (bulkDelete) bulkDelete.disabled = !(currentView === 'archived' && bulkSelected >= 1);
    const count = document.getElementById('selectedCount');
    const completedCount = document.getElementById('notifiedSelectedCount');
    if (count) count.textContent = String(bulkSelected);
    if (completedCount) completedCount.textContent = String(bulkSelected);
  }

  function render() {
    const rows = visibleResults();
    tableBody.replaceChildren();
    for (const item of rows) {
      const row = document.createElement('tr');
      const categories = Object.entries(item.categories || {}).map(([category, score]) => `<span>${escapeHtml(category)}: ${escapeHtml(score)}</span>`).join('<br>') || '—';
      row.innerHTML = `
        <td class="result-selection-cell"><input type="checkbox" class="table-checkbox result-checkbox" data-id="${escapeHtml(item.id)}" ${selected.has(item.id) ? 'checked' : ''}>${item.newResult ? '<span class="new-result-dot" title="New result"></span>' : ''}</td>
        <td>${escapeHtml(item.name)}<br><small>${escapeHtml(item.applicationId)}</small></td>
        <td>${item.score} / ${item.maxScore}</td>
        <td>${categories}</td>
        <td><span class="result-${item.result}">${item.result.toUpperCase()}</span></td>
        <td>${item.disqualified || item.violations.length ? `<button type="button" class="application-review-btn anti-cheating-view" data-id="${escapeHtml(item.id)}">VIEW</button>` : 'No violations'}</td>
        <td>${currentView === 'archived'
          ? `<button type="button" class="applications-dialog-close restore-result" data-id="${escapeHtml(item.id)}">RESTORE</button>`
          : `<div class="action-btn-group"><button type="button" class="btn-approve passed-action" data-id="${escapeHtml(item.id)}">PASSED</button><button type="button" class="btn-decline failed-action" data-id="${escapeHtml(item.id)}">FAILED</button></div>`}</td>`;
      tableBody.appendChild(row);
    }
    if (!rows.length) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="7" class="applications-empty">No examination results found.</td>`;
      tableBody.appendChild(row);
    }
    bindRows();
    updateSelectionControls();
  }

  function bindRows() {
    document.querySelectorAll('.result-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selected.add(checkbox.dataset.id); else selected.delete(checkbox.dataset.id);
        selectAll.indeterminate = selected.size > 0 && selected.size < visibleResults().length;
        selectAll.checked = selected.size > 0 && selected.size === visibleResults().length;
        updateSelectionControls();
      });
    });
    document.querySelectorAll('.anti-cheating-view').forEach((button) => button.addEventListener('click', () => {
      const item = results.find((result) => result.id === button.dataset.id);
      const content = document.getElementById('antiCheatingContent');
      content.replaceChildren();
      if (!item?.violations.length && !item?.disqualified) content.textContent = 'No anti-cheating violations recorded.';
      else {
        const list = document.createElement('ul');
        item.violations.forEach((violation) => {
          const row = document.createElement('li');
          row.textContent = `${violation.type || violation} — ${violation.timestamp ? new Date(violation.timestamp).toLocaleString() : 'Timestamp unavailable'}`;
          list.appendChild(row);
        });
        if (!item.violations.length && item.disqualified) list.textContent = 'Exam was disqualified by system.';
        content.appendChild(list);
      }
      antiCheatingDialog.showModal();
    }));
    document.querySelectorAll('.passed-action').forEach((button) => button.addEventListener('click', () => notify(button.dataset.id, 'passed')));
    document.querySelectorAll('.failed-action').forEach((button) => button.addEventListener('click', () => {
      const item = results.find((result) => result.id === button.dataset.id);
      pendingFailureIds = [button.dataset.id];
      failureApplicant.textContent = `${item.name} — ${item.applicationId}`;
      reasons.value = '';
      customMessage.value = '';
      failureDialog.showModal();
    }));
    document.querySelectorAll('.restore-result').forEach((button) => button.addEventListener('click', () => restore(button.dataset.id)));
  }

  function renderSummary() {
    const passed = results.filter((item) => !item.archived && item.result === 'passed');
    const failed = results.filter((item) => !item.archived && item.result === 'failed');
    document.getElementById('passedNamesList').innerHTML = passed.length ? passed.map((item, index) => `<li>${escapeHtml(item.name)}</li>`).join('') : '<li>No passed students.</li>';
    document.getElementById('failedNamesList').innerHTML = failed.length ? failed.map((item, index) => `<li>${escapeHtml(item.name)}</li>`).join('') : '<li>No failed students.</li>';
  }

  async function copyNames(outcome) {
    const names = results.filter((item) => !item.archived && item.result === outcome).map((item) => item.name);
    const text = names.map((name, index) => `${index + 1}. ${name}`).join('\n');
    if (!text) return window.alert(`No ${outcome} students found.`);
    await navigator.clipboard.writeText(text);
    window.alert(`${outcome.toUpperCase()} names copied.`);
  }

  async function renderArrivals() {
    const body = document.getElementById('arrivedTableBody');
    body.replaceChildren();
    if (!arrivals.length) {
      body.innerHTML = '<tr><td colspan="5" class="applications-empty">No arrived applicants recorded.</td></tr>';
      return;
    }
    arrivals.forEach((arrival) => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${escapeHtml(arrival.name)}</td><td>${escapeHtml(arrival.applicantId)}</td><td>${escapeHtml(arrival.applicationId)}</td><td><span class="result-${arrival.approvalStatus === 'approved' ? 'passed' : arrival.approvalStatus === 'rejected' ? 'failed' : 'pending'}">${escapeHtml(arrival.approvalStatus.toUpperCase())}</span></td><td>${arrival.arrivedAt ? new Date(arrival.arrivedAt).toLocaleString('en-PH') : '—'}</td>`;
      body.appendChild(row);
    });
    const count = document.getElementById('arrivedCount');
    if (count) count.textContent = String(arrivals.length);
  }

  async function load() {
    tableBody.innerHTML = '<tr><td colspan="7" class="applications-empty">Loading examination results...</td></tr>';
    try {
      const data = await api('/api/admin/results');
      results = data.results || [];
      const arrivedData = await api('/api/admin/results/arrived').catch(() => ({ arrivals: [] }));
      arrivals = arrivedData.arrivals || [];
      renderArrivals();
      const newCount = results.filter((item) => !item.archived && item.newResult).length;
      const pendingCount = document.getElementById('pendingCount');
      const completedCount = document.getElementById('notifiedCount');
      if (pendingCount) {
        pendingCount.textContent = String(newCount);
        pendingCount.classList.toggle('unread-badge', newCount > 0);
      }
      if (completedCount) completedCount.textContent = String(results.filter((item) => item.archived).length);
      passingInput.value = data.passingScore;
      passingInput.max = data.maxScore;
      passingLabel.textContent = `${data.passingScore} and Above`;
      maxScoreLabel.textContent = data.maxScore;
      render();
    } catch (error) {
      tableBody.innerHTML = `<tr><td colspan="7" class="applications-empty">${escapeHtml(error.message)}</td></tr>`;
    }
  }

  async function notify(id, outcome) {
    const item = results.find((result) => result.id === id);
    if (!item) return;
    try {
      await api(`/api/admin/results/${encodeURIComponent(id)}/action`, { method: 'POST', body: JSON.stringify({ outcome }) });
      await load();
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function restore(id) {
    try {
      await api(`/api/admin/results/${encodeURIComponent(id)}/restore`, { method: 'POST', body: '{}' });
      await load();
    } catch (error) {
      window.alert(error.message);
    }
  }

  document.getElementById('sendFailureResult')?.addEventListener('click', async () => {
    if (!pendingFailureIds.length) return;
    try {
      for (const id of pendingFailureIds) {
        await api(`/api/admin/results/${encodeURIComponent(id)}/action`, { method: 'POST', body: JSON.stringify({ outcome: 'failed', reasonTitle: reasons.value, customMessage: customMessage.value.trim() }) });
      }
      failureDialog.close();
      selected.clear();
      pendingFailureIds = [];
      await load();
    } catch (error) {
      window.alert(error.message);
    }
  });

  bulkPassed?.addEventListener('click', async () => {
    if (selected.size < 2) return;
    for (const id of [...selected]) await api(`/api/admin/results/${encodeURIComponent(id)}/action`, { method: 'POST', body: JSON.stringify({ outcome: 'passed' }) });
    selected.clear();
    await load();
  });
  bulkFailed?.addEventListener('click', () => {
    if (selected.size < 2) return;
    pendingFailureIds = [...selected];
    failureApplicant.textContent = `${selected.size} selected examination results`;
    reasons.value = '';
    customMessage.value = '';
    failureDialog.showModal();
  });
  bulkRestore?.addEventListener('click', async () => {
    for (const id of [...selected]) await api(`/api/admin/results/${encodeURIComponent(id)}/restore`, { method: 'POST', body: '{}' });
    selected.clear();
    await load();
  });
  bulkDelete?.addEventListener('click', async () => {
    if (!selected.size || !window.confirm('Permanently delete the selected completed results?')) return;
    for (const id of [...selected]) await api(`/api/admin/results/${encodeURIComponent(id)}/delete`, { method: 'DELETE' });
    selected.clear();
    await load();
  });
  document.getElementById('copyPassedNames')?.addEventListener('click', () => copyNames('passed'));
  document.getElementById('copyFailedNames')?.addEventListener('click', () => copyNames('failed'));

  passingInput?.addEventListener('change', async () => {
    try {
      const data = await api('/api/admin/results/settings', { method: 'PUT', body: JSON.stringify({ passingScore: Number(passingInput.value) }) });
      passingLabel.textContent = `${data.passingScore} and Above`;
      await load();
    } catch (error) {
      window.alert(error.message);
    }
  });
  nameFilter?.addEventListener('input', render);
  resultFilter?.addEventListener('change', render);
  sortSelect?.addEventListener('change', render);
  selectAll?.addEventListener('change', () => {
    visibleResults().forEach((item) => selectAll.checked ? selected.add(item.id) : selected.delete(item.id));
    render();
  });
  document.getElementById('clearSelectionBtn')?.addEventListener('click', () => { selected.clear(); render(); });
  document.getElementById('clearNotifiedBtn')?.addEventListener('click', () => { selected.clear(); render(); });
  document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog)?.close()));

  if (typeof window.io === 'function') {
    const socket = window.io();
    socket.on('admission:results-updated', () => load());
    socket.on('admission:arrival-updated', () => load());
  }

  document.querySelectorAll('.app-tab').forEach((tab) => tab.addEventListener('click', async () => {
    document.querySelectorAll('.app-tab').forEach((item) => item.classList.toggle('active', item === tab));
    currentView = tab.dataset.tab === 'notified' ? 'archived' : tab.dataset.tab === 'summary' ? 'summary' : tab.dataset.tab === 'arrived' ? 'arrived' : 'results';
    selected.clear();
    if (tab.dataset.tab === 'pending') {
      await api('/api/admin/results/seen', { method: 'POST', body: '{}' }).catch(() => {});
      results.forEach((item) => { if (!item.archived) item.newResult = false; });
      const pendingCount = document.getElementById('pendingCount');
      if (pendingCount) {
        pendingCount.textContent = '0';
        pendingCount.classList.remove('unread-badge');
      }
    }

    const summaryVisible = currentView === 'summary';
    const arrivedVisible = currentView === 'arrived';
    if (resultsPanel) resultsPanel.hidden = summaryVisible || arrivedVisible;
    if (summaryPanel) summaryPanel.hidden = !summaryVisible;
    if (arrivedPanel) arrivedPanel.hidden = !arrivedVisible;
    if (filtersRow) filtersRow.style.display = summaryVisible ? 'none' : '';
    if (resultsBulkBar) resultsBulkBar.style.display = currentView === 'results' ? '' : 'none';
    if (completedBulkBar) completedBulkBar.style.display = currentView === 'archived' ? '' : 'none';
    if (summaryVisible) renderSummary();
    else if (arrivedVisible) renderArrivals();
    else render();
  }));

  load();
});
