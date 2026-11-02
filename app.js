/**
 * THE FLYING DUTCHMANN — Frontend Application & GSAP Orchestrator
 * Made by GHOST FLEET
 * 
 * Features:
 * - 3D Ghost Ship WebGL initialization (FlyingDutchmanEngine)
 * - GSAP 3.12 timeline choreography & smooth scroll-based depth transitions
 * - Clean, mystical archival state management (No developer terminals!)
 * - Live backend proxy communication via /api/profile/:id
 * - Preserved Anti-Inspection & DevTools Security Shield
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize 3D Flying Dutchman Ghost Ship WebGL Engine
  let dutchmanEngine = null;
  const canvasElem = document.getElementById('dutchmanCanvas');
  if (canvasElem && window.FlyingDutchmanEngine) {
    try {
      dutchmanEngine = new window.FlyingDutchmanEngine('dutchmanCanvas');
    } catch (e) {
      console.warn('[Ghost Fleet] WebGL fallback active:', e);
    }
  }

  // 2. DOM Elements
  const profileForm = document.getElementById('profileForm');
  const rollNumberInput = document.getElementById('rollNumberInput');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');

  const loadingState = document.getElementById('loadingState');
  const mysticStatusText = document.getElementById('mysticStatusText');

  const errorState = document.getElementById('errorState');
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');
  const adminTip = document.getElementById('adminTip');

  const resultState = document.getElementById('resultState');
  const profileImage = document.getElementById('profileImage');
  const displayRoll = document.getElementById('displayRoll');
  const downloadBtn = document.getElementById('downloadBtn');
  const openNewTabBtn = document.getElementById('openNewTabBtn');

  let currentObjectUrl = null;
  const ROLL_NUMBER_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;

  // 3. GSAP Cinematic Entrance & Scroll Animations
  if (typeof gsap !== 'undefined') {
    const isReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isReduced) {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.ghost-fleet-header', {
        y: -30,
        opacity: 0,
        duration: 1.2
      })
      .from('.hero-subtitle-bar', {
        scale: 0.85,
        opacity: 0,
        duration: 0.8
      }, '-=0.6')
      .from('.hero-main-title', {
        y: 45,
        opacity: 0,
        duration: 1.4,
        ease: 'power4.out'
      }, '-=0.5')
      .from('.hero-app-title', {
        y: 20,
        opacity: 0,
        duration: 0.9
      }, '-=0.7')
      .from('.hero-institution', {
        y: 15,
        opacity: 0,
        duration: 0.8
      }, '-=0.6')
      .from('.hero-tagline-quote', {
        opacity: 0,
        duration: 1.2
      }, '-=0.5')
      .from('.scroll-explore-anchor', {
        y: 20,
        opacity: 0,
        duration: 0.8
      }, '-=0.4');

      // ScrollTrigger reveal for the archive altar
      if (typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
        gsap.from('.archive-console-card', {
          scrollTrigger: {
            trigger: '.archive-main-section',
            start: 'top 80%'
          },
          y: 70,
          opacity: 0,
          duration: 1.5,
          ease: 'power3.out'
        });
      }
    }
  }

  // 4. State Management
  function cleanupObjectUrl() {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
  }

  function resetStates() {
    if (loadingState) loadingState.classList.add('hidden');
    if (errorState) errorState.classList.add('hidden');
    if (resultState) resultState.classList.add('hidden');
    if (adminTip) adminTip.classList.add('hidden');
  }

  function showError(title, message, isSessionError = false) {
    resetStates();
    if (errorTitle) errorTitle.textContent = title;
    if (errorMessage) errorMessage.textContent = message;
    if (isSessionError && adminTip) {
      adminTip.classList.remove('hidden');
    }
    if (errorState) errorState.classList.remove('hidden');
  }

  function showResult(blob, rollNumber) {
    resetStates();
    cleanupObjectUrl();

    currentObjectUrl = URL.createObjectURL(blob);
    if (profileImage) profileImage.src = currentObjectUrl;
    if (displayRoll) displayRoll.textContent = rollNumber;

    if (downloadBtn) {
      downloadBtn.href = currentObjectUrl;
      downloadBtn.download = `DUTCHMAN_${rollNumber}.jpg`;
    }
    if (openNewTabBtn) {
      openNewTabBtn.href = currentObjectUrl;
    }

    if (resultState) resultState.classList.remove('hidden');

    if (typeof gsap !== 'undefined') {
      gsap.from('.result-archival-card', {
        scale: 0.95,
        opacity: 0,
        duration: 0.7,
        ease: 'power2.out'
      });
    }
  }

  function setLoading(isLoading) {
    if (isLoading) {
      if (submitBtn) submitBtn.disabled = true;
      if (btnText) btnText.textContent = 'CONSULTING ARCHIVE...';
      if (loadingState) loadingState.classList.remove('hidden');
      if (errorState) errorState.classList.add('hidden');
      if (resultState) resultState.classList.add('hidden');
    } else {
      if (submitBtn) submitBtn.disabled = false;
      if (btnText) btnText.textContent = 'REVEAL PROFILE';
      if (loadingState) loadingState.classList.add('hidden');
    }
  }

  // 5. Form Submission & API Pipeline
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const rawRoll = rollNumberInput ? rollNumberInput.value : '';
      const trimmedRoll = rawRoll.trim();

      // Client validation
      if (!trimmedRoll) {
        showError('ARCHIVAL NOTICE', 'Please enter an admission number to query.');
        if (rollNumberInput) rollNumberInput.focus();
        return;
      }

      if (trimmedRoll.length < 3 || trimmedRoll.length > 30) {
        showError('ARCHIVAL NOTICE', 'Admission number must be between 3 and 30 characters.');
        if (rollNumberInput) rollNumberInput.focus();
        return;
      }

      if (!ROLL_NUMBER_PATTERN.test(trimmedRoll)) {
        showError('ARCHIVAL NOTICE', 'Invalid characters. Only letters, numbers, hyphens, and underscores are allowed.');
        if (rollNumberInput) rollNumberInput.focus();
        return;
      }

      setLoading(true);
      if (mysticStatusText) mysticStatusText.textContent = 'Consulting maritime records...';

      const isReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const stepDelay = (ms) => new Promise(r => setTimeout(r, isReduced ? 10 : ms));

      // Dispatch fetch to backend API endpoint
      const fetchPromise = (async () => {
        try {
          const response = await fetch(`/api/profile/${encodeURIComponent(trimmedRoll)}`);
          return { ok: true, response };
        } catch (networkErr) {
          return { ok: false, error: networkErr };
        }
      })();

      // Poetic atmospheric summoning progression
      await stepDelay(300);
      if (mysticStatusText) mysticStatusText.textContent = 'Summoning record from the depths...';

      const fetchResult = await fetchPromise;

      if (!fetchResult.ok) {
        setLoading(false);
        showError('COMMUNICATION SEVERED', 'Unable to reach the ghost fleet archival proxy.');
        return;
      }

      const response = fetchResult.response;

      if (response.status === 200) {
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('image') || contentType.includes('jpeg') || contentType.includes('png')) {
          if (mysticStatusText) mysticStatusText.textContent = 'Record found. Manifesting portrait...';
          await stepDelay(250);
          const blob = await response.blob();
          setLoading(false);
          showResult(blob, trimmedRoll);
          return;
        }
      }

      // Handle non-200 responses
      let errorData = null;
      try {
        errorData = await response.json();
      } catch (jsonErr) {}

      setLoading(false);

      if (response.status === 401) {
        showError(
          'ERP SESSION EXPIRED',
          (errorData && errorData.error) || 'ABES ERP session has expired. Please refresh credentials on the server.',
          true
        );
      } else if (response.status === 404) {
        showError(
          'RECORD NOT FOUND',
          (errorData && errorData.error) || `No archive record found for admission number: ${trimmedRoll}`
        );
      } else if (response.status === 429) {
        showError(
          'TOO MANY QUERIES',
          (errorData && errorData.error) || 'Too many queries dispatched. Please wait a moment.'
        );
      } else {
        showError(
          'ARCHIVAL EXCEPTION',
          (errorData && errorData.error) || `Archival query failed with status ${response.status}.`
        );
      }
    });
  }

  // 6. Anti-Inspection & DevTools Security Shield
  initAntiInspectionSecurity();
});

// --------------------------------------------------------------------------
// Anti-Inspection & DevTools Protection System
// --------------------------------------------------------------------------
function initAntiInspectionSecurity() {
  const shield = document.getElementById('securityShield');
  let isDevToolsOpen = false;

  function triggerDevToolsBlock() {
    if (!isDevToolsOpen) {
      isDevToolsOpen = true;
      document.body.classList.add('devtools-blocked');
      if (shield) shield.style.display = 'flex';
    }
  }

  function removeDevToolsBlock() {
    if (isDevToolsOpen) {
      isDevToolsOpen = false;
      document.body.classList.remove('devtools-blocked');
      if (shield) shield.style.display = 'none';
    }
  }

  // Disable Right-Click Context Menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  }, { capture: true });

  // Disable Inspection Key Shortcuts
  document.addEventListener('keydown', (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const key = e.key ? e.key.toUpperCase() : '';
    const code = e.keyCode || e.which;

    // F12
    if (key === 'F12' || code === 123) {
      e.preventDefault();
      e.stopPropagation();
      triggerDevToolsBlock();
      return false;
    }

    // Ctrl+Shift+I, J, C
    if (isCtrlOrCmd && e.shiftKey && (key === 'I' || key === 'J' || key === 'C' || code === 73 || code === 74 || code === 67)) {
      e.preventDefault();
      e.stopPropagation();
      triggerDevToolsBlock();
      return false;
    }

    // Ctrl+U, Ctrl+S
    if (isCtrlOrCmd && (key === 'U' || key === 'S' || code === 85 || code === 83)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, { capture: true });

  // Dimension Differential Detection
  const threshold = 160;
  function checkDevToolsDimensions() {
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    const isOpen = widthDiff > threshold || heightDiff > threshold;

    if (isOpen) {
      triggerDevToolsBlock();
    } else {
      removeDevToolsBlock();
    }
  }

  window.addEventListener('resize', checkDevToolsDimensions);
  setInterval(checkDevToolsDimensions, 400);

  // Debugger Timing Lag Detection
  let lastTime = Date.now();
  setInterval(() => {
    const now = Date.now();
    if (now - lastTime > 400) {
      triggerDevToolsBlock();
    }
    lastTime = now;
  }, 100);
}
