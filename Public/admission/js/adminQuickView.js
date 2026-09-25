/* =========================================
   ADMIN QUICK VIEW — Charts Initialization
   Uses Chart.js
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Admin Quick View JS Initialized.');

  // =========================================
  // COLOR PALETTE
  // =========================================
  const colors = {
    red: '#e63946',
    green: '#2ecc71',
    yellow: '#f4d03f',
    orange: '#f39c12',
    darkRed: '#8B0000',
    darkGray: '#555555',
    lightGray: '#f0f0f0'
  };

  // =========================================
  // CHART 1: EXAMINATION FACILITIES (Pie Chart)
  // =========================================
  const facilitiesCtx = document.getElementById('facilitiesChart');
  if (facilitiesCtx) {
    new Chart(facilitiesCtx, {
      type: 'pie',
      data: {
        labels: ['In Use (57.9%)', 'Available (26.3%)', 'Maintenance (15.8%)'],
        datasets: [{
          data: [57.9, 26.3, 15.8],
          backgroundColor: [colors.red, colors.green, colors.yellow],
          borderColor: '#ffffff',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: { size: 11, family: 'Arial' },
              padding: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          title: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            callbacks: {
              label: function(context) {
                return context.label;
              }
            }
          }
        }
      }
    });
  }

  // =========================================
  // CHART 2: EXAMINATION RESULTS CATEGORY (Bar Chart)
  // =========================================
  const resultsCtx = document.getElementById('resultsChart');
  if (resultsCtx) {
    new Chart(resultsCtx, {
      type: 'bar',
      data: {
        labels: ['Math', 'Reading', 'Abstract', 'Reasoning'],
        datasets: [{
          data: [20, 30, 25, 50],
          backgroundColor: [colors.red, colors.orange, colors.yellow, colors.green],
          borderColor: [colors.red, colors.orange, colors.yellow, colors.green],
          borderWidth: 1,
          borderRadius: 4,
          barThickness: 45
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            callbacks: {
              label: function(context) {
                return 'Score: ' + context.parsed.y;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 60,
            ticks: {
              stepSize: 10,
              font: { size: 11 },
              color: '#333'
            },
            grid: {
              color: '#f0f0f0',
              drawBorder: false
            }
          },
          x: {
            ticks: {
              font: { size: 11, weight: 'bold' },
              color: '#333'
            },
            grid: { display: false }
          }
        }
      }
    });
  }

  // =========================================
  // CHART 3: EXAMINERS RESULT (Line/Area Chart)
  // =========================================
  const examinersCtx = document.getElementById('examinersChart');
  if (examinersCtx) {
    new Chart(examinersCtx, {
      type: 'line',
      data: {
        labels: ['April 7', 'April 14', 'April 21', 'April 27'],
        datasets: [
          {
            label: 'Passed',
            data: [20, 35, 65, 70],
            backgroundColor: 'rgba(46, 204, 113, 0.5)',
            borderColor: colors.green,
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: colors.green,
            pointBorderColor: '#fff',
            pointRadius: 5,
            pointHoverRadius: 7
          },
          {
            label: 'Failed',
            data: [15, 25, 40, 30],
            backgroundColor: 'rgba(230, 57, 70, 0.5)',
            borderColor: colors.red,
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: colors.red,
            pointBorderColor: '#fff',
            pointRadius: 5,
            pointHoverRadius: 7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 80,
            ticks: {
              stepSize: 10,
              font: { size: 11 },
              color: '#333'
            },
            grid: {
              color: '#f0f0f0',
              drawBorder: false
            }
          },
          x: {
            ticks: {
              font: { size: 11 },
              color: '#333'
            },
            grid: { display: false }
          }
        }
      }
    });
  }

  // =========================================
  // CHART 4: STUDENT RESULTS STORAGE (Donut)
  // =========================================
  const studentResultsCtx = document.getElementById('studentResultsChart');
  if (studentResultsCtx) {
    new Chart(studentResultsCtx, {
      type: 'doughnut',
      data: {
        labels: ['Used', 'Available'],
        datasets: [{
          data: [25, 75],
          backgroundColor: [colors.red, colors.green],
          borderColor: '#ffffff',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 10,
            callbacks: {
              label: function(context) {
                return context.label + ': ' + context.parsed + '%';
              }
            }
          }
        }
      }
    });
  }

  // =========================================
  // CHART 5: ACCOUNTS STORAGE (Donut)
  // =========================================
  const accountsCtx = document.getElementById('accountsChart');
  if (accountsCtx) {
    new Chart(accountsCtx, {
      type: 'doughnut',
      data: {
        labels: ['Created', 'Available'],
        datasets: [{
          data: [25, 75],
          backgroundColor: [colors.orange, colors.green],
          borderColor: '#ffffff',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 10,
            callbacks: {
              label: function(context) {
                return context.label + ': ' + context.parsed + '%';
              }
            }
          }
        }
      }
    });
  }

  // =========================================
  // CHART 6: OEES USERS (Donut)
  // =========================================
  const oeesUsersCtx = document.getElementById('oeesUsersChart');
  if (oeesUsersCtx) {
    new Chart(oeesUsersCtx, {
      type: 'doughnut',
      data: {
        labels: ['Offline', 'Online'],
        datasets: [{
          data: [25, 75],
          backgroundColor: [colors.darkGray, colors.green],
          borderColor: '#ffffff',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 10,
            callbacks: {
              label: function(context) {
                return context.label + ': ' + context.parsed + '%';
              }
            }
          }
        }
      }
    });
  }

  console.log('All charts initialized.');
});