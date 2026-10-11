document.addEventListener('DOMContentLoaded', () => {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const stateOrder = ['working', 'unavailable', 'maintenance'];
  const statusText = document.getElementById('scheduleStatusMessage');
  const infoDate = document.getElementById('infoDate');
  const infoCycle = document.getElementById('infoCycle');
  const infoFacilities = document.getElementById('infoFacilities');
  const infoComputerCounts = document.getElementById('infoComputerCounts');
  const infoBatchTimes = document.getElementById('infoBatchTimes');
  const selectedExamDates = document.getElementById('selectedExamDates');
  const facilitySelect = document.getElementById('pcLabSelect');
  const pcGrid = document.getElementById('pcStatusGrid');
  const batchRows = document.getElementById('batchRows');
  const addBatchButton = document.getElementById('addBatchBtn');
  const scheduleSaveButton = document.getElementById('saveScheduleChanges');
  const managerView = document.getElementById('scheduleManagerView');
  const editView = document.getElementById('editScheduleView');
  const facilitiesById = new Map();
  let currentDate = new Date();
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  let editDate = new Date(currentDate);
  let configuration = { facilities: [], computers: [], slots: [] };
  let selectedDate = null;
  let selectedExamDateSet = new Set();
  let batches = [];
  let selectedFacilityId = '';
  let pcStatuses = [];
  let summaryCharts = [];

  function monthParameters(date) {
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  }

  function dateKey(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function formatCycle(year) {
    return `${year}-${year + 1}`;
  }

  function formatDate(dateString) {
    const date = new Date(`${dateString}T00:00:00.000Z`);
    return Number.isNaN(date.getTime())
      ? 'Not yet configured'
      : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: { ...(options.headers || {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
    });
    const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.assign('/admission/adminLoginPage.html');
      throw new Error('Admission administrator authentication required.');
    }
    if (!response.ok) throw new Error(body.error || 'Request failed.');
    return body;
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  function monthSlots(date) {
    return configuration.slots.filter((slot) => {
      const slotDate = new Date(slot.examDate);
      return slotDate.getUTCFullYear() === date.getFullYear() && slotDate.getUTCMonth() === date.getMonth();
    });
  }

  function slotsAt(key) {
    return monthSlots(currentDate).filter((slot) => {
      const date = new Date(slot.examDate);
      return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()) === key;
    });
  }

  function stateForDay(key, dayOfWeek) {
    if (dayOfWeek === 0) return 'sunday';
    const slots = slotsAt(key);
    const available = slots.some((slot) => slot.status === 'available' && slot.bookedCount < slot.capacity);
    if (available) return 'available';
    if (slots.length > 0) return 'unavailable';
    return 'normal';
  }

  function renderCalendar(container, date, editing) {
    if (!container) return;
    const label = document.getElementById(editing ? 'editMonthLabel' : 'managerMonthLabel');
    if (label) label.textContent = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    container.replaceChildren();

    const firstWeekday = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    for (let index = 0; index < firstWeekday; index += 1) {
      const empty = document.createElement('div');
      empty.className = 'admin-cal-day empty';
      empty.setAttribute('aria-hidden', 'true');
      container.appendChild(empty);
    }

    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = dateKey(date.getFullYear(), date.getMonth() + 1, day);
      const dayOfWeek = new Date(date.getFullYear(), date.getMonth(), day).getDay();
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `admin-cal-day state-${editing
        ? selectedExamDateSet.has(key) ? 'available' : dayOfWeek === 0 ? 'sunday' : 'normal'
        : stateForDay(key, dayOfWeek)}`;
      cell.textContent = String(day);
      cell.setAttribute('aria-label', `${weekdays[dayOfWeek]}, ${monthNames[date.getMonth()]} ${day}, ${date.getFullYear()}`);
      if (selectedDate === key) cell.classList.add('state-selected');
      if (editing && dayOfWeek !== 0) {
        cell.setAttribute('aria-pressed', String(selectedExamDateSet.has(key)));
        cell.addEventListener('click', () => {
          if (selectedExamDateSet.has(key)) selectedExamDateSet.delete(key);
          else selectedExamDateSet.add(key);
          updateSelectedDateText();
          renderCalendar(editCalendar, editDate, true);
        });
      } else if (!editing) {
        cell.addEventListener('click', () => selectCurrentDate(key));
      }
      container.appendChild(cell);
    }
  }

  const adminCalendar = document.getElementById('adminCalendar');
  const editCalendar = document.getElementById('editCalendar');

  function renderCalendars() {
    renderCalendar(adminCalendar, currentDate, false);
    renderCalendar(editCalendar, editDate, true);
  }

  async function loadMonth(date) {
    statusText.textContent = 'Loading schedule configuration...';
    try {
      configuration = await api(`/api/admin/schedules/config?year=${date.getFullYear()}&month=${date.getMonth() + 1}`);
      configuration.slots ||= [];
      configuration.facilities ||= [];
      configuration.computers ||= [];
      facilitiesById.clear();
      configuration.facilities.forEach((facility) => facilitiesById.set(facility.facilityId, facility));
      setFacilities(configuration.facilities);
      renderCalendars();
      if (selectedDate) renderSelectedDate();
      if (statusText) statusText.textContent = '';
    } catch (error) {
      if (statusText) statusText.textContent = error.message;
      showToast(error.message, 'error');
    }
  }

  function setFacilities(facilities) {
    const oldValue = facilitySelect.value || selectedFacilityId;
    facilitySelect.replaceChildren();
    facilities.forEach((facility) => {
      const option = document.createElement('option');
      option.value = facility.facilityId;
      option.textContent = facility.name && facility.name !== 'Not yet configured'
        ? `${facility.facilityId} - ${facility.name}`
        : facility.facilityId;
      facilitySelect.appendChild(option);
    });
    if (facilities.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Not yet configured';
      facilitySelect.appendChild(option);
    }
    selectedFacilityId = facilities.some((facility) => facility.facilityId === oldValue)
      ? oldValue
      : facilities[0]?.facilityId || '';
    facilitySelect.value = selectedFacilityId;
    loadComputerStatuses();
  }

  function loadComputerStatuses() {
    pcStatuses = configuration.computers
      .filter((computer) => computer.facilityId === selectedFacilityId)
      .sort((left, right) => left.computerNumber - right.computerNumber)
      .map((computer) => ({ computerNumber: computer.computerNumber, computerName: computer.computerName || null, status: computer.status }));
    renderPCGrid();
  }

  function renderPCGrid() {
    pcGrid.replaceChildren();
    pcStatuses.forEach((computer) => {
      const cell = document.createElement('span');
      cell.className = `pc-box pc-${computer.status}`;
      cell.textContent = computer.computerName || String(computer.computerNumber);
      cell.title = `${cell.textContent}: ${computer.status}`;
      cell.setAttribute('aria-label', cell.title);
      pcGrid.appendChild(cell);
    });
    updateSummaryCharts();
  }

  function updateSummaryCharts() {
    if (summaryCharts.length !== 3) return;
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const examDays = new Set(configuration.slots
      .filter((slot) => slot.status === 'available' && slot.bookedCount < slot.capacity)
      .map((slot) => new Date(slot.examDate).toISOString().slice(0, 10))).size;
    summaryCharts[0].data.datasets[0].data = [examDays, Math.max(0, daysInMonth - examDays)];
    summaryCharts[2].data.datasets[0].data = [selectedExamDateSet.size, Math.max(0, daysInMonth - selectedExamDateSet.size)];
    summaryCharts[1].data.datasets[0].data = stateOrder.map((state) => pcStatuses.filter((computer) => computer.status === state).length);
    summaryCharts.forEach((chart) => chart.update());
  }

  function selectCurrentDate(key) {
    selectedDate = key;
    infoDate.textContent = formatDate(key);
    const slots = slotsAt(key);
    infoCycle.textContent = slots[0]?.cycle || formatCycle(Number(key.slice(0, 4)));
    const slotFacilities = [...new Set(slots.map((slot) => slot.facilityId))];
    const facilitiesForDate = slotFacilities.length
      ? slotFacilities
      : configuration.facilities.filter((facility) => facility.status === 'active').map((facility) => facility.facilityId);
    infoFacilities.textContent = facilitiesForDate.length ? facilitiesForDate.join(', ') : 'Not yet configured';
    const batchTimeRanges = [...new Set(slots.map((slot) => `${slot.batch}: ${slot.startTime} - ${slot.endTime}`))];
    infoBatchTimes.textContent = batchTimeRanges.length ? batchTimeRanges.join(' | ') : 'Not yet configured';
    updateComputerCounts(facilitiesForDate);
    if (facilitiesForDate.includes(selectedFacilityId)) {
      loadComputerStatuses();
    } else if (facilitiesForDate.length) {
      selectedFacilityId = facilitiesForDate[0];
      facilitySelect.value = selectedFacilityId;
      loadComputerStatuses();
    }
    renderCalendar(adminCalendar, currentDate, false);
  }

  function updateComputerCounts(facilityIds) {
    const slots = selectedDate ? slotsAt(selectedDate) : [];
    const slotFacilities = [...new Set(slots.map((slot) => slot.facilityId))];
    const facilitiesForDate = facilityIds || (slotFacilities.length
      ? slotFacilities
      : configuration.facilities.filter((facility) => facility.status === 'active').map((facility) => facility.facilityId));
    const counts = facilitiesForDate.map((facilityId) => {
      const facility = facilitiesById.get(facilityId);
      const computers = facilityId === selectedFacilityId && pcStatuses.length
        ? pcStatuses
        : configuration.computers.filter((computer) => computer.facilityId === facilityId);
      if (computers.length === 0) return `${facilityId}: Not yet configured`;
      const total = computers.length;
      const working = computers.filter((computer) => computer.status === 'working').length;
      return `${facilityId}: ${working}/${total} working PCs`;
    });
    infoComputerCounts.textContent = counts.length ? counts.join(' | ') : 'Not yet configured';
  }

  function renderSelectedDate() {
    if (selectedDate) selectCurrentDate(selectedDate);
  }

  function updateSelectedDateText() {
    const values = [...selectedExamDateSet].sort();
    selectedExamDates.textContent = values.length
      ? values.map((value) => new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' })).join(', ')
      : 'None selected';
  }

  function renderBatches() {
    batchRows.replaceChildren();
    batches.forEach((batch, index) => {
      const row = document.createElement('div');
      row.className = 'batch-row';
      const label = document.createElement('span');
      label.textContent = `Batch ${index + 1}`;
      const start = document.createElement('input');
      start.type = 'time';
      start.className = 'batch-time';
      start.value = batch.startTime || '';
      start.setAttribute('aria-label', `Batch ${index + 1} start time`);
      start.addEventListener('change', () => { batch.startTime = start.value; });
      const end = document.createElement('input');
      end.type = 'time';
      end.className = 'batch-time';
      end.value = batch.endTime || '';
      end.setAttribute('aria-label', `Batch ${index + 1} end time`);
      end.addEventListener('change', () => { batch.endTime = end.value; });
      row.append(label, start, end);
      if (batches.length > 1) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'batch-remove-btn';
        remove.textContent = 'Remove';
        remove.addEventListener('click', () => {
          batches.splice(index, 1);
          batches = batches.map((item, batchIndex) => ({ ...item, batch: `batch_${batchIndex + 1}` }));
          renderBatches();
        });
        row.appendChild(remove);
      }
      batchRows.appendChild(row);
    });
    addBatchButton.disabled = batches.length >= 3;
  }

  async function loadEditMonth(date) {
    try {
      const result = await api(`/api/admin/schedules/config?year=${date.getFullYear()}&month=${date.getMonth() + 1}`);
      const monthSlots = result.slots || [];
      selectedExamDateSet = new Set(monthSlots
        .filter((slot) => slot.status !== 'cancelled' && slot.status !== 'unavailable')
        .map((slot) => {
          const slotDate = new Date(slot.examDate);
          return dateKey(slotDate.getUTCFullYear(), slotDate.getUTCMonth() + 1, slotDate.getUTCDate());
        }));
      const batchesMap = new Map();
      monthSlots.forEach((slot) => {
        if (slot.startTime && slot.endTime && slot.batch) batchesMap.set(slot.batch, { batch: slot.batch, startTime: slot.startTime, endTime: slot.endTime });
      });
      batches = [...batchesMap.values()].sort((a, b) => a.batch.localeCompare(b.batch));
      renderBatches();
      updateSelectedDateText();
      renderCalendar(editCalendar, editDate, true);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  function navigateMonth(date, offset) {
    return new Date(date.getFullYear(), date.getMonth() + offset, 1);
  }

  document.getElementById('prevMonth').addEventListener('click', () => {
    currentDate = navigateMonth(currentDate, -1);
    selectedDate = null;
    loadMonth(currentDate);
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    currentDate = navigateMonth(currentDate, 1);
    selectedDate = null;
    loadMonth(currentDate);
  });
  document.getElementById('prevMonthEdit').addEventListener('click', () => {
    editDate = navigateMonth(editDate, -1);
    loadEditMonth(editDate);
  });
  document.getElementById('nextMonthEdit').addEventListener('click', () => {
    editDate = navigateMonth(editDate, 1);
    loadEditMonth(editDate);
  });
  facilitySelect.addEventListener('change', () => {
    selectedFacilityId = facilitySelect.value;
    loadComputerStatuses();
  });
  addBatchButton.addEventListener('click', () => {
    if (batches.length >= 3) return;
    batches.push({ batch: `batch_${batches.length + 1}`, startTime: '', endTime: '' });
    renderBatches();
  });
  document.getElementById('openEditSchedule').addEventListener('click', () => {
    editDate = new Date(currentDate);
    managerView.classList.add('hidden');
    editView.classList.remove('hidden');
    loadEditMonth(editDate);
  });
  document.getElementById('cancelEditSchedule').addEventListener('click', () => {
    editView.classList.add('hidden');
    managerView.classList.remove('hidden');
  });
  scheduleSaveButton.addEventListener('click', async () => {
    const dates = [...selectedExamDateSet].sort();
    if (dates.length && (!batches.length || batches.some((batch) => !batch.startTime || !batch.endTime))) {
      showToast('Configure valid start and end times for every batch.', 'error');
      return;
    }
    scheduleSaveButton.disabled = true;
    try {
      const result = await api('/api/admin/schedules/config', {
        method: 'PUT',
        body: JSON.stringify({ year: editDate.getFullYear(), month: editDate.getMonth() + 1, cycle: formatCycle(editDate.getFullYear()), examDates: dates, batches })
      });
      showToast(result.message);
      currentDate = new Date(editDate);
      await loadMonth(currentDate);
      editView.classList.add('hidden');
      managerView.classList.remove('hidden');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      scheduleSaveButton.disabled = false;
    }
  });

  if (typeof Chart !== 'undefined') {
    const charts = [
      document.getElementById('examScheduleChart'),
      document.getElementById('pcStatusChart'),
      document.getElementById('editScheduleChart')
    ];
    charts.forEach((canvas, index) => {
      if (!canvas) return;
      summaryCharts.push(new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: index === 1 ? ['Working', 'Unavailable', 'Maintenance'] : ['Exam days', 'Other days'],
          datasets: [{ data: index === 1 ? [0, 0, 0] : [0, 0], backgroundColor: index === 1 ? ['#2ecc71', '#555555', '#800000'] : ['#2ecc71', '#888888'], borderColor: '#ffffff', borderWidth: 3 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: true, position: 'bottom' } } }
      }));
    });
    updateSummaryCharts();
  }

  loadMonth(currentDate);
});
