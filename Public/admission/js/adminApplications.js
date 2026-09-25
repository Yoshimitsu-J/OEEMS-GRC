/* =========================================
   ADMIN APPLICATIONS — Bulk + Sort + Archive
   (APPROVE/DECLINE — walang pass/fail)
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Admin Applications JS Initialized.');

  // =========================================
  // STATE
  // =========================================
  let activeApplications = [
    { id: '012345', name: 'Juan Delacaruz', date: '2026-04-01', form138: 'show-img', psa: 'show-img', goodMoral: 'show-img', math: 'show-img', status: 'pending' },
    { id: '012346', name: 'Maria D. Bee', date: '2026-04-01', form138: 'show-img', psa: 'show-img', goodMoral: 'show-img', math: 'show-img', status: 'pending' },
    { id: '012347', name: 'Mike S. Quel', date: '2026-04-01', form138: 'show-img', psa: 'show-img', goodMoral: 'show-img', math: 'show-img', status: 'pending' },
    { id: '012348', name: 'Pike Thon', date: '2026-04-01', form138: 'show-img', psa: 'to-follow', goodMoral: 'show-img', math: 'show-img', status: 'pending' },
    { id: '012349', name: 'Jhava S. Crip', date: '2026-04-01', form138: 'show-img', psa: 'to-follow', goodMoral: 'show-img', math: 'show-img', status: 'pending' },
    { id: '012350', name: 'Jose Reyes', date: '2026-04-01', form138: 'show-img', psa: 'to-follow', goodMoral: 'show-img', math: 'show-img', status: 'pending' },
    { id: '012351', name: 'Ana Santa', date: '2026-04-02', form138: 'show-img', psa: 'to-follow', goodMoral: 'show-img', math: 'show-img', status: 'pending' },
    { id: '012352', name: 'Mario B. Karton', date: '2026-04-02', form138: 'show-img', psa: 'to-follow', goodMoral: 'show-img', math: 'show-img', status: 'pending' },
    { id: '012353', name: 'Ezekiel Query', date: '2026-04-02', form138: 'show-img', psa: 'show-img', goodMoral: 'show-img', math: 'show-img', status: 'pending' },
    { id: '012354', name: 'JayJay Berners', date: '2026-04-02', form138: 'show-img', psa: 'show-img', goodMoral: 'show-img', math: 'show-img', status: 'pending' }
  ];

  let archivedApplications = [];
  let currentTab = 'active';
  let selectedIds = new Set();
  let currentSort = { field: 'name', direction: 'asc' };

  // =========================================
  // DOM ELEMENTS
  // =========================================
  const tableBody = document.getElementById('applicationsTableBody');
  const filterName = document.getElementById('filterName');
  const filterDate = document.getElementById('filterDate');
  const sortBySelect = document.getElementById('sortBy');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const selectedCountEl = document.getElementById('selectedCount');
  const archivedSelectedCountEl = document.getElementById('archivedSelectedCount');
  const bulkActionsBar = document.getElementById('bulkActionsBar');
  const archivedBulkBar = document.getElementById('archivedBulkBar');
  const bulkApproveBtn = document.getElementById('bulkApproveBtn');
  const bulkDeclineBtn = document.getElementById('bulkDeclineBtn');
  const bulkRestoreBtn = document.getElementById('bulkRestoreBtn');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const clearSelectionBtn = document.getElementById('clearSelectionBtn');
  const clearArchivedBtn = document.getElementById('clearArchivedBtn');
  const activeCountEl = document.getElementById('activeCount');
  const archivedCountEl = document.getElementById('archivedCount');
  const filtersRow = document.getElementById('filtersRow');
  const lastColHeader = document.getElementById('lastColHeader');
  const imageModal = document.getElementById('imageModal');
  const imageModalImg = document.getElementById('imageModalImg');
  const imageModalTitle = document.getElementById('imageModalTitle');
  const closeImageModal = document.getElementById('closeImageModal');
  const closeImageBtn = document.getElementById('closeImageBtn');

  // =========================================
  // LOAD FROM LOCALSTORAGE
  // =========================================
  const saved = localStorage.getItem('applicationsData');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.active) activeApplications = data.active;
      if (data.archived) archivedApplications = data.archived;
      console.log('Loaded applications from localStorage');
    } catch (e) {
      console.warn('Failed to load:', e);
    }
  }

  function saveToStorage() {
    localStorage.setItem('applicationsData', JSON.stringify({
      active: activeApplications,
      archived: archivedApplications
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
    if (activeCountEl) activeCountEl.textContent = activeApplications.length;
    if (archivedCountEl) archivedCountEl.textContent = archivedApplications.length;

    if (currentTab === 'active') {
      filtersRow.style.display = '';
      bulkActionsBar.style.display = '';
      archivedBulkBar.style.display = 'none';
      lastColHeader.textContent = 'APPROVAL';
    } else {
      filtersRow.style.display = 'none';
      bulkActionsBar.style.display = 'none';
      archivedBulkBar.style.display = '';
      lastColHeader.textContent = 'ACTIONS';
    }
  }

  // =========================================
  // RENDER TABLE
  // =========================================
  function renderTable() {
    tableBody.innerHTML = '';
    const data = getCurrentData();

    if (data.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="8" class="applications-empty">
          <i class="bi bi-${currentTab === 'active' ? 'inbox' : 'archive'}"></i>
          <p>${currentTab === 'active' ? 'No active applications.' : 'Recycle bin is empty.'}</p>
        </td>
      `;
      tableBody.appendChild(tr);
      updateBulkBars();
      return;
    }

    data.forEach((app) => {
      const tr = document.createElement('tr');
      tr.dataset.id = app.id;

      if (app.status === 'approved') tr.classList.add('row-approved');
      if (app.status === 'declined') tr.classList.add('row-declined');

      const isChecked = selectedIds.has(app.id);

      let lastCell = '';
      if (currentTab === 'active') {
        lastCell = `
          <td class="col-approval">
            <div class="action-btn-group">
              <button class="btn-approve" data-action="approve" data-id="${app.id}">APPROVE</button>
              <button class="btn-decline" data-action="decline" data-id="${app.id}">DECLINE</button>
            </div>
          </td>
        `;
      } else {
        const statusBadge = app.status === 'approved'
          ? '<span class="archive-status approved">APPROVED</span>'
          : '<span class="archive-status declined">DECLINED</span>';

        lastCell = `
          <td class="col-approval">
            <div class="archive-action-group">
              ${statusBadge}
              <button class="btn-restore" data-id="${app.id}" title="Restore">
                <i class="bi bi-arrow-counterclockwise"></i>
              </button>
              <button class="btn-delete-perm" data-id="${app.id}" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        `;
      }

      tr.innerHTML = `
        <td class="col-checkbox">
          <input type="checkbox" class="table-checkbox row-checkbox" 
                 data-id="${app.id}" ${isChecked ? 'checked' : ''}>
        </td>
        <td class="col-name">${app.name}</td>
        <td class="col-date">${formatDate(app.date)}</td>
        <td class="col-doc">${renderDocCell(app.form138, 'Form-138', app.id, app.name)}</td>
        <td class="col-doc">${renderDocCell(app.psa, 'PSA Birth Cert', app.id, app.name)}</td>
        <td class="col-doc">${renderDocCell(app.goodMoral, 'Good Moral', app.id, app.name)}</td>
        <td class="col-doc">${renderDocCell(app.math, 'Math Exam', app.id, app.name)}</td>
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

    // Bind SHOW IMG
    tableBody.querySelectorAll('.show-img-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        openImageModal(link.dataset.docType, link.dataset.applicant);
      });
    });

    // Single approve/decline
    tableBody.querySelectorAll('.btn-approve').forEach((btn) => {
      btn.addEventListener('click', () => handleApproval(btn.dataset.id, 'approve'));
    });
    tableBody.querySelectorAll('.btn-decline').forEach((btn) => {
      btn.addEventListener('click', () => handleApproval(btn.dataset.id, 'decline'));
    });

    // Restore
    tableBody.querySelectorAll('.btn-restore').forEach((btn) => {
      btn.addEventListener('click', () => handleRestore(btn.dataset.id));
    });

    // Permanent delete
    tableBody.querySelectorAll('.btn-delete-perm').forEach((btn) => {
      btn.addEventListener('click', () => handleDeletePermanent(btn.dataset.id));
    });

    updateSelectAllState();
    updateBulkBars();
  }

  // =========================================
  // GET CURRENT DATA
  // =========================================
  function getCurrentData() {
    let source = currentTab === 'active' ? activeApplications : archivedApplications;
    let filtered = [...source];

    if (currentTab === 'active') {
      const nameKeyword = filterName.value.trim().toLowerCase();
      if (nameKeyword) {
        filtered = filtered.filter((a) => a.name.toLowerCase().includes(nameKeyword));
      }
      const dateKeyword = filterDate.value;
      if (dateKeyword) {
        filtered = filtered.filter((a) => a.date === dateKeyword);
      }
    }

    filtered.sort((a, b) => {
      const { field, direction } = currentSort;
      const dir = direction === 'asc' ? 1 : -1;
      if (field === 'name') return a.name.localeCompare(b.name) * dir;
      if (field === 'date') return (new Date(a.date) - new Date(b.date)) * dir;
      if (field === 'status') {
        const order = { pending: 1, approved: 2, declined: 3 };
        return (order[a.status] - order[b.status]) * dir;
      }
      return 0;
    });

    return filtered;
  }

  // =========================================
  // DOC CELL
  // =========================================
  function renderDocCell(value, docType, applicantId, applicantName) {
    if (value === 'show-img') {
      return `<a href="#" class="show-img-link" 
                data-doc-type="${docType}" 
                data-applicant="${applicantName}" 
                data-applicant-id="${applicantId}">SHOW IMG</a>`;
    }
    if (value === 'to-follow') return `<span class="to-follow">To follow</span>`;
    return `<span class="doc-missing">—</span>`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const y = d.getFullYear();
    return `${m}/${day}/${y}`;
  }

  // =========================================
  // SELECT ALL
  // =========================================
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const data = getCurrentData();
      if (e.target.checked) {
        data.forEach((app) => selectedIds.add(app.id));
      } else {
        data.forEach((app) => selectedIds.delete(app.id));
      }
      renderTable();
    });
  }

  function updateSelectAllState() {
    if (!selectAllCheckbox) return;
    const data = getCurrentData();
    const visibleIds = data.map((a) => a.id);
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
    if (archivedSelectedCountEl) archivedSelectedCountEl.textContent = count;
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
  if (clearArchivedBtn) {
    clearArchivedBtn.addEventListener('click', () => {
      if (selectedIds.size === 0) {
        showToast('⚠️ Wala pang naka-select.', 'danger');
        return;
      }
      selectedIds.clear();
      renderTable();
    });
  }

  // =========================================
  // APPROVE / DECLINE — Move to Archive
  // =========================================
  function handleApproval(appId, action) {
    const index = activeApplications.findIndex((a) => a.id === appId);
    if (index === -1) return;
    const app = activeApplications[index];
    const label = action === 'approve' ? 'APPROVE' : 'DECLINE';

    if (!confirm(`${label} application of ${app.name}?`)) return;

    app.status = action === 'approve' ? 'approved' : 'declined';
    app.archivedAt = new Date().toISOString();

    activeApplications.splice(index, 1);
    archivedApplications.unshift(app);

    saveToStorage();
    selectedIds.clear();
    updateTabsAndBars();
    renderTable();
    showToast(`${action === 'approve' ? '✅' : '❌'} ${app.name} ${label}D — Moved to Archive`, action === 'approve' ? 'success' : 'danger');
  }

  // =========================================
  // RESTORE
  // =========================================
  function handleRestore(appId) {
    const index = archivedApplications.findIndex((a) => a.id === appId);
    if (index === -1) return;
    const app = archivedApplications[index];

    if (!confirm(`Restore ${app.name} to Active Applications?`)) return;

    app.status = 'pending';
    delete app.archivedAt;

    archivedApplications.splice(index, 1);
    activeApplications.unshift(app);

    saveToStorage();
    selectedIds.clear();
    updateTabsAndBars();
    renderTable();
    showToast(`↩️ ${app.name} restored to Active`, 'info');
  }

  // =========================================
  // DELETE PERMANENTLY
  // =========================================
  function handleDeletePermanent(appId) {
    const index = archivedApplications.findIndex((a) => a.id === appId);
    if (index === -1) return;
    const app = archivedApplications[index];

    if (!confirm(`⚠️ PERMANENTLY DELETE ${app.name}?`)) return;

    archivedApplications.splice(index, 1);
    saveToStorage();
    selectedIds.clear();
    updateTabsAndBars();
    renderTable();
    showToast(`🗑️ ${app.name} deleted permanently`, 'danger');
  }

  // =========================================
  // BULK APPROVE
  // =========================================
  if (bulkApproveBtn) {
    bulkApproveBtn.addEventListener('click', () => {
      const count = selectedIds.size;
      if (count === 0) {
        showToast('⚠️ Please select at least one item first', 'danger');
        return;
      }
      if (!confirm(`APPROVE ${count} selected application(s)?`)) return;

      const toArchive = [];
      const remaining = [];

      activeApplications.forEach((app) => {
        if (selectedIds.has(app.id)) {
          app.status = 'approved';
          app.archivedAt = new Date().toISOString();
          toArchive.push(app);
        } else {
          remaining.push(app);
        }
      });

      activeApplications = remaining;
      archivedApplications = [...toArchive, ...archivedApplications];

      saveToStorage();
      selectedIds.clear();
      updateTabsAndBars();
      renderTable();
      showToast(`✅ ${count} application(s) APPROVED`, 'success');
    });
  }

  // =========================================
  // BULK DECLINE
  // =========================================
  if (bulkDeclineBtn) {
    bulkDeclineBtn.addEventListener('click', () => {
      const count = selectedIds.size;
      if (count === 0) {
        showToast('⚠️ Please select at least one item first', 'danger');
        return;
      }
      if (!confirm(`DECLINE ${count} selected application(s)?`)) return;

      const toArchive = [];
      const remaining = [];

      activeApplications.forEach((app) => {
        if (selectedIds.has(app.id)) {
          app.status = 'declined';
          app.archivedAt = new Date().toISOString();
          toArchive.push(app);
        } else {
          remaining.push(app);
        }
      });

      activeApplications = remaining;
      archivedApplications = [...toArchive, ...archivedApplications];

      saveToStorage();
      selectedIds.clear();
      updateTabsAndBars();
      renderTable();
      showToast(`❌ ${count} application(s) DECLINED`, 'danger');
    });
  }

  // =========================================
  // BULK RESTORE
  // =========================================
  if (bulkRestoreBtn) {
    bulkRestoreBtn.addEventListener('click', () => {
      const count = selectedIds.size;
      if (count === 0) {
        showToast('⚠️ Please select at least one item first', 'danger');
        return;
      }
      if (!confirm(`RESTORE ${count} selected application(s)?`)) return;

      const toRestore = [];
      const remaining = [];

      archivedApplications.forEach((app) => {
        if (selectedIds.has(app.id)) {
          app.status = 'pending';
          delete app.archivedAt;
          toRestore.push(app);
        } else {
          remaining.push(app);
        }
      });

      archivedApplications = remaining;
      activeApplications = [...toRestore, ...activeApplications];

      saveToStorage();
      selectedIds.clear();
      updateTabsAndBars();
      renderTable();
      showToast(`↩️ ${count} application(s) restored`, 'info');
    });
  }

  // =========================================
  // BULK DELETE
  // =========================================
  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', () => {
      const count = selectedIds.size;
      if (count === 0) {
        showToast('⚠️ Please select at least one item first', 'danger');
        return;
      }
      if (!confirm(`⚠️ PERMANENTLY DELETE ${count} application(s)?`)) return;

      archivedApplications = archivedApplications.filter((a) => !selectedIds.has(a.id));

      saveToStorage();
      selectedIds.clear();
      updateTabsAndBars();
      renderTable();
      showToast(`🗑️ ${count} application(s) deleted`, 'danger');
    });
  }

  // =========================================
  // FILTERS
  // =========================================
  if (filterName) filterName.addEventListener('input', renderTable);
  if (filterDate) filterDate.addEventListener('change', renderTable);

  // =========================================
  // SORT
  // =========================================
  if (sortBySelect) {
    sortBySelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'name-asc') currentSort = { field: 'name', direction: 'asc' };
      if (val === 'name-desc') currentSort = { field: 'name', direction: 'desc' };
      if (val === 'date-asc') currentSort = { field: 'date', direction: 'asc' };
      if (val === 'date-desc') currentSort = { field: 'date', direction: 'desc' };
      if (val === 'status') currentSort = { field: 'status', direction: 'asc' };
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
  // IMAGE MODAL
  // =========================================
  function openImageModal(docType, applicantName) {
    imageModalTitle.textContent = `${docType} — ${applicantName}`;
    imageModalImg.src = `../assets/image/grc-logo.png`;
    imageModal.classList.remove('hidden');
  }

  if (closeImageModal) closeImageModal.addEventListener('click', () => imageModal.classList.add('hidden'));
  if (closeImageBtn) closeImageBtn.addEventListener('click', () => imageModal.classList.add('hidden'));
  if (imageModal) {
    imageModal.addEventListener('click', (e) => {
      if (e.target === imageModal) imageModal.classList.add('hidden');
    });
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
  updateTabsAndBars();
  renderTable();
});