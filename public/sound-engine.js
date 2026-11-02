/**
 * THE FLYING DUTCHMANN — Procedural Nautical Sound Engine
 * Synthesized with Web Audio API (Zero external audio dependencies)
 * 
 * Complies with browser autoplay policies:
 * - Starts muted by default
 * - Enabled cleanly via header toggle or user interaction
 */

'use strict';

(function(window) {
  class NauticalSoundEngine {
    constructor() {
      this.ctx = null;
      this.isMuted = true;
      this.masterGain = null;
      this.ambientGain = null;
      this.isAmbientPlaying = false;
    }

    init() {
      if (this.ctx) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      } catch (e) {
        console.warn('[SoundEngine] Web Audio API unavailable:', e);
      }
    }

    toggleMute() {
      this.init();
      if (!this.ctx) return false;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      this.isMuted = !this.isMuted;
      const targetGain = this.isMuted ? 0 : 0.85;
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
      }

      if (!this.isMuted && !this.isAmbientPlaying) {
        this.startOceanAmbience();
      }
      return !this.isMuted;
    }

    startOceanAmbience() {
      if (!this.ctx || this.isAmbientPlaying) return;
      this.isAmbientPlaying = true;

      // Pink noise generator for gentle ocean surf
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Low pass filter simulating rolling ocean swell
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, this.ctx.currentTime);

      // Low frequency oscillator for wave swells
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.12, this.ctx.currentTime); // ~8 sec wave period
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(140, this.ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);

      whiteNoise.start();
      lfo.start();
    }

    playShipBell() {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;

      // Harmonics of an ancient maritime brass bell
      const freqs = [440, 880, 1320, 1760];
      const gains = [0.4, 0.25, 0.15, 0.08];

      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(gains[idx], now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 3.3);
      });
    }

    playCompassClick() {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200 + Math.random() * 400, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.05);
    }

    playThunder() {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;

      const bufferSize = this.ctx.sampleRate * 2.5;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1);
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(80, now);
      filter.frequency.exponentialRampToValueAtTime(30, now + 2.4);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start(now);
      noise.stop(now + 2.5);
    }

    playEmeraldMagic() {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.4); // A5
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.9); // D6

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 1.3);
    }
  }

  window.NauticalSoundEngine = NauticalSoundEngine;
})(window);
