document.addEventListener('DOMContentLoaded', () => {
  const facilityList = document.getElementById('facilityList');
  const facilityForm = document.getElementById('facilityCreateForm');
  const facilityMessage = document.getElementById('facilityMessage');
  const confirmDialog = document.getElementById('facilityConfirmDialog');
  const confirmTitle = document.getElementById('facilityConfirmTitle');
  const confirmMessage = document.getElementById('facilityConfirmMessage');
  const confirmExtra = document.getElementById('facilityConfirmExtra');
  const editFacilities = new Set();
  const selectedPCs = new Map();
  let facilities = [];
  let dashboardChart;
  let computerChart;

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: { ...(options.headers || {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.assign('/admission/adminLoginPage.html');
      throw new Error('Admission administrator authentication required.');
    }
    if (!response.ok) throw new Error(body.error || 'Request failed.');
    return body;
  }

  function showMessage(message, isError = false) {
    facilityMessage.textContent = message;
    facilityMessage.classList.toggle('is-error', isError);
  }

  function confirmAction(title, message, action, extra = '') {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmExtra.textContent = extra;
    confirmExtra.hidden = !extra;
    confirmDialog.showModal();
    const onClose = async () => {
      confirmDialog.removeEventListener('close', onClose);
      if (confirmDialog.returnValue !== 'confirm') return;
      try {
        await action();
      } catch (error) {
        showMessage(error.message, true);
      }
    };
    confirmDialog.addEventListener('close', onClose);
  }

  async function loadFacilities() {
    showMessage('Loading facilities...');
    try {
      const month = new Date();
      const result = await api(`/api/admin/schedules/config?year=${month.getFullYear()}&month=${month.getMonth() + 1}`);
      facilities = result.facilities || [];
      renderFacilities();
      updateCharts();
      showMessage('');
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  function nextComputerNumber(computers) {
    return computers.reduce((highest, computer) => Math.max(highest, computer.computerNumber || 0), 0) + 1;
  }

  function renderFacilities() {
    facilityList.replaceChildren();
    if (!facilities.length) {
      const empty = document.createElement('p');
      empty.className = 'facility-empty-state';
      empty.textContent = 'No facilities configured.';
      facilityList.appendChild(empty);
      return;
    }

    facilities.forEach((facility) => {
      const computers = [...(facility.computers || [])].sort((left, right) => left.computerNumber - right.computerNumber);
      const editing = editFacilities.has(facility.facilityId);
      const card = document.createElement('article');
      card.className = 'table-card facility-card';

      const header = document.createElement('div');
      header.className = 'facility-card-header';
      const titleBlock = document.createElement('div');
      const title = document.createElement('h3');
      title.className = 'comlab-title';
      title.textContent = facility.name || facility.facilityId;
      const id = document.createElement('p');
      id.className = 'facility-id';
      id.textContent = facility.facilityId;
      titleBlock.append(title, id);

      const statusButton = document.createElement('button');
      statusButton.type = 'button';
      statusButton.className = `facility-status ${facility.status === 'active' ? 'is-available' : 'is-unavailable'}`;
      statusButton.textContent = facility.status === 'active' ? 'Available' : 'Unavailable';
      statusButton.setAttribute('aria-label', `${facility.facilityId}: ${statusButton.textContent}. Change status`);
      statusButton.addEventListener('click', async () => {
        statusButton.disabled = true;
        try {
          const status = facility.status === 'active' ? 'inactive' : 'active';
          await api(`/api/admin/facilities/${encodeURIComponent(facility.facilityId)}/status`, {
            method: 'PUT', body: JSON.stringify({ status })
          });
          facility.status = status;
          renderFacilities();
          updateCharts();
        } catch (error) {
          showMessage(error.message, true);
          statusButton.disabled = false;
        }
      });
      header.append(titleBlock, statusButton);

      const actions = document.createElement('div');
      actions.className = 'facility-card-actions';
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'btn-schedule-action';
      editButton.textContent = editing ? 'DONE EDITING' : 'EDIT';
      editButton.addEventListener('click', () => {
        if (editing) editFacilities.delete(facility.facilityId);
        else editFacilities.add(facility.facilityId);
        renderFacilities();
      });
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'btn-schedule-action facility-danger-btn';
      deleteButton.textContent = 'REMOVE FACILITY';
      deleteButton.addEventListener('click', () => confirmAction(
        `ARE YOU SURE DELETING ${facility.facilityId}`,
        'Note: This will forcely remove the lists of PC inside of the facility too, other Admin users will see this configuration.',
        async () => {
          await api(`/api/admin/facilities/${encodeURIComponent(facility.facilityId)}`, { method: 'DELETE' });
          await loadFacilities();
        },
        'Unbooked exam slots for this facility will also be removed. Facilities with booked slots cannot be deleted.'
      ));
      actions.append(editButton, deleteButton);

      const dots = document.createElement('div');
      dots.className = 'comlab-dots facility-computer-dots';
      if (!computers.length) {
        const empty = document.createElement('p');
        empty.className = 'no-pc-data';
        empty.textContent = 'No PCs configured.';
        dots.appendChild(empty);
      }
      const selected = selectedPCs.get(facility.facilityId) || new Set();
      computers.forEach((computer) => {
        const item = document.createElement('div');
        item.className = 'facility-pc-item';
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = `comlab-dot dot-${computer.status}`;
        dot.textContent = computer.computerName || String(computer.computerNumber);
        dot.title = `${dot.textContent}: ${computer.status}`;
        dot.disabled = !editing;
        dot.setAttribute('aria-label', `${dot.title}${editing ? ', cycle status' : ''}`);
        dot.addEventListener('click', () => {
          const states = ['working', 'maintenance', 'unavailable'];
          computer.status = states[(states.indexOf(computer.status) + 1) % states.length];
          renderFacilities();
          updateCharts();
        });
        item.appendChild(dot);
        if (editing) {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = selected.has(computer.computerNumber);
          checkbox.setAttribute('aria-label', `Select ${dot.textContent} for removal`);
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) selected.add(computer.computerNumber);
            else selected.delete(computer.computerNumber);
            selectedPCs.set(facility.facilityId, selected);
            renderFacilities();
          });
          item.appendChild(checkbox);
        }
        dots.appendChild(item);
      });

      card.append(header, actions, dots);
      if (editing) {
        const editor = document.createElement('div');
        editor.className = 'facility-edit-controls';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.maxLength = 5;
        nameInput.placeholder = 'Auto # or name';
        nameInput.setAttribute('aria-label', 'Optional PC name, maximum 5 characters');
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'btn-schedule-action';
        addButton.textContent = 'ADD PC';
        addButton.addEventListener('click', () => {
          const computerName = nameInput.value.trim();
          if (computerName.length > 5) {
            showMessage('PC names can contain up to 5 characters.', true);
            return;
          }
          computers.push({ computerNumber: nextComputerNumber(computers), computerName: computerName || null, status: 'working' });
          facility.computers = computers;
          renderFacilities();
          updateCharts();
        });
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'btn-schedule-action facility-danger-btn';
        removeButton.textContent = 'REMOVE SELECTED PCs';
        removeButton.disabled = selected.size === 0;
        removeButton.addEventListener('click', () => {
          const names = computers.filter((computer) => selected.has(computer.computerNumber))
            .map((computer) => computer.computerName || String(computer.computerNumber)).join(', ');
          confirmAction(
            `ARE YOU SURE DELETING ${names}?`,
            'Note: other Admin users will see this configuration.',
            async () => {
              facility.computers = computers.filter((computer) => !selected.has(computer.computerNumber));
              selectedPCs.delete(facility.facilityId);
              renderFacilities();
              updateCharts();
            }
          );
        });
        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'btn-schedule-action facility-save-btn';
        saveButton.textContent = 'SAVE';
        saveButton.addEventListener('click', async () => {
          saveButton.disabled = true;
          try {
            const result = await api(`/api/admin/schedules/computers/${encodeURIComponent(facility.facilityId)}`, {
              method: 'PUT',
              body: JSON.stringify({ computers: facility.computers || computers })
            });
            showMessage(`${result.computerCount} PCs saved for ${facility.name || facility.facilityId}.`);
            selectedPCs.delete(facility.facilityId);
            editFacilities.delete(facility.facilityId);
            await loadFacilities();
          } catch (error) {
            showMessage(error.message, true);
            saveButton.disabled = false;
          }
        });
        editor.append(nameInput, addButton, removeButton, saveButton);
        card.appendChild(editor);
      }
      facilityList.appendChild(card);
    });
  }

  function updateCharts() {
    const facilityCounts = [
      facilities.filter((facility) => facility.status === 'active').length,
      facilities.filter((facility) => facility.status !== 'active').length
    ];
    const computers = facilities.flatMap((facility) => facility.computers || []);
    const computerCounts = ['working', 'maintenance', 'unavailable'].map((status) =>
      computers.filter((computer) => computer.status === status).length);
    if (typeof Chart === 'undefined') return;

    if (!dashboardChart) {
      dashboardChart = new Chart(document.getElementById('overallDashboardChart'), {
        type: 'bar',
        data: { labels: ['Available', 'Unavailable'], datasets: [{ data: facilityCounts, backgroundColor: ['#2ecc71', '#8a8a8a'], borderRadius: 3 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
      computerChart = new Chart(document.getElementById('overallPCStatusChart'), {
        type: 'doughnut',
        data: { labels: ['Working', 'Maintenance', 'Unavailable'], datasets: [{ data: computerCounts, backgroundColor: ['#2ecc71', '#580000', '#8a8a8a'], borderColor: '#fff', borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom' } } }
      });
      return;
    }
    dashboardChart.data.datasets[0].data = facilityCounts;
    computerChart.data.datasets[0].data = computerCounts;
    dashboardChart.update();
    computerChart.update();
  }

  facilityForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = facilityForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    try {
      await api('/api/admin/facilities', {
        method: 'POST',
        body: JSON.stringify({
          name: document.getElementById('facilityName').value.trim(),
          computerCount: Number(document.getElementById('initialPCCount').value)
        })
      });
      facilityForm.reset();
      document.getElementById('initialPCCount').value = '0';
      showMessage('Facility created.');
      await loadFacilities();
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      submitButton.disabled = false;
    }
  });

  loadFacilities();
});