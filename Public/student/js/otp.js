/* =========================================
   OTP VERIFICATION — 6-digit input
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('OTP JS Initialized.');

  const otpBoxes = document.querySelectorAll('.otp-box-6');
  const verifyBtn = document.getElementById('verifyBtn');
  const otpMessage = document.getElementById('otpMessage');
  const keypadButtons = document.querySelectorAll('.keypad-btn');

  let activeIndex = 0;

  // --- FOCUS FIRST BOX ---
  if (otpBoxes.length > 0) otpBoxes[0].focus();

  // --- OTP BOX INPUT ---
  otpBoxes.forEach((box, index) => {
    box.addEventListener('input', (e) => {
      const value = e.target.value;
      if (value.length >= 1) {
        box.value = value.slice(-1);
        if (index < otpBoxes.length - 1) {
          otpBoxes[index + 1].focus();
          activeIndex = index + 1;
        }
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && index > 0) {
        otpBoxes[index - 1].focus();
        activeIndex = index - 1;
      }
    });

    box.addEventListener('focus', () => {
      activeIndex = index;
    });
  });

  // --- KEYPAD INPUT ---
  keypadButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-key');

      if (key === 'backspace') {
        if (otpBoxes[activeIndex].value) {
          otpBoxes[activeIndex].value = '';
        } else if (activeIndex > 0) {
          activeIndex--;
          otpBoxes[activeIndex].value = '';
          otpBoxes[activeIndex].focus();
        }
      } else if (key === 'go') {
        verifyBtn.click();
      } else {
        if (activeIndex < otpBoxes.length) {
          otpBoxes[activeIndex].value = key;
          if (activeIndex < otpBoxes.length - 1) {
            activeIndex++;
            otpBoxes[activeIndex].focus();
          }
        }
      }
    });
  });

  // --- VERIFY BUTTON ---
  if (verifyBtn) {
    verifyBtn.addEventListener('click', () => {
      const entered = Array.from(otpBoxes).map((b) => b.value).join('');

      if (entered.length < 6) {
        otpMessage.textContent = 'Please enter all 6 digits.';
        otpMessage.style.color = '#ff6b6b';
        return;
      }

      // Demo code: 147412
      if (entered === '147412') {
        otpMessage.textContent = 'Verified! Redirecting...';
        otpMessage.style.color = '#4dd08a';

        setTimeout(() => {
          window.location.href = 'congratulations.html';
        }, 1000);
      } else {
        otpMessage.textContent = 'Invalid code. Try 147412.';
        otpMessage.style.color = '#ff6b6b';
      }
    });
  }
});