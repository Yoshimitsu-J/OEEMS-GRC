(function () {
  'use strict';

  const stepPaths = new Map([
    ['scheduleexam.html', 2],
    ['uploaddocuments.html', 3],
    ['applicationsummary.html', 4],
    ['takeexam.html', 5],
    ['statementofapplication.html', 5],
    ['examresult.html', 6],
    ['schedule.html', 2],
    ['documents.html', 3],
    ['summary.html', 4]
  ]);
  let status = null;
  let activeStepUrl = '/student/';
  let modal;

  function createModal() {
    if (modal) return modal;
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/public/student/css/style.css';
    document.head.append(stylesheet);

    modal = document.createElement('div');
    modal.className = 'step-guard-backdrop';
    modal.hidden = true;
    modal.innerHTML = `
      <section class="step-guard-modal" role="dialog" aria-modal="true" aria-labelledby="stepGuardTitle" aria-describedby="stepGuardMessage" tabindex="-1">
        <span class="step-guard-accent" aria-hidden="true"></span>
        <h2 id="stepGuardTitle">Step Incomplete</h2>
        <p id="stepGuardMessage">Please complete the previous step before proceeding.</p>
        <div class="step-guard-actions">
          <button class="step-guard-close" type="button">Close</button>
          <button class="step-guard-proceed" type="button">Go to Current Step</button>
        </div>
      </section>`;
    document.body.append(modal);

    const dialog = modal.querySelector('.step-guard-modal');
    const close = modal.querySelector('.step-guard-close');
    const proceed = modal.querySelector('.step-guard-proceed');
    close.addEventListener('click', closeModal);
    proceed.addEventListener('click', () => window.location.assign(activeStepUrl));
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) closeModal();
    });
    modal.dialog = dialog;
    return modal;
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('step-guard-open');
  }

  function openModal({ title = 'Step Incomplete', message = 'Please complete the previous step before proceeding.', showProceed = true } = {}) {
    const element = createModal();
    element.querySelector('#stepGuardTitle').textContent = title;
    element.querySelector('#stepGuardMessage').textContent = message;
    element.querySelector('.step-guard-proceed').hidden = !showProceed;
    element.hidden = false;
    document.body.classList.add('step-guard-open');
    element.dialog.focus();
  }

  function stepForAnchor(anchor) {
    try {
      const target = new URL(anchor.href, window.location.href);
      return stepPaths.get(target.pathname.split('/').pop().toLowerCase()) || null;
    } catch {
      return null;
    }
  }

  function isPending() {
    return ['under_review', 'approved', 'exam_completed', 'result_released'].includes(status?.workflowStatus);
  }

  function isDeclined() {
    return status?.workflowStatus === 'declined' || status?.applicationStatus === 'Declined';
  }

  function isStepAllowed(step) {
    if (!status) return false;
    if (isDeclined()) return step === 2;
    if (status.workflowStatus === 'under_review') return step === 6;
    if (status.workflowStatus === 'approved') return step === 5 || step === 6;
    if (status.workflowStatus === 'exam_completed') return step === 6;
    if (status.workflowStatus === 'result_released') return step === 6;
    if (step > 4) return false;
    const completedThrough = status.nextStep?.number || 2;
    return step <= completedThrough;
  }

  function applyNavigationLock() {
    document.querySelectorAll('a[href]').forEach((anchor) => {
      const step = stepForAnchor(anchor);
      if (!step) return;
      const locked = !isStepAllowed(step);
      anchor.classList.toggle('step-locked', locked);
      anchor.setAttribute('aria-disabled', String(locked));
      if (locked) anchor.setAttribute('data-step-locked', 'true');
      else anchor.removeAttribute('data-step-locked');
    });
  }

  function profileValue(profile, key, email) {
    const address = profile.address || {};
    const guardian = profile.guardian || {};
    const values = {
      fullname: [profile.givenName, profile.middleName, profile.lastName].filter(Boolean).join(' '),
      applicantname: `${profile.lastName}, ${profile.givenName}${profile.middleName ? ` ${profile.middleName}` : ''}`,
      applicantid: profile.applicantId,
      email,
      sex: profile.sex,
      birthday: profile.birthday ? new Date(profile.birthday).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' }) : '',
      phone: profile.phone,
      country: address.country,
      region: address.region,
      city: address.city,
      barangay: address.barangay,
      street: address.streetAddress || address.street,
      address: [address.streetAddress || address.street, address.barangay, address.city, address.region, address.country].filter(Boolean).join(', '),
      guardianname: guardian.name,
      guardianphone: guardian.phone,
      accountcreated: profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' }) : ''
    };
    return values[key.toLowerCase()] || '';
  }

  async function loadProfile() {
    const response = await fetch('/api/student/profile', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Profile data could not be loaded.');
    const result = await response.json();
    document.querySelectorAll('[data-profile]').forEach((element) => {
      const value = profileValue(result.profile, element.dataset.profile, result.email);
      element.textContent = value || 'Not provided';
      element.classList.remove('profile-loading');
      element.removeAttribute('aria-busy');
    });
    window.dispatchEvent(new CustomEvent('oeems:profile-loaded', { detail: result }));
  }

  async function loadStatus() {
    const response = await fetch('/api/student/application-status', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Application progress could not be loaded.');
    status = await response.json();
    const schedule = status.schedule || {};
    const applicationValues = {
      status: status.applicationStatus,
      cycle: status.cycle,
      applicantid: status.applicantId,
      applicationdate: status.applicationCreatedAt,
      submitteddate: status.submittedAt,
      approveddate: status.approval?.reviewedAt,
      bookingdate: schedule.bookedAt,
      examdate: schedule.examDate,
      examtime: schedule.startTime && schedule.endTime ? `${schedule.startTime} - ${schedule.endTime}` : '',
      facility: schedule.facilityId,
      batch: schedule.batch ? schedule.batch.replace(/^batch_/, 'Batch ') : ''
    };
    document.querySelectorAll('[data-application]').forEach((element) => {
    const nextPath = status.workflowStatus === 'approved'
      ? 'takeExam.html'
      : status.workflowStatus === 'result_released'
        ? 'examResult.html'
        : status.nextStep?.href;
      const value = applicationValues[key];
      element.textContent = value
        ? key.endsWith('date') ? new Date(value).toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' }) : value
        : '—';
      element.classList.remove('profile-loading');
      element.removeAttribute('aria-busy');
    });
    const nextPath = status.nextStep?.href;
    activeStepUrl = isPending() || !nextPath ? '/student/' : `/student/${nextPath}`;
    applyNavigationLock();
  }

  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href]');
    if (!anchor) return;
    const target = new URL(anchor.href, window.location.href);
    if (target.pathname.split('/').pop().toLowerCase() === 'examresult.html') {
      event.preventDefault();
      openModal({
        title: 'Exam Result',
        message: "Exam Result - You will receive an 'Entrance Examination Result' via email once the admission reviews your exam result",
        showProceed: false
      });
      return;
    }
    const step = stepForAnchor(anchor);
    if (step && !isStepAllowed(step)) {
      event.preventDefault();
      if (status) openModal();
      else loadStatus().then(openModal).catch(openModal);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await Promise.all([loadProfile(), loadStatus()]);
      if (new URLSearchParams(window.location.search).get('access') === 'previous-step') {
        openModal();
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      if (window.location.pathname.split('/').pop().toLowerCase() === 'examresult.html' && isPending()) {
        openModal({
          title: 'Exam Result',
          message: "Exam Result - You will receive an 'Entrance Examination Result' via email once the admission reviews your exam result",
          showProceed: false
        });
      }
    } catch (error) {
      document.querySelectorAll('.profile-loading').forEach((element) => {
        element.textContent = 'Profile unavailable';
        element.classList.remove('profile-loading');
        element.removeAttribute('aria-busy');
      });
      if (error.message.includes('Application progress')) console.error(error.message);
    }
  });

  window.addEventListener('oeems:student-update', () => {
    Promise.all([loadProfile(), loadStatus()]).catch((error) => console.error(error.message));
  });

  window.StepGuard = {
    open: openModal,
    showMessage(message, title = 'Notice') {
      openModal({ title, message, showProceed: false });
    },
    getStatus: () => status
  };
})();