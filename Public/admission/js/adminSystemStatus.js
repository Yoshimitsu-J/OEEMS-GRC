/* =========================================
   ADMIN SYSTEM STATUS — Charts
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Admin System Status JS Initialized.');

  if (typeof Chart === 'undefined') {
    console.error('❌ Chart.js not loaded!');
    return;
  }

  // =========================================
  // CHART OPTIONS (Shared)
  // =========================================
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    layout: { padding: 10 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        padding: 12,
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12 },
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.parsed}%`
        }
      }
    }
  };

  // =========================================
  // CHART 1: STUDENT RESULTS STORAGE
  // =========================================
  const chart1 = document.getElementById('studentResultsChart');
  if (chart1) {
    new Chart(chart1, {
      type: 'doughnut',
      data: {
        labels: ['Used', 'Available'],
        datasets: [{
          data: [25, 75],
          backgroundColor: ['#e63946', '#2ecc71'],
          borderColor: '#ffffff',
          borderWidth: 3
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          tooltip: {
            ...commonOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => {
                const labels = ['Used 25%', 'Available 75%'];
                return labels[ctx.dataIndex];
              }
            }
          }
        }
      },
      plugins: [{
        id: 'centerText1',
        afterDraw: (chart) => {
          const { ctx, chartArea } = chart;
          const centerX = (chartArea.left + chartArea.right) / 2;
          const centerY = (chartArea.top + chartArea.bottom) / 2;
          ctx.save();
          ctx.font = 'bold 13px Arial';
          ctx.fillStyle = '#333';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('25%', centerX, centerY - 6);
          ctx.font = '10px Arial';
          ctx.fillStyle = '#666';
          ctx.fillText('Used', centerX, centerY + 10);
          ctx.restore();
        }
      }]
    });
  }

  // =========================================
  // CHART 2: ACCOUNTS STORAGE
  // =========================================
  const chart2 = document.getElementById('accountsStorageChart');
  if (chart2) {
    new Chart(chart2, {
      type: 'doughnut',
      data: {
        labels: ['Created', 'Available'],
        datasets: [{
          data: [25, 75],
          backgroundColor: ['#f39c12', '#2ecc71'],
          borderColor: '#ffffff',
          borderWidth: 3
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          tooltip: {
            ...commonOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => {
                const labels = ['Created 25%', 'Available 75%'];
                return labels[ctx.dataIndex];
              }
            }
          }
        }
      },
      plugins: [{
        id: 'centerText2',
        afterDraw: (chart) => {
          const { ctx, chartArea } = chart;
          const centerX = (chartArea.left + chartArea.right) / 2;
          const centerY = (chartArea.top + chartArea.bottom) / 2;
          ctx.save();
          ctx.font = 'bold 13px Arial';
          ctx.fillStyle = '#333';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('25%', centerX, centerY - 6);
          ctx.font = '10px Arial';
          ctx.fillStyle = '#666';
          ctx.fillText('Created', centerX, centerY + 10);
          ctx.restore();
        }
      }]
    });
  }

  // =========================================
  // CHART 3: OEES USERS
  // =========================================
  const chart3 = document.getElementById('oeesUsersChart');
  if (chart3) {
    new Chart(chart3, {
      type: 'doughnut',
      data: {
        labels: ['Offline', 'Online'],
        datasets: [{
          data: [25, 75],
          backgroundColor: ['#555555', '#2ecc71'],
          borderColor: '#ffffff',
          borderWidth: 3
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          tooltip: {
            ...commonOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => {
                const labels = ['Offline 25%', 'Online 75%'];
                return labels[ctx.dataIndex];
              }
            }
          }
        }
      },
      plugins: [{
        id: 'centerText3',
        afterDraw: (chart) => {
          const { ctx, chartArea } = chart;
          const centerX = (chartArea.left + chartArea.right) / 2;
          const centerY = (chartArea.top + chartArea.bottom) / 2;
          ctx.save();
          ctx.font = 'bold 13px Arial';
          ctx.fillStyle = '#333';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('75%', centerX, centerY - 6);
          ctx.font = '10px Arial';
          ctx.fillStyle = '#666';
          ctx.fillText('Online', centerX, centerY + 10);
          ctx.restore();
        }
      }]
    });
  }

  // =========================================
  // CHART 4: ADMISSION OEEMS USERS
  // =========================================
  const chart4 = document.getElementById('admissionUsersChart');
  if (chart4) {
    new Chart(chart4, {
      type: 'doughnut',
      data: {
        labels: ['Offline', 'Online'],
        datasets: [{
          data: [25, 75],
          backgroundColor: ['#555555', '#2ecc71'],
          borderColor: '#ffffff',
          borderWidth: 3
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          tooltip: {
            ...commonOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => {
                const labels = ['Offline 25%', 'Online 75%'];
                return labels[ctx.dataIndex];
              }
            }
          }
        }
      },
      plugins: [{
        id: 'centerText4',
        afterDraw: (chart) => {
          const { ctx, chartArea } = chart;
          const centerX = (chartArea.left + chartArea.right) / 2;
          const centerY = (chartArea.top + chartArea.bottom) / 2;
          ctx.save();
          ctx.font = 'bold 13px Arial';
          ctx.fillStyle = '#333';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('75%', centerX, centerY - 6);
          ctx.font = '10px Arial';
          ctx.fillStyle = '#666';
          ctx.fillText('Online', centerX, centerY + 10);
          ctx.restore();
        }
      }]
    });
  }

  console.log('✅ All System Status charts initialized.');
});