/**
 * THE FLYING DUTCHMANN — Master 3D Cinematic Ghost Ship WebGL Engine
 * Crafted with Three.js (r128)
 * 
 * Architecture:
 * - Monumental 17th-century Ghost Galleon with high-fidelity procedural geometry:
 *   • Double-tumbled wooden hull with rising sheer line, forecastle, quarterdeck, and 3-tier sterncastle
 *   • Gothic stained-glass stern gallery windows with interior emerald & gold supernatural radiance
 *   • Carved stern balcony railings, gun ports with protruding brass cannons, and beakhead with spectral figurehead
 *   • 3 towering multi-stage masts (Fore, Main, Mizzen) with fighting tops, yardarms, shrouds, ratlines, and forestays
 *   • 10 billowed, wind-filled ghost sails with dynamic wave flutter and spectral phosphorescence
 * - Dynamic open Caribbean ocean with compound wave simulation (4 wave octaves with real-time normal updates)
 * - Atmospheric depth: Dense ocean fog (#071719), floating low-sea mist layers, and 500 drifting ghostly embers
 * - Dynamic lighting: Cold moonlight, 4 flickering spectral lanterns with point light attenuation, and ship hull reflections
 * - Cinematic camera choreography: Dramatic low-angle hero framing with smooth mouse parallax and scroll tracking
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
      this.oceanMesh = null;
      this.oceanGeometry = null;
      this.particleSystem = null;
      this.mistGroup = null;
      this.sails = [];
      this.lanternLights = [];

      this.mouseX = 0;
      this.mouseY = 0;
      this.targetMouseX = 0;
      this.targetMouseY = 0;
      this.scrollProgress = 0;
      this.clock = null;
      this.animationFrameId = null;

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

      // 1. Scene & Atmosphere
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x030708);
      // Atmospheric Exponential Fog blending into dark abyss
      this.scene.fog = new THREE.FogExp2(0x061517, 0.026);

      // 2. Cinematic Camera Setup
      // Positioned low looking up at the ship for majestic scale
      this.camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 1000);
      this.camera.position.set(0, 1.8, 18.5);

      // 3. Renderer with high performance & color calibration
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if (this.renderer.outputEncoding !== undefined) {
        this.renderer.outputEncoding = THREE.sRGBEncoding;
      }

      this.clock = new THREE.Clock();

      // 4. Construct the World
      this.setupLighting();
      this.createOcean();
      this.createGhostGalleon();
      this.createGhostParticles();
      this.createSeaMists();

      // 5. Events & Tracking
      window.addEventListener('resize', this.onWindowResize.bind(this), { passive: true });
      window.addEventListener('mousemove', this.onMouseMove.bind(this), { passive: true });
      window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: true });
      window.addEventListener('scroll', this.onScroll.bind(this), { passive: true });

      // 6. Start Loop
      this.animate();
    }

    setupLighting() {
      // Ambient ghost radiance (dark emerald teal)
      const ambientLight = new THREE.AmbientLight(0x0a2422, 1.6);
      this.scene.add(ambientLight);

      // Distant storm moonlight breaking through clouds
      const moonLight = new THREE.DirectionalLight(0x28635c, 2.4);
      moonLight.position.set(-20, 35, 12);
      this.scene.add(moonLight);

      // Secondary back moon rim light
      const rimLight = new THREE.DirectionalLight(0x0b302c, 1.8);
      rimLight.position.set(25, 20, -18);
      this.scene.add(rimLight);

      // Primary Ghost Emerald Lantern at Mainmast Fighting Top
      const mainEmeraldLight = new THREE.PointLight(0x00D6A0, 5.0, 48, 1.8);
      mainEmeraldLight.position.set(0, 7.5, 1.5);
      this.scene.add(mainEmeraldLight);
      this.lanternLights.push({ light: mainEmeraldLight, baseIntensity: 5.0, flickerSpeed: 2.8, phase: 0.0 });

      // Stern Castle Gothic Lantern (Antique Gold interior glow)
      const sternGoldLight = new THREE.PointLight(0xD4A559, 4.0, 36, 1.9);
      sternGoldLight.position.set(7.5, 4.5, 0.5);
      this.scene.add(sternGoldLight);
      this.lanternLights.push({ light: sternGoldLight, baseIntensity: 4.0, flickerSpeed: 2.1, phase: 1.5 });

      // Bowsprit Spectral Light (Phosphorescent Emerald)
      const bowLight = new THREE.PointLight(0x05FFB0, 3.8, 30, 2.0);
      bowLight.position.set(-8.5, 3.2, 0);
      this.scene.add(bowLight);
      this.lanternLights.push({ light: bowLight, baseIntensity: 3.8, flickerSpeed: 3.5, phase: 2.7 });
    }

    createOcean() {
      // 120x120 segments for fluid, organic ocean swells
      const oceanGeo = new THREE.PlaneGeometry(180, 180, 80, 80);
      oceanGeo.rotateX(-Math.PI / 2);

      const pos = oceanGeo.attributes.position;
      this.oceanBaseY = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        this.oceanBaseY[i] = pos.getY(i);
      }

      // Deep reflective ocean material
      const oceanMat = new THREE.MeshStandardMaterial({
        color: 0x051315,
        roughness: 0.14,
        metalness: 0.88,
        flatShading: true
      });

      this.oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
      this.oceanMesh.position.set(0, -2.1, -5);
      this.scene.add(this.oceanMesh);
      this.oceanGeometry = oceanGeo;
    }

    createGhostGalleon() {
      this.shipGroup = new THREE.Group();

      // Materials
      // Ancient barnacle-encrusted blackened timber
      const woodDark = new THREE.MeshStandardMaterial({
        color: 0x0a1415,
        roughness: 0.85,
        metalness: 0.2,
        flatShading: true
      });

      // Antique gilded carved trims & balustrades
      const goldTrim = new THREE.MeshStandardMaterial({
        color: 0x9b7e45,
        roughness: 0.38,
        metalness: 0.72,
        flatShading: true
      });

      // Haunted emerald glowing wood (internal framing & ribs)
      const eerieGlowWood = new THREE.MeshStandardMaterial({
        color: 0x062822,
        emissive: 0x011d17,
        emissiveIntensity: 0.65,
        roughness: 0.6,
        metalness: 0.3,
        flatShading: true
      });

      // Cursed billowed phantom sails (translucent spectral ivory-teal)
      const ghostSailMat = new THREE.MeshStandardMaterial({
        color: 0x224f46,
        emissive: 0x03211b,
        emissiveIntensity: 0.7,
        roughness: 0.55,
        metalness: 0.12,
        transparent: true,
        opacity: 0.90,
        side: THREE.DoubleSide
      });

      // Stained-glass glowing window material
      const cabinWindowMat = new THREE.MeshBasicMaterial({
        color: 0x00FFB8
      });

      // Lantern flame material
      const lanternFlameMat = new THREE.MeshBasicMaterial({
        color: 0xE8F8FF
      });

      // Blackened cannon metal
      const cannonMat = new THREE.MeshStandardMaterial({
        color: 0x0c0e10,
        roughness: 0.5,
        metalness: 0.85
      });

      // ======================================================================
      // 1. HULL CONSTRUCTION (Classic 17th Century War Galleon)
      // ======================================================================
      // Lower Keel
      const keelGeo = new THREE.BoxGeometry(19, 0.6, 0.7);
      const keel = new THREE.Mesh(keelGeo, woodDark);
      keel.position.set(0, -0.6, 0);
      this.shipGroup.add(keel);

      // Main Hull Belly (Tumblehome shape: curved inward near gunwales)
      const hullBellyGeo = new THREE.CylinderGeometry(2.7, 1.4, 16.5, 10, 1);
      hullBellyGeo.rotateZ(Math.PI / 2);
      hullBellyGeo.scale(1.0, 0.48, 0.72);
      const hullBelly = new THREE.Mesh(hullBellyGeo, woodDark);
      hullBelly.position.set(0, 0.1, 0);
      this.shipGroup.add(hullBelly);

      // Upper Hull Deck Bulwarks
      const bulwarkGeo = new THREE.BoxGeometry(15.5, 1.2, 3.6);
      const bulwark = new THREE.Mesh(bulwarkGeo, eerieGlowWood);
      bulwark.position.set(0, 1.0, 0);
      this.shipGroup.add(bulwark);

      // Forecastle (Raised Forward Deck)
      const forecastleGeo = new THREE.BoxGeometry(4.2, 1.6, 3.2);
      const forecastle = new THREE.Mesh(forecastleGeo, woodDark);
      forecastle.position.set(-6.5, 1.8, 0);
      this.shipGroup.add(forecastle);

      // Angled Prow / Cutwater (Beakhead base)
      const prowGeo = new THREE.ConeGeometry(2.4, 6.2, 6);
      prowGeo.rotateZ(Math.PI / 2);
      prowGeo.scale(0.8, 1.0, 0.55);
      const prow = new THREE.Mesh(prowGeo, woodDark);
      prow.position.set(-10.2, 0.7, 0);
      this.shipGroup.add(prow);

      // Massive Bowsprit & Jibboom (Angled long front spar)
      const bowspritGeo = new THREE.CylinderGeometry(0.14, 0.28, 9.5, 8);
      bowspritGeo.rotateZ(Math.PI / 2.65);
      const bowsprit = new THREE.Mesh(bowspritGeo, woodDark);
      bowsprit.position.set(-15.2, 3.2, 0);
      this.shipGroup.add(bowsprit);

      // Figurehead: Spectral Winged Sea-Demon / Skeleton Figure at Prow
      const figureheadGeo = new THREE.ConeGeometry(0.45, 1.8, 5);
      figureheadGeo.rotateZ(Math.PI / 3);
      const figurehead = new THREE.Mesh(figureheadGeo, goldTrim);
      figurehead.position.set(-12.8, 1.8, 0);
      this.shipGroup.add(figurehead);

      // Anchors hanging on port & starboard bows
      for (const side of [-1, 1]) {
        const anchorGroup = new THREE.Group();
        const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), cannonMat);
        const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), goldTrim);
        stock.rotation.z = Math.PI / 2;
        stock.position.y = 0.6;
        const fluke = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 12, Math.PI), cannonMat);
        fluke.position.y = -0.7;

        anchorGroup.add(shank);
        anchorGroup.add(stock);
        anchorGroup.add(fluke);
        anchorGroup.position.set(-7.5, 0.4, side * 1.95);
        anchorGroup.rotation.y = side * 0.25;
        this.shipGroup.add(anchorGroup);
      }

      // ======================================================================
      // 2. STERN CASTLE & GOTHIC TRANSOM (The Dutchman's Signature Tower)
      // ======================================================================
      // Quarterdeck (Lower aft castle)
      const quarterdeckGeo = new THREE.BoxGeometry(5.2, 2.2, 3.4);
      const quarterdeck = new THREE.Mesh(quarterdeckGeo, woodDark);
      quarterdeck.position.set(5.5, 1.8, 0);
      this.shipGroup.add(quarterdeck);

      // Poop Deck (Towering upper aft castle)
      const poopDeckGeo = new THREE.BoxGeometry(4.0, 2.4, 3.1);
      const poopDeck = new THREE.Mesh(poopDeckGeo, woodDark);
      poopDeck.position.set(7.2, 3.4, 0);
      this.shipGroup.add(poopDeck);

      // Gothic Carved Stern Transom (Back wall of captain's cabin)
      const transomGeo = new THREE.BoxGeometry(0.4, 4.4, 3.2);
      const transom = new THREE.Mesh(transomGeo, goldTrim);
      transom.position.set(9.2, 2.8, 0);
      this.shipGroup.add(transom);

      // 6 Glowing Gothic Windows in Stern Gallery
      for (let row = 0; row < 2; row++) {
        for (let col = -1; col <= 1; col++) {
          const windowGeo = new THREE.BoxGeometry(0.1, 0.85, 0.55);
          const win = new THREE.Mesh(windowGeo, cabinWindowMat);
          win.position.set(9.45, 2.2 + row * 1.2, col * 0.85);
          this.shipGroup.add(win);
        }
      }

      // Stern Balcony Gallery Railing
      const balconyGeo = new THREE.BoxGeometry(1.4, 0.35, 3.5);
      const balcony = new THREE.Mesh(balconyGeo, goldTrim);
      balcony.position.set(8.8, 1.4, 0);
      this.shipGroup.add(balcony);

      // Massive Carved Stern Lantern (The Cursed Lamp)
      const sternLantern = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55), lanternFlameMat);
      sternLantern.position.set(10.2, 4.8, 0);
      this.shipGroup.add(sternLantern);

      // Gilded Trim Moldings along Gunwales
      for (const side of [-1, 1]) {
        const molding = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.15, 0.12), goldTrim);
        molding.position.set(0, 1.6, side * 1.82);
        this.shipGroup.add(molding);

        // Deck Railings
        const rail = new THREE.Mesh(new THREE.BoxGeometry(14.8, 0.22, 0.1), woodDark);
        rail.position.set(0, 2.05, side * 1.82);
        this.shipGroup.add(rail);

        // Protruding Cannons (6 per side = 12 total)
        for (let c = -4.5; c <= 3.5; c += 1.6) {
          const portHole = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.15), goldTrim);
          portHole.position.set(c, 0.7, side * 1.88);
          this.shipGroup.add(portHole);

          const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.1, 6), cannonMat);
          barrel.rotateX(side * Math.PI / 2);
          barrel.position.set(c, 0.7, side * 2.2);
          this.shipGroup.add(barrel);
        }
      }

      // ======================================================================
      // 3. MASTS, YARDS, SHROUDS & RIGGING
      // ======================================================================
      const mastData = [
        { x: -4.5, height: 16.5, radius: 0.30, name: 'fore' },
        { x: 0.8,  height: 19.5, radius: 0.35, name: 'main' },
        { x: 6.2,  height: 14.5, radius: 0.26, name: 'mizzen' }
      ];

      mastData.forEach(m => {
        // Multi-stage mast cylinder
        const mastGeo = new THREE.CylinderGeometry(m.radius * 0.65, m.radius, m.height, 8);
        const mast = new THREE.Mesh(mastGeo, woodDark);
        mast.position.set(m.x, m.height / 2 + 0.4, 0);
        // Realistic backward mast rake
        mast.rotation.z = -0.045;
        this.shipGroup.add(mast);

        // Lower Fighting Top (Crow's Nest platform)
        const topGeo = new THREE.CylinderGeometry(1.1, 0.7, 0.75, 8, 1, true);
        const crowTop = new THREE.Mesh(topGeo, goldTrim);
        crowTop.position.set(m.x, m.height * 0.58, 0);
        this.shipGroup.add(crowTop);

        // Upper Fighting Top (Topgallant platform)
        const top2Geo = new THREE.CylinderGeometry(0.8, 0.5, 0.55, 8, 1, true);
        const crowTop2 = new THREE.Mesh(top2Geo, goldTrim);
        crowTop2.position.set(m.x, m.height * 0.84, 0);
        this.shipGroup.add(crowTop2);

        // Lantern hanging under lower crow's nest
        const nestLantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), lanternFlameMat);
        nestLantern.position.set(m.x, m.height * 0.58 - 0.7, 0.8);
        this.shipGroup.add(nestLantern);

        // Standing Rigging: Shrouds / Ratlines (Triangle web on port & starboard)
        for (const side of [-1, 1]) {
          const shroudGroup = new THREE.Group();
          for (let r = -0.8; r <= 0.8; r += 0.4) {
            const ropeGeo = new THREE.CylinderGeometry(0.02, 0.02, m.height * 0.6, 3);
            const rope = new THREE.Mesh(ropeGeo, woodDark);
            rope.position.set(m.x + r * 1.2, m.height * 0.3, side * 1.6);
            shroudGroup.add(rope);
          }
          this.shipGroup.add(shroudGroup);
        }

        // ====================================================================
        // 4. BILLOWED PHANTOM GHOST SAILS (3 tiers per mast)
        // ====================================================================
        const tiers = [
          { yPct: 0.28, w: 8.4, h: 4.2, bow: 1.2 },  // Course
          { yPct: 0.55, w: 6.8, h: 3.6, bow: 0.95 }, // Topsail
          { yPct: 0.80, w: 5.2, h: 2.8, bow: 0.75 }  // Topgallant
        ];

        tiers.forEach((t, tIdx) => {
          const yPos = m.height * t.yPct;

          // Yardarm (horizontal cross spar)
          const yardGeo = new THREE.CylinderGeometry(0.09, 0.15, t.w + 1.2, 6);
          yardGeo.rotateX(Math.PI / 2);
          const yard = new THREE.Mesh(yardGeo, woodDark);
          yard.position.set(m.x, yPos + t.h * 0.48, 0);
          this.shipGroup.add(yard);

          // Billowed Sail Mesh: Curved parametric surface
          const sailGeo = new THREE.PlaneGeometry(t.w, t.h, 16, 12);
          const pos = sailGeo.attributes.position;

          // Deform vertices to create wind-filled billowing arch
          for (let j = 0; j < pos.count; j++) {
            const vy = pos.getY(j);
            const vx = pos.getX(j);
            const normX = 1.0 - Math.abs(vx / (t.w * 0.5));
            const normY = 1.0 - Math.pow(vy / (t.h * 0.5), 2.0);
            const bulge = Math.max(0, normX * normY * t.bow);
            pos.setZ(j, bulge);
          }
          sailGeo.computeVertexNormals();

          const sail = new THREE.Mesh(sailGeo, ghostSailMat);
          sail.position.set(m.x, yPos, 0.35);
          // Angled slightly so sails catch wind from the starboard quarter
          sail.rotation.y = 0.26;
          this.shipGroup.add(sail);

          this.sails.push({
            mesh: sail,
            geo: sailGeo,
            basePos: new Float32Array(pos.array),
            phase: Math.random() * Math.PI * 2,
            speed: 1.2 + tIdx * 0.3
          });
        });
      });

      // Bowsprit Jib / Spritsails (Angled forward triangular sails)
      const jibGeo = new THREE.BufferGeometry();
      const jibVerts = new Float32Array([
        -15.0, 3.2, 0.0,
        -9.0, 1.8, 0.4,
        -9.0, 7.5, 0.0
      ]);
      jibGeo.setAttribute('position', new THREE.BufferAttribute(jibVerts, 3));
      jibGeo.computeVertexNormals();
      const jibSail = new THREE.Mesh(jibGeo, ghostSailMat);
      this.shipGroup.add(jibSail);

      // Forestay Ropes connecting masts
      const stay1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 8.5, 3), woodDark);
      stay1.position.set(-2.0, 13.0, 0);
      stay1.rotation.z = 0.65;
      this.shipGroup.add(stay1);

      const stay2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 7.2, 3), woodDark);
      stay2.position.set(3.5, 12.0, 0);
      stay2.rotation.z = 0.60;
      this.shipGroup.add(stay2);

      // Positioning the Flying Dutchman proudly in the scene
      // Scaled up by 1.35x for massive, imposing presence!
      this.shipGroup.scale.set(1.35, 1.35, 1.35);
      this.shipGroup.position.set(-0.5, 0.1, -1.0);
      this.shipGroup.rotation.y = -0.38; // 3/4 angle showing bow and full starboard sails
      this.scene.add(this.shipGroup);
    }

    createGhostParticles() {
      // 500 supernatural emerald & gold motes drifting in the cursed wind
      const count = 500;
      const geom = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const phases = new Float32Array(count);
      const speeds = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        positions[i * 3 + 0] = (Math.random() - 0.5) * 75;
        positions[i * 3 + 1] = Math.random() * 26 - 1.5;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 55;
        phases[i] = Math.random() * Math.PI * 2;
        speeds[i] = Math.random() * 0.4 + 0.2;
      }

      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const mat = new THREE.PointsMaterial({
        color: 0x00FFBD,
        size: 0.32,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      this.particleSystem = new THREE.Points(geom, mat);
      this.particlePhases = phases;
      this.particleSpeeds = speeds;
      this.scene.add(this.particleSystem);
    }

    createSeaMists() {
      const mistGroup = new THREE.Group();
      const mistGeo = new THREE.PlaneGeometry(90, 28);
      const mistMat = new THREE.MeshBasicMaterial({
        color: 0x062823,
        transparent: true,
        opacity: 0.20,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      for (let i = 0; i < 5; i++) {
        const mist = new THREE.Mesh(mistGeo, mistMat);
        mist.position.set((i - 2) * 14, -0.6 + i * 0.3, (i - 2) * 11 - 3);
        mist.rotation.x = -Math.PI / 2.25;
        mistGroup.add(mist);
      }

      this.scene.add(mistGroup);
      this.mistGroup = mistGroup;
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

    onScroll() {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll > 0) {
        this.scrollProgress = window.scrollY / maxScroll;
      }
    }

    onWindowResize() {
      if (!this.camera || !this.renderer) return;
      const width = window.innerWidth;
      const height = window.innerHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    }

    animate() {
      this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

      const delta = this.clock.getDelta();
      const time = this.clock.getElapsedTime();

      // Smooth mouse lerp
      this.mouseX += (this.targetMouseX - this.mouseX) * 0.045;
      this.mouseY += (this.targetMouseY - this.mouseY) * 0.045;

      if (!this.isReducedMotion) {
        // --- CINEMATIC CAMERA CHOREOGRAPHY ---
        // Smooth scroll transition: as user scrolls down, camera elevates and eases
        const scrollOffsetY = this.scrollProgress * 2.8;
        const scrollOffsetZ = this.scrollProgress * 4.2;

        this.camera.position.x = this.mouseX * 3.8;
        this.camera.position.y = 1.8 - this.mouseY * 1.8 + scrollOffsetY;
        this.camera.position.z = 18.5 + scrollOffsetZ;
        this.camera.lookAt(0, 3.8 + scrollOffsetY * 0.4, 0);

        // --- OCEAN COMPOUND WAVE SIMULATION ---
        if (this.oceanGeometry) {
          const pos = this.oceanGeometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const u = pos.getX(i);
            const v = pos.getZ(i);

            // 4 Wave Octaves (Swelling, rolling, crossing chops)
            const w1 = Math.sin(u * 0.07 + time * 0.95) * 0.75;
            const w2 = Math.cos(v * 0.08 + time * 0.8) * 0.65;
            const w3 = Math.sin((u + v) * 0.05 + time * 0.6) * 0.45;
            const w4 = Math.cos((u - v) * 0.09 + time * 1.1) * 0.3;

            pos.setY(i, this.oceanBaseY[i] + w1 + w2 + w3 + w4);
          }
          pos.needsUpdate = true;
          this.oceanGeometry.computeVertexNormals();
        }

        // --- GHOST SHIP NATURAL BUOYANCY & HYDRODYNAMICS ---
        if (this.shipGroup) {
          // Heave (vertical bobbing in the Caribbean swell)
          this.shipGroup.position.y = 0.1 + Math.sin(time * 0.82) * 0.52;

          // Pitch (fore & aft rocking)
          this.shipGroup.rotation.z = Math.sin(time * 0.72) * 0.052;

          // Roll (side-to-side ocean list)
          this.shipGroup.rotation.x = Math.cos(time * 0.62) * 0.075;

          // Yaw mouse response
          this.shipGroup.rotation.y = -0.38 + this.mouseX * 0.14;

          // --- SAIL WIND FLUTTER ---
          if (this.sails) {
            for (let s = 0; s < this.sails.length; s++) {
              const sail = this.sails[s];
              const pos = sail.geo.attributes.position;
              const base = sail.basePos;
              const freq = sail.speed;

              for (let k = 0; k < pos.count; k++) {
                const ox = base[k * 3 + 0];
                const oy = base[k * 3 + 1];
                const oz = base[k * 3 + 2];
                // Parametric ripple along wind direction
                const ripple = Math.sin(ox * 0.8 + time * freq + sail.phase) * 0.09 * (oz > 0.1 ? 1 : 0.2);
                pos.setZ(k, oz + ripple);
              }
              pos.needsUpdate = true;
            }
          }
        }

        // --- SPECTRAL PARTICLE FIELD ---
        if (this.particleSystem) {
          const pPos = this.particleSystem.geometry.attributes.position;
          for (let p = 0; p < pPos.count; p++) {
            let py = pPos.getY(p) + Math.sin(time + this.particlePhases[p]) * 0.016;
            let px = pPos.getX(p) + Math.cos(time * 0.35 + this.particlePhases[p]) * 0.012;

            if (py > 25) py = -1.5;
            pPos.setY(p, py);
            pPos.setX(p, px);
          }
          pPos.needsUpdate = true;
        }

        // --- LANTERN FLICKERING ---
        for (let l = 0; l < this.lanternLights.length; l++) {
          const item = this.lanternLights[l];
          const flicker = Math.sin(time * item.flickerSpeed + item.phase) * 0.42 +
                          (Math.random() - 0.5) * 0.18;
          item.light.intensity = item.baseIntensity + flicker;
        }

        // --- DRIFTING SEA MIST ---
        if (this.mistGroup) {
          this.mistGroup.position.x = Math.sin(time * 0.18) * 2.8;
          this.mistGroup.position.z = Math.cos(time * 0.14) * 1.5;
        }
      }

      this.renderer.render(this.scene, this.camera);
    }

    destroy() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      window.removeEventListener('resize', this.onWindowResize);
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('touchmove', this.onTouchMove);
      window.removeEventListener('scroll', this.onScroll);

      if (this.renderer) {
        this.renderer.dispose();
      }
    }
  }

  window.FlyingDutchmanEngine = FlyingDutchmanEngine;
})(window);
