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
  const otpModal = document.getElementById('otpModal');
  const closeOtpBtn = document.getElementById('closeOtpBtn');
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  const otpInputs = document.querySelectorAll('.otp-box');
  const otpMessage = document.getElementById('otpMessage');

  const ruleLength = document.getElementById('rule-length');
  const ruleCase = document.getElementById('rule-case');
  const ruleNumber = document.getElementById('rule-number');
  const ruleSpecial = document.getElementById('rule-special');

  // --- PASSWORD VALIDATION ---
  function validatePassword() {
    const val = passwordInput.value;
    let valid = true;

    if (val.length >= 8) ruleLength.classList.add('valid');
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

  // --- FORM SUBMIT → SHOW OTP ---
  if (signupForm && otpModal) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Save email lang (walang fname/lname)
      const email = document.getElementById('email').value.trim();
      localStorage.setItem('signupEmail', email);

      otpModal.classList.remove('hidden');
      if (otpInputs.length > 0) otpInputs[0].focus();
    });
  }

  // --- OTP AUTO-TAB ---
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      if (input.value.length === 1 && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        otpInputs[index - 1].focus();
      }
    });
  });

  // --- CLOSE OTP ---
  if (closeOtpBtn && otpModal) {
    closeOtpBtn.addEventListener('click', () => {
      otpModal.classList.add('hidden');
    });
  }

  // --- VERIFY OTP ---
  if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener('click', () => {
      const entered = Array.from(otpInputs).map((i) => i.value).join('');
      if (entered === '1234') {
        otpMessage.textContent = 'Verified! Redirecting...';
        otpMessage.style.color = '#4dd08a';

        setTimeout(() => {
          window.location.href = 'student/congratulations.html';
        }, 800);
      } else {
        otpMessage.textContent = 'Invalid code. Try 1234.';
        otpMessage.style.color = '#ff6b6b';
      }
    });
  }
});