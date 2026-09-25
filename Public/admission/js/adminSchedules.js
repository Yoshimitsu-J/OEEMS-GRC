/* =========================================
   ADMIN SCHEDULES — Calendar + PC Grid + Charts
   (Save PC status to localStorage for Facilities sync)
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Admin Schedules JS Initialized.');

  // =========================================
  // PC DATA (25 PCs per COMLAB)
  // =========================================
  let pcData = {
    COMLAB1: Array(25).fill('working'),
    COMLAB2: Array(25).fill('working'),
    COMLAB3: Array(25).fill('working'),
    COMLAB4: Array(25).fill('working')
  };

  // Demo states for COMLAB1
  pcData.COMLAB1[13] = 'unavailable';
  pcData.COMLAB1[14] = 'unavailable';
  pcData.COMLAB1[20] = 'maintenance';
  pcData.COMLAB1[23] = 'maintenance';

  // =========================================
  // LOAD FROM LOCALSTORAGE
  // =========================================
  function loadPCStatusFromStorage() {
    const saved = localStorage.getItem('pcStatusData');
    if (!saved) return;

    try {
      const data = JSON.parse(saved);
      if (data.COMLAB1) pcData.COMLAB1 = data.COMLAB1;
      if (data.COMLAB2) pcData.COMLAB2 = data.COMLAB2;
      if (data.COMLAB3) pcData.COMLAB3 = data.COMLAB3;
      if (data.COMLAB4) pcData.COMLAB4 = data.COMLAB4;
      console.log('✅ Loaded PC status from localStorage');
    } catch (e) {
      console.warn('Failed to load:', e);
    }
  }

  loadPCStatusFromStorage();

  // =========================================
  // CALENDAR
  // =========================================
  const adminCalendar = document.getElementById('adminCalendar');
  const editCalendar = document.getElementById('editCalendar');

  const aprilDays = [
    { day: 1, state: 'unavailable' }, { day: 2, state: 'unavailable' },
    { day: 3, state: 'unavailable' }, { day: 4, state: 'unavailable' },
    { day: 5, state: 'unavailable' }, { day: 6, state: 'unavailable' },
    { day: 7, state: 'available' }, { day: 8, state: 'available' },
    { day: 9, state: 'available' }, { day: 10, state: 'available' },
    { day: 11, state: 'available' }, { day: 12, state: 'available' },
    { day: 13, state: 'available' }, { day: 14, state: 'available' },
    { day: 15, state: 'selected' }, { day: 16, state: 'available' },
    { day: 17, state: 'available' }, { day: 18, state: 'available' },
    { day: 19, state: 'available' }, { day: 20, state: 'available' },
    { day: 21, state: 'available' }, { day: 22, state: 'available' },
    { day: 23, state: 'available' }, { day: 24, state: 'available' },
    { day: 25, state: 'available' }, { day: 26, state: 'available' },
    { day: 27, state: 'available' }, { day: 28, state: 'unavailable' },
    { day: 29, state: 'unavailable' }, { day: 30, state: 'unavailable' }
  ];

  function renderCalendar(container, days, clickable = false) {
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < 3; i++) {
      const empty = document.createElement('div');
      empty.className = 'admin-cal-day empty';
      container.appendChild(empty);
    }

    days.forEach((d) => {
      const dayEl = document.createElement('div');
      dayEl.className = `admin-cal-day state-${d.state}`;
      dayEl.textContent = d.day;

      dayEl.addEventListener('click', () => {
        if (clickable) {
          if (d.state === 'selected') {
            d.state = 'available';
            dayEl.className = 'admin-cal-day state-available';
          } else if (d.state === 'available') {
            d.state = 'selected';
            dayEl.className = 'admin-cal-day state-selected';
          }
        } else {
          container.querySelectorAll('.admin-cal-day').forEach((el) => {
            if (el.classList.contains('state-selected')) {
              el.classList.remove('state-selected');
              el.classList.add('state-available');
            }
          });
          dayEl.classList.remove('state-available');
          dayEl.classList.add('state-selected');

          const infoDate = document.getElementById('infoDate');
          if (infoDate) infoDate.textContent = `April ${d.day}, 2026`;
        }
      });

      container.appendChild(dayEl);
    });
  }

  renderCalendar(adminCalendar, aprilDays, false);

  const editAprilDays = aprilDays.map(d => ({
    ...d,
    state: d.day >= 25 && d.day <= 29 ? 'selected' : d.state
  }));
  renderCalendar(editCalendar, editAprilDays, true);

  // =========================================
  // PC STATUS GRID (5x5)
  // =========================================
  const pcStatusGrid = document.getElementById('pcStatusGrid');
  const pcLabSelect = document.getElementById('pcLabSelect');
  let currentLab = 'COMLAB1';

  function renderPCGrid(labName) {
    if (!pcStatusGrid) return;
    pcStatusGrid.innerHTML = '';

    const states = pcData[labName] || [];
    currentLab = labName;

    states.forEach((state, index) => {
      const pcEl = document.createElement('div');
      pcEl.className = `pc-box pc-${state}`;
      pcEl.textContent = index + 1;

      pcEl.addEventListener('click', () => {
        if (states[index] === 'working') {
          states[index] = 'unavailable';
          pcEl.className = 'pc-box pc-unavailable';
        } else if (states[index] === 'unavailable') {
          states[index] = 'maintenance';
          pcEl.className = 'pc-box pc-maintenance';
        } else {
          states[index] = 'working';
          pcEl.className = 'pc-box pc-working';
        }
      });

      pcStatusGrid.appendChild(pcEl);
    });
  }

  if (pcLabSelect) {
    pcLabSelect.addEventListener('change', (e) => renderPCGrid(e.target.value));
  }
  renderPCGrid('COMLAB1');

  // =========================================
  // SAVE PC STATUS → localStorage
  // =========================================
  const savePCStatusBtn = document.getElementById('savePCStatus');
  if (savePCStatusBtn) {
    savePCStatusBtn.addEventListener('click', () => {
      const sharedData = {
        COMLAB1: pcData.COMLAB1,
        COMLAB2: pcData.COMLAB2,
        COMLAB3: pcData.COMLAB3,
        COMLAB4: pcData.COMLAB4,
        lastUpdated: new Date().toISOString()
      };

      localStorage.setItem('pcStatusData', JSON.stringify(sharedData));

      console.log('✅ PC Status saved to localStorage:', sharedData);
      showToast('✅ PC Status saved! Facilities page updated.', 'success');
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
  // CHART 1: EXAM SCHEDULE (Donut)
  // =========================================
  if (typeof Chart !== 'undefined') {
    const examChartCanvas = document.getElementById('examScheduleChart');
    if (examChartCanvas) {
      new Chart(examChartCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Exam Day 70%', 'Unavailable 30%'],
          datasets: [{
            data: [70, 30],
            backgroundColor: ['#8B0000', '#888888'],
            borderColor: '#ffffff',
            borderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: { font: { size: 10 }, boxWidth: 10, padding: 8 }
            }
          }
        }
      });
    }

    // CHART 2: PC STATUS (Donut)
    const pcChartCanvas = document.getElementById('pcStatusChart');
    if (pcChartCanvas) {
      new Chart(pcChartCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Working', 'Unavailable', 'Maintenance'],
          datasets: [{
            data: [84, 8, 8],
            backgroundColor: ['#2ecc71', '#555555', '#580000'],
            borderColor: '#ffffff',
            borderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: { font: { size: 10 }, boxWidth: 10, padding: 8 }
            }
          }
        }
      });
    }

    // CHART 3: EDIT SCHEDULE (Donut)
    const editChartCanvas = document.getElementById('editScheduleChart');
    if (editChartCanvas) {
      new Chart(editChartCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Exam Day 70%', 'Unavailable 30%'],
          datasets: [{
            data: [70, 30],
            backgroundColor: ['#8B0000', '#888888'],
            borderColor: '#ffffff',
            borderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: { font: { size: 10 }, boxWidth: 10, padding: 8 }
            }
          }
        }
      });
    }
  }

  // =========================================
  // VIEW TOGGLING
  // =========================================
  const scheduleManagerView = document.getElementById('scheduleManagerView');
  const editScheduleView = document.getElementById('editScheduleView');
  const openEditBtn = document.getElementById('openEditSchedule');
  const cancelEditBtn = document.getElementById('cancelEditSchedule');
  const saveChangesBtn = document.getElementById('saveScheduleChanges');

  if (openEditBtn) {
    openEditBtn.addEventListener('click', () => {
      scheduleManagerView.classList.add('hidden');
      editScheduleView.classList.remove('hidden');
    });
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
      editScheduleView.classList.add('hidden');
      scheduleManagerView.classList.remove('hidden');
    });
  }

  if (saveChangesBtn) {
    saveChangesBtn.addEventListener('click', () => {
      showToast('✅ Schedule changes saved!', 'success');
      editScheduleView.classList.add('hidden');
      scheduleManagerView.classList.remove('hidden');
    });
  }
});