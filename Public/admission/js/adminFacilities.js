/* =========================================
   ADMIN FACILITIES — Charts + COMLAB Dots
   (Synchronized with Schedules via localStorage)
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Admin Facilities JS Initialized.');
  console.log('Chart.js loaded?', typeof Chart !== 'undefined');

  // =========================================
  // LOAD PC DATA FROM LOCALSTORAGE
  // =========================================
  function loadPCData() {
    const saved = localStorage.getItem('pcStatusData');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        console.log('✅ Loaded PC data from localStorage');
        return data;
      } catch (e) {
        console.warn('Failed to parse pcStatusData:', e);
      }
    }
    console.log('⚠️ No saved PC data. Using defaults.');
    return {
      COMLAB1: Array(25).fill('working'),
      COMLAB2: Array(25).fill('working'),
      COMLAB3: Array(25).fill('working'),
      COMLAB4: Array(25).fill('working')
    };
  }

  let pcData = loadPCData();

  // =========================================
  // COMLAB META
  // =========================================
  const comlabMeta = {
    COMLAB1: { facilitator: 'Juan Delacruz, Jay Clark', floor: 'FLOOR 2', occupation: 'low' },
    COMLAB2: { facilitator: 'Maria Dela Cruz', floor: 'FLOOR 2', occupation: 'full' },
    COMLAB3: { facilitator: 'Jose Reyes', floor: 'FLOOR 2', occupation: 'low' },
    COMLAB4: { facilitator: 'Mario Conception', floor: 'FLOOR 4', occupation: 'full' }
  };

  // =========================================
  // RENDER COMLAB DOTS
  // =========================================
  function renderComlabDots(containerId, states) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (!states || states.length === 0) {
      container.innerHTML = '<p class="no-pc-data">No PC data.</p>';
      return;
    }

    states.forEach((state, index) => {
      const dot = document.createElement('span');
      dot.className = `comlab-dot dot-${state}`;
      dot.title = `PC ${index + 1} — ${getStatusLabel(state)}`;
      container.appendChild(dot);
    });

    console.log(`✅ Rendered ${states.length} dots for #${containerId}`);
  }

  function getStatusLabel(state) {
    if (state === 'working') return 'Working Properly';
    if (state === 'unavailable') return 'Unavailable';
    if (state === 'maintenance') return 'Maintenance';
    return state;
  }

  function updateComlabMeta() {
    Object.keys(comlabMeta).forEach((labKey) => {
      const num = labKey.replace('COMLAB', '');
      const meta = comlabMeta[labKey];
      const facilitatorEl = document.querySelector(`[data-comlab="${num}"][data-field="facilitator"]`);
      const floorEl = document.querySelector(`[data-comlab="${num}"][data-field="floor"]`);
      const occupationEl = document.querySelector(`[data-comlab="${num}"][data-field="occupation"]`);
      if (facilitatorEl) facilitatorEl.textContent = meta.facilitator;
      if (floorEl) floorEl.textContent = meta.floor;
      if (occupationEl) occupationEl.className = `occupation-dot occupation-${meta.occupation}`;
    });
  }

  // ✅ RENDER DOTS AGAD
  renderComlabDots('comlab1Dots', pcData.COMLAB1);
  renderComlabDots('comlab2Dots', pcData.COMLAB2);
  renderComlabDots('comlab3Dots', pcData.COMLAB3);
  renderComlabDots('comlab4Dots', pcData.COMLAB4);
  updateComlabMeta();

  // =========================================
  // COMPUTE STATS
  // =========================================
  function computeStats(states) {
    if (!states || states.length === 0) return { working: 0, unavailable: 0, maintenance: 0, total: 0 };
    return {
      working: states.filter((s) => s === 'working').length,
      unavailable: states.filter((s) => s === 'unavailable').length,
      maintenance: states.filter((s) => s === 'maintenance').length,
      total: states.length
    };
  }

  const stats1 = computeStats(pcData.COMLAB1);
  const stats2 = computeStats(pcData.COMLAB2);
  const stats3 = computeStats(pcData.COMLAB3);
  const stats4 = computeStats(pcData.COMLAB4);

  // =========================================
  // CHART.JS CHARTS
  // =========================================
  if (typeof Chart === 'undefined') {
    console.error('❌ Chart.js NOT loaded.');
    showChartPlaceholder('overallDashboardChart', 'Bar Chart not available');
    showChartPlaceholder('overallPCStatusChart', 'Pie Chart not available');
    return;
  }

  console.log('✅ Chart.js detected. Initializing charts...');

  const totalFacilities = 4;
  const totalWorking = stats1.working + stats2.working + stats3.working + stats4.working;

  // CHART 1: Bar Chart
  const barChartEl = document.getElementById('overallDashboardChart');
  if (barChartEl) {
    try {
      new Chart(barChartEl, {
        type: 'bar',
        data: {
          labels: ['Total Facility', 'Working PCs'],
          datasets: [{
            data: [totalFacilities, totalWorking],
            backgroundColor: ['#2ecc71', '#2ecc71'],
            borderColor: ['#27ae60', '#27ae60'],
            borderWidth: 1,
            borderRadius: 4,
            barThickness: 35
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: 10 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.85)',
              padding: 10,
              callbacks: { label: (ctx) => `Count: ${ctx.parsed.x}` }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              max: Math.max(40, totalWorking + 10),
              ticks: { stepSize: 10, font: { size: 10 }, color: '#333' },
              grid: { color: '#f0f0f0' }
            },
            y: {
              ticks: { font: { size: 11, weight: 'bold' }, color: '#333' },
              grid: { display: false }
            }
          }
        }
      });
      console.log('✅ Bar chart rendered');
    } catch (err) {
      console.error('❌ Bar chart error:', err);
    }
  }

  // CHART 2: Pie Chart
  const pieData = [stats1.working, stats2.working, stats3.working, stats4.working];
  const pieLabels = [
    `COMLAB 1\n${stats1.working}`,
    `COMLAB 2\n${stats2.working}`,
    `COMLAB 3\n${stats3.working}`,
    `COMLAB 4\n${stats4.working}`
  ];

  const pieChartEl = document.getElementById('overallPCStatusChart');
  if (pieChartEl) {
    try {
      new Chart(pieChartEl, {
        type: 'pie',
        data: {
          labels: ['COMLAB 1', 'COMLAB 2', 'COMLAB 3', 'COMLAB 4'],
          datasets: [{
            data: pieData,
            backgroundColor: ['#f4d03f', '#2ecc71', '#f39c12', '#e63946'],
            borderColor: '#ffffff',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: 10 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.85)',
              padding: 12,
              callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed} working` }
            }
          }
        },
        plugins: [{
          id: 'pieLabels',
          afterDatasetsDraw: (chart) => {
            const { ctx } = chart;
            const meta = chart.getDatasetMeta(0);
            meta.data.forEach((segment, index) => {
              const { x, y } = segment.tooltipPosition();
              ctx.save();
              ctx.font = 'bold 11px Arial';
              ctx.fillStyle = '#fff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              const lines = pieLabels[index].split('\n');
              lines.forEach((line, i) => {
                ctx.fillText(line, x, y + (i - 0.5) * 14);
              });
              ctx.restore();
            });
          }
        }]
      });
      console.log('✅ Pie chart rendered');
    } catch (err) {
      console.error('❌ Pie chart error:', err);
    }
  }

  function showChartPlaceholder(canvasId, message) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const wrapper = canvas.parentElement;
    if (!wrapper) return;
    wrapper.innerHTML = `
      <div class="chart-fallback">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <p>${message}</p>
        <small>Chart.js not loaded.</small>
      </div>
    `;
  }

  // =========================================
  // REAL-TIME SYNC
  // =========================================
  window.addEventListener('storage', (e) => {
    if (e.key === 'pcStatusData') {
      console.log('🔄 PC status updated. Reloading...');
      location.reload();
    }
  });

  console.log('✅ Facilities page initialized.');
});