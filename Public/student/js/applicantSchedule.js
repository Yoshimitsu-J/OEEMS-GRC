/* =========================================
   APPLICANT SCHEDULE — Dynamic Calendar
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Dynamic Calendar Initialized.');

  const MONTH_NAMES = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];
  const MONTH_SHORT = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const TAKEN_DATES = [];

  const BATCH_TIMES = {
    'Batch 1': '7:30 - 9:30 AM',
    'Batch 2': '10:00 - 12:00 NN',
    'Batch 3': '1:00 - 3:00 PM'
  };

  // Dynamic default month — next month
  const today = new Date();
  let currentYear  = today.getFullYear();
  let currentMonth = today.getMonth() + 1;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }

  let selectedDate  = null;
  let selectedBatch = null;

  // DOM
  const monthTitleEl   = document.getElementById('monthTitle');
  const calendarDaysEl = document.getElementById('calendarDays');
  const prevBtn        = document.getElementById('prevMonth');
  const nextBtn        = document.getElementById('nextMonth');
  const selectDay      = document.getElementById('selectDay');
  const selectBatch    = document.getElementById('selectBatch');
  const saveBtn        = document.getElementById('saveScheduleBtn');

  const sumMonth = document.getElementById('sumMonth');
  const sumDay   = document.getElementById('sumDay');
  const sumYear  = document.getElementById('sumYear');
  const sumBatch = document.getElementById('sumBatch');
  const sumTime  = document.getElementById('sumTime');

  // HELPERS
  function pad2(n) { return String(n).padStart(2, '0'); }
  function toISODate(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }

  function isToday(y, m, d) {
    const t = new Date();
    return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
  }

  function isPastDate(y, m, d) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(y, m, d);
    target.setHours(0, 0, 0, 0);
    return target < now;
  }

  function isTaken(y, m, d) {
    return TAKEN_DATES.includes(toISODate(y, m, d));
  }

  // RENDER CALENDAR
  function renderCalendar() {
    if (!monthTitleEl || !calendarDaysEl) return;

    monthTitleEl.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;
    calendarDaysEl.innerHTML = '';

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Empty cells para sa alignment
    for (let i = 0; i < firstDayOfMonth; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-day empty-day';
      calendarDaysEl.appendChild(empty);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day';
      dayEl.textContent = day;

      const dow = new Date(currentYear, currentMonth, day).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isPast = isPastDate(currentYear, currentMonth, day);
      const isTakenDay = isTaken(currentYear, currentMonth, day);

      if (isWeekend) dayEl.classList.add('weekend');

      if (isPast) {
        dayEl.classList.add('past', 'disabled');
      } else if (isTakenDay) {
        dayEl.classList.add('taken', 'disabled');
      } else {
        dayEl.classList.add('available');
      }

      if (isToday(currentYear, currentMonth, day)) dayEl.classList.add('today');

      if (selectedDate &&
          selectedDate.year === currentYear &&
          selectedDate.month === currentMonth &&
          selectedDate.day === day) {
        dayEl.classList.add('active');
      }

      if (!isPast && !isTakenDay) {
        dayEl.addEventListener('click', () => handleDayClick(day));
      }

      calendarDaysEl.appendChild(dayEl);
    }
  }

  function handleDayClick(day) {
    selectedDate = { year: currentYear, month: currentMonth, day: day };
    updateSummary();
    renderCalendar();
  }

  function updateSummary() {
    if (!selectedDate) {
      sumMonth.textContent = '—';
      sumDay.textContent   = '—';
      sumYear.textContent  = '—';
      return;
    }
    sumMonth.textContent = MONTH_SHORT[selectedDate.month];
    sumDay.textContent   = selectedDate.day;
    sumYear.textContent  = selectedDate.year;
  }

  function updateBatchSummary() {
    if (!selectedBatch) {
      sumBatch.textContent = '—';
      sumTime.textContent  = '—';
      return;
    }
    sumBatch.textContent = selectedBatch.replace('Batch ', '');
    sumTime.textContent  = BATCH_TIMES[selectedBatch] || '—';
  }

  function updateSaveButton() {
    if (saveBtn) saveBtn.disabled = !(selectedDate && selectedBatch);
  }

  function populateSelectDay() {
    if (!selectDay) return;
    selectDay.innerHTML = '<option value="">-- Select Day --</option>';

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      if (isPastDate(currentYear, currentMonth, day)) continue;
      if (isTaken(currentYear, currentMonth, day)) continue;

      const dow = new Date(currentYear, currentMonth, day).getDay();
      const isWeekend = dow === 0 || dow === 6;

      const opt = document.createElement('option');
      opt.value = day;
      opt.textContent = `${day}${isWeekend ? ' (Weekend)' : ''}`;

      if (selectedDate &&
          selectedDate.year === currentYear &&
          selectedDate.month === currentMonth &&
          selectedDate.day === day) {
        opt.selected = true;
      }
      selectDay.appendChild(opt);
    }
  }

  // NAV
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      selectedDate = null;
      updateSummary(); renderCalendar(); populateSelectDay(); updateSaveButton();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      selectedDate = null;
      updateSummary(); renderCalendar(); populateSelectDay(); updateSaveButton();
    });
  }

  if (selectDay) {
    selectDay.addEventListener('change', (e) => {
      const day = parseInt(e.target.value);
      if (!day) return;
      handleDayClick(day);
    });
  }

  if (selectBatch) {
    selectBatch.addEventListener('change', (e) => {
      selectedBatch = e.target.value || null;
      updateBatchSummary();
      updateSaveButton();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!selectedDate || !selectedBatch) return;

      const schedule = {
        date: toISODate(selectedDate.year, selectedDate.month, selectedDate.day),
        month: MONTH_SHORT[selectedDate.month],
        day: selectedDate.day,
        year: selectedDate.year,
        batch: selectedBatch,
        time: BATCH_TIMES[selectedBatch],
        savedAt: new Date().toISOString()
      };

      localStorage.setItem('examSchedule', JSON.stringify(schedule));
      window.location.href = 'uploadDocuments.html';
    });
  }

  // INIT
  renderCalendar();
  populateSelectDay();
  updateSummary();
  updateBatchSummary();
  updateSaveButton();
});

