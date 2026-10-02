/* =========================================
   DASHBOARD — Dynamic data + Dropdown + Sidebar
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard JS Initialized.');

  let logoutPending = false;
  const clearClientState = () => {
    localStorage.clear();
    sessionStorage.clear();
  };

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

  const EXAM_DATE_ISO = '2026-04-15T07:30:00';
  const DEFAULT_APPLICANT_ID = '012345';

  const applicantData = JSON.parse(localStorage.getItem('applicantData') || '{}');
  const accountInfo   = JSON.parse(localStorage.getItem('accountInfo')   || '{}');

  const firstName  = applicantData.givenName  || accountInfo.givenName  || 'Juan';
  const middleName = applicantData.middleName || accountInfo.middleName || '';
  const lastName   = applicantData.lastName   || accountInfo.lastName   || 'Dela Cruz';
  const applicantId = applicantData.applicantId || DEFAULT_APPLICANT_ID;
  const email       = applicantData.email       || 'juandelacruz@gmail.com';
  const fullName    = `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.trim();

  // DYNAMIC NAME / ID
  const welcomeNameEl = document.getElementById('welcomeName');
  if (welcomeNameEl) welcomeNameEl.textContent = fullName;

  const applicantIdEl = document.getElementById('bannerApplicantId');
  if (applicantIdEl) applicantIdEl.textContent = `#${applicantId}`;

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

  // LIVE COUNTDOWN
  const countdownEl    = document.getElementById('examCountdown');
  const scheduleTextEl = document.getElementById('examScheduleText');

  if (countdownEl) {
    const examDate = new Date(EXAM_DATE_ISO);
    const now = new Date();
    const daysLeft = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));

    if (isNaN(examDate.getTime())) {
      countdownEl.textContent = 'No schedule';
    } else if (daysLeft < 0) {
      countdownEl.textContent = 'Exam done';
      countdownEl.style.color = '#2e7d32';
    } else if (daysLeft === 0) {
      countdownEl.textContent = 'Today!';
      countdownEl.style.color = '#d32f2f';
      countdownEl.style.fontWeight = '800';
    } else if (daysLeft === 1) {
      countdownEl.textContent = 'Tomorrow';
      countdownEl.style.color = '#d32f2f';
      countdownEl.style.fontWeight = '800';
    } else if (daysLeft <= 7) {
      countdownEl.textContent = `${daysLeft} days left`;
      countdownEl.style.color = '#ef6c00';
      countdownEl.style.fontWeight = '700';
    } else {
      countdownEl.textContent = `${daysLeft} days left`;
    }
  }

  if (scheduleTextEl) {
    const examDate = new Date(EXAM_DATE_ISO);
    if (!isNaN(examDate.getTime())) {
      scheduleTextEl.textContent = examDate.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    }
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

  const dropdownNameEl  = document.getElementById('dropdownName');
  const dropdownEmailEl = document.getElementById('dropdownEmail');
  if (dropdownNameEl)  dropdownNameEl.textContent  = fullName;
  if (dropdownEmailEl) dropdownEmailEl.textContent = email;

  fetch('/api/auth/me')
    .then((response) => {
      if (!response.ok) throw new Error('Could not load the signed-in student profile.');
      return response.json();
    })
    .then(({ user, profile }) => {
      const serverFullName = `${profile.givenName} ${profile.middleName ? `${profile.middleName} ` : ''}${profile.lastName}`.trim();
      const serverWelcomeName = document.getElementById('welcomeName');
      const serverApplicantId = document.getElementById('bannerApplicantId');
      const serverDropdownName = document.getElementById('dropdownName');
      const serverDropdownEmail = document.getElementById('dropdownEmail');
      if (serverWelcomeName) serverWelcomeName.textContent = serverFullName;
      if (serverApplicantId) serverApplicantId.textContent = profile.applicantId;
      if (serverDropdownName) serverDropdownName.textContent = serverFullName;
      if (serverDropdownEmail) serverDropdownEmail.textContent = user.email;
    })
    .catch((error) => console.error(error.message));

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