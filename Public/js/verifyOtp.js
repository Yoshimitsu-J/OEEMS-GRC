document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('verifyOtpForm');
  const emailDisplay = document.getElementById('emailDisplay');
  const codeInput = document.getElementById('code');
  const verifyButton = document.getElementById('verifyButton');
  const resendButton = document.getElementById('resendButton');
  const countdown = document.getElementById('countdown');
  const message = document.getElementById('message');
  const devNote = document.getElementById('devNote');
  const query = new URLSearchParams(window.location.search);
  const email = (sessionStorage.getItem('pendingOtpEmail') || query.get('email') || '').trim();
  let remainingMs = Math.max(0, Number(query.get('remainingMs')) || 0);
  let deadline = performance.now() + remainingMs;
  let countdownInterval;

  emailDisplay.textContent = email || 'the email address used during signup';
  devNote.hidden = query.get('dev') !== '1';
  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
  });

  function updateCountdown() {
    remainingMs = Math.max(0, deadline - performance.now());
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    countdown.textContent = `Code expires in ${minutes}:${seconds}`;

    if (remainingMs === 0) {
      window.clearInterval(countdownInterval);
      verifyButton.disabled = true;
      resendButton.hidden = false;
      message.textContent = 'The code has expired. Request a new one to continue.';
    }
  }

  function startCountdown(durationMs) {
    window.clearInterval(countdownInterval);
    remainingMs = Math.max(0, durationMs);
    deadline = performance.now() + remainingMs;
    verifyButton.disabled = !email || remainingMs === 0;
    resendButton.hidden = remainingMs > 0;
    updateCountdown();
    if (remainingMs > 0) countdownInterval = window.setInterval(updateCountdown, 250);
  }

  startCountdown(remainingMs);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!email || remainingMs <= 0) return;
    verifyButton.disabled = true;
    message.textContent = '';

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: codeInput.value })
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.expired) startCountdown(0);
        throw new Error(result.error || 'Could not verify the code.');
      }
      sessionStorage.removeItem('pendingOtpEmail');
      window.location.assign(result.redirectUrl);
    } catch (error) {
      message.textContent = error.message;
      message.className = 'error';
    } finally {
      if (remainingMs > 0) verifyButton.disabled = false;
    }
  });

  resendButton.addEventListener('click', async () => {
    if (!email) {
      message.textContent = 'Return to sign up and enter your email address.';
      return;
    }

    resendButton.disabled = true;
    message.textContent = '';
    try {
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not resend the code.');
      devNote.hidden = !result.isDevMode;
      codeInput.value = '';
      message.textContent = result.isDevMode
        ? 'A new code was logged to the server terminal.'
        : 'A new code was sent to your email.';
      message.className = 'success';
      startCountdown(result.expiresInMs);
    } catch (error) {
      message.textContent = error.message;
      message.className = 'error';
    } finally {
      resendButton.disabled = false;
    }
  });
});