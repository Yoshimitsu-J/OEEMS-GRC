/* =========================================
   ADMIN DASHBOARD — shared admin logic
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Admin Dashboard JS Initialized.');

  const searchInput =
    document.querySelector('#filterName') ||
    document.querySelector('#searchApplicant');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const keyword = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('.admin-table tbody tr');
      rows.forEach((row) => {
        const nameCell = row.cells[0]?.textContent.toLowerCase() || '';
        row.style.display = nameCell.includes(keyword) ? '' : 'none';
      });
    });
  }

  document.querySelectorAll('.btn-approve').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('tr');
      if (row) row.style.opacity = '0.5';
    });
  });

  document.querySelectorAll('.btn-decline').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('tr');
      if (row) row.style.opacity = '0.5';
    });
  });
});