document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('verifyOtpForm');
  const emailInput = document.getElementById('email');
  const codeInput = document.getElementById('code');
  const verifyButton = document.getElementById('verifyButton');
  const message = document.getElementById('verifyMessage');

  emailInput.value = new URLSearchParams(window.location.search).get('email') || '';
  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    verifyButton.disabled = true;
    message.textContent = '';

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.value.trim(), code: codeInput.value })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not verify the code.');
      window.location.assign(result.redirectUrl);
    } catch (error) {
      message.textContent = error.message;
      message.className = 'error';
    } finally {
      verifyButton.disabled = false;
    }
  });
});