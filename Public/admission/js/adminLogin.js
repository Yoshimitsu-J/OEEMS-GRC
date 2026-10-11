/* =========================================
   ADMIN LOGIN — form validation + redirect
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('adminLoginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    const msgEl = document.getElementById('adminMessage');
    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ login, password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not sign in.');
      msgEl.textContent = 'Login successful. Redirecting...';
      msgEl.style.color = '#27ae60';
      window.location.assign(result.redirectUrl);
    } catch (error) {
      msgEl.textContent = error.message;
      msgEl.style.color = '#c0392b';
      if (submitButton) submitButton.disabled = false;
    }
  });
});