/**
 * ABES Student Profile Viewer - Frontend Application
 * Synapse Design System Implementation
 * Handles theme toggling, client validation, and secure communication with the backend profile proxy.
 * NOTE: Strict frontend-only file. Backend communication logic remains 100% compatible.
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const searchForm = document.getElementById('searchForm');
  const rollNumberInput = document.getElementById('rollNumberInput');
  const inputWrapper = document.querySelector('.input-wrapper');
  const searchBtn = document.getElementById('searchBtn');
  const clearBtn = document.getElementById('clearBtn');
  const inputHelper = document.getElementById('inputHelper');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');
  const adminTip = document.getElementById('adminTip');

  const resultState = document.getElementById('resultState');
  const profileImage = document.getElementById('profileImage');
  const displayRoll = document.getElementById('displayRoll');
  const downloadBtn = document.getElementById('downloadBtn');
  const openNewTabBtn = document.getElementById('openNewTabBtn');

  const systemStatus = document.getElementById('systemStatus');
  const statusLabel = systemStatus ? systemStatus.querySelector('.status-label') : null;

  // Track active blob URL for proper memory cleanup
  let currentObjectUrl = null;

  // Validation regular expression: 3 to 30 alphanumeric characters, hyphens, or underscores
  const ROLL_NUMBER_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;

  // Minimum loading animation duration to prevent jarring visual flash
  const MIN_LOADING_DURATION_MS = 800;

  // --------------------------------------------------------------------------
  // Theme Management (Synapse Dark / Light Mode with Persistence)
  // --------------------------------------------------------------------------
  function getPreferredTheme() {
    const savedTheme = localStorage.getItem('abes_synapse_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'light' ? '#f4f4f0' : '#030303');
    }
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
    localStorage.setItem('abes_synapse_theme', nextTheme);
  }

  // Initialize theme
  applyTheme(getPreferredTheme());

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Listen for system theme changes if user has not set an explicit preference
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('abes_synapse_theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  // --------------------------------------------------------------------------
  // Gateway Health & ERP Status Check
  // --------------------------------------------------------------------------
  async function checkGatewayHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (data.sessionConfigured) {
          if (data.erpSession === 'active') {
            if (systemStatus) systemStatus.className = 'nav-status-pill status-online';
            if (statusLabel) statusLabel.textContent = 'GATEWAY ACTIVE';
          } else if (data.erpSession === 'expired') {
            if (systemStatus) systemStatus.className = 'nav-status-pill status-warning';
            if (statusLabel) statusLabel.textContent = 'SESSION EXPIRED';
          } else if (data.erpSession === 'temporarily_unavailable') {
            if (systemStatus) systemStatus.className = 'nav-status-pill status-warning';
            if (statusLabel) statusLabel.textContent = 'GATEWAY BUSY';
          } else {
            if (systemStatus) systemStatus.className = 'nav-status-pill status-online';
            if (statusLabel) statusLabel.textContent = 'ERP CONFIGURED';
          }
        } else {
          if (systemStatus) systemStatus.className = 'nav-status-pill status-warning';
          if (statusLabel) statusLabel.textContent = 'NOT CONFIGURED';
        }
      } else {
        throw new Error('Health check non-200');
      }
    } catch {
      if (systemStatus) systemStatus.className = 'nav-status-pill status-offline';
      if (statusLabel) statusLabel.textContent = 'GATEWAY OFFLINE';
    }
  }

  // --------------------------------------------------------------------------
  // UI State Reset and Cleanup
  // --------------------------------------------------------------------------
  function cleanupObjectUrl() {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
  }

  function resetStates() {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    resultState.classList.add('hidden');
    adminTip.classList.add('hidden');
    if (inputWrapper) inputWrapper.classList.remove('input-error');
  }

  // --------------------------------------------------------------------------
  // Display Error State
  // --------------------------------------------------------------------------
  function showError(title, message, isSessionError = false) {
    resetStates();
    errorTitle.textContent = title;
    errorMessage.textContent = message;
    if (inputWrapper) inputWrapper.classList.add('input-error');

    if (isSessionError) {
      adminTip.classList.remove('hidden');
    }

    errorState.classList.remove('hidden');
  }

  // --------------------------------------------------------------------------
  // Display Success State with Profile Card
  // --------------------------------------------------------------------------
  function showResult(blob, rollNumber) {
    resetStates();
    cleanupObjectUrl();

    currentObjectUrl = URL.createObjectURL(blob);
    profileImage.src = currentObjectUrl;
    displayRoll.textContent = rollNumber;

    // Configure download action
    downloadBtn.href = currentObjectUrl;
    downloadBtn.download = `ABES_${rollNumber}.jpg`;

    // Configure open in new tab action
    openNewTabBtn.href = currentObjectUrl;

    resultState.classList.remove('hidden');
  }

  // --------------------------------------------------------------------------
  // Toggle Loading Indicator
  // --------------------------------------------------------------------------
  function setLoading(isLoading) {
    const btnText = searchBtn ? searchBtn.querySelector('.btn-text') : null;
    if (isLoading) {
      if (searchBtn) searchBtn.disabled = true;
      if (btnText) btnText.textContent = 'Connecting...';
      loadingState.classList.remove('hidden');
      errorState.classList.add('hidden');
      resultState.classList.add('hidden');
    } else {
      if (searchBtn) searchBtn.disabled = false;
      if (btnText) btnText.textContent = 'Search Profile';
      loadingState.classList.add('hidden');
    }
  }

  // --------------------------------------------------------------------------
  // Handle Clear Button Visibility
  // --------------------------------------------------------------------------
  function updateClearButton() {
    if (rollNumberInput.value.trim().length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }

  // --------------------------------------------------------------------------
  // Event Listeners for Input & Clear
  // --------------------------------------------------------------------------
  rollNumberInput.addEventListener('input', () => {
    updateClearButton();
    if (inputWrapper) inputWrapper.classList.remove('input-error');
  });

  clearBtn.addEventListener('click', () => {
    rollNumberInput.value = '';
    updateClearButton();
    rollNumberInput.focus();
    resetStates();
  });

  // --------------------------------------------------------------------------
  // Form Submission & API Communication
  // --------------------------------------------------------------------------
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawRoll = rollNumberInput.value;
    const trimmedRoll = rawRoll.trim();

    // 1. Client-Side Input Validation
    if (!trimmedRoll) {
      showError('Validation Error', 'Please enter your admission number.');
      rollNumberInput.focus();
      return;
    }

    if (trimmedRoll.length < 3 || trimmedRoll.length > 30) {
      showError('Validation Error', 'Admission number must be between 3 and 30 characters.');
      rollNumberInput.focus();
      return;
    }

    if (!ROLL_NUMBER_PATTERN.test(trimmedRoll)) {
      showError(
        'Validation Error',
        'Admission number contains invalid characters. Use only letters, numbers, hyphens, and underscores.'
      );
      rollNumberInput.focus();
      return;
    }

    // 2. Execute Request to Existing Backend Profile API
    setLoading(true);

    try {
      // Execute the request to the existing backend endpoint
      const fetchPromise = fetch(`/api/profile/${encodeURIComponent(trimmedRoll)}`);
      
      // Enforce minimum display time for the Synapse scanner animation
      const delayPromise = new Promise(resolve => setTimeout(resolve, MIN_LOADING_DURATION_MS));
      
      const [response] = await Promise.all([fetchPromise, delayPromise]);

      const contentType = response.headers.get('content-type') || '';

      if (response.ok && contentType.startsWith('image/')) {
        const imageBlob = await response.blob();
        showResult(imageBlob, trimmedRoll);
        if (systemStatus) systemStatus.className = 'nav-status-pill status-online';
        if (statusLabel) statusLabel.textContent = 'GATEWAY ACTIVE';
      } else {
        // Parse error response
        let errData = {};
        try {
          errData = await response.json();
        } catch {
          errData = { error: `Server returned unexpected status ${response.status}` };
        }

        const msg = errData.error || 'Failed to retrieve student profile image.';

        if (response.status === 400) {
          showError('Invalid Admission Number', msg);
        } else if (response.status === 401) {
          showError('ERP Session Expired', msg, true);
          if (systemStatus) systemStatus.className = 'nav-status-pill status-warning';
          if (statusLabel) statusLabel.textContent = 'SESSION EXPIRED';
        } else if (response.status === 404) {
          showError('Profile Not Found', msg);
        } else if (response.status === 429) {
          showError('Rate Limit Reached', msg);
        } else if (response.status === 504) {
          showError('Request Timed Out', msg);
        } else {
          showError('Gateway Error', msg);
        }
      }
    } catch (networkErr) {
      showError(
        'Connection Error',
        'Could not communicate with the ERP gateway server. Please check your network connection.'
      );
    } finally {
      setLoading(false);
    }
  });

  // --------------------------------------------------------------------------
  // Cinematic Landing Animation Reveal Manager
  // Cleans up the initial entrance animation lock after sequence finishes (~1200ms)
  // --------------------------------------------------------------------------
  const LANDING_SEQUENCE_DURATION_MS = 1200;
  setTimeout(() => {
    document.body.classList.remove('loading-unrevealed');
    document.body.classList.add('loaded');
  }, LANDING_SEQUENCE_DURATION_MS);

  // --------------------------------------------------------------------------
  // Synapse Multi-Layer Fluid Atmospheric Motion & Inertia Controller
  // Fluid Lerp + Pointer Velocity Calculation via requestAnimationFrame
  // --------------------------------------------------------------------------
  const cursorLight = document.getElementById('cursorLight');
  const ambientGrid = document.querySelector('.ambient-grid-layer');
  const layerViolet = document.querySelector('.layer-violet');
  const layerCyan = document.querySelector('.layer-cyan');
  const layerIndigo = document.querySelector('.layer-indigo');
  const layerEmerald = document.querySelector('.layer-emerald');
  const layerDrift = document.querySelector('.layer-drift');

  const isTouchOrCoarse =
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  if (!isTouchOrCoarse && cursorLight) {
    let currentMouseX = window.innerWidth / 2;
    let currentMouseY = window.innerHeight / 2;
    let targetMouseX = currentMouseX;
    let targetMouseY = currentMouseY;

    let lastRawX = currentMouseX;
    let lastRawY = currentMouseY;
    let lastMoveTime = performance.now();
    let targetVelocity = 0;
    let currentVelocity = 0;

    let currentParallaxX = 0;
    let currentParallaxY = 0;
    let targetParallaxX = 0;
    let targetParallaxY = 0;

    let isTracking = false;

    function renderMotionLoop() {
      // Fluid Lerp: 0.07 for cursor light, 0.045 for atmospheric inertia
      currentMouseX += (targetMouseX - currentMouseX) * 0.07;
      currentMouseY += (targetMouseY - currentMouseY) * 0.07;

      currentParallaxX += (targetParallaxX - currentParallaxX) * 0.045;
      currentParallaxY += (targetParallaxY - currentParallaxY) * 0.045;

      // Pointer velocity smoothing and exponential decay when resting
      currentVelocity += (targetVelocity - currentVelocity) * 0.08;
      targetVelocity *= 0.92;

      // Cursor light expansion with velocity
      const lightScale = (1 + Math.min(currentVelocity * 0.04, 0.18)).toFixed(3);
      cursorLight.style.transform = `translate3d(${currentMouseX.toFixed(1)}px, ${currentMouseY.toFixed(1)}px, 0) scale(${lightScale})`;

      const velDisturb = currentVelocity * 3.5;

      // Layer 1: Ambient grid (subtle inverse parallax)
      if (ambientGrid) {
        ambientGrid.style.transform = `translate3d(${(currentParallaxX * -8).toFixed(1)}px, ${(currentParallaxY * -8).toFixed(1)}px, 0)`;
      }

      // Layer 2: Deep Violet Fluid (mid-depth with subtle velocity disturbance)
      if (layerViolet) {
        const vx = (currentParallaxX * 24 + currentParallaxX * velDisturb).toFixed(1);
        const vy = (currentParallaxY * 18 + currentParallaxY * velDisturb).toFixed(1);
        layerViolet.style.transform = `translate3d(${vx}px, ${vy}px, 0)`;
      }

      // Layer 3: Cyan Fluid (opposing depth, fluid swirl)
      if (layerCyan) {
        const cx = (-currentParallaxX * 30 - currentParallaxX * velDisturb).toFixed(1);
        const cy = (-currentParallaxY * 24 - currentParallaxY * velDisturb).toFixed(1);
        layerCyan.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      }

      // Layer 4: Indigo Fluid (foreground atmospheric depth)
      if (layerIndigo) {
        const ix = (currentParallaxX * 36).toFixed(1);
        const iy = (currentParallaxY * 28).toFixed(1);
        layerIndigo.style.transform = `translate3d(${ix}px, ${iy}px, 0)`;
      }

      // Layer 5: Emerald Accent
      if (layerEmerald) {
        const ex = (-currentParallaxX * 18).toFixed(1);
        const ey = (currentParallaxY * 16).toFixed(1);
        layerEmerald.style.transform = `translate3d(${ex}px, ${ey}px, 0)`;
      }

      // Layer 6: Mid-Field Drift
      if (layerDrift) {
        const dx = (currentParallaxX * 14).toFixed(1);
        const dy = (-currentParallaxY * 14).toFixed(1);
        layerDrift.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      }

      requestAnimationFrame(renderMotionLoop);
    }

    window.addEventListener('mousemove', (e) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;

      // Calculate instantaneous pointer velocity
      const now = performance.now();
      const dt = Math.max(now - lastMoveTime, 16);
      const dx = e.clientX - lastRawX;
      const dy = e.clientY - lastRawY;
      const dist = Math.hypot(dx, dy);
      const instantVel = Math.min((dist / dt) * 12, 5.0);
      targetVelocity = instantVel;
      lastRawX = e.clientX;
      lastRawY = e.clientY;
      lastMoveTime = now;

      // Normalized coordinates (-1 to 1) from viewport center
      targetParallaxX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      targetParallaxY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);

      if (!isTracking) {
        isTracking = true;
        currentMouseX = e.clientX;
        currentMouseY = e.clientY;
        document.body.classList.add('has-cursor');
        requestAnimationFrame(renderMotionLoop);
      }
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
      document.body.classList.remove('has-cursor');
      targetParallaxX = 0;
      targetParallaxY = 0;
      targetVelocity = 0;
    });

    document.addEventListener('mouseenter', () => {
      document.body.classList.add('has-cursor');
    });
  }

  // Initial setup
  checkGatewayHealth();
  updateClearButton();
});


