document.addEventListener('DOMContentLoaded', () => {
  const downloadButton = document.getElementById('downloadSummaryBtn');
  const submitButton = document.getElementById('submitApplicationBtn');
  const pdfFrame = document.getElementById('summaryPdfFrame');
  const submittedDialog = document.getElementById('applicationSubmittedDialog');
  const emailNote = document.getElementById('submissionEmailNote');
  const setText = (id, value) => { document.getElementById(id).textContent = value || '—'; };
  const formatDate = (value) => value
    ? new Date(value).toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })
    : '—';

  async function loadSummary() {
    const [profileResponse, statusResponse] = await Promise.all([
      fetch('/api/student/profile', { credentials: 'same-origin', cache: 'no-store' }),
      fetch('/api/student/application-status', { credentials: 'same-origin', cache: 'no-store' })
    ]);
    if (!profileResponse.ok || !statusResponse.ok) throw new Error('Could not load your application summary.');
    const profileResult = await profileResponse.json();
    const status = await statusResponse.json();
    const profile = profileResult.profile;
    setText('summaryApplicantId', profile.applicantId);
    setText('summaryLastName', profile.lastName);
    setText('summaryGivenName', profile.givenName);
    setText('summaryMiddleName', profile.middleName || 'N/A');
    setText('summarySuffix', profile.suffix || 'N/A');
    setText('summaryCountry', profile.address?.country);
    setText('summaryRegion', profile.address?.region);
    setText('summaryCityBarangay', [profile.address?.city, profile.address?.barangay].filter(Boolean).join(', '));
    setText('summaryHomeAddress', profile.address?.streetAddress || profile.address?.street);
    setText('summaryMobile', profile.phone);
    setText('summaryEmail', profileResult.email);
    setText('summaryExamDate', formatDate(status.schedule?.examDate));
    setText('summaryBatchTime', status.schedule
      ? `${String(status.schedule.batch || '').replace(/^batch_/, 'Batch ')} (${status.schedule.startTime} - ${status.schedule.endTime})`
      : '—');
    document.title = `Application Summary - ${profile.applicantId}`;
    if (pdfFrame) {
      pdfFrame.src = `/api/student/application/summary.pdf?inline=1&v=${Date.now()}`;
    }
    const submitted = status.workflowStatus === 'under_review' || status.applicationStatus === 'Pending';
    if (submitted) {
      submitButton.hidden = true;
      emailNote.textContent = 'Your application is pending Admission Office verification.';
    }
  }

  downloadButton?.addEventListener('click', () => {
    window.location.assign('/api/student/application/summary.pdf?download=1');
  });

  submitButton?.addEventListener('click', async () => {
    submitButton.disabled = true;
    try {
      const response = await fetch('/api/student/application/submit', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not submit the application.');
      submitButton.hidden = true;
      emailNote.textContent = result.emailSent
        ? 'A confirmation email has been sent to your registered email address.'
        : 'Your application was received, but the confirmation email could not be sent. Please contact the Admission Office.';
      submittedDialog.showModal();
    } catch (error) {
      window.StepGuard?.showMessage(error.message);
      submitButton.disabled = false;
    }
  });

  document.getElementById('closeApplicationSubmitted').addEventListener('click', () => {
    submittedDialog.close();
    window.location.assign('/student/');
  });

  loadSummary().catch((error) => {
    console.error(error.message);
    window.StepGuard?.showMessage(error.message);
  });
  window.addEventListener('oeems:student-update', () => {
    loadSummary().catch((error) => console.error(error.message));
  });
});