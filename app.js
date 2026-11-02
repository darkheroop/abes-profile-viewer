/**
 * THE FLYING DUTCHMANN — Master Frontend Application Orchestrator
 * Rebuilt from scratch for ABES Student Profile Viewer
 * Made by GHOST FLEET
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // --------------------------------------------------------------------------
  // 1. Initialize Engines (Sound & 3D WebGL Ghost Galleon)
  // --------------------------------------------------------------------------
  let soundEngine = null;
  if (window.NauticalSoundEngine) {
    try {
      soundEngine = new window.NauticalSoundEngine();
    } catch (e) {
      console.warn('[SoundEngine] Init warning:', e);
    }
  }

  let dutchmanEngine = null;
  const canvasElem = document.getElementById('dutchmanCanvas');
  if (canvasElem && window.FlyingDutchmanEngine) {
    try {
      dutchmanEngine = new window.FlyingDutchmanEngine('dutchmanCanvas');
    } catch (e) {
      console.warn('[FlyingDutchmanEngine] 3D fallback active:', e);
    }
  }

  // --------------------------------------------------------------------------
  // 2. DOM Elements Selection
  // --------------------------------------------------------------------------
  // Header Actions
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundLabel = document.getElementById('soundLabel');
  const soundIconMuted = document.getElementById('soundIconMuted');
  const soundIconActive = document.getElementById('soundIconActive');
  const replayIntroBtn = document.getElementById('replayIntroBtn');

  // Cinematic Intro Overlay Elements
  const introOverlay = document.getElementById('cinematicIntroOverlay');
  const introSceneTag = document.getElementById('introSceneTag');
  const introSceneTitle = document.getElementById('introSceneTitle');
  const introSceneText = document.getElementById('introSceneText');
  const skipIntroBtn = document.getElementById('skipIntroBtn');
  const stepperDots = document.querySelectorAll('.stepper-dot');

  // Search Form Elements
  const profileForm = document.getElementById('profileForm');
  const rollNumberInput = document.getElementById('rollNumberInput');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const compassNeedle = document.getElementById('compassNeedle');
  const searchRunes = document.getElementById('searchRunes');

  // Output States
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

  // Story Navigation Pills
  const chapterPills = document.querySelectorAll('.chapter-pill');

  let currentObjectUrl = null;
  const ROLL_NUMBER_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;
  const isReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --------------------------------------------------------------------------
  // 3. Sound Engine Controls
  // --------------------------------------------------------------------------
  if (soundToggleBtn && soundEngine) {
    soundToggleBtn.addEventListener('click', () => {
      const isAudible = soundEngine.toggleMute();
      soundToggleBtn.setAttribute('aria-pressed', isAudible ? 'true' : 'false');

      if (isAudible) {
        soundToggleBtn.classList.add('sound-active');
        if (soundLabel) soundLabel.textContent = 'SOUND: ON';
        if (soundIconMuted) soundIconMuted.classList.add('hidden');
        if (soundIconActive) soundIconActive.classList.remove('hidden');
        soundEngine.playEmeraldMagic();
      } else {
        soundToggleBtn.classList.remove('sound-active');
        if (soundLabel) soundLabel.textContent = 'SOUND: OFF';
        if (soundIconMuted) soundIconMuted.classList.remove('hidden');
        if (soundIconActive) soundIconActive.classList.add('hidden');
      }
    });
  }

  // --------------------------------------------------------------------------
  // 4. Cinematic Introduction Experience (Controlled & Non-Blocking)
  // --------------------------------------------------------------------------
  const INTRO_SCENES = {
    1: {
      tag: 'SCENE 1 // THE FORBIDDEN OCEAN',
      title: 'The Forbidden Caribbean Ocean',
      text: 'Thick sea fog blankets the moonlit waters. Distant thunder rumbles across the eternal dark abyss...',
      sound: () => soundEngine && soundEngine.playThunder()
    },
    2: {
      tag: 'SCENE 2 // THE GHOST SHIP EMERGES',
      title: 'The Ghost Ship Emerges',
      text: 'A towering cursed galleon breaks through the spectral mist. Its weathered black sails catch the phantom wind...',
      sound: () => soundEngine && soundEngine.playShipBell()
    },
    3: {
      tag: 'SCENE 3 // APPROACH THE VESSEL',
      title: 'The Cursed Galleon',
      text: 'Weathered timber, ancient rigging, and supernatural emerald lanterns illuminate the lost vessel...',
      sound: () => null
    },
    4: {
      tag: 'SCENE 4 // THE ANCIENT ARCHIVE',
      title: "The Captain's Ledger Awakens",
      text: 'The brass navigational compass spins. Ancient maritime records unfold upon the captain\'s table...',
      sound: () => soundEngine && soundEngine.playCompassClick()
    },
    5: {
      tag: 'SCENE 5 // REVEAL THE ARCHIVE',
      title: 'Access The Ghost Fleet Records',
      text: 'The parchment settles. The Student Profile Archive is unlocked for ABES Engineering College...',
      sound: () => soundEngine && soundEngine.playEmeraldMagic()
    }
  };

  function updateIntroScene(sceneNumber) {
    const data = INTRO_SCENES[sceneNumber];
    if (!data) return;

    if (introSceneTag) introSceneTag.textContent = data.tag;
    if (introSceneTitle) introSceneTitle.textContent = data.title;
    if (introSceneText) introSceneText.textContent = data.text;

    // Update Stepper Dots
    stepperDots.forEach(dot => {
      const step = parseInt(dot.getAttribute('data-step'), 10);
      if (step === sceneNumber) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });

    // Audio trigger
    if (data.sound) data.sound();
  }

  function dismissIntro() {
    if (!introOverlay) return;

    introOverlay.classList.add('dismissed');
    introOverlay.style.opacity = '0';
    introOverlay.style.pointerEvents = 'none';

    setTimeout(() => {
      if (introOverlay) {
        introOverlay.style.display = 'none';
      }
    }, 400);

    try {
      sessionStorage.setItem('dutchman_intro_played', '1');
    } catch (e) {}

    // Focus input for instant accessibility
    if (rollNumberInput) {
      setTimeout(() => {
        try { rollNumberInput.focus(); } catch (e) {}
      }, 500);
    }
  }

  function playCinematicIntro() {
    if (!introOverlay) return;

    introOverlay.style.display = 'flex';
    introOverlay.style.pointerEvents = 'auto';
    introOverlay.classList.remove('dismissed');
    introOverlay.style.opacity = '1';

    updateIntroScene(1);

    if (dutchmanEngine && dutchmanEngine.playCinematicIntro) {
      dutchmanEngine.playCinematicIntro(
        (sceneNum) => updateIntroScene(sceneNum),
        () => dismissIntro()
      );
    } else {
      setTimeout(dismissIntro, 1200);
    }
  }

  // Skip Intro Action & ESC Key Binding
  if (skipIntroBtn) {
    skipIntroBtn.addEventListener('click', () => {
      if (dutchmanEngine && dutchmanEngine.skipIntro) {
        dutchmanEngine.skipIntro(() => dismissIntro());
      } else {
        dismissIntro();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
      if (introOverlay && !introOverlay.classList.contains('dismissed')) {
        if (dutchmanEngine && dutchmanEngine.skipIntro) {
          dutchmanEngine.skipIntro(() => dismissIntro());
        } else {
          dismissIntro();
        }
      }
    }
  });

  // Replay Intro Header Button
  if (replayIntroBtn) {
    replayIntroBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      playCinematicIntro();
    });
  }

  // Initial Run Decision
  if (isReducedMotion || window.location.search.includes('nointro')) {
    dismissIntro();
  } else {
    playCinematicIntro();
  }

  // --------------------------------------------------------------------------
  // 5. Story Navigation Pills
  // --------------------------------------------------------------------------
  chapterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const chapterIdx = parseInt(pill.getAttribute('data-chapter'), 10);

      chapterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      if (dutchmanEngine && dutchmanEngine.focusStoryChapter) {
        dutchmanEngine.focusStoryChapter(chapterIdx);
      }

      if (soundEngine) {
        soundEngine.playCompassClick();
      }
    });
  });

  // --------------------------------------------------------------------------
  // 6. Interactive Search Form Typing & Feedback
  // --------------------------------------------------------------------------
  if (rollNumberInput) {
    rollNumberInput.addEventListener('input', () => {
      const val = rollNumberInput.value.trim();

      // Mechanical compass needle wobble
      if (compassNeedle) {
        const angle = (val.length * 45 + (val.charCodeAt(val.length - 1) || 0) * 7) % 360;
        compassNeedle.style.transform = `rotate(${angle}deg)`;
      }

      // Maritime runes glow illumination
      if (searchRunes) {
        if (val.length > 0) {
          searchRunes.classList.add('glow');
        } else {
          searchRunes.classList.remove('glow');
        }
      }

      // Compass tick audio
      if (soundEngine && val.length > 0) {
        soundEngine.playCompassClick();
      }
    });
  }

  // --------------------------------------------------------------------------
  // 7. Output State Management
  // --------------------------------------------------------------------------
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

    // Highlight Chapter IV pill
    chapterPills.forEach((p, idx) => {
      if (idx === 3) p.classList.add('active');
      else p.classList.remove('active');
    });

    if (soundEngine) {
      soundEngine.playEmeraldMagic();
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

  // --------------------------------------------------------------------------
  // 8. Form Submission & Backend API Pipeline
  // --------------------------------------------------------------------------
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

      if (soundEngine) {
        soundEngine.playShipBell();
      }

      setLoading(true);
      if (mysticStatusText) mysticStatusText.textContent = 'Consulting maritime records...';

      const stepDelay = (ms) => new Promise(r => setTimeout(r, isReducedMotion ? 10 : ms));

      // Dispatch fetch to backend API proxy
      const fetchPromise = (async () => {
        try {
          const response = await fetch(`/api/profile/${encodeURIComponent(trimmedRoll)}`);
          return { ok: true, response };
        } catch (networkErr) {
          return { ok: false, error: networkErr };
        }
      })();

      await stepDelay(250);
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
          await stepDelay(200);
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

  // --------------------------------------------------------------------------
  // 9. Anti-Inspection & DevTools Security Shield ("Baap se Backchodi nahi beta")
  // --------------------------------------------------------------------------
  initAntiInspectionSecurity();
});

// --------------------------------------------------------------------------
// DevTools Protection System (Preserved Exact Requirement)
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

  // Disable Right-Click
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  }, { capture: true });

  // Disable Key Shortcuts (F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S)
  document.addEventListener('keydown', (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const key = e.key ? e.key.toUpperCase() : '';
    const code = e.keyCode || e.which;

    if (key === 'F12' || code === 123) {
      e.preventDefault();
      e.stopPropagation();
      triggerDevToolsBlock();
      return false;
    }

    if (isCtrlOrCmd && e.shiftKey && (key === 'I' || key === 'J' || key === 'C' || code === 73 || code === 74 || code === 67)) {
      e.preventDefault();
      e.stopPropagation();
      triggerDevToolsBlock();
      return false;
    }

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

  // Timing Lag Detection
  let lastTime = Date.now();
  setInterval(() => {
    const now = Date.now();
    if (now - lastTime > 400) {
      triggerDevToolsBlock();
    }
    lastTime = now;
  }, 100);
}
