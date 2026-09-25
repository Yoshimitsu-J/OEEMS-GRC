/* =========================================
   APPLICANT GUARD — Step-Locking System
   Prevents access to pages without completing prerequisites
   ========================================= */

(function () {
  'use strict';

  console.log('Applicant Guard Initialized.');

  // =========================================
  // PROGRESS STATE — basa sa localStorage
  // =========================================
  function getProgress() {
    const applicantData = JSON.parse(localStorage.getItem('applicantData') || '{}');
    const examSchedule  = JSON.parse(localStorage.getItem('examSchedule')  || 'null');
    const uploadedDocs  = JSON.parse(localStorage.getItem('uploadedDocuments') || 'null');
    const approved      = localStorage.getItem('applicationApproved') === 'true';
    const examDone      = localStorage.getItem('examCompleted') === 'true';

    return {
      hasAccount:      !!applicantData.givenName,
      hasSchedule:     !!examSchedule,
      hasDocuments:    !!uploadedDocs && uploadedDocs.count >= 3,
      isApproved:      approved,
      isExamCompleted: examDone
    };
  }

  // =========================================
  // PAGE REQUIREMENTS
  // =========================================
  const PAGE_RULES = {
    'scheduleExam.html': {
      check: (p) => p.hasAccount,
      redirect: 'setUpAccount.html',
      message: 'Kailangan mo munang i-setup ang iyong account.'
    },
    'uploadDocuments.html': {
      check: (p) => p.hasSchedule,
      redirect: 'scheduleExam.html',
      message: 'Kailangan mo munang pumili ng schedule ng exam.'
    },
    'applicationSummary.html': {
      check: (p) => p.hasDocuments,
      redirect: 'uploadDocuments.html',
      message: 'Kailangan mo munang i-upload ang lahat ng required documents.'
    },
    'takeExam.html': {
      check: (p) => p.isApproved,
      redirect: 'applicationSummary.html',
      message: 'Hindi ka pa na-a-approve ng Admission. Maghintay muna.'
    },
    'examResult.html': {
      check: (p) => p.isExamCompleted,
      redirect: 'takeExam.html',
      message: 'Kailangan mo munang tapusin ang exam.'
    }
  };

  // =========================================
  // CHECK CURRENT PAGE
  // =========================================
  function guardCurrentPage() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const rule = PAGE_RULES[currentPage];

    if (!rule) return;   // walang requirement — okay lang

    const progress = getProgress();

    if (!rule.check(progress)) {
      console.warn(`🔒 Blocked: ${currentPage} — ${rule.message}`);

      // Ipakita ang alert (pwedeng palitan ng toast)
      alert(`🔒 Access Denied\n\n${rule.message}\n\nRedirecting...`);

      // Redirect
      setTimeout(() => {
        window.location.href = rule.redirect;
      }, 300);
    }
  }

  // =========================================
  // MARK SIDEBAR ITEMS AS LOCKED
  // =========================================
  function markSidebarLocks() {
    const progress = getProgress();

    const sidebarRules = {
      'uploadDocuments.html':   progress.hasSchedule,
      'applicationSummary.html': progress.hasDocuments,
      'takeExam.html':           progress.isApproved,
      'examResult.html':         progress.isExamCompleted
    };

    document.querySelectorAll('.sidebar nav ul li a').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;

      const isLocked = sidebarRules.hasOwnProperty(href) && !sidebarRules[href];

      if (isLocked) {
        link.classList.add('locked');
        link.setAttribute('data-locked', 'true');

        // Prevent navigation
        link.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          const messages = {
            'uploadDocuments.html':    'Pumili muna ng schedule ng exam.',
            'applicationSummary.html': 'I-upload muna ang lahat ng documents.',
            'takeExam.html':           'Kailangan mo munang ma-approve ng Admission.',
            'examResult.html':         'Tapusin muna ang exam.'
          };

          alert(`🔒 Locked\n\n${messages[href] || 'Hindi pa available ang page na ito.'}`);
        });
      }
    });
  }

  // =========================================
  // INIT — pagkatapos ng DOM load
  // =========================================
  document.addEventListener('DOMContentLoaded', () => {
    guardCurrentPage();
    markSidebarLocks();
  });

  // =========================================
  // EXPOSE HELPERS (para magamit ng ibang JS)
  // =========================================
  window.ApplicantGuard = {
    getProgress,
    markStepComplete(step) {
      const validSteps = [
        'hasSchedule',
        'hasDocuments',
        'isApproved',
        'isExamCompleted'
      ];
      if (!validSteps.includes(step)) {
        console.warn('Invalid step:', step);
        return;
      }
      // Handled through localStorage keys sa ibang pages
      console.log(`Step marked complete: ${step}`);
    }
  };
})();