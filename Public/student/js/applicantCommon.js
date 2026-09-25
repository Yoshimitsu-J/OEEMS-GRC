/* =========================================
   APPLICANT COMMON — sidebar toggle
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Applicant Common JS Initialized.');

  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggleSidebar');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });
  }
});