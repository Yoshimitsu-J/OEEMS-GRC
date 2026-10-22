/* =========================================
   DASHBOARD — Dynamic data + Dropdown + Sidebar
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard JS Initialized.');

  let logoutPending = false;
  let studentIdleTimer;
  const STUDENT_IDLE_LIMIT = 10 * 60 * 1000;
  const clearClientState = () => {
    sessionStorage.clear();
  };

  const resetStudentIdleTimer = () => {
    window.clearTimeout(studentIdleTimer);
    studentIdleTimer = window.setTimeout(async () => {
      if (logoutPending) return;
      clearClientState();
      try {
        await fetch('/api/auth/logout', { method: 'POST', headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });
      } catch {}
      window.location.replace('/public/index.html?openLogin=true&reason=inactivity');
    }, STUDENT_IDLE_LIMIT);
  };
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach((eventName) => {
    document.addEventListener(eventName, resetStudentIdleTimer, { passive: true });
  });
  resetStudentIdleTimer();

  document.querySelectorAll('a[href="/api/auth/logout"]').forEach((logoutLink) => {
    logoutLink.addEventListener('click', async (event) => {
      event.preventDefault();
      if (logoutPending) return;
      logoutPending = true;
      logoutLink.setAttribute('aria-disabled', 'true');

      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store'
        });
        if (!response.ok) throw new Error('Server logout failed.');
      } catch (error) {
        console.error('Logout request failed; following server logout link.', error);
        clearClientState();
        window.location.replace('/api/auth/logout');
        return;
      }

      clearClientState();
      window.location.replace('/public/index.html');
    });
  });

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => {
        if (!response.ok) {
          clearClientState();
          window.location.replace('/public/index.html?openLogin=true');
        }
      })
      .catch(() => {
        clearClientState();
        window.location.replace('/public/index.html?openLogin=true');
      });
  });

  // TIME-BASED GREETING
  const greetingEl = document.getElementById('bannerGreeting');
  if (greetingEl) {
    const hour = new Date().getHours();
    let greeting;
    if (hour >= 5 && hour < 12)       greeting = 'Good morning';
    else if (hour >= 12 && hour < 18) greeting = 'Good afternoon';
    else if (hour >= 18 && hour < 22) greeting = 'Good evening';
    else                              greeting = 'Hello';
    greetingEl.textContent = `${greeting},`;
  }

  // PROFILE DROPDOWN
  const profileToggle   = document.getElementById('profileToggle');
  const profileDropdown = document.getElementById('profileDropdown');

  if (profileToggle && profileDropdown) {
    profileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!profileDropdown.contains(e.target) && !profileToggle.contains(e.target)) {
        profileDropdown.classList.add('hidden');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') profileDropdown.classList.add('hidden');
    });
  }

  const formatSchedule = (schedule) => {
    if (!schedule) return "Unavailable, please proceed to Step 2: 'Schedule Exam' first";
    const date = new Date(schedule.examDate).toLocaleDateString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila'
    });
    return `${date} | ${schedule.batch.replace(/^batch_/, 'Batch ')} | ${schedule.startTime} - ${schedule.endTime} | ${schedule.facilityId || 'Facility pending'}`;
  };

  const updateDashboard = async () => {
    if (!document.getElementById('welcomeName')) return;
    const [profileResponse, statusResponse] = await Promise.all([
      fetch('/api/student/profile', { credentials: 'same-origin', cache: 'no-store' }),
      fetch('/api/student/application-status', { credentials: 'same-origin', cache: 'no-store' })
    ]);
    if (!profileResponse.ok || !statusResponse.ok) {
      if (profileResponse.status === 401 || statusResponse.status === 401) {
        window.location.replace('/public/index.html?openLogin=true');
        return;
      }
      throw new Error('Could not load student dashboard data.');
    }

    const { profile, email } = await profileResponse.json();
    const status = await statusResponse.json();
    const fullName = `${profile.givenName} ${profile.middleName ? `${profile.middleName} ` : ''}${profile.lastName}`.trim();
    document.getElementById('welcomeName').textContent = fullName;
    document.getElementById('bannerApplicantId').textContent = profile.applicantId;
    document.getElementById('dropdownName').textContent = fullName;
    document.getElementById('dropdownEmail').textContent = email;
    document.getElementById('applicationStatus').textContent = status.applicationStatus;
    document.getElementById('applicationStep').textContent = status.isSubmitted
      ? 'Application submitted'
      : `Step ${status.nextStep?.number || 1} of 4`;
    document.getElementById('documentsProgress').textContent = `${status.documentCount} of ${status.documentTotal} Uploaded`;

    document.getElementById('progressPercent').textContent = `${status.progressPercent}% Complete`;
    document.getElementById('progressBar').style.width = `${status.progressPercent}%`;

    const hasSchedule = Boolean(status.schedule);
    const documentsComplete = status.documentCount === status.documentTotal;
    const stepElements = document.querySelectorAll('.stepper .step');
    const completeSteps = [true, hasSchedule, documentsComplete, status.isSubmitted];
    const activeStep = status.isSubmitted ? -1 : Math.max(0, (status.nextStep?.number || 1) - 1);
    stepElements.forEach((step, index) => {
      step.classList.toggle('completed', completeSteps[index]);
      step.classList.toggle('active', index === activeStep && !completeSteps[index]);
      const circle = step.querySelector('.step-circle');
      if (circle) circle.innerHTML = completeSteps[index] ? '<i class="bi bi-check-lg"></i>' : String(index + 1);
    });

    const scheduleText = document.getElementById('examScheduleText');
    const scheduleDisplay = formatSchedule(status.schedule);
    if (scheduleText) scheduleText.textContent = scheduleDisplay;
    const countdown = document.getElementById('examCountdown');
    if (countdown) {
      if (!status.schedule) countdown.textContent = 'No schedule';
      else {
        const daysLeft = Math.ceil((new Date(status.schedule.examDate) - new Date()) / 86400000);
        countdown.textContent = daysLeft < 0 ? 'Exam date passed' : daysLeft === 0 ? 'Today' : `${daysLeft} days left`;
      }
    }

    const description = document.getElementById('nextStepDescription');
    const action = document.getElementById('nextStepAction');
    if (status.workflowStatus === 'approved') {
      description.textContent = 'Your application is approved. Proceed to your scheduled entrance examination.';
      action.href = 'takeExam.html';
      action.textContent = 'Proceed Now';
      action.hidden = false;
    } else if (status.workflowStatus === 'result_released') {
      description.textContent = 'Your examination result is available.';
      action.href = 'examResult.html';
      action.textContent = 'View Result';
      action.hidden = false;
    } else if (status.isSubmitted) {
      description.textContent = status.applicationStatus === 'Completed'
        ? 'Your application has been reviewed. Check your exam or result status for the next update.'
        : 'Your application has been submitted and is pending review by the Admissions Department.';
      action.hidden = true;
    } else if (status.nextStep) {
      description.textContent = status.nextStep.title === 'Schedule Exam'
        ? 'Your exam appointment is not yet scheduled.'
        : status.nextStep.title === 'Upload Documents'
          ? `Upload the remaining ${status.documentTotal - status.documentCount} required document(s).`
          : 'Your required documents are ready. Review and submit your application.';
      action.href = status.nextStep.href;
      action.hidden = false;
    }

    const submitted = ['under_review', 'approved', 'exam_completed', 'result_released'].includes(status.workflowStatus);
    const declined = status.workflowStatus === 'declined' || status.applicationStatus === 'Declined';
    document.querySelectorAll('.sidebar nav ul li a').forEach((link) => {
      const target = link.getAttribute('href');
      if (declined) {
        link.closest('li').hidden = !['index.html', 'studentInformation.html', 'scheduleExam.html'].includes(target);
      } else if (submitted) {
        link.closest('li').hidden = !['index.html', 'studentInformation.html', 'examResult.html'].includes(target);
      }
    });
  };

  updateDashboard().catch((error) => console.error(error.message));
  if (typeof window.io === 'function') {
    const socket = window.io();
    ['student:profile-updated', 'student:application-updated', 'student:application-submitted', 'admission:schedule-updated'].forEach((eventName) => {
      socket.on(eventName, (detail) => {
        updateDashboard().catch((error) => console.error(error.message));
        window.dispatchEvent(new CustomEvent('oeems:student-update', { detail }));
      });
    });
  }

  // AUTO-ACTIVE SIDEBAR
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar nav ul li a').forEach((link) => {
    if (link.getAttribute('href') === currentPage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
});