/**
 * THE FLYING DUTCHMANN — 3D Cinematic Ghost Ship WebGL Engine
 * (Mirrored in public/ for static asset serving)
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
      this.lights = [];
      this.lanterns = [];

      this.mouseX = 0;
      this.mouseY = 0;
      this.targetMouseX = 0;
      this.targetMouseY = 0;
      this.clock = null;
      this.animationFrameId = null;

      this.isReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.init();
    }

    init() {
      if (typeof THREE === 'undefined') {
        console.warn('[FlyingDutchmanEngine] Three.js not found in global scope.');
        return;
      }

      const width = window.innerWidth;
      const height = window.innerHeight;

      // 1. Scene & Cursed Fog
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x05090B);
      this.scene.fog = new THREE.FogExp2(0x071719, 0.022);

      // 2. Camera Setup
      this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
      this.camera.position.set(0, 3.2, 24);

      // 3. Renderer with antialiasing & tone mapping
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

      // 4. Construct Environment & Ghost Ship
      this.setupLighting();
      this.createOcean();
      this.createFlyingDutchmanShip();
      this.createGhostParticles();
      this.createAtmosphericMists();

      // 5. Interaction Listeners
      window.addEventListener('resize', this.onWindowResize.bind(this), { passive: true });
      window.addEventListener('mousemove', this.onMouseMove.bind(this), { passive: true });
      window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: true });

      // 6. Start Render Loop
      this.animate();
    }

    setupLighting() {
      const ambientLight = new THREE.AmbientLight(0x082b28, 1.4);
      this.scene.add(ambientLight);

      const moonLight = new THREE.DirectionalLight(0x1a4a45, 2.2);
      moonLight.position.set(-18, 30, -10);
      this.scene.add(moonLight);

      const emeraldGlow = new THREE.PointLight(0x00D6A0, 4.5, 45, 1.8);
      emeraldGlow.position.set(0, 5, 2);
      this.scene.add(emeraldGlow);
      this.lights.push({ light: emeraldGlow, baseIntensity: 4.5, flickerSpeed: 3.2, timeOffset: 0.0 });

      const goldLantern = new THREE.PointLight(0xC5A46D, 3.0, 35, 2.0);
      goldLantern.position.set(6, 4.5, 1);
      this.scene.add(goldLantern);
      this.lights.push({ light: goldLantern, baseIntensity: 3.0, flickerSpeed: 2.1, timeOffset: 1.4 });

      const bowLight = new THREE.PointLight(0x087F76, 3.5, 30, 2.0);
      bowLight.position.set(-7, 2, 0);
      this.scene.add(bowLight);
      this.lights.push({ light: bowLight, baseIntensity: 3.5, flickerSpeed: 4.0, timeOffset: 2.8 });
    }

    createOcean() {
      const oceanGeo = new THREE.PlaneGeometry(160, 160, 64, 64);
      oceanGeo.rotateX(-Math.PI / 2);

      const pos = oceanGeo.attributes.position;
      this.oceanBaseY = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        this.oceanBaseY[i] = pos.getY(i);
      }

      const oceanMat = new THREE.MeshStandardMaterial({
        color: 0x071b1d,
        roughness: 0.18,
        metalness: 0.85,
        flatShading: true,
        wireframe: false
      });

      this.oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
      this.oceanMesh.position.set(0, -1.8, -10);
      this.scene.add(this.oceanMesh);
      this.oceanGeometry = oceanGeo;
    }

    createFlyingDutchmanShip() {
      this.shipGroup = new THREE.Group();

      const hullMaterial = new THREE.MeshStandardMaterial({
        color: 0x091414,
        roughness: 0.82,
        metalness: 0.25,
        flatShading: true
      });

      const goldTrimMaterial = new THREE.MeshStandardMaterial({
        color: 0x937840,
        roughness: 0.45,
        metalness: 0.75,
        flatShading: true
      });

      const ghostSailMaterial = new THREE.MeshStandardMaterial({
        color: 0x1d463e,
        emissive: 0x04211c,
        emissiveIntensity: 0.55,
        roughness: 0.7,
        metalness: 0.1,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide
      });

      const lanternMat = new THREE.MeshBasicMaterial({
        color: 0x00FFBC
      });

      // Lower Keel & Main Hull
      const mainHullGeo = new THREE.CylinderGeometry(2.4, 1.2, 14, 8, 1);
      mainHullGeo.rotateZ(Math.PI / 2);
      mainHullGeo.scale(1.0, 0.45, 0.65);
      const mainHull = new THREE.Mesh(mainHullGeo, hullMaterial);
      mainHull.position.set(0, 0, 0);
      this.shipGroup.add(mainHull);

      // Pointed Bow
      const bowGeo = new THREE.ConeGeometry(2.2, 5.5, 7);
      bowGeo.rotateZ(Math.PI / 2);
      bowGeo.scale(0.85, 1.0, 0.6);
      const bow = new THREE.Mesh(bowGeo, hullMaterial);
      bow.position.set(-8.5, 0.5, 0);
      this.shipGroup.add(bow);

      // Bowsprit
      const bowspritGeo = new THREE.CylinderGeometry(0.12, 0.25, 7.5, 6);
      bowspritGeo.rotateZ(Math.PI / 2.6);
      const bowsprit = new THREE.Mesh(bowspritGeo, hullMaterial);
      bowsprit.position.set(-13, 2.5, 0);
      this.shipGroup.add(bowsprit);

      // Stern Castle
      const sternGeo = new THREE.BoxGeometry(4.5, 3.4, 3.2);
      const stern = new THREE.Mesh(sternGeo, hullMaterial);
      stern.position.set(5.5, 1.6, 0);
      this.shipGroup.add(stern);

      // Stern Balcony
      const galleryGeo = new THREE.BoxGeometry(1.6, 2.2, 3.6);
      const gallery = new THREE.Mesh(galleryGeo, goldTrimMaterial);
      gallery.position.set(7.5, 1.8, 0);
      this.shipGroup.add(gallery);

      // Stern Lantern
      const sternLantern = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35), lanternMat);
      sternLantern.position.set(8.5, 3.2, 0);
      this.shipGroup.add(sternLantern);

      // Rails
      const railGeo = new THREE.BoxGeometry(13, 0.25, 0.2);
      const leftRail = new THREE.Mesh(railGeo, goldTrimMaterial);
      leftRail.position.set(-0.5, 1.4, 1.7);
      this.shipGroup.add(leftRail);

      const rightRail = new THREE.Mesh(railGeo, goldTrimMaterial);
      rightRail.position.set(-0.5, 1.4, -1.7);
      this.shipGroup.add(rightRail);

      // Cannon Ports
      for (let i = -4; i <= 3; i += 2) {
        const portL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.2), goldTrimMaterial);
        portL.position.set(i, 0.4, 1.75);
        this.shipGroup.add(portL);

        const portR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.2), goldTrimMaterial);
        portR.position.set(i, 0.4, -1.75);
        this.shipGroup.add(portR);
      }

      // Masts
      const mastConfigs = [
        { x: -4.0, height: 13.5, radius: 0.22 },
        { x: 0.5,  height: 16.0, radius: 0.26 },
        { x: 4.8,  height: 12.0, radius: 0.20 }
      ];

      this.sails = [];

      mastConfigs.forEach(cfg => {
        const mastGeo = new THREE.CylinderGeometry(cfg.radius * 0.7, cfg.radius, cfg.height, 8);
        const mast = new THREE.Mesh(mastGeo, hullMaterial);
        mast.position.set(cfg.x, cfg.height / 2 + 0.5, 0);
        mast.rotation.z = -0.04;
        this.shipGroup.add(mast);

        const nestGeo = new THREE.CylinderGeometry(0.8, 0.5, 0.7, 8, 1, true);
        const nest = new THREE.Mesh(nestGeo, goldTrimMaterial);
        nest.position.set(cfg.x, cfg.height * 0.75, 0);
        this.shipGroup.add(nest);

        const nestLight = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), lanternMat);
        nestLight.position.set(cfg.x, cfg.height * 0.75 - 0.6, 0.6);
        this.shipGroup.add(nestLight);

        const sailTiers = [
          { yRel: 0.32, width: 6.8, height: 3.2, curve: 0.8 },
          { yRel: 0.58, width: 5.6, height: 2.8, curve: 0.7 },
          { yRel: 0.82, width: 4.2, height: 2.2, curve: 0.55 }
        ];

        sailTiers.forEach(st => {
          const yPos = cfg.height * st.yRel;
          const yardGeo = new THREE.CylinderGeometry(0.08, 0.12, st.width + 0.8, 6);
          yardGeo.rotateX(Math.PI / 2);
          const yard = new THREE.Mesh(yardGeo, hullMaterial);
          yard.position.set(cfg.x, yPos + st.height * 0.45, 0);
          this.shipGroup.add(yard);

          const sailGeo = new THREE.PlaneGeometry(st.width, st.height, 12, 10);
          const posAttr = sailGeo.attributes.position;
          for (let j = 0; j < posAttr.count; j++) {
            const vy = posAttr.getY(j);
            const vx = posAttr.getX(j);
            const distFromCenter = 1.0 - Math.abs(vx / (st.width * 0.5));
            const verticalProfile = 1.0 - Math.pow(vy / (st.height * 0.5), 2.0);
            const bulge = distFromCenter * verticalProfile * st.curve;
            posAttr.setZ(j, bulge);
          }
          sailGeo.computeVertexNormals();

          const sail = new THREE.Mesh(sailGeo, ghostSailMaterial);
          sail.position.set(cfg.x, yPos, 0.25);
          sail.rotation.y = 0.22;
          this.shipGroup.add(sail);
          this.sails.push({ mesh: sail, baseY: yPos, phase: Math.random() * Math.PI * 2 });
        });
      });

      this.shipGroup.position.set(-1.0, 0.2, 0);
      this.shipGroup.rotation.y = -0.32;
      this.scene.add(this.shipGroup);
    }

    createGhostParticles() {
      const particleCount = 450;
      const geom = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const scales = new Float32Array(particleCount);
      const phases = new Float32Array(particleCount);

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 0] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 1] = Math.random() * 22 - 2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 45;
        scales[i] = Math.random() * 1.5 + 0.5;
        phases[i] = Math.random() * Math.PI * 2;
      }

      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const particleMat = new THREE.PointsMaterial({
        color: 0x00D6A0,
        size: 0.28,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      this.particleSystem = new THREE.Points(geom, particleMat);
      this.particlePhases = phases;
      this.scene.add(this.particleSystem);
    }

    createAtmosphericMists() {
      const mistGroup = new THREE.Group();
      const mistGeo = new THREE.PlaneGeometry(80, 24);
      const mistMat = new THREE.MeshBasicMaterial({
        color: 0x08332f,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      for (let i = 0; i < 4; i++) {
        const mist = new THREE.Mesh(mistGeo, mistMat);
        mist.position.set((i - 1.5) * 12, -0.5 + i * 0.4, (i - 1.5) * 10 - 2);
        mist.rotation.x = -Math.PI / 2.3;
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

      this.mouseX += (this.targetMouseX - this.mouseX) * 0.04;
      this.mouseY += (this.targetMouseY - this.mouseY) * 0.04;

      if (!this.isReducedMotion) {
        this.camera.position.x = this.mouseX * 3.5;
        this.camera.position.y = 3.2 - this.mouseY * 2.0;
        this.camera.lookAt(0, 3.5, 0);

        if (this.oceanGeometry) {
          const pos = this.oceanGeometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const u = pos.getX(i);
            const v = pos.getZ(i);
            const wave = Math.sin(u * 0.08 + time * 0.9) * 0.65 +
                         Math.cos(v * 0.09 + time * 0.7) * 0.55 +
                         Math.sin((u + v) * 0.05 + time * 0.5) * 0.35;
            pos.setY(i, this.oceanBaseY[i] + wave);
          }
          pos.needsUpdate = true;
          this.oceanGeometry.computeVertexNormals();
        }

        if (this.shipGroup) {
          this.shipGroup.position.y = 0.2 + Math.sin(time * 0.85) * 0.45;
          this.shipGroup.rotation.z = Math.sin(time * 0.75) * 0.045;
          this.shipGroup.rotation.x = Math.cos(time * 0.65) * 0.065;
          this.shipGroup.rotation.y = -0.32 + this.mouseX * 0.12;

          if (this.sails) {
            for (let s = 0; s < this.sails.length; s++) {
              const sailObj = this.sails[s];
              sailObj.mesh.rotation.z = Math.sin(time * 1.5 + sailObj.phase) * 0.02;
            }
          }
        }

        if (this.particleSystem) {
          const pPos = this.particleSystem.geometry.attributes.position;
          for (let p = 0; p < pPos.count; p++) {
            let py = pPos.getY(p) + Math.sin(time + this.particlePhases[p]) * 0.012;
            let px = pPos.getX(p) + Math.cos(time * 0.4 + this.particlePhases[p]) * 0.008;

            if (py > 20) py = -2;
            pPos.setY(p, py);
            pPos.setX(p, px);
          }
          pPos.needsUpdate = true;
        }

        for (let l = 0; l < this.lights.length; l++) {
          const item = this.lights[l];
          const flicker = Math.sin(time * item.flickerSpeed + item.timeOffset) * 0.35 +
                          (Math.random() - 0.5) * 0.15;
          item.light.intensity = item.baseIntensity + flicker;
        }

        if (this.mistGroup) {
          this.mistGroup.position.x = Math.sin(time * 0.2) * 2.0;
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

      if (this.renderer) {
        this.renderer.dispose();
      }
    }
  }

  window.FlyingDutchmanEngine = FlyingDutchmanEngine;
})(window);
