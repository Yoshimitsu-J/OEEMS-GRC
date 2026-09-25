/* =========================================
   ADMIN RESULTS — Tabs + Recycle Bin + Bulk + Sort
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Admin Results JS Initialized.');

  // =========================================
  // DEFAULT SAMPLE DATA
  // =========================================
  const SAMPLE_PENDING = [
    { id: '012345', name: 'Juan Delacaruz', score: 53, program: 'BSBA', logic: 10, math: 40, result: 'PASSED', notified: false, email: 'juan@gmail.com' },
    { id: '012346', name: 'Maria D. Bee', score: 61, program: 'BSBA', logic: 21, math: 40, result: 'PASSED', notified: false, email: 'maria@gmail.com' },
    { id: '012347', name: 'Mike S. Quel', score: 71, program: 'BSBA', logic: 1, math: 70, result: 'PASSED', notified: false, email: 'mike@gmail.com' },
    { id: '012348', name: 'Pike Thon', score: 84, program: 'BSBA', logic: 34, math: 50, result: 'PASSED', notified: false, email: 'pike@gmail.com' },
    { id: '012349', name: 'Jhava S. Crip', score: 89, program: 'BSIT', logic: 69, math: 20, result: 'PASSED', notified: false, email: 'jhava@gmail.com' },
    { id: '012350', name: 'Jose Reyes', score: 58, program: 'BSBA', logic: 8, math: 50, result: 'PASSED', notified: false, email: 'jose@gmail.com' },
    { id: '012351', name: 'Ana Santa', score: 80, program: 'BSBA', logic: 30, math: 50, result: 'PASSED', notified: false, email: 'ana@gmail.com' },
    { id: '012352', name: 'Mario B. Karton', score: 50, program: 'BSBA', logic: 0, math: 50, result: 'PASSED', notified: false, email: 'mario@gmail.com' },
    { id: '012353', name: 'Ezekiel Query', score: 12, program: '--', logic: 0, math: 12, result: 'FAILED', notified: false, email: 'ezekiel@gmail.com' },
    { id: '012354', name: 'JayJay Berners', score: 90, program: 'BSIT', logic: 40, math: 50, result: 'PASSED', notified: false, email: 'jayjay@gmail.com' }
  ];

  // =========================================
  // STATE
  // =========================================
  let pendingResults = [];
  let notifiedResults = [];
  let currentTab = 'pending';
  let selectedIds = new Set();
  let currentSort = { field: 'name', direction: 'asc' };

  // =========================================
  // DOM ELEMENTS
  // =========================================
  const tableBody = document.getElementById('resultsTableBody');
  const filterName = document.getElementById('filterName');
  const filterResult = document.getElementById('filterResult');
  const sortBySelect = document.getElementById('sortBy');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const selectedCountEl = document.getElementById('selectedCount');
  const notifiedSelectedCountEl = document.getElementById('notifiedSelectedCount');
  const pendingCountEl = document.getElementById('pendingCount');
  const notifiedCountEl = document.getElementById('notifiedCount');
  const bulkActionsBar = document.getElementById('bulkActionsBar');
  const notifiedBulkBar = document.getElementById('notifiedBulkBar');
  const bulkMarkPassedBtn = document.getElementById('bulkMarkPassedBtn');
  const bulkMarkFailedBtn = document.getElementById('bulkMarkFailedBtn');
  const bulkRestoreBtn = document.getElementById('bulkRestoreBtn');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const clearSelectionBtn = document.getElementById('clearSelectionBtn');
  const clearNotifiedBtn = document.getElementById('clearNotifiedBtn');
  const filtersRow = document.getElementById('filtersRow');
  const lastColHeader = document.getElementById('lastColHeader');
  const scoreTooltip = document.getElementById('scoreTooltip');
  const tooltipName = document.getElementById('tooltipName');
  const tooltipBody = document.getElementById('tooltipBody');

  // =========================================
  // LOAD DATA WITH VALIDATION
  // =========================================
  function loadResultsData() {
    try {
      const saved = localStorage.getItem('resultsData');
      if (!saved) {
        console.log('No saved data. Using sample data.');
        pendingResults = [...SAMPLE_PENDING];
        notifiedResults = [];
        return;
      }

      const parsed = JSON.parse(saved);

      // ✅ Bagong format — object with pending + notified
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (Array.isArray(parsed.pending)) pendingResults = parsed.pending;
        if (Array.isArray(parsed.notified)) notifiedResults = parsed.notified;
        console.log('✅ Loaded pending + notified from localStorage');
        return;
      }

      // ⚠️ Lumang format — array lang
      if (Array.isArray(parsed)) {
        console.log('⚠️ Old array format detected. Migrating...');
        pendingResults = parsed;
        notifiedResults = [];
        return;
      }

      // Fallback
      pendingResults = [...SAMPLE_PENDING];
      notifiedResults = [];
    } catch (e) {
      console.error('Failed to load:', e);
      pendingResults = [...SAMPLE_PENDING];
      notifiedResults = [];
    }
  }

  loadResultsData();

  // =========================================
  // SAVE TO LOCALSTORAGE
  // =========================================
  function saveToStorage() {
    localStorage.setItem('resultsData', JSON.stringify({
      pending: pendingResults,
      notified: notifiedResults
    }));
  }

  // =========================================
  // TAB SWITCHING
  // =========================================
  document.querySelectorAll('.app-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.app-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      selectedIds.clear();
      updateTabsAndBars();
      renderTable();
    });
  });

  function updateTabsAndBars() {
    if (pendingCountEl) pendingCountEl.textContent = pendingResults.length;
    if (notifiedCountEl) notifiedCountEl.textContent = notifiedResults.length;

    if (currentTab === 'pending') {
      filtersRow.style.display = '';
      bulkActionsBar.style.display = '';
      notifiedBulkBar.style.display = 'none';
      lastColHeader.textContent = 'NOTIFY & MARK';
    } else {
      filtersRow.style.display = 'none';
      bulkActionsBar.style.display = 'none';
      notifiedBulkBar.style.display = '';
      lastColHeader.textContent = 'ACTIONS';
    }
  }

  // =========================================
  // RENDER TABLE
  // =========================================
  function renderTable() {
    if (!tableBody) return;

    tableBody.innerHTML = '';
    const data = getCurrentData();

    if (data.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="8" class="applications-empty">
          <i class="bi bi-${currentTab === 'pending' ? 'hourglass-split' : 'archive'}"></i>
          <p>${currentTab === 'pending'
            ? 'No pending results.'
            : 'Recycle bin is empty.'}</p>
        </td>
      `;
      tableBody.appendChild(tr);
      updateBulkBars();
      return;
    }

    data.forEach((r) => {
      const tr = document.createElement('tr');
      tr.dataset.id = r.id;

      if (r.result === 'PASSED') tr.classList.add('row-approved');
      if (r.result === 'FAILED') tr.classList.add('row-declined');

      const isChecked = selectedIds.has(r.id);

      let lastCell = '';
      if (currentTab === 'pending') {
        lastCell = `
          <td class="col-approval">
            <div class="action-btn-group">
              <button class="btn-approve" data-action="passed" data-id="${r.id}">PASSED</button>
              <button class="btn-decline" data-action="failed" data-id="${r.id}">FAILED</button>
            </div>
          </td>
        `;
      } else {
        const statusBadge = r.notifiedAs === 'PASSED'
          ? '<span class="archive-status approved">NOTIFIED: PASSED</span>'
          : '<span class="archive-status declined">NOTIFIED: FAILED</span>';

        lastCell = `
          <td class="col-approval">
            <div class="archive-action-group">
              ${statusBadge}
              <button class="btn-restore" data-id="${r.id}" title="Restore to pending">
                <i class="bi bi-arrow-counterclockwise"></i>
              </button>
              <button class="btn-delete-perm" data-id="${r.id}" title="Delete permanently">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        `;
      }

      tr.innerHTML = `
        <td class="col-checkbox">
          <input type="checkbox" class="table-checkbox row-checkbox"
                 data-id="${r.id}" ${isChecked ? 'checked' : ''}>
        </td>
        <td class="col-name hoverable-name" data-id="${r.id}">
          <span class="name-with-icon">
            ${r.name}
            <i class="bi bi-info-circle name-info-icon"></i>
          </span>
        </td>
        <td class="col-score">${r.score}</td>
        <td class="col-program">${r.program}</td>
        <td class="col-logic">${r.logic}</td>
        <td class="col-math">${r.math}</td>
        <td class="col-result">
          <span class="result-${r.result.toLowerCase()}">${r.result}</span>
        </td>
        ${lastCell}
      `;

      tableBody.appendChild(tr);
    });

    // Bind row checkboxes
    tableBody.querySelectorAll('.row-checkbox').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (e.target.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        updateSelectAllState();
        updateBulkBars();
      });
    });

    // Bind single notify buttons (pending)
    tableBody.querySelectorAll('.btn-approve').forEach((btn) => {
      btn.addEventListener('click', () => handleNotify(btn.dataset.id, 'passed'));
    });
    tableBody.querySelectorAll('.btn-decline').forEach((btn) => {
      btn.addEventListener('click', () => handleNotify(btn.dataset.id, 'failed'));
    });

    // Bind restore buttons (notified)
    tableBody.querySelectorAll('.btn-restore').forEach((btn) => {
      btn.addEventListener('click', () => handleRestore(btn.dataset.id));
    });

    // Bind delete buttons (notified)
    tableBody.querySelectorAll('.btn-delete-perm').forEach((btn) => {
      btn.addEventListener('click', () => handleDeletePermanent(btn.dataset.id));
    });

    // Bind hover on names
    tableBody.querySelectorAll('.hoverable-name').forEach((nameEl) => {
      nameEl.addEventListener('mouseenter', (e) => showTooltip(e, nameEl.dataset.id));
      nameEl.addEventListener('mousemove', (e) => moveTooltip(e));
      nameEl.addEventListener('mouseleave', hideTooltip);
    });

    updateSelectAllState();
    updateBulkBars();
  }

  // =========================================
  // GET CURRENT DATA (filtered + sorted)
  // =========================================
  function getCurrentData() {
    let source = currentTab === 'pending' ? pendingResults : notifiedResults;

    // Guard
    if (!Array.isArray(source)) {
      console.warn('Source is not an array. Resetting...');
      if (currentTab === 'pending') {
        pendingResults = [...SAMPLE_PENDING];
        source = pendingResults;
      } else {
        notifiedResults = [];
        source = notifiedResults;
      }
    }

    let filtered = [...source];

    // Filters (Pending tab only)
    if (currentTab === 'pending') {
      if (filterName) {
        const nameKeyword = filterName.value.trim().toLowerCase();
        if (nameKeyword) {
          filtered = filtered.filter((r) => r.name.toLowerCase().includes(nameKeyword));
        }
      }
      if (filterResult) {
        const resultFilter = filterResult.value;
        if (resultFilter) {
          filtered = filtered.filter((r) => r.result.toLowerCase() === resultFilter);
        }
      }
    }

    // Sort
    filtered.sort((a, b) => {
      const { field, direction } = currentSort;
      const dir = direction === 'asc' ? 1 : -1;

      if (field === 'name') return a.name.localeCompare(b.name) * dir;
      if (field === 'score') return (a.score - b.score) * dir;
      if (field === 'result') {
        const order = { PASSED: 1, FAILED: 2 };
        return (order[a.result] - order[b.result]) * dir;
      }
      return 0;
    });

    return filtered;
  }

  // =========================================
  // SELECT ALL
  // =========================================
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const data = getCurrentData();
      if (e.target.checked) {
        data.forEach((r) => selectedIds.add(r.id));
      } else {
        data.forEach((r) => selectedIds.delete(r.id));
      }
      renderTable();
    });
  }

  function updateSelectAllState() {
    if (!selectAllCheckbox) return;
    const data = getCurrentData();
    const visibleIds = data.map((r) => r.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    const someSelected = visibleIds.some((id) => selectedIds.has(id));
    selectAllCheckbox.checked = allSelected;
    selectAllCheckbox.indeterminate = someSelected && !allSelected;
  }

  // =========================================
  // UPDATE BULK BARS
  // =========================================
  function updateBulkBars() {
    const count = selectedIds.size;
    if (selectedCountEl) selectedCountEl.textContent = count;
    if (notifiedSelectedCountEl) notifiedSelectedCountEl.textContent = count;
  }

  // =========================================
  // CLEAR SELECTION
  // =========================================
  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener('click', () => {
      if (selectedIds.size === 0) {
        showToast('⚠️ Wala pang naka-select.', 'danger');
        return;
      }
      selectedIds.clear();
      renderTable();
    });
  }
  if (clearNotifiedBtn) {
    clearNotifiedBtn.addEventListener('click', () => {
      if (selectedIds.size === 0) {
        showToast('⚠️ Wala pang naka-select.', 'danger');
        return;
      }
      selectedIds.clear();
      renderTable();
    });
  }

  // =========================================
  // NOTIFY SINGLE (Pending → Notified)
  // =========================================
  function handleNotify(id, action) {
    const index = pendingResults.findIndex((r) => r.id === id);
    if (index === -1) return;

    const r = pendingResults[index];
    const label = action === 'passed' ? 'PASSED' : 'FAILED';

    if (!confirm(`Mark ${r.name} as ${label} and send email notification?`)) return;

    r.notified = true;
    r.notifiedAs = label;
    r.notifiedAt = new Date().toISOString();

    pendingResults.splice(index, 1);
    notifiedResults.unshift(r);

    saveToStorage();
    selectedIds.delete(id);
    updateTabsAndBars();
    renderTable();
    showToast(`📧 ${r.name} notified as ${label} → ${r.email}`,
      action === 'passed' ? 'success' : 'danger');
  }

  // =========================================
  // RESTORE (Notified → Pending)
  // =========================================
  function handleRestore(id) {
    const index = notifiedResults.findIndex((r) => r.id === id);
    if (index === -1) return;

    const r = notifiedResults[index];

    if (!confirm(`Restore ${r.name} to Pending Results?`)) return;

    r.notified = false;
    delete r.notifiedAs;
    delete r.notifiedAt;

    notifiedResults.splice(index, 1);
    pendingResults.unshift(r);

    saveToStorage();
    selectedIds.clear();
    updateTabsAndBars();
    renderTable();
    showToast(`↩️ ${r.name} restored to Pending`, 'info');
  }

  // =========================================
  // DELETE PERMANENTLY
  // =========================================
  function handleDeletePermanent(id) {
    const index = notifiedResults.findIndex((r) => r.id === id);
    if (index === -1) return;

    const r = notifiedResults[index];

    if (!confirm(`⚠️ PERMANENTLY DELETE ${r.name}?\n\nThis cannot be undone!`)) return;

    notifiedResults.splice(index, 1);
    saveToStorage();
    selectedIds.clear();
    updateTabsAndBars();
    renderTable();
    showToast(`🗑️ ${r.name} deleted permanently`, 'danger');
  }

  // =========================================
  // BULK MARK PASSED
  // =========================================
  if (bulkMarkPassedBtn) {
    bulkMarkPassedBtn.addEventListener('click', () => {
      const count = selectedIds.size;
      if (count === 0) {
        showToast('⚠️ Please select at least one result first', 'danger');
        return;
      }
      if (!confirm(`Mark ${count} result(s) as PASSED and send notifications?`)) return;

      const toNotify = [];
      const remaining = [];

      pendingResults.forEach((r) => {
        if (selectedIds.has(r.id)) {
          r.notified = true;
          r.notifiedAs = 'PASSED';
          r.notifiedAt = new Date().toISOString();
          toNotify.push(r);
        } else {
          remaining.push(r);
        }
      });

      pendingResults = remaining;
      notifiedResults = [...toNotify, ...notifiedResults];

      saveToStorage();
      selectedIds.clear();
      updateTabsAndBars();
      renderTable();
      showToast(`📧 ${count} result(s) notified as PASSED`, 'success');
    });
  }

  // =========================================
  // BULK MARK FAILED
  // =========================================
  if (bulkMarkFailedBtn) {
    bulkMarkFailedBtn.addEventListener('click', () => {
      const count = selectedIds.size;
      if (count === 0) {
        showToast('⚠️ Please select at least one result first', 'danger');
        return;
      }
      if (!confirm(`Mark ${count} result(s) as FAILED and send notifications?`)) return;

      const toNotify = [];
      const remaining = [];

      pendingResults.forEach((r) => {
        if (selectedIds.has(r.id)) {
          r.notified = true;
          r.notifiedAs = 'FAILED';
          r.notifiedAt = new Date().toISOString();
          toNotify.push(r);
        } else {
          remaining.push(r);
        }
      });

      pendingResults = remaining;
      notifiedResults = [...toNotify, ...notifiedResults];

      saveToStorage();
      selectedIds.clear();
      updateTabsAndBars();
      renderTable();
      showToast(`📧 ${count} result(s) notified as FAILED`, 'danger');
    });
  }

  // =========================================
  // BULK RESTORE
  // =========================================
  if (bulkRestoreBtn) {
    bulkRestoreBtn.addEventListener('click', () => {
      const count = selectedIds.size;
      if (count === 0) {
        showToast('⚠️ Please select at least one result first', 'danger');
        return;
      }
      if (!confirm(`RESTORE ${count} result(s) to Pending?`)) return;

      const toRestore = [];
      const remaining = [];

      notifiedResults.forEach((r) => {
        if (selectedIds.has(r.id)) {
          r.notified = false;
          delete r.notifiedAs;
          delete r.notifiedAt;
          toRestore.push(r);
        } else {
          remaining.push(r);
        }
      });

      notifiedResults = remaining;
      pendingResults = [...toRestore, ...pendingResults];

      saveToStorage();
      selectedIds.clear();
      updateTabsAndBars();
      renderTable();
      showToast(`↩️ ${count} result(s) restored to Pending`, 'info');
    });
  }

  // =========================================
  // BULK DELETE PERMANENTLY
  // =========================================
  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', () => {
      const count = selectedIds.size;
      if (count === 0) {
        showToast('⚠️ Please select at least one result first', 'danger');
        return;
      }
      if (!confirm(`⚠️ PERMANENTLY DELETE ${count} result(s)?\n\nThis cannot be undone!`)) return;

      notifiedResults = notifiedResults.filter((r) => !selectedIds.has(r.id));

      saveToStorage();
      selectedIds.clear();
      updateTabsAndBars();
      renderTable();
      showToast(`🗑️ ${count} result(s) deleted permanently`, 'danger');
    });
  }

  // =========================================
  // FILTERS
  // =========================================
  if (filterName) filterName.addEventListener('input', renderTable);
  if (filterResult) filterResult.addEventListener('change', renderTable);

  // =========================================
  // SORT
  // =========================================
  if (sortBySelect) {
    sortBySelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'name-asc') currentSort = { field: 'name', direction: 'asc' };
      if (val === 'name-desc') currentSort = { field: 'name', direction: 'desc' };
      if (val === 'score-desc') currentSort = { field: 'score', direction: 'desc' };
      if (val === 'score-asc') currentSort = { field: 'score', direction: 'asc' };
      if (val === 'result') currentSort = { field: 'result', direction: 'asc' };
      renderTable();
    });
  }

  document.querySelectorAll('.sortable-th').forEach((th) => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort = { field, direction: 'asc' };
      }
      renderTable();
    });
  });

  // =========================================
  // TOOLTIP
  // =========================================
  function showTooltip(e, id) {
    const allResults = [...pendingResults, ...notifiedResults];
    const r = allResults.find((x) => x.id === id);
    if (!r) return;

    tooltipName.textContent = r.name;
    tooltipBody.innerHTML = `
      <div class="tooltip-row"><span>Applicant ID:</span><strong>${r.id}</strong></div>
      <div class="tooltip-row"><span>Raw Score:</span><strong>${r.score} / 90</strong></div>
      <div class="tooltip-row"><span>Logic Reasoning:</span><strong>${r.logic}</strong></div>
      <div class="tooltip-row"><span>Math:</span><strong>${r.math}</strong></div>
      <div class="tooltip-row"><span>Program Recommendation:</span><strong>${r.program}</strong></div>
      <div class="tooltip-row"><span>Result:</span><strong class="result-${r.result.toLowerCase()}">${r.result}</strong></div>
      <div class="tooltip-row"><span>Email:</span><strong>${r.email}</strong></div>
    `;

    scoreTooltip.classList.remove('hidden');
    moveTooltip(e);
  }

  function moveTooltip(e) {
    const tooltip = scoreTooltip;
    const offsetX = 15;
    const offsetY = 15;

    let x = e.clientX + offsetX;
    let y = e.clientY + offsetY;

    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - offsetX;
    if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - offsetY;

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  function hideTooltip() {
    scoreTooltip.classList.add('hidden');
  }

  // =========================================
  // TOAST
  // =========================================
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // =========================================
  // INITIAL RENDER
  // =========================================
  console.log('Initial pendingResults:', pendingResults);
  console.log('Initial notifiedResults:', notifiedResults);
  updateTabsAndBars();
  renderTable();
});