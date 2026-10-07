/**
 * Aurora Borealis & Volumetric Light Rays WebGL Background Engine
 * ABES Student Profile Viewer
 * 
 * High-performance native WebGL pipeline featuring:
 * - Pure Black base (#030303) in Dark Mode / Porcelain (#f4f4f0) in Light Mode
 * - Multi-layered Aurora Borealis ribbons with vertical folds and chromatic dispersion
 *   (Emerald, Teal, Cyan, Electric Blue, Violet, Magenta accents)
 * - Integrated Volumetric Light Rays scattering through the atmospheric curtain folds
 * - Interactive pointer tracking with smooth inertia
 * - Mouse velocity wake (streaming fluid turbulence following cursor speed)
 * - Click Impacts ("Aurora Impact" ring buffer generating expanding circular shockwaves and luminous blooms)
 * - Full prefers-reduced-motion and high-DPI clamping
 */

'use strict';

(function(window) {
  const VERTEX_SHADER_SOURCE = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

  const FRAGMENT_SHADER_SOURCE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform float iTime;
uniform vec2  iResolution;

// Volumetric ray uniforms
uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;

// Interaction & fluid uniforms
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float uVelocity;
uniform vec4  uImpacts[4]; // vec4(x, y, age, intensity)

// Atmosphere & theme uniforms
uniform float noiseAmount;
uniform float distortion;
uniform float lightMode;

varying vec2 vUv;

// Pseudo-random hash
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// 2D Noise
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// 2-octave FBM for organic ribbon turbulence
float fbm(vec2 p) {
  float v = 0.0;
  v += 0.65 * noise(p);
  p = p * 2.02 + vec2(1.4, -0.8);
  v += 0.35 * noise(p);
  return v;
}

// Single click impact wave evaluation (unrolled for WebGL 1.0 compatibility)
void evalImpact(vec4 imp, vec2 p, float aspect, inout vec2 totalDisp, inout float totalBloom) {
  if (imp.w > 0.005 && imp.z >= 0.0) {
    vec2 cPos = vec2(imp.x * aspect, imp.y);
    vec2 toClick = p - cPos;
    float dist = length(toClick);
    float age = imp.z;
    float intensity = imp.w;
    
    // Wavefront expands at constant speed
    float waveRadius = age * 0.55;
    float waveWidth = 0.08 + age * 0.04;
    float distFromCrest = dist - waveRadius;
    float ring = exp(-pow(distFromCrest / max(waveWidth, 0.001), 2.0));
    float decay = exp(-age * 1.85);
    
    // Ripple oscillation profile creates fluid compression wave
    float ripple = sin(distFromCrest * 22.0) * ring * decay;
    vec2 pushDir = (dist > 0.001) ? (toClick / dist) : vec2(0.0, 1.0);
    totalDisp += pushDir * ripple * 0.075 * intensity;
    totalBloom += ring * decay * intensity;
  }
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float aspect = iResolution.x / iResolution.y;
  vec2 uv = fragCoord.xy / iResolution.xy;
  vec2 p = vec2(uv.x * aspect, uv.y);

  // --------------------------------------------------------------------------
  // 1. Mouse Interaction & Velocity Fluid Wake
  // --------------------------------------------------------------------------
  vec2 mPos = vec2(mousePos.x * aspect, mousePos.y);
  vec2 toMouse = p - mPos;
  float mDist = length(toMouse);
  float mFactor = exp(-mDist * 3.4);
  vec2 mouseWake = (mDist > 0.001 ? (toMouse / mDist) : vec2(0.0)) * mFactor * (0.015 + uVelocity * 0.055);

  // --------------------------------------------------------------------------
  // 2. Click Impacts ("Aurora Impact" shockwaves)
  // --------------------------------------------------------------------------
  vec2 clickDisp = vec2(0.0);
  float impactBloom = 0.0;
  evalImpact(uImpacts[0], p, aspect, clickDisp, impactBloom);
  evalImpact(uImpacts[1], p, aspect, clickDisp, impactBloom);
  evalImpact(uImpacts[2], p, aspect, clickDisp, impactBloom);
  evalImpact(uImpacts[3], p, aspect, clickDisp, impactBloom);

  vec2 displacedP = p + mouseWake + clickDisp;
  float dispX = displacedP.x;
  float dispY = displacedP.y;

  // --------------------------------------------------------------------------
  // 3. Layered Aurora Borealis Curtains & Ribbons
  // --------------------------------------------------------------------------
  
  // Layer 1: Dominant Emerald, Teal & Indigo Aurora Curtain
  float wave1 = sin(dispX * 1.6 + iTime * 0.28 * raysSpeed) * 0.15 +
                cos(dispX * 3.4 - iTime * 0.20 * raysSpeed) * 0.08 +
                sin(dispX * 0.7 + iTime * 0.12 * raysSpeed) * 0.10;
  float base1 = 0.35 + wave1;
  float h1 = dispY - base1;

  // Vertical folds (crests of the draped curtain)
  float folds1 = sin(dispX * 12.0 + sin(dispY * 4.0 + iTime * 0.40 * raysSpeed) * 2.5 + iTime * 0.35 * raysSpeed);
  folds1 = pow(0.5 + 0.5 * folds1, 2.2);

  float density1 = 0.0;
  if (h1 > 0.0) {
    density1 = smoothstep(0.0, 0.07, h1) * exp(-h1 * 2.5) * (0.35 + 0.65 * folds1);
  }

  vec3 colEmerald = vec3(0.05, 0.90, 0.55);
  vec3 colCyan = vec3(0.06, 0.80, 0.92);
  vec3 colIndigo = vec3(0.36, 0.26, 0.88);
  vec3 color1 = mix(colEmerald, colCyan, clamp(h1 * 2.2, 0.0, 1.0));
  color1 = mix(color1, colIndigo, clamp((h1 - 0.28) * 2.2, 0.0, 1.0));

  // Layer 2: Slanted Cyan, Purple & Magenta Ribbon
  float s2 = dispX * 0.95 + dispY * 0.35;
  float wave2 = sin(s2 * 2.0 - iTime * 0.24 * raysSpeed) * 0.18 +
                cos(dispX * 4.0 + iTime * 0.32 * raysSpeed) * 0.07;
  float base2 = 0.44 + wave2;
  float h2 = dispY - base2;

  float folds2 = sin(s2 * 15.0 + cos(dispY * 4.5 - iTime * 0.38 * raysSpeed) * 2.8 + iTime * 0.42 * raysSpeed);
  folds2 = pow(0.5 + 0.5 * folds2, 2.5);

  float density2 = 0.0;
  if (h2 > 0.0) {
    density2 = smoothstep(0.0, 0.08, h2) * exp(-h2 * 2.1) * (0.30 + 0.70 * folds2);
  }

  vec3 colElecCyan = vec3(0.08, 0.75, 0.98);
  vec3 colPurple = vec3(0.60, 0.24, 0.95);
  vec3 colMagenta = vec3(0.92, 0.22, 0.65);
  vec3 color2 = mix(colElecCyan, colPurple, clamp(h2 * 2.0, 0.0, 1.0));
  color2 = mix(color2, colMagenta, clamp((h2 - 0.32) * 2.5, 0.0, 1.0));

  // Layer 3: High-Atmosphere Ethereal Ambient Veil
  float wave3 = sin(dispX * 1.2 + iTime * 0.16 * raysSpeed) * 0.14 +
                cos(dispX * 2.2 - iTime * 0.14 * raysSpeed) * 0.08;
  float base3 = 0.30 + wave3;
  float h3 = dispY - base3;

  float density3 = 0.0;
  if (h3 > 0.0) {
    float f = fbm(vec2(dispX * 1.4 + iTime * 0.05, dispY * 1.2 - iTime * 0.08));
    density3 = smoothstep(0.0, 0.12, h3) * exp(-h3 * 1.7) * 0.35 * (0.45 + 0.55 * f);
  }
  vec3 color3 = mix(vec3(0.06, 0.65, 0.75), vec3(0.42, 0.25, 0.85), clamp(h3 * 1.6, 0.0, 1.0));

  // Combined Aurora Energy
  vec3 auroraColor = color1 * density1 * 1.25 + color2 * density2 * 1.15 + color3 * density3 * 0.75;
  float auroraDensity = density1 + density2 + density3;

  // --------------------------------------------------------------------------
  // 4. Volumetric Light Rays (Scattering through Aurora Folds)
  // --------------------------------------------------------------------------
  vec2 rOrigin = rayPos;
  vec2 toRay = displacedP - rOrigin;
  vec2 toRayDir = normalize(toRay);

  vec2 currentRayDir = normalize(rayDir);
  if (mouseInfluence > 0.0) {
    vec2 mouseTargetDir = normalize(mPos - rOrigin);
    currentRayDir = normalize(mix(currentRayDir, mouseTargetDir, mouseInfluence));
  }

  float cosAngle = dot(toRayDir, currentRayDir);
  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(toRay) * 3.5) * 0.15;
  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

  float rayDist = length(toRay);
  float maxRayDist = rayLength;
  float lengthFalloff = clamp((maxRayDist - rayDist) / maxRayDist, 0.0, 1.0);
  float fadeFalloff = clamp((fadeDistance - rayDist) / fadeDistance, 0.25, 1.0);

  float pulse = pulsating > 0.5 ? (0.88 + 0.12 * sin(iTime * raysSpeed * 2.2)) : 1.0;

  float rayAngle = atan(toRay.y, toRay.x);
  float streaks = (0.5 + 0.5 * sin(rayAngle * 24.0 + iTime * raysSpeed * 0.8)) *
                  (0.5 + 0.5 * cos(-rayAngle * 16.0 + iTime * raysSpeed * 0.6));
  streaks = pow(streaks, 1.8);

  float rayStrength = streaks * lengthFalloff * fadeFalloff * spreadFactor * pulse;
  vec3 rayScattered = raysColor * rayStrength * (0.35 + auroraDensity * 1.5);

  // --------------------------------------------------------------------------
  // 5. Click Bloom & Composition
  // --------------------------------------------------------------------------
  vec3 bloomRgb = vec3(0.08, 0.92, 0.82) * (impactBloom * 0.65) + 
                  vec3(0.68, 0.32, 0.96) * (impactBloom * 0.45);

  // Dark Mode Composition: Pure Vantablack Base (#030303)
  vec3 baseDark = vec3(0.0118, 0.0118, 0.0118);
  vec3 darkScene = baseDark + auroraColor + rayScattered + bloomRgb;

  // Vignette
  vec2 vigCoord = (uv - 0.5) * vec2(aspect, 1.0);
  float vignette = smoothstep(1.35, 0.45, length(vigCoord));
  darkScene *= (0.72 + 0.28 * vignette);

  // Subtle film grain
  if (noiseAmount > 0.0) {
    float n = (hash(gl_FragCoord.xy + fract(iTime * 7.13)) - 0.5) * noiseAmount;
    darkScene += n;
  }

  // Saturation
  if (saturation != 1.0) {
    float lum = dot(darkScene, vec3(0.299, 0.587, 0.114));
    darkScene = mix(vec3(lum), darkScene, saturation);
  }

  // Light Mode Composition: Clean Porcelain Base (#f4f4f0) with Soft Pastel Inks
  vec3 lightBase = vec3(0.957, 0.957, 0.941);
  vec3 pastelMint = vec3(0.16, 0.78, 0.68);
  vec3 pastelCyan = vec3(0.20, 0.68, 0.88);
  vec3 pastelViolet = vec3(0.58, 0.45, 0.88);

  vec3 lightAurora = pastelMint * density1 * 0.40 +
                     pastelCyan * density2 * 0.35 +
                     pastelViolet * density3 * 0.28;

  float lightEnergy = clamp(auroraDensity * 0.32 + rayStrength * 0.18 + impactBloom * 0.32, 0.0, 0.42);
  vec3 lightTint = mix(pastelMint, pastelViolet, clamp(uv.y * 1.1, 0.0, 1.0));
  vec3 lightScene = mix(lightBase, lightTint, lightEnergy);
  lightScene = mix(lightScene, lightBase - lightAurora * 0.18, 0.5);

  // Smooth interpolation between Dark and Light mode shaders
  vec3 finalColor = mix(darkScene, lightScene, clamp(lightMode, 0.0, 1.0));

  fragColor = vec4(finalColor, 1.0);
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}
`;

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1];
  }

  function getAnchorAndDir(origin, aspect) {
    const outside = 0.15;
    switch (origin) {
      case 'top-left':
        return { anchor: [0.1 * aspect, 1.0 + outside], dir: [0.2, -1.0] };
      case 'top-right':
        return { anchor: [0.9 * aspect, 1.0 + outside], dir: [-0.2, -1.0] };
      case 'left':
        return { anchor: [-outside, 0.5], dir: [1.0, 0.0] };
      case 'right':
        return { anchor: [aspect + outside, 0.5], dir: [-1.0, 0.0] };
      default: // "top-center"
        return { anchor: [0.5 * aspect, 1.0 + outside], dir: [0.0, -1.0] };
    }
  }

  class LightRaysEngine {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.options = Object.assign({
        raysOrigin: 'top-center',
        raysColor: '#dbeafe', // Restrained cool-white luminous tone for Dark Mode
        raysColorLight: '#7c3aed', // Elegant soft lavender for Light Mode
        raysSpeed: 1.0,
        lightSpread: 1.15,
        rayLength: 2.2,
        pulsating: true,
        fadeDistance: 1.8,
        saturation: 1.0,
        followMouse: true,
        mouseInfluence: 0.22,
        noiseAmount: 0.015,
        distortion: 0.045,
        lightMode: false
      }, options);

      this.gl = null;
      this.program = null;
      this.uniforms = {};
      this.animationId = null;
      this.startTime = performance.now();
      this.lastFrameTime = this.startTime;

      // Mouse tracking & velocity
      this.mouse = { x: 0.5, y: 0.5 };
      this.smoothMouse = { x: 0.5, y: 0.5 };
      this.lastMouse = { x: 0.5, y: 0.5 };
      this.lastMouseMoveTime = this.startTime;
      this.velocity = 0;
      this.smoothVelocity = 0;

      // Theme interpolation
      this.targetLightMode = this.options.lightMode ? 1.0 : 0.0;
      this.currentLightMode = this.targetLightMode;

      // Click Impacts ("Aurora Impact") ring buffer
      this.impacts = [
        { x: 0.5, y: 0.5, age: -1.0, intensity: 0.0 },
        { x: 0.5, y: 0.5, age: -1.0, intensity: 0.0 },
        { x: 0.5, y: 0.5, age: -1.0, intensity: 0.0 },
        { x: 0.5, y: 0.5, age: -1.0, intensity: 0.0 }
      ];
      this.impactIndex = 0;
      this.impactsData = new Float32Array(16); // Zero allocation per frame

      this.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;
      this.isReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.onMouseMove = this.onMouseMove.bind(this);
      this.onResize = this.onResize.bind(this);
      this.render = this.render.bind(this);

      this.init();
    }

    init() {
      const gl = this.canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance'
      }) || this.canvas.getContext('experimental-webgl');

      if (!gl) {
        console.warn('[LightRays] WebGL not supported on this device.');
        return;
      }
      this.gl = gl;

      // Compile vertex shader
      const vertShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertShader, VERTEX_SHADER_SOURCE);
      gl.compileShader(vertShader);
      if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
        console.error('[LightRays] Vertex shader compilation failed:', gl.getShaderInfoLog(vertShader));
        return;
      }

      // Compile fragment shader
      const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragShader, FRAGMENT_SHADER_SOURCE);
      gl.compileShader(fragShader);
      if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
        console.error('[LightRays] Fragment shader compilation failed:', gl.getShaderInfoLog(fragShader));
        return;
      }

      // Link program
      const program = gl.createProgram();
      gl.attachShader(program, vertShader);
      gl.attachShader(program, fragShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('[LightRays] Program link failed:', gl.getProgramInfoLog(program));
        return;
      }
      this.program = program;
      gl.useProgram(program);

      // Create full-screen triangle buffer [-1, -1, 3, -1, -1, 3]
      const triangleVertices = new Float32Array([
        -1.0, -1.0,
         3.0, -1.0,
        -1.0,  3.0
      ]);
      const vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);

      const posAttrib = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(posAttrib);
      gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

      // Retrieve uniform locations
      const uniformNames = [
        'iTime', 'iResolution', 'rayPos', 'rayDir', 'raysColor',
        'raysSpeed', 'lightSpread', 'rayLength', 'pulsating',
        'fadeDistance', 'saturation', 'mousePos', 'mouseInfluence',
        'uVelocity', 'noiseAmount', 'distortion', 'lightMode'
      ];
      uniformNames.forEach(name => {
        this.uniforms[name] = gl.getUniformLocation(program, name);
      });
      this.uniforms.uImpacts = gl.getUniformLocation(program, 'uImpacts[0]') || gl.getUniformLocation(program, 'uImpacts');

      // Set initial uniform values
      this.updateStaticUniforms();

      // Listeners
      window.addEventListener('resize', this.onResize);
      if (this.options.followMouse && !this.isTouch && !this.isReducedMotion) {
        window.addEventListener('mousemove', this.onMouseMove, { passive: true });
      }

      this.onResize();

      // Start animation loop
      this.animationId = requestAnimationFrame(this.render);
    }

    updateStaticUniforms() {
      const gl = this.gl;
      if (!gl || !this.program) return;
      gl.useProgram(this.program);

      const color = this.options.lightMode ? this.options.raysColorLight : this.options.raysColor;
      const rgb = hexToRgb(color);

      gl.uniform3fv(this.uniforms.raysColor, rgb);
      gl.uniform1f(this.uniforms.raysSpeed, this.isReducedMotion ? 0.3 : this.options.raysSpeed);
      gl.uniform1f(this.uniforms.lightSpread, this.options.lightSpread);
      gl.uniform1f(this.uniforms.rayLength, this.options.rayLength);
      gl.uniform1f(this.uniforms.pulsating, (this.options.pulsating && !this.isReducedMotion) ? 1.0 : 0.0);
      gl.uniform1f(this.uniforms.fadeDistance, this.options.fadeDistance);
      gl.uniform1f(this.uniforms.saturation, this.options.saturation);
      gl.uniform1f(this.uniforms.mouseInfluence, (this.options.mouseInfluence && !this.isReducedMotion) ? this.options.mouseInfluence : 0.0);
      gl.uniform1f(this.uniforms.noiseAmount, this.options.noiseAmount);
      gl.uniform1f(this.uniforms.distortion, this.options.distortion);
    }

    onMouseMove(e) {
      const now = performance.now();
      const x = e.clientX / window.innerWidth;
      const y = 1.0 - (e.clientY / window.innerHeight);

      const dt = Math.max((now - this.lastMouseMoveTime) * 0.001, 0.001);
      const dx = x - this.lastMouse.x;
      const dy = y - this.lastMouse.y;
      const dist = Math.hypot(dx, dy);

      const instSpeed = dist / dt;
      this.velocity = Math.min(this.velocity * 0.4 + instSpeed * 0.6, 3.5);

      this.mouse.x = x;
      this.mouse.y = y;
      this.lastMouse.x = x;
      this.lastMouse.y = y;
      this.lastMouseMoveTime = now;
    }

    onResize() {
      if (!this.gl || !this.program) return;
      const gl = this.gl;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const wCSS = window.innerWidth;
      const hCSS = window.innerHeight;
      const w = Math.round(wCSS * dpr);
      const h = Math.round(hCSS * dpr);

      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }

      gl.viewport(0, 0, w, h);
      gl.useProgram(this.program);
      gl.uniform2f(this.uniforms.iResolution, w, h);

      const aspect = w / h;
      const { anchor, dir } = getAnchorAndDir(this.options.raysOrigin, aspect);
      gl.uniform2fv(this.uniforms.rayPos, anchor);
      gl.uniform2fv(this.uniforms.rayDir, dir);
    }

    setTheme(theme) {
      this.options.lightMode = (theme === 'light');
      this.targetLightMode = this.options.lightMode ? 1.0 : 0.0;
      this.updateStaticUniforms();
    }

    /**
     * Trigger an Aurora Impact localized shockwave at screen coordinates
     * @param {number} clientX - Screen X position
     * @param {number} clientY - Screen Y position
     * @param {number} [intensity=1.0] - Impact shockwave magnitude
     */
    triggerImpact(clientX, clientY, intensity = 1.0) {
      if (!this.gl || !this.program) return;
      const x = clientX / window.innerWidth;
      const y = 1.0 - (clientY / window.innerHeight);

      const imp = this.impacts[this.impactIndex];
      imp.x = x;
      imp.y = y;
      imp.age = 0.0;
      imp.intensity = this.isReducedMotion ? 0.35 : intensity;

      this.impactIndex = (this.impactIndex + 1) % this.impacts.length;
    }

    render(now) {
      if (!this.gl || !this.program) return;
      const gl = this.gl;

      const dt = Math.min((now - this.lastFrameTime) * 0.001, 0.1);
      this.lastFrameTime = now;
      const elapsed = (now - this.startTime) * 0.001;

      gl.useProgram(this.program);
      gl.uniform1f(this.uniforms.iTime, elapsed);

      // Smooth mouse inertia & velocity friction decay
      this.velocity *= Math.exp(-dt * 4.0);
      this.smoothVelocity += (this.velocity - this.smoothVelocity) * Math.min(dt * 8.0, 1.0);

      const mouseLerp = Math.min(dt * 6.0, 1.0);
      this.smoothMouse.x += (this.mouse.x - this.smoothMouse.x) * mouseLerp;
      this.smoothMouse.y += (this.mouse.y - this.smoothMouse.y) * mouseLerp;

      gl.uniform2f(this.uniforms.mousePos, this.smoothMouse.x, this.smoothMouse.y);
      gl.uniform1f(this.uniforms.uVelocity, this.smoothVelocity);

      // Smooth theme transitions
      const themeLerp = Math.min(dt * 5.0, 1.0);
      this.currentLightMode += (this.targetLightMode - this.currentLightMode) * themeLerp;
      gl.uniform1f(this.uniforms.lightMode, this.currentLightMode);

      // Update and upload Click Impacts
      for (let i = 0; i < 4; i++) {
        const imp = this.impacts[i];
        if (imp.age >= 0.0) {
          imp.age += dt * (this.isReducedMotion ? 0.6 : 1.15);
          if (imp.age > 2.2) {
            imp.age = -1.0;
            imp.intensity = 0.0;
          }
        }
        this.impactsData[i * 4 + 0] = imp.x;
        this.impactsData[i * 4 + 1] = imp.y;
        this.impactsData[i * 4 + 2] = imp.age;
        this.impactsData[i * 4 + 3] = imp.intensity;
      }
      if (this.uniforms.uImpacts) {
        gl.uniform4fv(this.uniforms.uImpacts, this.impactsData);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.animationId = requestAnimationFrame(this.render);
    }

    destroy() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('mousemove', this.onMouseMove);

      if (this.gl) {
        const loseExt = this.gl.getExtension('WEBGL_lose_context');
        if (loseExt) {
          loseExt.loseContext();
        }
      }
      this.gl = null;
      this.program = null;
    }
  }

  // Expose global initializer
  window.LightRaysEngine = LightRaysEngine;
})(window);
