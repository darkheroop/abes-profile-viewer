/**
 * LightRays WebGL Background Engine
 * ABES Student Profile Viewer
 * 
 * Based on the reference WebGL implementation (ReactBits / OGL / Superdesign)
 * Renders cinematic atmospheric volumetric light rays via GPU fragment shader
 * Supports mouse-reactive ray direction, smooth inertia, and dark/light mode adaptation.
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

  const FRAGMENT_SHADER_SOURCE = `precision highp float;

uniform float iTime;
uniform vec2  iResolution;

uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;
uniform float lightMode;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);

  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
  
  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  
  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float pulse = pulsating > 0.5 ? (0.88 + 0.12 * sin(iTime * speed * 2.0)) : 1.0;

  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0, 1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  
  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 rays1 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349,
                           1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234,
                           1.1 * raysSpeed);

  fragColor = rays1 * 0.5 + rays2 * 0.4;

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
  }

  float brightness = 1.0 - (coord.y / iResolution.y);
  fragColor.x *= 0.1 + brightness * 0.8;
  fragColor.y *= 0.3 + brightness * 0.6;
  fragColor.z *= 0.5 + brightness * 0.5;

  if (saturation != 1.0) {
    float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
    fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
  }

  fragColor.rgb *= raysColor;

  if (lightMode > 0.5) {
    vec3 mapped = vec3(1.0) - exp(-max(fragColor.rgb, vec3(0.0)) * 1.35);
    float energy = clamp(max(mapped.r, max(mapped.g, mapped.b)), 0.0, 1.0);
    vec3 hue = mapped / max(energy, 0.0001);
    vec3 ink = mix(hue * 0.25, hue * 0.72, energy);
    fragColor = vec4(mix(vec3(0.96, 0.96, 0.94), ink, energy * 0.6), energy * 0.75);
  }
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

  function getAnchorAndDir(origin, w, h) {
    const outside = 0.2;
    switch (origin) {
      case 'top-left':
        return { anchor: [0, -outside * h], dir: [0, 1] };
      case 'top-right':
        return { anchor: [w, -outside * h], dir: [0, 1] };
      case 'left':
        return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] };
      case 'right':
        return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] };
      case 'bottom-left':
        return { anchor: [0, (1 + outside) * h], dir: [0, -1] };
      case 'bottom-center':
        return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] };
      case 'bottom-right':
        return { anchor: [w, (1 + outside) * h], dir: [0, -1] };
      default: // "top-center"
        return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
    }
  }

  class LightRaysEngine {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.options = Object.assign({
        raysOrigin: 'top-center',
        raysColor: '#dbeafe', // Subtle cool-white / cyan-tinted atmospheric ray for Dark Mode
        raysColorLight: '#8b5cf6', // Soft violet-tinted atmospheric ray for Light Mode
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
        lightMode: false
      }, options);

      this.gl = null;
      this.program = null;
      this.uniforms = {};
      this.animationId = null;
      this.startTime = performance.now();

      this.mouse = { x: 0.5, y: 0.5 };
      this.smoothMouse = { x: 0.5, y: 0.5 };
      this.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;
      this.isReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.onMouseMove = this.onMouseMove.bind(this);
      this.onResize = this.onResize.bind(this);
      this.render = this.render.bind(this);

      this.init();
    }

    init() {
      const gl = this.canvas.getContext('webgl', {
        alpha: true,
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
        'noiseAmount', 'distortion', 'lightMode'
      ];
      uniformNames.forEach(name => {
        this.uniforms[name] = gl.getUniformLocation(program, name);
      });

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
      gl.uniform1f(this.uniforms.raysSpeed, this.isReducedMotion ? 0.2 : this.options.raysSpeed);
      gl.uniform1f(this.uniforms.lightSpread, this.options.lightSpread);
      gl.uniform1f(this.uniforms.rayLength, this.options.rayLength);
      gl.uniform1f(this.uniforms.pulsating, (this.options.pulsating && !this.isReducedMotion) ? 1.0 : 0.0);
      gl.uniform1f(this.uniforms.fadeDistance, this.options.fadeDistance);
      gl.uniform1f(this.uniforms.saturation, this.options.saturation);
      gl.uniform1f(this.uniforms.mouseInfluence, (this.options.mouseInfluence && !this.isReducedMotion) ? this.options.mouseInfluence : 0.0);
      gl.uniform1f(this.uniforms.noiseAmount, this.options.noiseAmount);
      gl.uniform1f(this.uniforms.distortion, this.options.distortion);
      gl.uniform1f(this.uniforms.lightMode, this.options.lightMode ? 1.0 : 0.0);
    }

    onMouseMove(e) {
      this.mouse.x = e.clientX / window.innerWidth;
      this.mouse.y = e.clientY / window.innerHeight;
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

      const { anchor, dir } = getAnchorAndDir(this.options.raysOrigin, w, h);
      gl.uniform2fv(this.uniforms.rayPos, anchor);
      gl.uniform2fv(this.uniforms.rayDir, dir);
    }

    setTheme(theme) {
      this.options.lightMode = (theme === 'light');
      this.updateStaticUniforms();
    }

    render(now) {
      if (!this.gl || !this.program) return;
      const gl = this.gl;

      const elapsed = (now - this.startTime) * 0.001;
      gl.useProgram(this.program);
      gl.uniform1f(this.uniforms.iTime, elapsed);

      if (this.options.followMouse && this.options.mouseInfluence > 0 && !this.isTouch && !this.isReducedMotion) {
        // Smooth inertia lerp (0.92 retention)
        const smoothing = 0.92;
        this.smoothMouse.x = this.smoothMouse.x * smoothing + this.mouse.x * (1 - smoothing);
        this.smoothMouse.y = this.smoothMouse.y * smoothing + this.mouse.y * (1 - smoothing);
        gl.uniform2f(this.uniforms.mousePos, this.smoothMouse.x, this.smoothMouse.y);
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
