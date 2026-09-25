/* =========================================
   ADMIN COMMON — Global admin utilities
   ========================================= */

function toggleMobileSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar && overlay) {
    sidebar.classList.toggle('show-mobile');
    overlay.classList.toggle('show-mobile');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('Admin Common JS Initialized.');

  const logoutBtn = document.querySelector('.btn-logout-nav');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('userSession');
      window.location.href = 'adminLoginPage.html';
    });
  }

  const searchInput =
    document.querySelector('#filterName') ||
    document.querySelector('#searchApplicant');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const keyword = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('.admin-table tbody tr');
      rows.forEach((row) => {
        const nameCell =
          row.cells[1]?.textContent.toLowerCase() ||
          row.cells[0]?.textContent.toLowerCase() ||
          '';
        row.style.display = nameCell.includes(keyword) ? '' : 'none';
      });
    });
  }
});