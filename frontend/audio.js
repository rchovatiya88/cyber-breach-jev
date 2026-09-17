/**
 * Procedural Web Audio Engine for Cyber-Breach: The Jev Protocol
 * Pure Web Audio API synthesis - no external audio files required.
 * Daft Punk / Tron: Legacy procedural multi-track synthwave architecture.
 */
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.musicEnabled = true;
        this.isAudioUnlocked = false;

        // Music scheduler state
        this.bpm = 124;
        this.current16thStep = 0;
        this.nextNoteTime = 0.0;
        this.scheduleAheadTime = 0.12; // seconds
        this.timerID = null;
        this.musicIntensity = 'ambient'; // 'ambient' | 'combat' | 'boss'
        this.isLowHealthMuffled = false;

        // Master nodes
        this.masterMusicGain = null;
        this.musicLowpassFilter = null;
        this.sfxMasterGain = null;

        // Musical scales & patterns
        this.bassNotes = [
            55, 55, 110, 55,  65.41, 55, 73.42, 55,
            82.41, 73.42, 65.41, 55,  49.0, 55, 65.41, 73.42,
            55, 55, 110, 55,  65.41, 55, 73.42, 55,
            87.31, 82.41, 73.42, 65.41,  73.42, 82.41, 98.0, 82.41
        ]; // A1, C2, D2, E2, F2, G2

        this.arpNotes = [
            220, 261.63, 329.63, 440,  392.0, 329.63, 261.63, 293.66,
            349.23, 440, 523.25, 440,  392.0, 349.23, 329.63, 293.66
        ]; // A3, C4, E4, A4, G4, D4...
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            // Set up Master Audio Routing Graph
            this.musicLowpassFilter = this.ctx.createBiquadFilter();
            this.musicLowpassFilter.type = 'lowpass';
            this.musicLowpassFilter.frequency.setValueAtTime(20000, this.ctx.currentTime);

            this.masterMusicGain = this.ctx.createGain();
            this.masterMusicGain.gain.setValueAtTime(0.22, this.ctx.currentTime);

            this.musicLowpassFilter.connect(this.masterMusicGain);
            this.masterMusicGain.connect(this.ctx.destination);

            this.sfxMasterGain = this.ctx.createGain();
            this.sfxMasterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
            this.sfxMasterGain.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.isAudioUnlocked = true;
    }

    /* --------------------------------------------------------------------- */
    /* PROCEDURAL SOUND EFFECTS (SFX)                                        */
    /* --------------------------------------------------------------------- */

    playLaser() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.13);
    }

    playHeavyLaser() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.22);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.23);
    }

    playExplosion() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // White noise burst
        const bufferSize = Math.floor(ctx.sampleRate * 0.35);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.exponentialRampToValueAtTime(60, now + 0.35);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);

        // Add sub-bass thump
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(140, now);
        sub.frequency.exponentialRampToValueAtTime(30, now + 0.3);
        subGain.gain.setValueAtTime(0.4, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        sub.connect(subGain);
        subGain.connect(this.sfxMasterGain || ctx.destination);

        noise.start(now);
        sub.start(now);
        noise.stop(now + 0.36);
        sub.stop(now + 0.31);
    }

    playDash() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(950, now + 0.15);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.16);
    }

    playBlink() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Quantum phase-warp sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(2200, now + 0.18);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(3500, now + 0.18);
        filter.Q.setValueAtTime(4.0, now);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.23);
    }

    playOverdrive() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Power turbine surge
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(110, now);
        osc1.frequency.exponentialRampToValueAtTime(660, now + 0.35);
        osc2.frequency.setValueAtTime(165, now);
        osc2.frequency.exponentialRampToValueAtTime(990, now + 0.35);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.46);
        osc2.stop(now + 0.46);
    }

    playShieldHit() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.09);
    }

    playPowerup() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const noteStart = now + idx * 0.05;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, noteStart);

            gain.gain.setValueAtTime(0.18, noteStart);
            gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.12);

            osc.connect(gain);
            gain.connect(this.sfxMasterGain || ctx.destination);

            osc.start(noteStart);
            osc.stop(noteStart + 0.13);
        });
    }

    playAlert() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.setValueAtTime(650, now + 0.1);
        osc.frequency.setValueAtTime(350, now + 0.2);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.36);
    }

    playBossWarning() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Heavy industrial klaxon
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(440, now + 0.3);
        osc.frequency.linearRampToValueAtTime(220, now + 0.6);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

        osc.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.7);
    }

    playBossCharge() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(480, now + 0.75);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.4, now + 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        osc.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.86);
    }

    playComboUp(tier = 1) {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const baseFreq = 440 * Math.pow(1.2, tier);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.1);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    playLockOn() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1760, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.07);
    }

    playRamImpact() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Heavy kinetic crunch
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.4);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.46);
    }

    playDiscThrow() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(1480, now + 0.18);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
    }

    playDiscRicochet() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1760, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    playDerez() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Digital noise blast
        const bufferSize = Math.floor(ctx.sampleRate * 0.45);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.sin(i * 0.08);
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(180, now + 0.4);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);

        // Pitch cascade sweep
        const sweep = ctx.createOscillator();
        const sweepGain = ctx.createGain();
        sweep.type = 'sawtooth';
        sweep.frequency.setValueAtTime(1600, now);
        sweep.frequency.exponentialRampToValueAtTime(80, now + 0.38);
        sweepGain.gain.setValueAtTime(0.35, now);
        sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        sweep.connect(sweepGain);
        sweepGain.connect(this.sfxMasterGain || ctx.destination);

        noise.start(now);
        sweep.start(now);
        noise.stop(now + 0.44);
        sweep.stop(now + 0.4);
    }

    playWallHop() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);

        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
    }

    playShockwave() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(95, now);
        osc.frequency.exponentialRampToValueAtTime(28, now + 0.45);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

        osc.connect(gain);
        gain.connect(this.sfxMasterGain || ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
    }

    /* --------------------------------------------------------------------- */
    /* DAFT PUNK / TRON PROCEDURAL SYNTHWAVE ENGINE                          */
    /* --------------------------------------------------------------------- */

    startMusic() {
        if (!this.musicEnabled) return;
        this.init();

        if (this.timerID) return;

        this.current16thStep = 0;
        this.nextNoteTime = this.ctx.currentTime + 0.05;

        // Run high-frequency lookahead scheduler
        this.timerID = setInterval(() => {
            this.scheduler();
        }, 25);
    }

    stopMusic() {
        if (this.timerID) {
            clearInterval(this.timerID);
            this.timerID = null;
        }
    }

    scheduler() {
        if (!this.musicEnabled || !this.enabled || !this.ctx) return;
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.schedule16thNote(this.current16thStep, this.nextNoteTime);
            this.advance16thNote();
        }
    }

    advance16thNote() {
        // Calculate seconds per 16th note: (60 / BPM) / 4
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += 0.25 * secondsPerBeat;
        this.current16thStep = (this.current16thStep + 1) % 32;
    }

    schedule16thNote(step, time) {
        const beatStep = step % 16;
        const isBoss = this.musicIntensity === 'boss';
        const isCombat = this.musicIntensity === 'combat' || isBoss;

        // 1. Four-on-the-floor Kick Drum (Beat 0, 4, 8, 12)
        if (isCombat && (beatStep % 4 === 0 || (isBoss && beatStep === 14))) {
            this.triggerKick(time, isBoss ? 0.35 : 0.28);
        }

        // 2. Analog Snare / Clap on Beats 4 and 12
        if (isCombat && (beatStep === 4 || beatStep === 12)) {
            this.triggerSnare(time, 0.22);
        }

        // 3. 16th-Note Metallic Hi-Hats
        if (beatStep % 2 !== 0 || isBoss) {
            const isAccent = (beatStep === 2 || beatStep === 6 || beatStep === 10 || beatStep === 14);
            this.triggerHiHat(time, isAccent ? 0.12 : 0.06, isAccent);
        }

        // 4. Rolling Moog-Style Resonant Bassline
        const bassFreq = this.bassNotes[step % this.bassNotes.length];
        this.triggerBassNote(time, bassFreq, isCombat, isBoss);

        // 5. Shimmering Arpeggiator Lead (Active in Combat and Boss modes)
        if (isCombat && (step % 2 === 0 || isBoss)) {
            const arpFreq = this.arpNotes[step % this.arpNotes.length] * (isBoss ? 1.5 : 1.0);
            this.triggerArpNote(time, arpFreq, isBoss ? 0.14 : 0.09);
        }
    }

    triggerKick(time, volume = 0.3) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(145, time);
        osc.frequency.exponentialRampToValueAtTime(36, time + 0.12);

        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

        osc.connect(gain);
        gain.connect(this.musicLowpassFilter || ctx.destination);

        osc.start(time);
        osc.stop(time + 0.17);
    }

    triggerSnare(time, volume = 0.22) {
        const ctx = this.ctx;
        // White noise burst
        const bufferSize = Math.floor(ctx.sampleRate * 0.14);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1600, time);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicLowpassFilter || ctx.destination);

        noise.start(time);
        noise.stop(time + 0.15);
    }

    triggerHiHat(time, volume = 0.08, isOpen = false) {
        const ctx = this.ctx;
        const bufferSize = Math.floor(ctx.sampleRate * (isOpen ? 0.09 : 0.04));
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(7500, time);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + (isOpen ? 0.09 : 0.04));

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicLowpassFilter || ctx.destination);

        noise.start(time);
        noise.stop(time + (isOpen ? 0.1 : 0.05));
    }

    triggerBassNote(time, freq, isCombat, isBoss) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        const startCutoff = isBoss ? 1600 : (isCombat ? 1100 : 550);
        const endCutoff = isBoss ? 300 : 120;
        filter.frequency.setValueAtTime(startCutoff, time);
        filter.frequency.exponentialRampToValueAtTime(endCutoff, time + 0.14);
        filter.Q.setValueAtTime(isCombat ? 5.5 : 2.5, time);

        const vol = isBoss ? 0.22 : (isCombat ? 0.18 : 0.14);
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicLowpassFilter || ctx.destination);

        osc.start(time);
        osc.stop(time + 0.16);
    }

    triggerArpNote(time, freq, volume = 0.1) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

        osc.connect(gain);
        gain.connect(this.musicLowpassFilter || ctx.destination);

        osc.start(time);
        osc.stop(time + 0.12);
    }

    setMusicIntensity(intensity) {
        if (this.musicIntensity === intensity) return;
        this.musicIntensity = intensity;

        if (intensity === 'boss') {
            this.bpm = 138;
        } else if (intensity === 'combat') {
            this.bpm = 126;
        } else {
            this.bpm = 120;
        }
    }

    setLowHealthFilter(isLow) {
        if (this.isLowHealthMuffled === isLow || !this.ctx || !this.musicLowpassFilter) return;
        this.isLowHealthMuffled = isLow;

        const now = this.ctx.currentTime;
        this.musicLowpassFilter.frequency.cancelScheduledValues(now);
        if (isLow) {
            // Drop to 380Hz lowpass for heartbeat tension
            this.musicLowpassFilter.frequency.exponentialRampToValueAtTime(380, now + 0.4);
        } else {
            // Restore full spectrum
            this.musicLowpassFilter.frequency.exponentialRampToValueAtTime(20000, now + 0.4);
        }
    }

    toggleSound() {
        this.enabled = !this.enabled;
        if (!this.enabled) this.stopMusic();
        else if (this.musicEnabled) this.startMusic();
        return this.enabled;
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (this.musicEnabled && this.enabled) this.startMusic();
        else this.stopMusic();
        return this.musicEnabled;
    }

    toggleSfx() {
        return this.toggleSound();
    }
}

// Global Singletons & Aliases for full backward/forward compatibility
window.sounds = new SoundEngine();
window.audioManager = window.sounds;
