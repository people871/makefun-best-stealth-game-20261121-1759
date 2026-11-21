// SHADOW LANTERN — every sound is synthesised with WebAudio.
// No audio files, no network: oscillators and filtered noise only.
// All calls are safe before the first user gesture (the context is
// created lazily and every method no-ops when audio is unavailable).
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.droneNodes = null;
    this.lastStepAt = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    }
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!this.ensure()) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch { /* audio must never break the game */ }
  }

  noiseBurst(dur, vol, filterFreq, when = 0) {
    if (!this.ensure()) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
    } catch { /* audio must never break the game */ }
  }

  // Soft alternating footsteps for the player; pitch drops while sneaking.
  footstep(sneaking) {
    const now = performance.now();
    if (now - this.lastStepAt < (sneaking ? 420 : 260)) return;
    this.lastStepAt = now;
    this.noiseBurst(0.07, sneaking ? 0.05 : 0.11, sneaking ? 500 : 900);
  }

  // A guard's heavier boot, panned by distance in the caller.
  guardStep(volume) {
    this.noiseBurst(0.09, Math.max(0.02, Math.min(0.22, volume)), 420);
  }

  coinThrow() {
    this.tone(1900, 0.09, 'sine', 0.12, 0, 1400);
  }

  coinClink() {
    this.tone(2400, 0.12, 'triangle', 0.16);
    this.tone(3100, 0.16, 'sine', 0.12, 0.07);
    this.tone(1900, 0.2, 'sine', 0.08, 0.14);
  }

  lootPickup() {
    this.tone(880, 0.1, 'sine', 0.14);
    this.tone(1318, 0.16, 'sine', 0.14, 0.07);
  }

  suspicious() {
    this.tone(330, 0.16, 'square', 0.06, 0, 392);
  }

  alertSting() {
    this.tone(196, 0.22, 'sawtooth', 0.14, 0, 392);
    this.tone(294, 0.22, 'sawtooth', 0.1, 0.1, 440);
  }

  spottedAlarm() {
    this.tone(660, 0.14, 'square', 0.14);
    this.tone(660, 0.14, 'square', 0.14, 0.18);
    this.tone(880, 0.3, 'square', 0.14, 0.36);
  }

  winJingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => this.tone(freq, 0.22, 'triangle', 0.16, i * 0.11));
  }

  loseSting() {
    this.tone(392, 0.3, 'sawtooth', 0.12, 0, 196);
    this.tone(196, 0.5, 'sawtooth', 0.12, 0.28, 98);
  }

  uiClick() {
    this.tone(700, 0.06, 'sine', 0.1);
  }

  // A low night drone under the game: two detuned sines + slow tremolo.
  startDrone() {
    if (!this.ensure() || this.droneNodes) return;
    try {
      const gain = this.ctx.createGain();
      gain.gain.value = 0.035;
      gain.connect(this.master);
      const oscA = this.ctx.createOscillator();
      oscA.type = 'sine';
      oscA.frequency.value = 55;
      const oscB = this.ctx.createOscillator();
      oscB.type = 'sine';
      oscB.frequency.value = 55.7;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.08;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      oscA.connect(gain);
      oscB.connect(gain);
      oscA.start();
      oscB.start();
      lfo.start();
      this.droneNodes = { gain, oscA, oscB, lfo };
    } catch {
      this.droneNodes = null;
    }
  }

  stopDrone() {
    if (!this.droneNodes) return;
    try {
      this.droneNodes.oscA.stop();
      this.droneNodes.oscB.stop();
      this.droneNodes.lfo.stop();
      this.droneNodes.gain.disconnect();
    } catch { /* already stopped */ }
    this.droneNodes = null;
  }
}
