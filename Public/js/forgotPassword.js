document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgotPasswordForm');
  const emailInput = document.getElementById('resetEmail');
  const submitButton = document.getElementById('requestOtpButton');
  const message = document.getElementById('forgotMessage');

  emailInput.addEventListener('input', () => {
    submitButton.disabled = !emailInput.validity.valid || submitButton.dataset.busy === 'true';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!emailInput.validity.valid || submitButton.disabled) return;
    const email = emailInput.value.trim().toLowerCase();
    submitButton.disabled = true;
    submitButton.dataset.busy = 'true';
    message.textContent = '';

    try {
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ email })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not request a reset code.');
      sessionStorage.setItem('passwordResetEmail', email);
      const devParam = result.isDevMode ? '&dev=1' : '';
      window.location.assign(`/passwordResetOtp.html?remainingMs=${Math.max(0, result.expiresInMs || 120000)}${devParam}`);
    } catch (error) {
      message.textContent = error.message;
      message.className = 'auth-message error';
      submitButton.dataset.busy = 'false';
      submitButton.disabled = !emailInput.validity.valid;
    }
  });
});
