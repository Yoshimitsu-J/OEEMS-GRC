/* =========================================
   APPLICANT EXAM — timer + answer autosave
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Applicant Exam JS Initialized.');

  const timerElement = document.querySelector('[data-exam-timer]');
  if (timerElement) {
    let timeLeft = 15 * 60;

    const interval = setInterval(() => {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      if (timeLeft <= 0) {
        clearInterval(interval);
        alert("Time's up! Your exam will be submitted.");
        window.location.href = 'examResult.html';
      }
      timeLeft--;
    }, 1000);
  }

  document.querySelectorAll('input[type="radio"][name="answer"]').forEach((input) => {
    input.addEventListener('change', () => {
      localStorage.setItem('examAnswer', input.value);
    });
  });

  const savedAnswer = localStorage.getItem('examAnswer');
  if (savedAnswer) {
    const matchingInput = document.querySelector(
      `input[type="radio"][name="answer"][value="${savedAnswer}"]`
    );
    if (matchingInput) matchingInput.checked = true;
  }
});