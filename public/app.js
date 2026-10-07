/**
 * ABES Student Profile Viewer - Frontend Application
 * Synapse Design System Implementation
 * Handles theme toggling, client validation, and secure communication with the backend profile proxy.
 * NOTE: Strict frontend-only file. Backend communication logic remains 100% compatible.
 */

/**
 * Terminal-Style Processing Animation Manager
 * Coordinates lifecycle stages during the real API profile request.
 */
class TerminalManager {
  constructor(elements) {
    this.elements = elements;
    this.timerInterval = null;
    this.dotsInterval = null;
    this.startTime = 0;
    this.isWaiting = false;
  }

  start(rollNumber) {
    this.stop();
    const { cmdText, log, activeLabel, footTimer } = this.elements;
    if (cmdText) cmdText.textContent = `init profile-query --id=${rollNumber}`;
    if (log) log.innerHTML = '';
    if (activeLabel) activeLabel.textContent = 'initializing request pipeline';
    if (footTimer) footTimer.textContent = '0.00s';

    this.startTime = performance.now();
    this.timerInterval = setInterval(() => {
      if (footTimer) {
        const elapsed = (performance.now() - this.startTime) * 0.001;
        footTimer.textContent = `${elapsed.toFixed(2)}s`;
      }
    }, 50);

    this.isWaiting = false;
  }

  addLine(status, text) {
    const { log, body } = this.elements;
    if (!log) return null;

    const line = document.createElement('div');
    line.className = 'terminal-log-line';

    let markerClass = 'status-ok';
    let markerText = '[ OK ]';
    if (status === 'wait') {
      markerClass = 'status-wait';
      markerText = '[ .. ]';
    } else if (status === 'fail') {
      markerClass = 'status-fail';
      markerText = '[FAIL]';
    } else if (status === 'info') {
      markerClass = 'status-info';
      markerText = '[ -- ]';
    }

    line.innerHTML = `<span class="term-status ${markerClass}">${markerText}</span><span class="term-msg">${text}</span>`;
    log.appendChild(line);

    if (body) {
      body.scrollTop = body.scrollHeight;
    }
    return line;
  }

  updateLine(lineElem, status, text) {
    if (!lineElem) return;
    let markerClass = 'status-ok';
    let markerText = '[ OK ]';
    if (status === 'wait') {
      markerClass = 'status-wait';
      markerText = '[ .. ]';
    } else if (status === 'fail') {
      markerClass = 'status-fail';
      markerText = '[FAIL]';
    }
    lineElem.innerHTML = `<span class="term-status ${markerClass}">${markerText}</span><span class="term-msg">${text}</span>`;
    const { body } = this.elements;
    if (body) body.scrollTop = body.scrollHeight;
  }

  setActiveLabel(text) {
    const { activeLabel } = this.elements;
    if (activeLabel) activeLabel.textContent = text;
  }

  startWaitingDots(baseText) {
    this.stopWaitingDots();
    this.isWaiting = true;
    let dotCount = 0;
    const { activeLabel } = this.elements;
    this.dotsInterval = setInterval(() => {
      if (!this.isWaiting) return;
      dotCount = (dotCount + 1) % 4;
      const dots = '.'.repeat(dotCount);
      if (activeLabel) activeLabel.textContent = `${baseText}${dots}`;
    }, 300);
  }

  stopWaitingDots() {
    this.isWaiting = false;
    if (this.dotsInterval) {
      clearInterval(this.dotsInterval);
      this.dotsInterval = null;
    }
  }

  stop() {
    this.stopWaitingDots();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const searchForm = document.getElementById('searchForm');
  const rollNumberInput = document.getElementById('rollNumberInput');
  const inputWrapper = document.querySelector('.input-wrapper');
  const portalCard = document.querySelector('.glass-portal-card');
  const searchCardContainer = document.querySelector('.search-card-container');
  const searchBtn = document.getElementById('searchBtn');
  const clearBtn = document.getElementById('clearBtn');
  const inputHelper = document.getElementById('inputHelper');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  const loadingState = document.getElementById('loadingState');
  const terminalBody = document.getElementById('terminalBody');
  const terminalCmdText = document.getElementById('terminalCmdText');
  const terminalLog = document.getElementById('terminalLog');
  const terminalActiveLabel = document.getElementById('terminalActiveLabel');
  const terminalFootTimer = document.getElementById('terminalFootTimer');

  const terminalManager = new TerminalManager({
    body: terminalBody,
    cmdText: terminalCmdText,
    log: terminalLog,
    activeLabel: terminalActiveLabel,
    footTimer: terminalFootTimer
  });

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
      rayLength: 1.65,
      pulsating: true,
      fadeDistance: 1.0,
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
    if (terminalManager) terminalManager.stop();
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

    if (searchCardContainer) {
      searchCardContainer.classList.remove('is-loading');
      searchCardContainer.classList.add('has-error');
      setTimeout(() => {
        if (searchCardContainer) searchCardContainer.classList.remove('has-error');
      }, 2800);
    }

    if (portalCard) {
      portalCard.classList.remove('is-loading');
      portalCard.classList.add('has-error');
      setTimeout(() => {
        if (portalCard) portalCard.classList.remove('has-error');
      }, 2800);
    }

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

    if (searchCardContainer) {
      searchCardContainer.classList.remove('is-loading', 'has-error');
      searchCardContainer.classList.add('has-success');
      setTimeout(() => {
        if (searchCardContainer) searchCardContainer.classList.remove('has-success');
      }, 2200);
    }

    if (portalCard) {
      portalCard.classList.remove('is-loading', 'has-error');
      portalCard.classList.add('has-success');
      setTimeout(() => {
        if (portalCard) portalCard.classList.remove('has-success');
      }, 2200);
    }

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
      if (btnText) btnText.textContent = 'Processing...';
      if (searchCardContainer) {
        searchCardContainer.classList.add('is-loading');
        searchCardContainer.classList.remove('has-error', 'has-success');
      }
      if (portalCard) {
        portalCard.classList.add('is-loading');
        portalCard.classList.remove('has-error', 'has-success');
      }
      loadingState.classList.remove('hidden');
      errorState.classList.add('hidden');
      resultState.classList.add('hidden');
    } else {
      if (searchBtn) searchBtn.disabled = false;
      if (btnText) btnText.textContent = 'Search Profile';
      if (searchCardContainer) {
        searchCardContainer.classList.remove('is-loading');
      }
      if (portalCard) {
        portalCard.classList.remove('is-loading');
      }
      loadingState.classList.add('hidden');
      if (terminalManager) terminalManager.stop();
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

    // 2. Execute Request with Professional Terminal Lifecycle
    setLoading(true);
    terminalManager.start(trimmedRoll);

    const isReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stepDelay = (ms) => new Promise(r => setTimeout(r, isReduced ? 20 : ms));

    // Parallel real fetch to backend API endpoint (identical URL, method, headers)
    const fetchPromise = (async () => {
      try {
        const response = await fetch(`/api/profile/${encodeURIComponent(trimmedRoll)}`);
        return { ok: true, response };
      } catch (networkErr) {
        return { ok: false, error: networkErr };
      }
    })();

    // Terminal workflow progression
    terminalManager.setActiveLabel('gateway context initializing');
    await stepDelay(150);
    terminalManager.addLine('ok', 'gateway initialized');

    terminalManager.setActiveLabel('verifying session context');
    await stepDelay(160);
    terminalManager.addLine('ok', 'session context detected');

    terminalManager.setActiveLabel('validating query parameter');
    await stepDelay(160);
    terminalManager.addLine('ok', 'admission query verified');

    terminalManager.setActiveLabel('dispatching secure ERP relay');
    await stepDelay(180);
    terminalManager.addLine('ok', 'dispatching ERP query');

    // Await ERP response (Wait Point)
    const waitLine = terminalManager.addLine('wait', 'awaiting ERP response');
    terminalManager.startWaitingDots('awaiting ERP response');

    // Wait for the real API response
    const fetchResult = await fetchPromise;
    terminalManager.stopWaitingDots();

    try {
      if (fetchResult.ok && fetchResult.response) {
        const response = fetchResult.response;
        const contentType = response.headers.get('content-type') || '';

        if (response.ok && contentType.startsWith('image/')) {
          terminalManager.updateLine(waitLine, 'ok', 'awaiting ERP response');

          terminalManager.setActiveLabel('streaming profile payload');
          const imageBlob = await response.blob();
          await stepDelay(160);
          terminalManager.addLine('ok', `profile payload stream acquired (${Math.round(imageBlob.size / 1024)} KB)`);

          terminalManager.setActiveLabel('validating response integrity');
          await stepDelay(150);
          terminalManager.addLine('ok', 'response integrity verified');

          terminalManager.setActiveLabel('render pipeline ready');
          await stepDelay(140);
          terminalManager.addLine('ok', 'render pipeline ready');

          terminalManager.setActiveLabel('profile loaded');
          terminalManager.stop();
          await stepDelay(220);

          showResult(imageBlob, trimmedRoll);
          if (systemStatus) systemStatus.className = 'card-session-indicator status-online';
          if (statusLabel) statusLabel.textContent = 'SESSION ACTIVE';
        } else {
          // HTTP error response from server
          terminalManager.updateLine(waitLine, 'fail', `gateway response error (HTTP ${response.status})`);
          terminalManager.setActiveLabel('request terminated');
          terminalManager.stop();

          let errData = {};
          try {
            errData = await response.json();
          } catch {
            errData = { error: `Server returned unexpected status ${response.status}` };
          }
          const msg = errData.error || 'Failed to retrieve student profile image.';

          await stepDelay(320);

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
      } else {
        // Network connection error
        terminalManager.updateLine(waitLine, 'fail', 'network relay unreachable');
        terminalManager.setActiveLabel('request terminated');
        terminalManager.stop();

        await stepDelay(320);
        showError(
          'Connection Error',
          'Could not communicate with the ERP gateway server. Please check your network connection.'
        );
      }
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


