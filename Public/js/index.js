/* =========================================
   INDEX.JS — Landing page handler
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Index JS Initialized.');

  const openDrawerBtn = document.getElementById('openDrawerBtn');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  const navDrawerOverlay = document.getElementById('navDrawerOverlay');
  const drawerCloseLinks = document.querySelectorAll('.drawer-close-link');

  if (openDrawerBtn && navDrawerOverlay) {
    openDrawerBtn.addEventListener('click', () => {
      navDrawerOverlay.classList.remove('hidden');
    });
  }

  if (closeDrawerBtn && navDrawerOverlay) {
    closeDrawerBtn.addEventListener('click', () => {
      navDrawerOverlay.classList.add('hidden');
    });
  }

  drawerCloseLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (navDrawerOverlay) navDrawerOverlay.classList.add('hidden');
    });
  });

  const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
  dropdownToggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const submenu = toggle.nextElementSibling;
      toggle.classList.toggle('active');
      if (submenu) submenu.classList.toggle('hidden');
    });
  });
});
/* =========================================
   DISABLED LINKS — Event Blocker
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Landing page disabled-link blocker initialized.');

  // =========================================
  // 1. BLOCK ALL CLICKS ON DISABLED LINKS
  // =========================================
  document.querySelectorAll('.disabled-link').forEach((link) => {
    // Block click
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    });

    // Block mousedown (para hindi mag-focus)
    link.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    // Block touch (mobile)
    link.addEventListener('touchstart', (e) => {
      e.preventDefault();
    }, { passive: false });
  });

  // =========================================
  // 2. ALLOW ONLY LOGIN TO OEEMS LINKS
  // =========================================
  document.querySelectorAll('.login-oeems-link').forEach((link) => {
    // Remove any disabled attributes (just in case)
    link.classList.remove('disabled-link');
    link.removeAttribute('aria-disabled');

    // Make sure it navigates
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      const href = link.getAttribute('href');
      if (href && href !== '#') {
        window.location.href = href;
      }
    });
  });

  // =========================================
  // 3. DISABLED DRAWER BUTTONS
  // =========================================
  document.querySelectorAll('.dropdown-toggle.disabled-btn, button.dropdown-toggle[disabled]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    });
  });
});
/* =========================================
   DISABLED LINKS — Event Blocker (backup)
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  // Block clicks sa lahat ng disabled links
  document.querySelectorAll('.disabled-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    });

    link.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    link.addEventListener('touchstart', (e) => {
      e.preventDefault();
    }, { passive: false });
  });

  // Block disabled drawer buttons
  document.querySelectorAll('.dropdown-toggle.disabled-btn, button.dropdown-toggle[disabled]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    });
  });
});