/* =========================================
   LOGIN.JS — Login + Forgot Password
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const messageEl = document.getElementById('message');

  const oauthErrors = {
    google_sign_in_cancelled: 'Google sign-in was cancelled.',
    account_not_found: 'No account was found. Use Sign Up to create one.',
    account_disabled: 'This account cannot sign in. Contact support.',
    google_auth_failed: 'Google sign-in failed. Please try again.'
  };
  const oauthError = new URLSearchParams(window.location.search).get('error');
  if (messageEl && oauthErrors[oauthError]) {
    messageEl.textContent = oauthErrors[oauthError];
    messageEl.className = 'error';
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitButton = loginForm.querySelector('[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('email').value.trim(),
            password: document.getElementById('password').value
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not sign in.');
        window.location.assign(result.redirectUrl);
      } catch (error) {
        if (messageEl) {
          messageEl.textContent = error.message;
          messageEl.className = 'error';
        }
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

});