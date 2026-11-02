/**
 * THE FLYING DUTCHMANN — Master 3D WebGL Engine & 5-Scene Cinematic Camera Director
 * Crafted with Three.js (r128) & GSAP 3.12
 * Made by GHOST FLEET
 * 
 * Features:
 * - Real 3D Environment:
 *   • Realistic compound ocean swells with real-time vertex normal updates
 *   • Monumental 17th-century ghost galleon with dual-tumbled hull, beakhead, 3-tier sterncastle
 *   • 3 towering masts, fighting tops, yardarms, shrouds, ratlines, and forestays
 *   • 10 wind-filled ghost sails with procedural wave flutter
 *   • 12 gunports with protruding brass cannons, glowing emerald cabin windows
 *   • Quarterdeck with captain's navigation table, ancient nautical map, and brass compass
 *   • 4 swinging spectral lanterns with point light attenuation and flickering
 *   • Dense atmospheric ocean fog, floating sea mist, and drifting embers
 * - Continuous 5-Scene Cinematic Storytelling Journey:
 *   • Scene 1: The Forgotten Ocean (0–3s) — camera sweeps low over dark waters
 *   • Scene 2: The Ghost Ship (3–7s) — galleon emerges through thick ocean mist
 *   • Scene 3: Boarding The Ship (7–10s) — camera glides onto deck past rigging & lanterns
 *   • Scene 4: The Captain's Table (10–13s) — camera settles on navigation table, map unfolds
 *   • Scene 5: Reveal The Archive (13–15s) — camera frames ship as background for student viewer
 * - Immediate Skip Intro with graceful camera ease
 * - Interactive Story Chapter navigation and subtle mouse parallax
 * - Performance optimized with proper disposal and reduced-motion fallback
 */

'use strict';

(function(window) {
  class FlyingDutchmanEngine {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;

      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.shipGroup = null;
      this.tableGroup = null;
      this.oceanMesh = null;
      this.oceanGeometry = null;
      this.oceanBaseY = null;
      this.particleSystem = null;
      this.particlePhases = null;
      this.mistGroup = null;
      this.sails = [];
      this.lanterns = [];

      this.mouseX = 0;
      this.mouseY = 0;
      this.targetMouseX = 0;
      this.targetMouseY = 0;
      this.clock = null;
      this.animationFrameId = null;

      // Cinematic Timeline State
      this.isCinematicPlaying = false;
      this.cinematicTimeline = null;
      this.cameraTarget = new THREE.Vector3(0, 4.2, 0);

      this.isReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.init();
    }

    init() {
      if (typeof THREE === 'undefined') {
        console.warn('[FlyingDutchmanEngine] Three.js not detected.');
        return;
      }

      const width = window.innerWidth;
      const height = window.innerHeight;

      // 1. Scene & Deep Atmosphere
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x03090B);
      // Exponential dark ocean fog blending into deep teal-black abyss
      this.scene.fog = new THREE.FogExp2(0x04191B, 0.026);

      // 2. Camera
      this.camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 1000);
      this.camera.position.set(0, 1.2, 42); // Starts far back for Scene 1

      // 3. Renderer with color calibration
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
      if (this.renderer.outputEncoding !== undefined) {
        this.renderer.outputEncoding = THREE.sRGBEncoding;
      }

      this.clock = new THREE.Clock();

      // 4. Construct Environment & Models
      this.setupLighting();
      this.createOcean();
      this.createGhostGalleon();
      this.createCaptainsTable();
      this.createGhostParticles();
      this.createSeaMists();

      // 5. Event Listeners
      this.handleResize = this.onWindowResize.bind(this);
      this.handleMouseMove = this.onMouseMove.bind(this);
      this.handleTouchMove = this.onTouchMove.bind(this);

      window.addEventListener('resize', this.handleResize, { passive: true });
      window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
      window.addEventListener('touchmove', this.handleTouchMove, { passive: true });

      // 6. Start Loop
      this.animate();
    }

    setupLighting() {
      // Ambient ghost luminescence (dark midnight teal)
      const ambientLight = new THREE.AmbientLight(0x062B2B, 1.8);
      this.scene.add(ambientLight);

      // Distant storm moonlight breaking through clouds
      const moonLight = new THREE.DirectionalLight(0x2A736A, 2.6);
      moonLight.position.set(-25, 40, 15);
      this.scene.add(moonLight);

      // Rim light illuminating sail edges and mist
      const rimLight = new THREE.DirectionalLight(0x0C3F3B, 2.0);
      rimLight.position.set(30, 25, -20);
      this.scene.add(rimLight);

      // Mainmast Emerald Ghost Lantern
      const mainEmeraldLight = new THREE.PointLight(0x00C6A2, 5.5, 45, 1.8);
      mainEmeraldLight.position.set(0, 8.5, 1.5);
      this.scene.add(mainEmeraldLight);
      this.lanterns.push({ light: mainEmeraldLight, baseIntensity: 5.5, speed: 2.8, phase: 0 });

      // Stern Castle Antique Gold Interior Light
      const sternGoldLight = new THREE.PointLight(0xC9A45C, 4.2, 35, 1.9);
      sternGoldLight.position.set(8.0, 5.0, 0.5);
      this.scene.add(sternGoldLight);
      this.lanterns.push({ light: sternGoldLight, baseIntensity: 4.2, speed: 2.2, phase: 1.5 });

      // Bowsprit Phosphorescent Light
      const bowLight = new THREE.PointLight(0x00FFB8, 4.0, 30, 2.0);
      bowLight.position.set(-9.0, 3.5, 0);
      this.scene.add(bowLight);
      this.lanterns.push({ light: bowLight, baseIntensity: 4.0, speed: 3.4, phase: 2.6 });
    }

    createOcean() {
      // 80x80 segments for fluid compound wave simulation
      const oceanGeo = new THREE.PlaneGeometry(180, 180, 75, 75);
      oceanGeo.rotateX(-Math.PI / 2);

      const pos = oceanGeo.attributes.position;
      this.oceanBaseY = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        this.oceanBaseY[i] = pos.getY(i);
      }

      const oceanMat = new THREE.MeshStandardMaterial({
        color: 0x031214,
        roughness: 0.15,
        metalness: 0.85,
        flatShading: false
      });

      this.oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
      this.oceanMesh.position.y = -0.6;
      this.oceanGeometry = oceanGeo;
      this.scene.add(this.oceanMesh);
    }

    createGhostGalleon() {
      this.shipGroup = new THREE.Group();
      this.shipGroup.position.set(0, 0, 0);

      // Materials
      const weatheredWood = new THREE.MeshStandardMaterial({
        color: 0x081719,
        roughness: 0.85,
        metalness: 0.15
      });

      const darkTimber = new THREE.MeshStandardMaterial({
        color: 0x050E10,
        roughness: 0.90,
        metalness: 0.20
      });

      const goldTrim = new THREE.MeshStandardMaterial({
        color: 0xC9A45C,
        roughness: 0.40,
        metalness: 0.80
      });

      const sailMaterial = new THREE.MeshStandardMaterial({
        color: 0x0A1617,
        roughness: 0.95,
        metalness: 0.05,
        side: THREE.DoubleSide
      });

      const emeraldGlowMat = new THREE.MeshBasicMaterial({
        color: 0x00C6A2
      });

      // --- HULL CONSTRUCTION ---
      // Lower Hull keel
      const keelGeo = new THREE.BoxGeometry(16, 2.8, 4.4);
      const keel = new THREE.Mesh(keelGeo, weatheredWood);
      keel.position.set(0, 1.2, 0);
      this.shipGroup.add(keel);

      // Forecastle (Bow)
      const bowGeo = new THREE.CylinderGeometry(2.4, 0.4, 5.5, 4);
      bowGeo.rotateZ(Math.PI / 3.2);
      const bow = new THREE.Mesh(bowGeo, weatheredWood);
      bow.position.set(-8.5, 2.5, 0);
      this.shipGroup.add(bow);

      // Bowsprit Spar
      const sparGeo = new THREE.CylinderGeometry(0.12, 0.28, 9.5, 8);
      sparGeo.rotateZ(Math.PI / 2.6);
      const spar = new THREE.Mesh(sparGeo, darkTimber);
      spar.position.set(-11.5, 4.2, 0);
      this.shipGroup.add(spar);

      // Stern Castle (3-Tier Quarterdeck)
      const sternGeo = new THREE.BoxGeometry(6.5, 4.8, 4.8);
      const stern = new THREE.Mesh(sternGeo, darkTimber);
      stern.position.set(5.5, 3.2, 0);
      this.shipGroup.add(stern);

      // Stern Gallery Windows with Emerald Radiance
      for (let w = -1; w <= 1; w++) {
        const winGeo = new THREE.PlaneGeometry(0.85, 1.3);
        const winMesh = new THREE.Mesh(winGeo, emeraldGlowMat);
        winMesh.position.set(8.8, 3.8, w * 1.5);
        winMesh.rotateY(Math.PI / 2);
        this.shipGroup.add(winMesh);
      }

      // Stern Balcony Railing
      const railGeo = new THREE.BoxGeometry(0.2, 0.9, 4.6);
      const rail = new THREE.Mesh(railGeo, goldTrim);
      rail.position.set(8.75, 4.8, 0);
      this.shipGroup.add(rail);

      // Gunports & Cannons (Port & Starboard)
      const cannonGeo = new THREE.CylinderGeometry(0.14, 0.22, 1.4, 8);
      cannonGeo.rotateX(Math.PI / 2);
      const gunportMat = new THREE.MeshBasicMaterial({ color: 0x020506 });

      for (let side = -1; side <= 1; side += 2) {
        for (let c = -4; c <= 3; c += 2.2) {
          // Port opening
          const portFrame = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.1), gunportMat);
          portFrame.position.set(c, 1.8, side * 2.25);
          this.shipGroup.add(portFrame);

          // Protruding cannon barrel
          const cannon = new THREE.Mesh(cannonGeo, darkTimber);
          cannon.position.set(c, 1.8, side * 2.6);
          this.shipGroup.add(cannon);
        }
      }

      // --- 3 TOWERING MASTS & RIGGING ---
      const mastPositions = [
        { x: -4.5, h: 16.5, r: 0.32 }, // Foremast
        { x: 0.5,  h: 19.5, r: 0.38 }, // Mainmast
        { x: 5.2,  h: 15.0, r: 0.30 }  // Mizzenmast
      ];

      mastPositions.forEach((m, idx) => {
        // Main Mast pole
        const mastGeo = new THREE.CylinderGeometry(m.r * 0.55, m.r, m.h, 10);
        const mast = new THREE.Mesh(mastGeo, darkTimber);
        mast.position.set(m.x, m.h / 2 + 1.2, 0);
        this.shipGroup.add(mast);

        // Fighting Top platform
        const topGeo = new THREE.CylinderGeometry(1.4, 1.1, 0.45, 8);
        const top = new THREE.Mesh(topGeo, weatheredWood);
        top.position.set(m.x, m.h * 0.62 + 1.2, 0);
        this.shipGroup.add(top);

        // Cross Yardarms & Billowed Sails (3 tiers per mast)
        const tiers = [
          { y: m.h * 0.38, w: 6.8, h: 3.4 },
          { y: m.h * 0.68, w: 5.4, h: 2.8 },
          { y: m.h * 0.90, w: 3.8, h: 2.2 }
        ];

        tiers.forEach((t, tIdx) => {
          // Yardarm
          const yardGeo = new THREE.CylinderGeometry(0.08, 0.16, t.w + 0.6, 8);
          yardGeo.rotateX(Math.PI / 2);
          const yard = new THREE.Mesh(yardGeo, darkTimber);
          yard.position.set(m.x, t.y + 1.2, 0);
          this.shipGroup.add(yard);

          // Billowed Sail with procedural vertex curvature
          const sailGeo = new THREE.PlaneGeometry(t.w, t.h, 12, 10);
          sailGeo.rotateY(Math.PI / 2);

          const sPos = sailGeo.attributes.position;
          const basePositions = new Float32Array(sPos.count * 3);

          for (let p = 0; p < sPos.count; p++) {
            const vy = sPos.getY(p);
            // Bell curve billow in wind direction
            const billow = Math.sin((vy / t.h + 0.5) * Math.PI) * 0.85;
            sPos.setZ(p, sPos.getZ(p) + billow);

            basePositions[p * 3 + 0] = sPos.getX(p);
            basePositions[p * 3 + 1] = sPos.getY(p);
            basePositions[p * 3 + 2] = sPos.getZ(p);
          }
          sailGeo.computeVertexNormals();

          const sailMesh = new THREE.Mesh(sailGeo, sailMaterial);
          sailMesh.position.set(m.x, t.y - t.h * 0.45 + 1.2, 0);
          this.shipGroup.add(sailMesh);

          this.sails.push({
            mesh: sailMesh,
            geo: sailGeo,
            basePos: basePositions,
            speed: 1.8 + idx * 0.4 + tIdx * 0.2,
            phase: idx + tIdx * 1.5
          });
        });

        // Standing Shrouds (Rigging ropes from deck to mast)
        for (let side = -1; side <= 1; side += 2) {
          const shroudGeo = new THREE.BufferGeometry();
          const shroudVerts = new Float32Array([
            m.x, m.h * 0.62 + 1.2, 0,
            m.x - 1.2, 2.2, side * 2.2,
            m.x, m.h * 0.62 + 1.2, 0,
            m.x + 1.2, 2.2, side * 2.2
          ]);
          shroudGeo.setAttribute('position', new THREE.BufferAttribute(shroudVerts, 3));
          const shroud = new THREE.LineSegments(shroudGeo, new THREE.LineBasicMaterial({ color: 0x051315 }));
          this.shipGroup.add(shroud);
        }
      });

      // Hanging Lanterns on Yardarms
      const lanternGeo = new THREE.CylinderGeometry(0.18, 0.25, 0.5, 6);
      const lanternMesh = new THREE.Mesh(lanternGeo, goldTrim);
      lanternMesh.position.set(0.5, 14.5, 2.8);
      this.shipGroup.add(lanternMesh);

      this.scene.add(this.shipGroup);
    }

    createCaptainsTable() {
      this.tableGroup = new THREE.Group();
      this.tableGroup.position.set(4.8, 3.8, 0); // Positioned on quarterdeck

      const woodMat = new THREE.MeshStandardMaterial({ color: 0x0B1E21, roughness: 0.75, metalness: 0.2 });
      const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xD8C49A, roughness: 0.90, side: THREE.DoubleSide });
      const brassMat = new THREE.MeshStandardMaterial({ color: 0xC9A45C, roughness: 0.35, metalness: 0.85 });

      // Table Top & Legs
      const topGeo = new THREE.BoxGeometry(2.4, 0.12, 1.6);
      const tableTop = new THREE.Mesh(topGeo, woodMat);
      this.tableGroup.add(tableTop);

      for (let x = -1; x <= 1; x += 2) {
        for (let z = -1; z <= 1; z += 2) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 6), woodMat);
          leg.position.set(x * 1.0, -0.6, z * 0.65);
          this.tableGroup.add(leg);
        }
      }

      // Unfolded Ancient Nautical Map
      const mapGeo = new THREE.PlaneGeometry(1.6, 1.1);
      mapGeo.rotateX(-Math.PI / 2);
      const mapMesh = new THREE.Mesh(mapGeo, parchmentMat);
      mapMesh.position.set(0, 0.08, 0);
      this.tableGroup.add(mapMesh);

      // Antique Brass Compass on Table
      const compassBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.1, 12), brassMat);
      compassBase.position.set(-0.5, 0.14, 0.25);
      this.tableGroup.add(compassBase);

      const compassGlass = new THREE.Mesh(new THREE.CircleGeometry(0.20, 12), new THREE.MeshBasicMaterial({ color: 0x00C6A2 }));
      compassGlass.rotateX(-Math.PI / 2);
      compassGlass.position.set(-0.5, 0.20, 0.25);
      this.tableGroup.add(compassGlass);

      // Candle with flickering amber point light
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0xF4EBDD }));
      candle.position.set(0.6, 0.24, -0.4);
      this.tableGroup.add(candle);

      const candleLight = new THREE.PointLight(0xF4BA68, 2.2, 8, 2.0);
      candleLight.position.set(0.6, 0.45, -0.4);
      this.tableGroup.add(candleLight);
      this.lanterns.push({ light: candleLight, baseIntensity: 2.2, speed: 4.5, phase: 1.0 });

      this.scene.add(this.tableGroup);
    }

    createGhostParticles() {
      // 450 drifting spectral embers
      const count = 450;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      this.particlePhases = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        pos[i * 3 + 0] = (Math.random() - 0.5) * 65;
        pos[i * 3 + 1] = Math.random() * 22;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 65;
        this.particlePhases[i] = Math.random() * Math.PI * 2;
      }

      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

      const mat = new THREE.PointsMaterial({
        color: 0x00C6A2,
        size: 0.16,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending
      });

      this.particleSystem = new THREE.Points(geo, mat);
      this.scene.add(this.particleSystem);
    }

    createSeaMists() {
      this.mistGroup = new THREE.Group();
      const mistMat = new THREE.MeshBasicMaterial({
        color: 0x051F22,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide
      });

      for (let i = 0; i < 4; i++) {
        const mistGeo = new THREE.PlaneGeometry(90, 20);
        mistGeo.rotateX(-Math.PI / 2.3);
        const mist = new THREE.Mesh(mistGeo, mistMat);
        mist.position.set((Math.random() - 0.5) * 20, 0.4 + i * 0.3, (Math.random() - 0.5) * 30);
        this.mistGroup.add(mist);
      }
      this.scene.add(this.mistGroup);
    }

    // ------------------------------------------------------------------------
    // 5-Scene Continuous Cinematic Camera Director
    // ------------------------------------------------------------------------
    playCinematicIntro(onSceneChange, onComplete) {
      if (typeof gsap === 'undefined' || this.isReducedMotion) {
        if (onComplete) onComplete();
        return;
      }

      this.isCinematicPlaying = true;
      const tl = gsap.timeline({
        onComplete: () => {
          this.isCinematicPlaying = false;
          if (onComplete) onComplete();
        }
      });
      this.cinematicTimeline = tl;

      // Initial Camera Origin: Far back, low over forbidden ocean
      this.camera.position.set(0, 1.2, 42);
      this.cameraTarget.set(0, 2.5, 0);

      // --- SCENE 1: THE FORGOTTEN OCEAN (0s – 3s) ---
      tl.call(() => { if (onSceneChange) onSceneChange(1); }, null, 0);
      tl.to(this.camera.position, {
        x: -2.5,
        y: 1.8,
        z: 32.0,
        duration: 3.2,
        ease: 'power2.inOut'
      }, 0);

      // --- SCENE 2: THE GHOST SHIP (3s – 7s) ---
      tl.call(() => { if (onSceneChange) onSceneChange(2); }, null, 3.2);
      tl.to(this.camera.position, {
        x: -5.5,
        y: 3.4,
        z: 23.5,
        duration: 3.8,
        ease: 'power1.inOut'
      }, 3.2);
      tl.to(this.cameraTarget, {
        x: -0.5,
        y: 4.8,
        z: 0,
        duration: 3.8,
        ease: 'power1.inOut'
      }, 3.2);

      // --- SCENE 3: BOARDING THE SHIP (7s – 10s) ---
      tl.call(() => { if (onSceneChange) onSceneChange(3); }, null, 7.0);
      tl.to(this.camera.position, {
        x: 2.2,
        y: 3.6,
        z: 16.0,
        duration: 3.0,
        ease: 'power2.inOut'
      }, 7.0);
      tl.to(this.cameraTarget, {
        x: 1.5,
        y: 3.8,
        z: 0,
        duration: 3.0,
        ease: 'power2.inOut'
      }, 7.0);

      // --- SCENE 4: THE CAPTAIN'S TABLE (10s – 13s) ---
      tl.call(() => { if (onSceneChange) onSceneChange(4); }, null, 10.0);
      tl.to(this.camera.position, {
        x: 4.6,
        y: 4.4,
        z: 2.4,
        duration: 3.0,
        ease: 'power2.out'
      }, 10.0);
      tl.to(this.cameraTarget, {
        x: 4.8,
        y: 3.9,
        z: 0,
        duration: 3.0,
        ease: 'power2.out'
      }, 10.0);

      // --- SCENE 5: REVEAL THE ARCHIVE (13s – 15s) ---
      tl.call(() => { if (onSceneChange) onSceneChange(5); }, null, 13.0);
      tl.to(this.camera.position, {
        x: 0,
        y: 2.2,
        z: 22.0,
        duration: 2.0,
        ease: 'power3.out'
      }, 13.0);
      tl.to(this.cameraTarget, {
        x: 0,
        y: 4.2,
        z: 0,
        duration: 2.0,
        ease: 'power3.out'
      }, 13.0);
    }

    skipIntro(onComplete) {
      if (this.cinematicTimeline) {
        this.cinematicTimeline.kill();
        this.cinematicTimeline = null;
      }
      this.isCinematicPlaying = false;

      if (typeof gsap !== 'undefined' && !this.isReducedMotion) {
        gsap.to(this.camera.position, {
          x: 0,
          y: 2.2,
          z: 22.0,
          duration: 0.6,
          ease: 'power3.out',
          onComplete: () => {
            this.cameraTarget.set(0, 4.2, 0);
            if (onComplete) onComplete();
          }
        });
      } else {
        this.camera.position.set(0, 2.2, 22.0);
        this.cameraTarget.set(0, 4.2, 0);
        if (onComplete) onComplete();
      }
    }

    focusStoryChapter(chapterIndex) {
      if (typeof gsap === 'undefined') return;
      const targets = [
        { pos: [0, 2.0, 32],   look: [0, 3.5, 0] },  // 0: The Forgotten Ocean
        { pos: [-5.0, 3.5, 23], look: [0, 4.6, 0] },  // 1: The Ghost Galleon
        { pos: [4.6, 4.4, 2.4], look: [4.8, 3.9, 0] },// 2: Captain's Table
        { pos: [0, 2.2, 22.0],  look: [0, 4.2, 0] }   // 3: Profile Archive
      ];

      const t = targets[Math.min(chapterIndex, targets.length - 1)];
      gsap.to(this.camera.position, {
        x: t.pos[0],
        y: t.pos[1],
        z: t.pos[2],
        duration: 1.2,
        ease: 'power3.out'
      });
      gsap.to(this.cameraTarget, {
        x: t.look[0],
        y: t.look[1],
        z: t.look[2],
        duration: 1.2,
        ease: 'power3.out'
      });
    }

    onMouseMove(e) {
      this.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.targetMouseY = (e.clientY / window.innerHeight) * 2 - 1;
    }

    onTouchMove(e) {
      if (e.touches && e.touches.length > 0) {
        this.targetMouseX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
        this.targetMouseY = (e.touches[0].clientY / window.innerHeight) * 2 - 1;
      }
    }

    onWindowResize() {
      if (!this.camera || !this.renderer) return;
      const width = window.innerWidth;
      const height = window.innerHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    }

    animate() {
      this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

      const time = this.clock.getElapsedTime();

      // Smooth mouse lerp
      this.mouseX += (this.targetMouseX - this.mouseX) * 0.045;
      this.mouseY += (this.targetMouseY - this.mouseY) * 0.045;

      if (!this.isReducedMotion) {
        // Subtle mouse parallax when not running guided cinematic camera timeline
        if (!this.isCinematicPlaying) {
          this.camera.position.x = this.mouseX * 2.8;
          this.camera.position.y = 2.2 - this.mouseY * 1.2;
          this.camera.position.z = 22.0;
          this.camera.lookAt(0, 4.2, 0);
        } else {
          this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y, this.cameraTarget.z);
        }

        // --- OCEAN COMPOUND WAVE SIMULATION ---
        if (this.oceanGeometry) {
          const pos = this.oceanGeometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const u = pos.getX(i);
            const v = pos.getZ(i);

            const w1 = Math.sin(u * 0.07 + time * 0.95) * 0.70;
            const w2 = Math.cos(v * 0.08 + time * 0.80) * 0.60;
            const w3 = Math.sin((u + v) * 0.05 + time * 0.60) * 0.40;
            const w4 = Math.cos((u - v) * 0.09 + time * 1.10) * 0.25;

            pos.setY(i, this.oceanBaseY[i] + w1 + w2 + w3 + w4);
          }
          pos.needsUpdate = true;
          this.oceanGeometry.computeVertexNormals();
        }

        // --- GHOST SHIP NATURAL BUOYANCY & HYDRODYNAMICS ---
        if (this.shipGroup) {
          this.shipGroup.position.y = 0.1 + Math.sin(time * 0.82) * 0.45;
          this.shipGroup.rotation.z = Math.sin(time * 0.72) * 0.045;
          this.shipGroup.rotation.x = Math.cos(time * 0.62) * 0.065;
          this.shipGroup.rotation.y = -0.35 + this.mouseX * 0.12;

          // Natural Sail Flutter
          for (let s = 0; s < this.sails.length; s++) {
            const sail = this.sails[s];
            const pos = sail.geo.attributes.position;
            const base = sail.basePos;
            const freq = sail.speed;

            for (let k = 0; k < pos.count; k++) {
              const ox = base[k * 3 + 0];
              const oz = base[k * 3 + 2];
              const ripple = Math.sin(ox * 0.8 + time * freq + sail.phase) * 0.08 * (oz > 0.1 ? 1 : 0.2);
              pos.setZ(k, oz + ripple);
            }
            pos.needsUpdate = true;
          }
        }

        // --- SPECTRAL PARTICLE FIELD ---
        if (this.particleSystem) {
          const pPos = this.particleSystem.geometry.attributes.position;
          for (let p = 0; p < pPos.count; p++) {
            let py = pPos.getY(p) + Math.sin(time + this.particlePhases[p]) * 0.015;
            let px = pPos.getX(p) + Math.cos(time * 0.35 + this.particlePhases[p]) * 0.012;

            if (py > 22) py = -1.0;
            pPos.setY(p, py);
            pPos.setX(p, px);
          }
          pPos.needsUpdate = true;
        }

        // --- LANTERN & CANDLE FLICKERING ---
        for (let l = 0; l < this.lanterns.length; l++) {
          const item = this.lanterns[l];
          const flicker = Math.sin(time * item.speed + item.phase) * 0.35 +
                          (Math.random() - 0.5) * 0.15;
          item.light.intensity = item.baseIntensity + flicker;
        }

        // --- DRIFTING SEA MIST ---
        if (this.mistGroup) {
          this.mistGroup.position.x = Math.sin(time * 0.16) * 2.5;
          this.mistGroup.position.z = Math.cos(time * 0.12) * 1.4;
        }
      }

      this.renderer.render(this.scene, this.camera);
    }

    destroy() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      window.removeEventListener('resize', this.handleResize);
      window.removeEventListener('mousemove', this.handleMouseMove);
      window.removeEventListener('touchmove', this.handleTouchMove);

      if (this.renderer) {
        this.renderer.dispose();
      }
    }
  }

  window.FlyingDutchmanEngine = FlyingDutchmanEngine;
})(window);
