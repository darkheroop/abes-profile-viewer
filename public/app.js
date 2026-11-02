/**
 * THE FLYING DUTCHMANN — Master Application & GSAP Orchestrator
 * Made by GHOST FLEET
 * 
 * Features:
 * - 3D Ghost Ship WebGL initialization (FlyingDutchmanEngine)
 * - 15-Second 5-Scene Cinematic Storytelling Introduction with skip & replay
 * - Procedural Nautical Web Audio Sound Engine (ambient surf, bell, thunder, compass, emerald magic)
 * - Interactive Admission Number Search with rotating brass compass, illuminated runes & ignited wax seal
 * - Horizontal traveling emerald light sweep across parchment
 * - Interactive 4-chapter narrative strip with 3D camera choreography
 * - Real-time student profile retrieval from ABES ERP via /api/profile/:id
 * - Preserved Anti-Inspection & DevTools Security Shield ("Baap se Backchodi nahi beta")
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // --------------------------------------------------------------------------
  // 1. Initialize Sound Engine & 3D WebGL Ghost Galleon Engine
  // --------------------------------------------------------------------------
  let soundEngine = null;
  if (window.NauticalSoundEngine) {
    try {
      soundEngine = new window.NauticalSoundEngine();
    } catch (e) {
      console.warn('[SoundEngine] Init exception:', e);
    }
  }

  let dutchmanEngine = null;
  const canvasElem = document.getElementById('dutchmanCanvas');
  if (canvasElem && window.FlyingDutchmanEngine) {
    try {
      dutchmanEngine = new window.FlyingDutchmanEngine('dutchmanCanvas');
    } catch (e) {
      console.warn('[Ghost Fleet] WebGL fallback active:', e);
    }
  }

  // --------------------------------------------------------------------------
  // 2. DOM Elements
  // --------------------------------------------------------------------------
  // Header Controls
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundLabel = document.getElementById('soundLabel');
  const soundIconMuted = document.getElementById('soundIconMuted');
  const soundIconActive = document.getElementById('soundIconActive');
  const replayIntroBtn = document.getElementById('replayIntroBtn');

  // Cinematic Intro Elements
  const introOverlay = document.getElementById('cinematicIntroOverlay');
  const introSceneTag = document.getElementById('introSceneTag');
  const introSceneTitle = document.getElementById('introSceneTitle');
  const introSceneText = document.getElementById('introSceneText');
  const skipIntroBtn = document.getElementById('skipIntroBtn');
  const stepperDots = document.querySelectorAll('.stepper-dot');

  // Search Form & Interactive Archival Props
  const profileForm = document.getElementById('profileForm');
  const rollNumberInput = document.getElementById('rollNumberInput');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const compassNeedle = document.getElementById('compassNeedle');
  const searchRunes = document.getElementById('searchRunes');
  const archiveSeal = document.getElementById('archiveSeal');
  const emeraldBeamSweep = document.getElementById('emeraldBeamSweep');

  // Dynamic Output States
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

  // Story Chapter Cards
  const chapterCards = document.querySelectorAll('.story-chapter-card');

  let currentObjectUrl = null;
  const ROLL_NUMBER_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;

  // --------------------------------------------------------------------------
  // 3. Sound Engine Toggle Controller
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
  // 4. Cinematic 15-Second Introduction Director
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
    if (introSceneTitle) {
      introSceneTitle.textContent = data.title;
      if (typeof gsap !== 'undefined') {
        gsap.fromTo(introSceneTitle, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
      }
    }
    if (introSceneText) {
      introSceneText.textContent = data.text;
      if (typeof gsap !== 'undefined') {
        gsap.fromTo(introSceneText, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.out' });
      }
    }

    // Update Stepper Dots
    stepperDots.forEach(dot => {
      const step = parseInt(dot.getAttribute('data-step'), 10);
      if (step === sceneNumber) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });

    // Fire procedural sound effect if enabled
    if (data.sound) data.sound();
  }

  function dismissIntro() {
    if (introOverlay) {
      introOverlay.classList.add('dismissed');
    }
    try {
      sessionStorage.setItem('dutchman_intro_played', '1');
    } catch (e) {}

    // Animate the hero interface entrance smoothly
    animateHeroEntrance();
  }

  function playCinematicIntro() {
    if (!dutchmanEngine) return;

    if (introOverlay) {
      introOverlay.classList.remove('dismissed');
      introOverlay.style.opacity = '1';
      introOverlay.style.visibility = 'visible';
    }

    updateIntroScene(1);

    dutchmanEngine.playCinematicIntro(
      (sceneNum) => updateIntroScene(sceneNum),
      () => dismissIntro()
    );
  }

  // Skip Intro Action Button & ESC Key Binding
  if (skipIntroBtn) {
    skipIntroBtn.addEventListener('click', () => {
      if (dutchmanEngine) {
        dutchmanEngine.skipIntro(() => dismissIntro());
      } else {
        dismissIntro();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
      if (introOverlay && !introOverlay.classList.contains('dismissed')) {
        if (dutchmanEngine) {
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

  // Start Intro on First Visit
  const alreadySeen = false; // Always give the cinematic experience on load
  if (!alreadySeen && dutchmanEngine) {
    playCinematicIntro();
  } else {
    dismissIntro();
  }

  // --------------------------------------------------------------------------
  // 5. GSAP Entrance & Scroll Animations
  // --------------------------------------------------------------------------
  function animateHeroEntrance() {
    if (typeof gsap === 'undefined') return;
    const isReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) return;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.fromTo('.ghost-fleet-header', { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.0 })
      .fromTo('.hero-subtitle-bar', { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7 }, '-=0.5')
      .fromTo('.hero-main-title', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'power4.out' }, '-=0.4')
      .fromTo('.hero-app-title', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, '-=0.6')
      .fromTo('.hero-institution', { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, '-=0.5')
      .fromTo('.hero-tagline-quote', { opacity: 0 }, { opacity: 0.95, duration: 1.0 }, '-=0.4')
      .fromTo('.scroll-explore-anchor', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, '-=0.4');

    if (typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
      gsap.fromTo('.archive-console-card', 
        { y: 60, opacity: 0 },
        {
          scrollTrigger: {
            trigger: '.archive-main-section',
            start: 'top 80%'
          },
          y: 0,
          opacity: 1,
          duration: 1.3,
          ease: 'power3.out'
        }
      );
    }
  }

  // --------------------------------------------------------------------------
  // 6. Interactive Story Chapter Strip Controller
  // --------------------------------------------------------------------------
  chapterCards.forEach(card => {
    card.addEventListener('click', () => {
      const chapterIdx = parseInt(card.getAttribute('data-chapter'), 10);

      // Update active state
      chapterCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      // Camera choreography
      if (dutchmanEngine && dutchmanEngine.focusStoryChapter) {
        dutchmanEngine.focusStoryChapter(chapterIdx);
      }

      // Audio feedback
      if (soundEngine) {
        soundEngine.playCompassClick();
      }

      // Viewport scroll guidance
      if (chapterIdx === 2 || chapterIdx === 3) {
        const archiveElem = document.getElementById('archive-section');
        if (archiveElem) {
          archiveElem.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        const heroElem = document.getElementById('hero');
        if (heroElem) {
          heroElem.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // 7. Interactive Search Form Typing Animation & Sound
  // --------------------------------------------------------------------------
  if (rollNumberInput) {
    rollNumberInput.addEventListener('input', () => {
      const val = rollNumberInput.value.trim();

      // Mechanical compass needle wobble with each keystroke
      if (compassNeedle) {
        const angle = (val.length * 42 + (val.charCodeAt(val.length - 1) || 0) * 5) % 360;
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

      // Audio tick
      if (soundEngine && val.length > 0) {
        soundEngine.playCompassClick();
      }
    });

    rollNumberInput.addEventListener('focus', () => {
      if (searchRunes) searchRunes.classList.add('glow');
    });

    rollNumberInput.addEventListener('blur', () => {
      if (rollNumberInput.value.trim().length === 0 && searchRunes) {
        searchRunes.classList.remove('glow');
      }
    });
  }

  // --------------------------------------------------------------------------
  // 8. State Management
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
    if (archiveSeal) archiveSeal.classList.remove('ignited');
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

    // Highlight Chapter 4 in the narrative strip
    chapterCards.forEach((c, idx) => {
      if (idx === 3) c.classList.add('active');
      else c.classList.remove('active');
    });

    // Play supernatural emerald chime
    if (soundEngine) {
      soundEngine.playEmeraldMagic();
    }

    if (typeof gsap !== 'undefined') {
      gsap.from('.result-archival-card', {
        scale: 0.94,
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

  // --------------------------------------------------------------------------
  // 9. Form Submission & API Pipeline
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

      // Trigger Story Submissions Animations & Sound
      if (soundEngine) {
        soundEngine.playShipBell();
      }

      // Wax seal flame ignite
      if (archiveSeal) {
        archiveSeal.classList.add('ignited');
      }

      // Traveling emerald light sweep across the parchment console
      if (emeraldBeamSweep) {
        emeraldBeamSweep.classList.remove('sweeping');
        void emeraldBeamSweep.offsetWidth; // Force reflow
        emeraldBeamSweep.classList.add('sweeping');
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

  // --------------------------------------------------------------------------
  // 10. Anti-Inspection & DevTools Security Shield (Preserved)
  // --------------------------------------------------------------------------
  initAntiInspectionSecurity();
});

// --------------------------------------------------------------------------
// Anti-Inspection & DevTools Protection System ("Baap se Backchodi nahi beta")
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
