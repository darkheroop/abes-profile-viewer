/**
 * THE FLYING DUTCHMANN — OFFICIAL FRONTEND CONTROLLER
 * Single-Screen Authentic Image-Accurate Experience
 * Design Source of Truth: ghost-ship-student-archive.png
 * Attribution: MADE BY GHOST FLEET // ABES ENGINEERING COLLEGE
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // --------------------------------------------------------------------------
  // 1. Element References
  // --------------------------------------------------------------------------
  const sceneContainer = document.getElementById('sceneContainer');
  const sceneVisual = document.getElementById('sceneVisual');
  const atmosphereCanvas = document.getElementById('atmosphereCanvas');

  const profileForm = document.getElementById('profileForm');
  const rollNumberInput = document.getElementById('rollNumberInput');
  const inputSlot = document.getElementById('inputSlot');
  const compassNeedle = document.getElementById('compassNeedle');
  const submitBtn = document.getElementById('submitBtn');
  const waxSealTarget = document.getElementById('waxSealTarget');

  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingStatusText = document.getElementById('loadingStatusText');

  const errorOverlay = document.getElementById('errorOverlay');
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');
  const adminTip = document.getElementById('adminTip');
  const closeErrorBtn = document.getElementById('closeErrorBtn');

  const profileModal = document.getElementById('profileModal');
  const profileImage = document.getElementById('profileImage');
  const displayRoll = document.getElementById('displayRoll');
  const openNewTabBtn = document.getElementById('openNewTabBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');

  const securityShield = document.getElementById('securityShield');

  // --------------------------------------------------------------------------
  // 2. Mouse-Controlled 3D Parallax & Depth (Smooth, Subtle, Restrained)
  // --------------------------------------------------------------------------
  let targetTiltX = 0;
  let targetTiltY = 0;
  let currentTiltX = 0;
  let currentTiltY = 0;

  window.addEventListener('mousemove', (e) => {
    // Normalize coordinates from -1 to +1
    const normX = (e.clientX / window.innerWidth - 0.5) * 2;
    const normY = (e.clientY / window.innerHeight - 0.5) * 2;

    // Subtle maximum tilt: 2.2 degrees
    targetTiltX = -normY * 2.2;
    targetTiltY = normX * 2.2;
  });

  function renderParallax() {
    // Smooth lerp interpolation
    currentTiltX += (targetTiltX - currentTiltX) * 0.08;
    currentTiltY += (targetTiltY - currentTiltY) * 0.08;

    if (sceneVisual) {
      sceneVisual.style.transform = `rotateX(${currentTiltX.toFixed(3)}deg) rotateY(${currentTiltY.toFixed(3)}deg)`;
    }

    requestAnimationFrame(renderParallax);
  }
  requestAnimationFrame(renderParallax);

  // --------------------------------------------------------------------------
  // 3. Living Atmospheric Particles & Fog Canvas
  // --------------------------------------------------------------------------
  if (atmosphereCanvas) {
    const ctx = atmosphereCanvas.getContext('2d');
    let width = (atmosphereCanvas.width = window.innerWidth);
    let height = (atmosphereCanvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = atmosphereCanvas.width = window.innerWidth;
      height = atmosphereCanvas.height = window.innerHeight;
    });

    const particles = [];
    const PARTICLE_COUNT = 38;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.8 + 0.6,
        speedY: Math.random() * 0.45 + 0.15,
        swaySpeed: Math.random() * 0.015 + 0.005,
        swayRange: Math.random() * 25 + 10,
        alpha: Math.random() * 0.5 + 0.2,
        isEmerald: Math.random() > 0.4,
        timeOffset: Math.random() * 1000
      });
    }

    let frame = 0;
    function animateAtmosphere() {
      ctx.clearRect(0, 0, width, height);
      frame++;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y -= p.speedY;
        const sway = Math.sin((frame + p.timeOffset) * p.swaySpeed) * 0.5;
        p.x += sway;

        // Reset if offscreen top
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.isEmerald
          ? `rgba(0, 198, 162, ${p.alpha})`
          : `rgba(201, 164, 92, ${p.alpha * 0.85})`;
        ctx.shadowBlur = p.radius * 3.5;
        ctx.shadowColor = p.isEmerald ? '#00C6A2' : '#C9A45C';
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      requestAnimationFrame(animateAtmosphere);
    }
    requestAnimationFrame(animateAtmosphere);
  }

  // --------------------------------------------------------------------------
  // 4. Interactive Search Input Focus, Keystrokes & Compass Detail
  // --------------------------------------------------------------------------
  if (rollNumberInput && inputSlot) {
    // Focus effect
    rollNumberInput.addEventListener('focus', () => {
      inputSlot.classList.add('is-focused');
      if (waxSealTarget) waxSealTarget.classList.add('active-seal-glow');
    });

    // Blur effect
    rollNumberInput.addEventListener('blur', () => {
      inputSlot.classList.remove('is-focused');
      if (waxSealTarget && !rollNumberInput.value.trim()) {
        waxSealTarget.classList.remove('active-seal-glow');
      }
    });

    // Keystroke reactivity: Compass needle rotation & has-value class
    rollNumberInput.addEventListener('input', () => {
      const val = rollNumberInput.value.trim();

      if (val.length > 0) {
        inputSlot.classList.add('has-value');
        if (waxSealTarget) waxSealTarget.classList.add('active-seal-glow');
      } else {
        inputSlot.classList.remove('has-value');
        if (waxSealTarget && !inputSlot.classList.contains('is-focused')) {
          waxSealTarget.classList.remove('active-seal-glow');
        }
      }

      // Rotate mechanical compass needle
      if (compassNeedle) {
        const charCode = val.charCodeAt(val.length - 1) || 0;
        const angle = (val.length * 35 + charCode * 6) % 360;
        compassNeedle.style.transform = `rotate(${angle}deg)`;
      }
    });
  }

  // --------------------------------------------------------------------------
  // 5. Input Validation
  // --------------------------------------------------------------------------
  function sanitizeRoll(input) {
    if (!input || typeof input !== 'string') return '';
    return input.trim().replace(/[^a-zA-Z0-9_\-]/g, '');
  }

  function validateRoll(roll) {
    if (!roll) {
      return { valid: false, message: 'Please enter a valid student admission number.' };
    }
    if (roll.length < 3) {
      return { valid: false, message: 'Admission number is too short (minimum 3 characters).' };
    }
    if (roll.length > 30) {
      return { valid: false, message: 'Admission number is too long (maximum 30 characters).' };
    }
    return { valid: true };
  }

  // --------------------------------------------------------------------------
  // 6. Form Submission & Profile Retrieval
  // --------------------------------------------------------------------------
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Trigger button shockwave & seal glow
      if (submitBtn) {
        submitBtn.classList.remove('btn-pulse');
        void submitBtn.offsetWidth; // Force reflow
        submitBtn.classList.add('btn-pulse');
      }
      if (waxSealTarget) {
        waxSealTarget.classList.add('active-seal-glow');
      }

      const rawVal = rollNumberInput ? rollNumberInput.value : '';
      const cleanRoll = sanitizeRoll(rawVal);
      const validation = validateRoll(cleanRoll);

      if (!validation.valid) {
        showError('Invalid Admission Number', validation.message);
        return;
      }

      // Hide previous errors and show loading state
      hideError();
      showLoading(cleanRoll);

      try {
        // Query official student profile JSON endpoint
        const response = await fetch(`/api/profile/${encodeURIComponent(cleanRoll)}/json`, {
          headers: { 'Accept': 'application/json' }
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          hideLoading();
          const errCode = data && data.code ? data.code : '';
          const errMsg = data && data.error ? data.error : 'Failed to retrieve profile record.';
          showError('Record Unavailable', errMsg, errCode === 'ERP_SESSION_EXPIRED');
          return;
        }

        if (!data || !data.dataUrl) {
          hideLoading();
          showError('No Record Found', `No profile photo found for admission number: ${cleanRoll}`);
          return;
        }

        // Profile successfully retrieved
        hideLoading();
        showProfileResult(cleanRoll, data.dataUrl);

      } catch (err) {
        hideLoading();
        showError('Network Error', 'Unable to connect to the profile service. Please verify your connection.');
      }
    });
  }

  // --------------------------------------------------------------------------
  // 7. Loading, Error & Modal UI State Handlers
  // --------------------------------------------------------------------------
  function showLoading(roll) {
    if (!loadingOverlay) return;
    if (loadingStatusText) {
      loadingStatusText.textContent = `Consulting maritime records for ${roll}...`;
    }
    loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    if (!loadingOverlay) return;
    loadingOverlay.classList.add('hidden');
  }

  function showError(title, msg, isSessionExpired = false) {
    if (!errorOverlay) return;
    if (errorTitle) errorTitle.textContent = title;
    if (errorMessage) errorMessage.textContent = msg;

    if (adminTip) {
      if (isSessionExpired) {
        adminTip.classList.remove('hidden');
      } else {
        adminTip.classList.add('hidden');
      }
    }

    errorOverlay.classList.remove('hidden');
  }

  function hideError() {
    if (!errorOverlay) return;
    errorOverlay.classList.add('hidden');
  }

  if (closeErrorBtn) {
    closeErrorBtn.addEventListener('click', hideError);
  }

  function showProfileResult(roll, dataUrl) {
    if (!profileModal) return;

    if (displayRoll) displayRoll.textContent = roll;
    if (profileImage) {
      profileImage.src = dataUrl;
      profileImage.alt = `Official Profile Photo — ${roll}`;
    }

    if (downloadBtn) {
      downloadBtn.href = dataUrl;
      downloadBtn.download = `ABES_Student_Profile_${roll}.jpg`;
    }

    if (openNewTabBtn) {
      openNewTabBtn.href = dataUrl;
    }

    profileModal.classList.remove('hidden');
  }

  function hideProfileModal() {
    if (!profileModal) return;
    profileModal.classList.add('hidden');
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', hideProfileModal);
  }

  // Close modal when clicking outside parchment card
  if (profileModal) {
    profileModal.addEventListener('click', (e) => {
      if (e.target === profileModal) {
        hideProfileModal();
      }
    });
  }

  // Escape key handler
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (profileModal && !profileModal.classList.contains('hidden')) {
        hideProfileModal();
      } else if (errorOverlay && !errorOverlay.classList.contains('hidden')) {
        hideError();
      }
    }
  });

  // --------------------------------------------------------------------------
  // 8. Anti-Inspection & DevTools Security Shield (Exact Text Intact)
  // --------------------------------------------------------------------------
  function triggerSecurityShield() {
    if (securityShield) {
      securityShield.style.display = 'flex';
      // Disable interaction with background
      document.body.style.pointerEvents = 'none';
      securityShield.style.pointerEvents = 'auto';
    }
  }

  // Disable right-click context menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Intercept inspection keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // F12
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      triggerSecurityShield();
      return;
    }
    // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools)
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
      e.preventDefault();
      triggerSecurityShield();
      return;
    }
    // Ctrl+U (View Source)
    if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
      e.preventDefault();
      triggerSecurityShield();
      return;
    }
  });

  // Console threshold inspection detection
  let devToolsOpen = false;
  const threshold = 160;
  setInterval(() => {
    // Only test outer/inner dimension difference on desktop screens
    if (window.innerWidth >= 768 && window.outerWidth >= 768) {
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;
      if ((widthDiff || heightDiff) && !devToolsOpen) {
        devToolsOpen = true;
        triggerSecurityShield();
      }
    }
  }, 1000);
});
