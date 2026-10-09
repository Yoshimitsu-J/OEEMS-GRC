/* =========================================
   APPLICANT GUARD — Step-Locking System
   Prevents access to pages without completing prerequisites
   ========================================= */

(function () {
  'use strict';

  let currentStatus = null;

  async function loadStatus() {
    const response = await fetch('/api/student/application-status', {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    if (!response.ok) return null;
    currentStatus = await response.json();
    return currentStatus;
  }

  function showPreviousStepMessage() {
    if (new URLSearchParams(window.location.search).get('access') !== 'previous-step') return;
    window.alert('Please complete the previous step first.');
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  function syncSidebar(status) {
    const pendingReview = status.workflowStatus === 'under_review';
    const unlocked = {
      'scheduleExam.html': !status.isSubmitted,
      'uploadDocuments.html': Boolean(status.schedule) && !status.isSubmitted,
      'applicationSummary.html': status.documentCount === status.documentTotal && !status.isSubmitted,
      'myApplication.html': !pendingReview,
      'takeExam.html': status.workflowStatus === 'approved',
      'examResult.html': status.workflowStatus === 'result_released'
    };

    document.querySelectorAll('.sidebar nav ul li a').forEach((link) => {
      const href = link.getAttribute('href');
      if (!Object.hasOwn(unlocked, href)) return;
      const allowed = unlocked[href];
      link.closest('li').hidden = pendingReview && !['index.html', 'studentInformation.html'].includes(href);
      link.setAttribute('aria-disabled', String(!allowed));
      if (!allowed) {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          window.alert('Please complete the previous step first.');
        }, { once: true });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    showPreviousStepMessage();
    try {
      const status = await loadStatus();
      if (status) syncSidebar(status);
    } catch (error) {
      console.error('Could not check application progress:', error.message);
    }
  });

  window.ApplicantGuard = {
    loadStatus,
    getProgress: () => currentStatus
  };
})();