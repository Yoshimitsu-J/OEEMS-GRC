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

  const forgotModal = document.getElementById('forgotPasswordModal');
  const openForgotBtn = document.getElementById('openForgotPassword');
  const closeForgotBtn = document.getElementById('closeForgotPassword');
  const step1 = document.getElementById('forgotStep1');
  const step2 = document.getElementById('forgotStep2');
  const step3 = document.getElementById('forgotStep3');
  const sendCodeBtn = document.getElementById('sendCodeBtn');
  const verifyCodeBtn = document.getElementById('verifyCodeBtn');
  const resetPasswordBtn = document.getElementById('resetPasswordBtn');
  const forgotMessage1 = document.getElementById('forgotMessage1');
  const forgotMessage2 = document.getElementById('forgotMessage2');
  const forgotMessage3 = document.getElementById('forgotMessage3');
  const otpBoxes = document.querySelectorAll('.forgotOtpBox');

  if (openForgotBtn && forgotModal) {
    openForgotBtn.addEventListener('click', (e) => {
      e.preventDefault();
      forgotModal.classList.remove('hidden');
      showStep(1);
    });
  }

  if (closeForgotBtn && forgotModal) {
    closeForgotBtn.addEventListener('click', () => {
      forgotModal.classList.add('hidden');
      resetAllFields();
    });
  }

  function showStep(n) {
    [step1, step2, step3].forEach((s) => s && s.classList.add('hidden'));
    if (n === 1 && step1) step1.classList.remove('hidden');
    if (n === 2 && step2) step2.classList.remove('hidden');
    if (n === 3 && step3) step3.classList.remove('hidden');
  }

  if (forgotModal && window.location.hash === '#forgotPasswordModal') {
    forgotModal.classList.remove('hidden');
    showStep(1);
  }

  if (sendCodeBtn) {
    sendCodeBtn.addEventListener('click', async () => {
      const email = document.getElementById('forgotEmail').value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        forgotMessage1.textContent = 'Please enter a valid email.';
        forgotMessage1.style.color = '#ff6b6b';
        return;
      }
      sendCodeBtn.disabled = true;
      try {
        const response = await fetch('/api/auth/password-reset/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not request a reset code.');
        forgotMessage1.textContent = result.message;
        forgotMessage1.style.color = '#4dd08a';
        showStep(2);
        if (otpBoxes.length > 0) otpBoxes[0].focus();
      } catch (error) {
        forgotMessage1.textContent = error.message;
        forgotMessage1.style.color = '#ff6b6b';
      } finally {
        sendCodeBtn.disabled = false;
      }
    });
  }

  otpBoxes.forEach((input, index) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(-1);
      if (input.value.length === 1 && index < otpBoxes.length - 1) {
        otpBoxes[index + 1].focus();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        otpBoxes[index - 1].focus();
      }
    });
  });

  if (verifyCodeBtn) {
    verifyCodeBtn.addEventListener('click', () => {
      const entered = Array.from(otpBoxes).map((i) => i.value).join('');
      if (/^\d{6}$/.test(entered)) {
        forgotMessage2.textContent = 'Enter your new password, then submit the code.';
        forgotMessage2.style.color = '#4dd08a';
        setTimeout(() => showStep(3), 500);
      } else {
        forgotMessage2.textContent = 'Enter all six digits from the email.';
        forgotMessage2.style.color = '#ff6b6b';
      }
    });
  }

  const toggleNewPassword = document.getElementById('toggleNewPassword');
  const newPasswordInput = document.getElementById('newPassword');
  const eyeIconNew = document.getElementById('eyeIconNew');
  if (toggleNewPassword && newPasswordInput) {
    toggleNewPassword.addEventListener('click', () => {
      const type = newPasswordInput.type === 'password' ? 'text' : 'password';
      newPasswordInput.type = type;
      eyeIconNew.className = type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
    });
  }

  const toggleConfirmNew = document.getElementById('toggleConfirmNew');
  const confirmNewInput = document.getElementById('confirmNewPassword');
  const eyeIconConfirmNew = document.getElementById('eyeIconConfirmNew');
  if (toggleConfirmNew && confirmNewInput) {
    toggleConfirmNew.addEventListener('click', () => {
      const type = confirmNewInput.type === 'password' ? 'text' : 'password';
      confirmNewInput.type = type;
      eyeIconConfirmNew.className = type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
    });
  }

  if (resetPasswordBtn) {
    resetPasswordBtn.addEventListener('click', () => {
      const newPass = newPasswordInput.value;
      const confirmPass = confirmNewInput.value;
      const code = Array.from(otpBoxes).map((input) => input.value).join('');
      if (newPass.length < 8 || newPass.length > 128) {
        forgotMessage3.textContent = 'Password must be 8 to 128 characters.';
        forgotMessage3.style.color = '#ff6b6b';
        return;
      }
      if (newPass !== confirmPass) {
        forgotMessage3.textContent = 'Passwords do not match.';
        forgotMessage3.style.color = '#ff6b6b';
        return;
      }
      resetPasswordBtn.disabled = true;
      fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('forgotEmail').value.trim(),
          code,
          password: newPass
        })
      })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Could not reset the password.');
          forgotMessage3.textContent = result.message;
          forgotMessage3.style.color = '#4dd08a';
          setTimeout(() => {
            forgotModal.classList.add('hidden');
            resetAllFields();
          }, 1200);
        })
        .catch((error) => {
          forgotMessage3.textContent = error.message;
          forgotMessage3.style.color = '#ff6b6b';
        })
        .finally(() => {
          resetPasswordBtn.disabled = false;
        });
    });
  }

  function resetAllFields() {
    const forgotEmail = document.getElementById('forgotEmail');
    if (forgotEmail) forgotEmail.value = '';
    otpBoxes.forEach((b) => (b.value = ''));
    if (newPasswordInput) newPasswordInput.value = '';
    if (confirmNewInput) confirmNewInput.value = '';
    if (forgotMessage1) forgotMessage1.textContent = '';
    if (forgotMessage2) forgotMessage2.textContent = '';
    if (forgotMessage3) forgotMessage3.textContent = '';
    showStep(1);
  }
});