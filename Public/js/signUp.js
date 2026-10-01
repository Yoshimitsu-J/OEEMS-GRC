/* =========================================
   SIGNUP.JS — Signup form + OTP modal
   (WALANG First Name / Last Name)
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Signup JS Initialized.');

  const signupForm = document.getElementById('signupForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submitBtn');
  const message = document.getElementById('message');

  const ruleLength = document.getElementById('rule-length');
  const ruleCase = document.getElementById('rule-case');
  const ruleNumber = document.getElementById('rule-number');
  const ruleSpecial = document.getElementById('rule-special');

  let isSubmitting = false;

  function validatePassword() {
    const val = passwordInput.value;
    const checks = [
      [ruleLength, val.length >= 8],
      [ruleCase, /[a-z]/.test(val) && /[A-Z]/.test(val)],
      [ruleNumber, /\d/.test(val)],
      [ruleSpecial, /[_\/@#!]/.test(val)]
    ];
    checks.forEach(([rule, passes]) => rule.classList.toggle('valid', passes));
    submitBtn.disabled = isSubmitting || !emailInput.validity.valid || checks.some(([, passes]) => !passes);
  }

  emailInput.addEventListener('input', validatePassword);
  if (passwordInput) passwordInput.addEventListener('input', validatePassword);

  // --- CREATE ACCOUNT AND REQUEST EMAIL OTP ---
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      isSubmitting = true;
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

        const pendingEmail = emailInput.value.trim();
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
        isSubmitting = false;
        validatePassword();
      }
    });
  }

});