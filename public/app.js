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
  let lightRays = null;

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
    if (lightRays) {
      lightRays.setTheme(theme);
    }
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
    localStorage.setItem('abes_synapse_theme', nextTheme);
  }

  // Initialize theme
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  // Initialize LightRays WebGL Background Engine
  const lightRaysCanvas = document.getElementById('lightRaysCanvas');
  if (lightRaysCanvas && window.LightRaysEngine) {
    lightRays = new window.LightRaysEngine(lightRaysCanvas, {
      raysOrigin: 'top-center',
      raysColor: '#dbeafe', // Restrained luminous tone for Dark Mode
      raysColorLight: '#7c3aed', // Elegant soft lavender for Light Mode
      raysSpeed: 1.0,
      lightSpread: 1.1,
      rayLength: 1.8,
      pulsating: true,
      fadeDistance: 1.1,
      saturation: 1.0,
      followMouse: true,
      mouseInfluence: 0.22,
      noiseAmount: 0.015,
      distortion: 0.045,
      lightMode: initialTheme === 'light'
    });
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Listen for pointerdown across document to trigger Aurora Impact shockwave blooms
  window.addEventListener('pointerdown', (e) => {
    if (lightRays && typeof lightRays.triggerImpact === 'function') {
      lightRays.triggerImpact(e.clientX, e.clientY);
    }
  }, { passive: true });

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
            if (systemStatus) systemStatus.className = 'card-session-indicator status-online';
            if (statusLabel) statusLabel.textContent = 'SESSION ACTIVE';
          } else if (data.erpSession === 'expired') {
            if (systemStatus) systemStatus.className = 'card-session-indicator status-warning';
            if (statusLabel) statusLabel.textContent = 'SESSION EXPIRED';
          } else if (data.erpSession === 'temporarily_unavailable') {
            if (systemStatus) systemStatus.className = 'card-session-indicator status-warning';
            if (statusLabel) statusLabel.textContent = 'GATEWAY BUSY';
          } else {
            if (systemStatus) systemStatus.className = 'card-session-indicator status-online';
            if (statusLabel) statusLabel.textContent = 'ERP CONFIGURED';
          }
        } else {
          if (systemStatus) systemStatus.className = 'card-session-indicator status-warning';
          if (statusLabel) statusLabel.textContent = 'NOT CONFIGURED';
        }
      } else {
        throw new Error('Health check non-200');
      }
    } catch {
      if (systemStatus) systemStatus.className = 'card-session-indicator status-offline';
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
        if (systemStatus) systemStatus.className = 'card-session-indicator status-online';
        if (statusLabel) statusLabel.textContent = 'SESSION ACTIVE';
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
          if (systemStatus) systemStatus.className = 'card-session-indicator status-warning';
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

  // Initial setup
  checkGatewayHealth();
  updateClearButton();
});


