/* =========================================
   ADMIN LOGIN — form validation + redirect
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('adminLoginForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    const msgEl = document.getElementById('adminMessage');

    if (username === 'admin' && password === 'admin123') {
      const adminSession = {
        username: username,
        fullname: 'Dr. Esguerra',
        role: 'Admin',
        token: 'admin-token-' + Date.now()
      };
      localStorage.setItem('userSession', JSON.stringify(adminSession));

      msgEl.textContent = 'Login successful! Redirecting...';
      msgEl.style.color = '#27ae60';

      setTimeout(() => {
        window.location.href = 'adminQuickView.html';
      }, 800);
    } else {
      msgEl.textContent = 'Invalid credentials. Use admin / admin123';
      msgEl.style.color = '#c0392b';
    }
  });
});