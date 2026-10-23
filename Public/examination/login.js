document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('applicationCode');
  const submit = document.getElementById('submitApplicationCode');
  const error = document.getElementById('loginError');
  const dialog = document.getElementById('verificationDialog');
  const completedDialog = document.getElementById('completedExamDialog');
  let applicant = null;


  submit.addEventListener('click', async () => {
    const applicationCode = input.value.trim().toUpperCase();
    if (!applicationCode) {
      error.textContent = 'Enter your Application Code.';
      return;
    }
    submit.disabled = true;
    error.textContent = '';
    try {
      const response = await fetch('/api/examination/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationCode })
      });
      const result = await response.json();
      if (result.alreadySubmitted) {
        document.getElementById('completedExamApplicationId').textContent = `Application ID: ${result.applicationId || applicationCode}`;
        completedDialog.showModal();
        return;
      }
      if (!response.ok) throw new Error(result.error || 'Verification failed.');
      applicant = result.applicant;
      document.getElementById('verificationApplicantId').textContent = applicant.applicationCode;
      document.getElementById('verificationName').textContent = applicant.name;
      document.getElementById('verificationEmail').textContent = applicant.email || '—';
      dialog.showModal();
    } catch (requestError) {
      error.textContent = requestError.message;
    } finally {
      submit.disabled = false;
    }
  });

  document.getElementById('notMeButton').addEventListener('click', () => {
    dialog.close();
    applicant = null;
    input.value = '';
    input.focus();
  });

  document.getElementById('completedExamOkButton').addEventListener('click', () => {
    completedDialog.close();
    input.value = '';
    input.focus();
  });

  document.getElementById('itsMeButton').addEventListener('click', async () => {
    if (!applicant) return;
    sessionStorage.setItem('examinationApplicationCode', applicant.applicationCode);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      try { await document.documentElement.requestFullscreen(); } catch {}
    }
    window.location.assign('/public/examination/exam.html?applicationCode=' + encodeURIComponent(applicant.applicationCode));
  });
});
