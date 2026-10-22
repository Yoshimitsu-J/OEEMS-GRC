document.addEventListener('DOMContentLoaded', () => {
  const email = (sessionStorage.getItem('passwordResetEmail') || '').trim().toLowerCase();
  const emailDisplay = document.getElementById('resetEmailDisplay');
  const inputs = [...document.querySelectorAll('.otp-digit')];
  const verifyButton = document.getElementById('verifyResetOtpButton');
  const resendButton = document.getElementById('resendResetOtpButton');
  const countdown = document.getElementById('resetCountdown');
  const message = document.getElementById('resetOtpMessage');
  const devNote = document.getElementById('resetDevNote');
  let duration = Math.max(0, Number(new URLSearchParams(location.search).get('remainingMs')) || 0);
  let deadline = performance.now() + duration;
  let timer;
  const code = () => inputs.map((input) => input.value).join('');

  emailDisplay.textContent = email || 'the email address you entered';
  devNote.hidden = new URLSearchParams(location.search).get('dev') !== '1';

  function renderCountdown() {
    duration = Math.max(0, deadline - performance.now());
    const seconds = Math.ceil(duration / 1000);
    countdown.textContent = `Code expires in ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    resendButton.disabled = duration > 0 || !email;
    verifyButton.disabled = duration <= 0 || code().length !== inputs.length || !email;
    if (duration <= 0) {
      window.clearInterval(timer);
      message.textContent = 'The code has expired. Resend a new code to continue.';
    }
  }

  function startCountdown(milliseconds) {
    window.clearInterval(timer);
    duration = Math.max(0, milliseconds);
    deadline = performance.now() + duration;
    renderCountdown();
    if (duration > 0) timer = window.setInterval(renderCountdown, 250);
  }

  inputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '');
      input.value = digits.slice(-1);
      if (digits.length > 1) {
        digits.slice(0, inputs.length).split('').forEach((digit, digitIndex) => { inputs[digitIndex].value = digit; });
      }
      if (input.value && index < inputs.length - 1) inputs[index + 1].focus();
      renderCountdown();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !input.value && index > 0) inputs[index - 1].focus();
    });
    input.addEventListener('paste', (event) => {
      const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, inputs.length);
      if (!digits) return;
      event.preventDefault();
      digits.split('').forEach((digit, digitIndex) => { inputs[digitIndex].value = digit; });
      inputs[Math.min(digits.length, inputs.length) - 1].focus();
      renderCountdown();
    });
  });

  document.getElementById('resetOtpForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (verifyButton.disabled) return;
    verifyButton.disabled = true;
    message.textContent = '';
    try {
      const response = await fetch('/api/auth/password-reset/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ email, code: code() })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not verify the code.');
      sessionStorage.removeItem('passwordResetEmail');
      window.location.assign(result.redirectUrl || '/resetPassword.html');
    } catch (error) {
      message.textContent = error.message;
      message.className = 'auth-message error';
      renderCountdown();
    }
  });

  resendButton.addEventListener('click', async () => {
    if (!email || resendButton.disabled) return;
    resendButton.disabled = true;
    message.textContent = '';
    try {
      const response = await fetch('/api/auth/password-reset/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ email })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not resend the code.');
      inputs.forEach((input) => { input.value = ''; });
      devNote.hidden = !result.isDevMode;
      message.textContent = result.message;
      message.className = 'auth-message success';
      const devParam = result.isDevMode ? '1' : '0';
      history.replaceState({}, document.title, `${location.pathname}?remainingMs=${result.expiresInMs || 120000}&dev=${devParam}`);
      startCountdown(result.expiresInMs || 120000);
    } catch (error) {
      message.textContent = error.message;
      message.className = 'auth-message error';
      resendButton.disabled = false;
    }
  });

  if (!email) {
    message.textContent = 'Start again from Forgot Password to request a reset code.';
    verifyButton.disabled = true;
    resendButton.disabled = true;
  }
  startCountdown(duration);
});
