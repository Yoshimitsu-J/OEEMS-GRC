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
  const note = document.querySelector('.schedule-note');
  const summary = {
    month: document.getElementById('sumMonth'),
    day: document.getElementById('sumDay'),
    year: document.getElementById('sumYear'),
    batch: document.getElementById('sumBatch'),
    time: document.getElementById('sumTime'),
    facility: document.getElementById('sumFacility')
  };
  let schedules = [];
  let selectedDate = '';
  let selectedSchedule = null;
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
    return schedules.filter((schedule) => dateKey(schedule.examDate) === date);
  }

  function batchLabel(batch) {
    return batch.replace(/^batch_/, 'Batch ');
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
    summary.year.textContent = year;
    populateSlotOptions();
    renderCalendar();
  }

  function populateDays() {
    selectDay.innerHTML = '<option value="">-- Select Day --</option>';
    const dates = [...new Set(schedules.map((schedule) => dateKey(schedule.examDate)))]
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
    slotsForDate(selectedDate).forEach((schedule) => {
      const option = document.createElement('option');
      option.value = schedule.scheduleId;
      option.textContent = `${batchLabel(schedule.batch)} (${schedule.startTime} - ${schedule.endTime})`;
      selectBatch.appendChild(option);
    });
    selectBatch.value = '';
    selectedSchedule = null;
    summary.batch.textContent = '—';
    summary.time.textContent = '—';
    summary.facility.textContent = '—';
    updateSaveButton();
  }

  function updateSaveButton() {
    saveButton.disabled = !selectedSchedule;
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
      const cell = document.createElement('div');
      const key = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const available = slotsForDate(key).length > 0;
      cell.className = 'calendar-day';
      cell.textContent = day;
      if ([0, 6].includes(new Date(currentYear, currentMonth, day).getDay())) cell.classList.add('weekend');
      if (available) {
        cell.classList.add('available');
        cell.addEventListener('click', () => setDate(key));
      } else {
        cell.classList.add('disabled');
      }
      if (selectedDate === key) cell.classList.add('active');
      calendarDays.appendChild(cell);
    }
  }

  document.getElementById('prevMonth').addEventListener('click', () => {
    currentMonth -= 1;
    if (currentMonth < 0) { currentMonth = 11; currentYear -= 1; }
    selectedDate = '';
    resetSummary();
    populateDays();
    renderCalendar();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonth += 1;
    if (currentMonth > 11) { currentMonth = 0; currentYear += 1; }
    selectedDate = '';
    resetSummary();
    populateDays();
    renderCalendar();
  });
  selectDay.addEventListener('change', () => {
    if (selectDay.value) setDate(selectDay.value);
    else resetSummary();
  });
  selectBatch.addEventListener('change', () => {
    selectedSchedule = schedules.find((schedule) => schedule.scheduleId === selectBatch.value) || null;
    summary.batch.textContent = selectedSchedule ? batchLabel(selectedSchedule.batch) : '—';
    summary.time.textContent = selectedSchedule ? `${selectedSchedule.startTime} - ${selectedSchedule.endTime}` : '—';
    summary.facility.textContent = selectedSchedule?.facilityId || '—';
    updateSaveButton();
  });
  saveButton.addEventListener('click', async () => {
    if (!selectedSchedule) return;
    saveButton.disabled = true;
    try {
      const response = await fetch('/api/student/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ scheduleId: selectedSchedule.scheduleId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not reserve this exam schedule.');
      window.location.assign(result.redirectUrl);
    } catch (error) {
      note.textContent = error.message;
      saveButton.disabled = false;
    }
  });

  async function loadSchedules() {
    try {
      const [scheduleResponse, statusResponse] = await Promise.all([
        fetch('/api/student/schedules', { credentials: 'same-origin', cache: 'no-store' }),
        fetch('/api/student/application-status', { credentials: 'same-origin', cache: 'no-store' })
      ]);
      if (!scheduleResponse.ok || !statusResponse.ok) throw new Error('Could not load available exam schedules.');
      const scheduleData = await scheduleResponse.json();
      const status = await statusResponse.json();
      schedules = scheduleData.schedules;
      if (status.schedule) {
        selectedDate = dateKey(status.schedule.examDate);
        const [year, month, day] = dateKey(status.schedule.examDate).split('-').map(Number);
        summary.month.textContent = monthNames[month - 1];
        summary.day.textContent = day;
        summary.year.textContent = year;
        summary.batch.textContent = batchLabel(status.schedule.batch);
        summary.time.textContent = `${status.schedule.startTime} - ${status.schedule.endTime}`;
        summary.facility.textContent = status.schedule.facilityId || '—';
        selectDay.disabled = true;
        selectBatch.disabled = true;
        saveButton.hidden = true;
        note.textContent = 'Your exam schedule is already reserved.';
      } else if (schedules.length) {
        const firstDate = new Date(schedules[0].examDate);
        currentYear = Number(dateKey(firstDate).slice(0, 4));
        currentMonth = Number(dateKey(firstDate).slice(5, 7)) - 1;
        note.textContent = 'Select an available exam date and batch.';
      } else {
        note.textContent = 'No available exam schedules. Please check again later or contact the Admissions Department.';
      }
      populateDays();
      renderCalendar();
    } catch (error) {
      note.textContent = error.message;
      saveButton.disabled = true;
    }
  }

  loadSchedules();
  window.addEventListener('oeems:student-update', loadSchedules);
});

