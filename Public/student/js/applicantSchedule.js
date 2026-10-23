/* =========================================
   APPLICANT SCHEDULE — Dynamic Calendar
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthTitle = document.getElementById('monthTitle');
  const calendarDays = document.getElementById('calendarDays');
  const selectDay = document.getElementById('selectDay');
  const selectBatch = document.getElementById('selectBatch');
  const saveButton = document.getElementById('saveScheduleBtn');
  const scheduleConfirmDialog = document.getElementById('scheduleConfirmDialog');
  const scheduleSuccessDialog = document.getElementById('scheduleSuccessDialog');
  const scheduleConfirmationSummary = document.getElementById('scheduleConfirmationSummary');
  const existingScheduleDialog = document.getElementById('existingScheduleDialog');
  const rescheduleError = document.getElementById('rescheduleError');
  const beginRescheduleButton = document.getElementById('beginReschedule');
  const keepExistingScheduleButton = document.getElementById('keepExistingSchedule');
  const note = document.querySelector('.schedule-note');
  const summary = {
    month: document.getElementById('sumMonth'),
    day: document.getElementById('sumDay'),
    year: document.getElementById('sumYear'),
    batch: document.getElementById('sumBatch'),
    time: document.getElementById('sumTime')
  };
  let schedules = [];
  let availableMonths = [];
  let selectedDate = '';
  let selectedSchedule = null;
  let saveInProgress = false;
  let nextStepUrl = '/student/uploadDocuments.html';
  const now = new Date();
  let currentYear = now.getFullYear();
  let currentMonth = now.getMonth();

  function dateKey(value) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(value));
    const get = (type) => parts.find((part) => part.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function slotsForDate(date) {
    return schedules.filter((schedule) => dateKey(schedule.examDate) === date && !isSunday(date) && ['batch_1', 'batch_2', 'batch_3'].includes(schedule.batch));
  }

  function batchLabel(batch) {
    return typeof batch === 'string' ? batch.replace(/^batch_/, 'Batch ') : '';
  }

  function yearLabel(cycle, year) {
    const schoolYear = cycle || `${year}-${year + 1}`;
    return `SY ${schoolYear}`;
  }

  function isSunday(date) {
    return new Date(`${date}T00:00:00.000Z`).getUTCDay() === 0;
  }

  async function readApiResponse(response, fallbackMessage) {
    const responseText = await response.text();
    try {
      return responseText ? JSON.parse(responseText) : {};
    } catch {
      if (response.status === 404) {
        throw new Error('The running server does not have the schedule update route. Restart OEEMS and try again.');
      }
      throw new Error(`${fallbackMessage} (server returned HTTP ${response.status}).`);
    }
  }

  function resetSummary() {
    Object.values(summary).forEach((element) => { if (element) element.textContent = '—'; });
    selectedSchedule = null;
    updateSaveButton();
  }

  function setDate(date) {
    selectedDate = date;
    selectDay.value = date;
    const [year, month, day] = date.split('-').map(Number);
    summary.month.textContent = monthNames[month - 1];
    summary.day.textContent = day;
    summary.year.textContent = yearLabel(slotsForDate(date)[0]?.cycle, year);
    populateSlotOptions();
    renderCalendar();
  }

  function populateDays() {
    selectDay.innerHTML = '<option value="">-- Select Day --</option>';
    const dates = [...new Set(schedules.map((schedule) => dateKey(schedule.examDate)).filter((date) => !isSunday(date)))]
      .filter((date) => Number(date.slice(0, 4)) === currentYear && Number(date.slice(5, 7)) - 1 === currentMonth)
      .sort();
    dates.forEach((date) => {
      const option = document.createElement('option');
      option.value = date;
      option.textContent = Number(date.slice(8, 10));
      selectDay.appendChild(option);
    });
  }

  function populateSlotOptions() {
    selectBatch.innerHTML = '<option value="">-- Select Batch --</option>';
    const bestSlotByBatch = new Map();
    slotsForDate(selectedDate).forEach((schedule) => {
      const current = bestSlotByBatch.get(schedule.batch);
      if (!current || schedule.remainingSeats > current.remainingSeats) bestSlotByBatch.set(schedule.batch, schedule);
    });
    [...bestSlotByBatch.values()].sort((left, right) => left.batch.localeCompare(right.batch)).forEach((schedule) => {
      const option = document.createElement('option');
      option.value = schedule.scheduleId;
      option.textContent = `${batchLabel(schedule.batch)} (${schedule.startTime} - ${schedule.endTime})`;
      selectBatch.appendChild(option);
    });
    selectBatch.value = '';
    selectedSchedule = null;
    summary.batch.textContent = '—';
    summary.time.textContent = '—';
    updateSaveButton();
  }

  function updateSaveButton() {
    saveButton.disabled = saveInProgress || !selectedSchedule || !selectedDate || isSunday(selectedDate) || !['batch_1', 'batch_2', 'batch_3'].includes(selectedSchedule.batch);
  }

  function confirmationRows() {
    return [
      ['Month', summary.month.textContent],
      ['Exam Day', summary.day.textContent],
      ['Year', summary.year.textContent],
      ['Batch', summary.batch.textContent],
      ['Time', summary.time.textContent]
    ];
  }

  function showScheduleConfirmation() {
    scheduleConfirmationSummary.replaceChildren();
    confirmationRows().forEach(([label, value]) => {
      const row = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = `${label}: `;
      row.append(strong, document.createTextNode(value));
      scheduleConfirmationSummary.appendChild(row);
    });
    scheduleConfirmDialog.showModal();
  }

  async function submitSchedule() {
    if (!selectedSchedule || saveButton.disabled) return;
    saveInProgress = true;
    updateSaveButton();
    try {
      const response = await fetch('/api/student/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ scheduleId: selectedSchedule.scheduleId })
      });
      const result = await readApiResponse(response, 'Could not reserve this exam schedule');
      if (!response.ok) throw new Error(result.error || 'Could not reserve this exam schedule.');
      nextStepUrl = result.redirectUrl === '/student/uploadDocuments.html'
        ? result.redirectUrl
        : '/student/uploadDocuments.html';
      note.textContent = 'Your exam schedule was saved.';
      scheduleSuccessDialog.showModal();
    } catch (error) {
      note.textContent = error.message;
      saveInProgress = false;
      updateSaveButton();
    }
  }

  function updateMonthButtons() {
    const currentKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthIndex = availableMonths.indexOf(currentKey);
    document.getElementById('prevMonth').disabled = monthIndex <= 0;
    document.getElementById('nextMonth').disabled = monthIndex < 0 || monthIndex >= availableMonths.length - 1;
  }

  function changeAvailableMonth(direction) {
    const currentKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthIndex = availableMonths.indexOf(currentKey);
    const nextMonth = availableMonths[monthIndex + direction];
    if (!nextMonth) return;
    [currentYear, currentMonth] = [Number(nextMonth.slice(0, 4)), Number(nextMonth.slice(5, 7)) - 1];
    selectedDate = '';
    selectDay.value = '';
    selectBatch.value = '';
    resetSummary();
    populateDays();
    renderCalendar();
  }

  function renderCalendar() {
    monthTitle.textContent = `${months[currentMonth]} ${currentYear}`;
    calendarDays.innerHTML = '';
    for (let emptyIndex = 0; emptyIndex < new Date(currentYear, currentMonth, 1).getDay(); emptyIndex += 1) {
      const empty = document.createElement('div');
      empty.className = 'calendar-day empty-day';
      calendarDays.appendChild(empty);
    }

    const dayCount = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let day = 1; day <= dayCount; day += 1) {
      const key = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const sunday = new Date(currentYear, currentMonth, day).getDay() === 0;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'calendar-day';
      cell.textContent = day;
      cell.setAttribute('aria-label', `${monthNames[currentMonth]} ${day}${sunday ? ', Sunday, unavailable' : ''}`);
      const available = !sunday && slotsForDate(key).length > 0;
      if (sunday) {
        cell.classList.add('sunday', 'disabled');
        cell.disabled = true;
      } else if (new Date(currentYear, currentMonth, day) < new Date(new Date().setHours(0, 0, 0, 0))) {
        cell.classList.add('past', 'disabled');
        cell.disabled = true;
      }
      if (available) {
        cell.classList.add('available');
        cell.addEventListener('click', () => setDate(key));
      } else {
        cell.classList.add('disabled');
      }
      if (selectedDate === key) cell.classList.add('active');
      calendarDays.appendChild(cell);
    }
    updateMonthButtons();
  }

  document.getElementById('prevMonth').addEventListener('click', () => {
    changeAvailableMonth(-1);
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    changeAvailableMonth(1);
  });
  selectDay.addEventListener('change', () => {
    if (selectDay.value) setDate(selectDay.value);
    else {
      selectedDate = '';
      selectBatch.replaceChildren(new Option('-- Select Batch --', ''));
      resetSummary();
    }
  });
  selectBatch.addEventListener('change', () => {
    selectedSchedule = schedules.find((schedule) => schedule.scheduleId === selectBatch.value) || null;
    summary.batch.textContent = selectedSchedule ? batchLabel(selectedSchedule.batch) : '—';
    summary.time.textContent = selectedSchedule ? `${selectedSchedule.startTime} - ${selectedSchedule.endTime}` : '—';
    if (selectedSchedule) summary.year.textContent = yearLabel(selectedSchedule.cycle, Number(selectedDate.slice(0, 4)));
    updateSaveButton();
  });
  saveButton.addEventListener('click', () => {
    if (saveButton.disabled) return;
    showScheduleConfirmation();
  });
  document.getElementById('confirmScheduleYes').addEventListener('click', () => {
    scheduleConfirmDialog.close();
    submitSchedule();
  });
  document.getElementById('confirmScheduleNo').addEventListener('click', () => scheduleConfirmDialog.close());
  document.getElementById('proceedToDocuments').addEventListener('click', () => {
    scheduleSuccessDialog.close();
    window.location.assign(nextStepUrl);
  });

  keepExistingScheduleButton.addEventListener('click', () => {
    existingScheduleDialog.close();
    window.location.assign('/student/');
  });

  beginRescheduleButton.addEventListener('click', async () => {
    beginRescheduleButton.disabled = true;
    keepExistingScheduleButton.disabled = true;
    rescheduleError.textContent = '';
    try {
      const response = await fetch('/api/student/schedule/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const result = await readApiResponse(response, 'Could not reset your exam schedule');
      if (!response.ok) throw new Error(result.error || 'Could not reset your exam schedule.');
      existingScheduleDialog.close();
      selectedDate = '';
      selectedSchedule = null;
      resetSummary();
      await loadSchedules(false);
      window.dispatchEvent(new CustomEvent('oeems:student-update', { detail: { scheduleLoaded: true } }));
    } catch (error) {
      rescheduleError.textContent = error.message;
      beginRescheduleButton.disabled = false;
      keepExistingScheduleButton.disabled = false;
    }
  });

  async function loadSchedules(promptForExistingSchedule = false) {
    try {
      const [scheduleResponse, statusResponse] = await Promise.all([
        fetch('/api/student/schedules', { credentials: 'same-origin', cache: 'no-store' }),
        fetch('/api/student/application-status', { credentials: 'same-origin', cache: 'no-store' })
      ]);
      if (!scheduleResponse.ok || !statusResponse.ok) throw new Error('Could not load available exam schedules.');
      const scheduleData = await scheduleResponse.json();
      const status = await statusResponse.json();
      schedules = scheduleData.schedules;
      availableMonths = [...new Set(scheduleData.months || [])].sort();
      if (status.schedule) {
        selectedDate = dateKey(status.schedule.examDate);
        const [year, month, day] = dateKey(status.schedule.examDate).split('-').map(Number);
        summary.month.textContent = monthNames[month - 1];
        summary.day.textContent = day;
        summary.year.textContent = yearLabel(status.schedule.cycle, year);
        summary.batch.textContent = batchLabel(status.schedule.batch);
        summary.time.textContent = `${status.schedule.startTime} - ${status.schedule.endTime}`;
        selectDay.disabled = true;
        selectBatch.disabled = true;
        saveButton.hidden = true;
        note.textContent = 'Your exam schedule is already reserved.';
        if (promptForExistingSchedule && !existingScheduleDialog.open) existingScheduleDialog.showModal();
      } else if (schedules.length) {
        selectDay.disabled = false;
        selectBatch.disabled = false;
        saveButton.hidden = false;
        currentYear = Number(availableMonths[0].slice(0, 4));
        currentMonth = Number(availableMonths[0].slice(5, 7)) - 1;
        note.textContent = 'Select an available exam date and batch.';
      } else {
        selectDay.disabled = false;
        selectBatch.disabled = false;
        saveButton.hidden = false;
        availableMonths = [];
        note.textContent = 'No available exam schedules. Please check again later or contact the Admissions Department.';
      }
      populateDays();
      renderCalendar();
    } catch (error) {
      note.textContent = error.message;
      saveButton.disabled = true;
    }
  }

  loadSchedules(true);

  let scheduleRefreshTimer = null;
  function refreshSchedulesLive() {
    window.clearTimeout(scheduleRefreshTimer);
    scheduleRefreshTimer = window.setTimeout(() => {
      loadSchedules(false);
    }, 150);
  }

  window.addEventListener('oeems:student-update', (event) => {
    if (!event.detail?.scheduleLoaded) refreshSchedulesLive();
  });
  if (typeof window.io === 'function') {
    const scheduleSocket = window.io();
    scheduleSocket.on('admission:schedule-updated', refreshSchedulesLive);
  }
  window.addEventListener('focus', refreshSchedulesLive);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshSchedulesLive();
  });
});

