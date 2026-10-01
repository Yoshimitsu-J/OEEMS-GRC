/* =========================================
   SIGNUP.JS — Signup form + OTP modal
   (WALANG First Name / Last Name)
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Signup JS Initialized.');

  const signupForm = document.getElementById('signupForm');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirmPassword');
  const submitBtn = document.getElementById('submitBtn');
  const message = document.getElementById('message');

  const ruleLength = document.getElementById('rule-length');
  const ruleCase = document.getElementById('rule-case');
  const ruleNumber = document.getElementById('rule-number');
  const ruleSpecial = document.getElementById('rule-special');

  // --- PASSWORD VALIDATION ---
  function validatePassword() {
    const val = passwordInput.value;
    let valid = true;

    if (val.length >= 12) ruleLength.classList.add('valid');
    else { ruleLength.classList.remove('valid'); valid = false; }

    if (/[a-z]/.test(val) && /[A-Z]/.test(val)) ruleCase.classList.add('valid');
    else { ruleCase.classList.remove('valid'); valid = false; }

    if (/\d/.test(val)) ruleNumber.classList.add('valid');
    else { ruleNumber.classList.remove('valid'); valid = false; }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(val)) ruleSpecial.classList.add('valid');
    else { ruleSpecial.classList.remove('valid'); valid = false; }

    submitBtn.disabled = !(confirmInput.value && confirmInput.value === val && valid);
  }

  if (passwordInput) passwordInput.addEventListener('input', validatePassword);
  if (confirmInput) confirmInput.addEventListener('input', validatePassword);

  // --- TOGGLE PASSWORD ---
  const togglePassword = document.getElementById('togglePassword');
  const eyeIconPassword = document.getElementById('eyeIconPassword');
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      eyeIconPassword.className = type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
    });
  }

  const toggleConfirm = document.getElementById('toggleConfirmPassword');
  const eyeIconConfirm = document.getElementById('eyeIconConfirm');
  if (toggleConfirm && confirmInput) {
    toggleConfirm.addEventListener('click', () => {
      const type = confirmInput.type === 'password' ? 'text' : 'password';
      confirmInput.type = type;
      eyeIconConfirm.className = type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
    });
  }

  // --- CREATE ACCOUNT AND REQUEST EMAIL OTP ---
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      message.textContent = '';
      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('email').value.trim(),
            password: passwordInput.value
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not create your account.');

        const pendingEmail = document.getElementById('email').value.trim();
        message.textContent = result.isDevMode
          ? 'Development Mode: OTP logged to server terminal.'
          : result.message;
        message.className = result.isDevMode ? 'warning' : 'success';
        sessionStorage.setItem('pendingOtpEmail', pendingEmail);
        window.setTimeout(() => {
          const remainingMs = Math.max(0, result.expiresInMs - 900);
          const devParam = result.isDevMode ? '&dev=1' : '';
          window.location.assign(`/verify-otp?remainingMs=${remainingMs}${devParam}`);
        }, 900);
      } catch (error) {
        message.textContent = error.message;
        message.className = 'error';
      } finally {
        validatePassword();
      }
    });
  }

});