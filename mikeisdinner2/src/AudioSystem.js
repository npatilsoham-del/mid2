import { State } from './GameState.js';

export class AudioSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.bgmOscillator = null;
        this.bgmGain = null;
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1.0;
        this.masterGain.connect(this.ctx.destination);
    }

    _resume() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    playBGM() {
        if (!State.musicEnabled || this.bgmOscillator) return;
        this._resume();

        // Base ominous drone
        this.bgmOscillator = this.ctx.createOscillator();
        this.bgmGain = this.ctx.createGain();
        this.bgmOscillator.type = 'sine';
        this.bgmOscillator.frequency.value = 42; // Deeper ominous frequency

        // Slow LFO vibrato
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.25; // 4 second cycle
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 5;
        lfo.connect(lfoGain);
        lfoGain.connect(this.bgmOscillator.frequency);
        lfo.start();
        this._lfo = lfo;

        // Second harmonic triangle for grit
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.value = 63;
        const g2 = this.ctx.createGain();
        g2.gain.value = 0.08;
        osc2.connect(g2);
        g2.connect(this.masterGain);
        osc2.start();
        this._bgmOsc2 = osc2;

        this.bgmGain.gain.value = 0.16;
        this.bgmOscillator.connect(this.bgmGain);
        this.bgmGain.connect(this.masterGain);
        this.bgmOscillator.start();
    }

    stopBGM() {
        if (this.bgmOscillator) {
            try { this.bgmOscillator.stop(); } catch(e) {}
            this.bgmOscillator.disconnect();
            this.bgmOscillator = null;
        }
        if (this._bgmOsc2) {
            try { this._bgmOsc2.stop(); } catch(e) {}
            this._bgmOsc2 = null;
        }
        if (this._lfo) {
            try { this._lfo.stop(); } catch(e) {}
            this._lfo = null;
        }
    }

    playDropSound() {
        this._resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(170, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.18);

        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.25);
    }

    playPickupSound() {
        this._resume();
        const t = this.ctx.currentTime;

        // Two-tone rising chime (gothic/clean chime)
        [784, 1174].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + i * 0.08);
            gain.gain.setValueAtTime(0.22, t + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.22);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t + i * 0.08);
            osc.stop(t + i * 0.08 + 0.24);
        });
    }

    playAdrenalineSound() {
        this._resume();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.5);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.5);
    }

    playBaitTick() {
        this._resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(2500, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.04);
    }

    playAlarmRing() {
        this._resume();
        const t = this.ctx.currentTime;
        [880, 932].forEach(freq => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + 0.16);
        });
    }

    playFootstep(isMonster = false, distance = 0, isSprinting = false) {
        if (!State.musicEnabled) return;
        this._resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = isMonster ? 'triangle' : 'sine';
        const baseFreq = isMonster ? 50 : 130;
        osc.frequency.setValueAtTime(isSprinting ? baseFreq * 1.1 : baseFreq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(12, this.ctx.currentTime + 0.14);

        filter.type = 'lowpass';
        filter.frequency.value = isMonster ? 300 : 800;

        let vol = isSprinting ? 0.5 : 0.15;
        if (isMonster) {
            vol = Math.max(0, 1.0 - (distance / 32));
        }

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (isMonster ? 0.38 : 0.14));

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + (isMonster ? 0.38 : 0.14));
    }

    playHeartbeat(intensity) {
        if (!State.musicEnabled) return;
        this._resume();

        // Double thump (lub-dub)
        [0, 0.16].forEach(delay => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const t = this.ctx.currentTime + delay;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(45, t);
            osc.frequency.exponentialRampToValueAtTime(20, t + 0.14);

            const vol = Math.min(0.85, intensity * 0.95);
            gain.gain.setValueAtTime(vol, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + 0.3);
        });
    }

    playJumpscareSound() {
        this._resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Blood-curdling high-pitch screeching saw chord
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1100, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(150, this.ctx.currentTime + 0.85);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1400;
        filter.Q.value = 0.65;

        gain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 1.2);
    }

    playDeathStinger() {
        this._resume();
        const t = this.ctx.currentTime;
        [180, 140, 110, 80].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.45, t + i * 0.18);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.5);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t + i * 0.18);
            osc.stop(t + i * 0.18 + 0.55);
        });
    }

    playWinStinger() {
        this._resume();
        const t = this.ctx.currentTime;
        // Ascending major chord (peaceful and triumphant escape)
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.28, t + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.65);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t + i * 0.15);
            osc.stop(t + i * 0.15 + 0.7);
        });
    }
}
