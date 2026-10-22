document.addEventListener('DOMContentLoaded', () => {
  const applicationCode = new URLSearchParams(window.location.search).get('applicationCode') || sessionStorage.getItem('examinationApplicationCode');
  const instructions = document.getElementById('examInstructionsDialog');
  const startButton = document.getElementById('startExamButton');
  const questionElement = document.querySelector('[data-exam-question]');
  const optionsElement = document.querySelector('[data-exam-options]');
  const progressElement = document.querySelector('[data-items-progress]');
  const timerElement = document.querySelector('[data-exam-timer]');
  const nextButton = document.querySelector('[data-exam-next]');
  let questions = [];
  let questionIndex = 0;
  let answers = {};
  let attemptId = null;
  let timeLeft = 180;
  let timerId = null;
  let submissionInProgress = false;
  let violationCount = 0;

  function requestFullscreen() {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  async function recordViolation(type) {
    violationCount += 1;
    if (!attemptId) return;
    try {
      await fetch('/api/examination/violation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, violation: type, timestamp: new Date().toISOString() })
      });
    } catch {}
    if (violationCount >= 3) submitExam(true);
  }

  document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    recordViolation('context-menu');
  });
  document.addEventListener('keydown', (event) => {
    const blocked = event.key === 'F12' || (event.ctrlKey && ['c', 'v', 'x', 'u', 's', 'p'].includes(event.key.toLowerCase())) || (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(event.key.toLowerCase())) || event.altKey && event.key === 'Tab';
    if (blocked) {
      event.preventDefault();
      recordViolation(`blocked-key-${event.key}`);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) recordViolation('visibility-hidden');
  });
  window.addEventListener('blur', () => recordViolation('window-blur'));
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      recordViolation('fullscreen-exit');
      requestFullscreen();
    }
  });

  async function submitExam(forceDisqualification = false) {
    if (submissionInProgress || !attemptId) return;
    submissionInProgress = true;
    clearInterval(timerId);
    try {
      await fetch('/api/examination/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, answers, forceDisqualification })
      });
    } finally {
      window.location.assign('/public/examination/result.html?examSubmitted=true');
    }
  }

  function updateProgress() {
    const answered = Object.keys(answers).length;
    progressElement.textContent = `${answered} out of ${questions.length} items`;
  }

  function renderQuestion() {
    const question = questions[questionIndex];
    if (!question) return submitExam(false);
    questionElement.textContent = question.text;
    optionsElement.replaceChildren();
    question.options.forEach((option) => {
      const label = document.createElement('label');
      label.className = 'option-item';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'answer';
      input.value = option.optionId;
      input.checked = answers[question.questionId] === option.optionId;
      input.addEventListener('change', () => {
        answers[question.questionId] = option.optionId;
        nextButton.disabled = false;
        updateProgress();
      });
      const text = document.createElement('span');
      text.textContent = option.text;
      label.append(input, text);
      optionsElement.append(label);
    });
    nextButton.disabled = !answers[question.questionId];
    nextButton.textContent = questionIndex === questions.length - 1 ? 'Submit Exam' : 'Next';
    updateProgress();
  }

  nextButton.addEventListener('click', () => {
    if (!answers[questions[questionIndex].questionId]) return;
    if (questionIndex === questions.length - 1) submitExam(false);
    else {
      questionIndex += 1;
      renderQuestion();
    }
  });

  function startTimer() {
    timerId = setInterval(() => {
      timeLeft -= 1;
      const minutes = Math.floor(timeLeft / 60);
      const seconds = String(Math.max(0, timeLeft % 60)).padStart(2, '0');
      timerElement.textContent = `${minutes}:${seconds}`;
      if (timeLeft <= 0) submitExam(false);
    }, 1000);
  }

  async function initializeExam() {
    if (!applicationCode) {
      window.location.assign('/public/examination/login.html');
      return;
    }
    try {
      const [questionResponse, startResponse] = await Promise.all([
        fetch('/api/examination/questionnaire', { credentials: 'same-origin', cache: 'no-store' }),
        fetch('/api/examination/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ applicationCode }) })
      ]);
      const questionResult = await questionResponse.json();
      const startResult = await startResponse.json();
      if (!questionResponse.ok) throw new Error(questionResult.error || 'Could not load exam questions.');
      if (!startResponse.ok) throw new Error(startResult.error || 'Could not start examination.');
      questions = questionResult.questions;
      attemptId = startResult.attemptId;
      timeLeft = startResult.durationSeconds || 180;
      renderQuestion();
    } catch (error) {
      questionElement.textContent = error.message;
      optionsElement.replaceChildren();
      nextButton.disabled = true;
    }
  }

  startButton.addEventListener('click', async () => {
    instructions.close();
    requestFullscreen();
    await initializeExam();
    if (attemptId) startTimer();
  });

  requestFullscreen();
  instructions.showModal();
});