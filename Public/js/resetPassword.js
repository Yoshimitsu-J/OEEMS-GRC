document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('resetPasswordForm');
  const passwordInput = document.getElementById('newPassword');
  const confirmationInput = document.getElementById('confirmPassword');
  const submitButton = document.getElementById('resetPasswordButton');
  const message = document.getElementById('resetPasswordMessage');
  const matchMessage = document.getElementById('passwordMatchMessage');
  const successDialog = document.getElementById('passwordResetSuccess');
  let submitting = false;

  function validatePassword() {
    const password = passwordInput.value;
    const checks = [
      [document.getElementById('rule-length'), password.length >= 8 && password.length <= 128],
      [document.getElementById('rule-case'), /[a-z]/.test(password) && /[A-Z]/.test(password)],
      [document.getElementById('rule-number'), /\d/.test(password)],
      [document.getElementById('rule-special'), /[_\/@#!]/.test(password)]
    ];
    checks.forEach(([rule, passes]) => rule.classList.toggle('valid', passes));
    const passwordsMatch = password.length > 0 && password === confirmationInput.value;
    matchMessage.textContent = confirmationInput.value && !passwordsMatch ? 'Passwords do not match.' : '';
    submitButton.disabled = submitting || checks.some(([, passes]) => !passes) || !passwordsMatch;
  }

  passwordInput.addEventListener('input', validatePassword);
  confirmationInput.addEventListener('input', validatePassword);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitButton.disabled) return;
    submitting = true;
    validatePassword();
    message.textContent = '';
    try {
      const response = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ password: passwordInput.value, confirmPassword: confirmationInput.value })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not reset your password.');
      form.hidden = true;
      successDialog.showModal();
    } catch (error) {
      message.textContent = error.message;
      message.className = 'auth-message error';
    } finally {
      submitting = false;
      if (!successDialog.open) validatePassword();
    }
  });

  document.getElementById('resetSuccessOk').addEventListener('click', () => {
    successDialog.close();
    window.location.assign('/public/index.html');
  });

  validatePassword();
});
