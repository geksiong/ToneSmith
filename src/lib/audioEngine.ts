import { CircuitAnalysisResult } from '../types/guitar';

export class GuitarAudioEngine {
  private ctx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  
  // DSP Nodes
  private inputGain: GainNode | null = null;
  private riffBusGain: GainNode | null = null;
  private resonantPeakFilter: BiquadFilterNode | null = null;
  private pickupRolloffFilter: BiquadFilterNode | null = null;
  private toneLowpassFilter: BiquadFilterNode | null = null;
  private phaseCancelFilter: BiquadFilterNode | null = null;
  private phaseNasalFilter: BiquadFilterNode | null = null;
  private seriesBoostGain: GainNode | null = null;
  private volumeGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private lastAnalysis: CircuitAnalysisResult | null = null;
  
  // Hum Generator (60Hz + harmonics)
  private humGain: GainNode | null = null;
  private humOsc1: OscillatorNode | null = null;
  private humOsc2: OscillatorNode | null = null;
  private humOsc3: OscillatorNode | null = null;
  
  // Synthesizer / DI Looper tracking
  private isLooping: boolean = false;
  private looperTimer: number | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private activeNoteGains: GainNode[] = [];
  private activeFilters: BiquadFilterNode[] = [];
  private activeTimers: number[] = [];

  // Subscriber callbacks for state sync across components
  private listeners: Set<() => void> = new Set();
  
  // State flags
  public isMicActive: boolean = false;
  public isRiffPlaying: boolean = false;
  public humEnabled: boolean = true;
  public currentRiffType: 'funk' | 'blues' | 'chords' | 'lead' = 'chords';

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (_) {}
    });
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setupGraph() {
    this.initContext();
    if (!this.ctx) return;

    if (this.masterGain) return; // already set up

    const ctx = this.ctx;

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1.0;

    // Dedicated bus for synthesized guitar riffs so playback can be muted/stopped instantaneously
    this.riffBusGain = ctx.createGain();
    this.riffBusGain.gain.value = 1.0;
    this.riffBusGain.connect(this.inputGain);

    // Resonant peak of pickup RLC
    this.resonantPeakFilter = ctx.createBiquadFilter();
    this.resonantPeakFilter.type = 'peaking';
    this.resonantPeakFilter.frequency.value = 3500;
    this.resonantPeakFilter.Q.value = 2.0;
    this.resonantPeakFilter.gain.value = 4.0;

    // Pickup natural rolloff above resonant peak
    this.pickupRolloffFilter = ctx.createBiquadFilter();
    this.pickupRolloffFilter.type = 'lowpass';
    this.pickupRolloffFilter.frequency.value = 6500;
    this.pickupRolloffFilter.Q.value = 0.707;

    // Tone potentiometer rolloff
    this.toneLowpassFilter = ctx.createBiquadFilter();
    this.toneLowpassFilter.type = 'lowpass';
    this.toneLowpassFilter.frequency.value = 20000;
    this.toneLowpassFilter.Q.value = 0.707;

    // Phase cancellation (highpass for bass fundamental cancellation)
    this.phaseCancelFilter = ctx.createBiquadFilter();
    this.phaseCancelFilter.type = 'highpass';
    this.phaseCancelFilter.frequency.value = 10; // bypassed initially
    this.phaseCancelFilter.Q.value = 1.0;

    // Phase nasal formant filter (peaking for out-of-phase Peter Green bite)
    this.phaseNasalFilter = ctx.createBiquadFilter();
    this.phaseNasalFilter.type = 'peaking';
    this.phaseNasalFilter.frequency.value = 1800;
    this.phaseNasalFilter.gain.value = 0; // bypassed initially
    this.phaseNasalFilter.Q.value = 2.0;

    // Series / Split Gain multiplier
    this.seriesBoostGain = ctx.createGain();
    this.seriesBoostGain.gain.value = 1.0;

    // Volume pot attenuation
    this.volumeGain = ctx.createGain();
    this.volumeGain.gain.value = 1.0;

    // Master output & meter
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.85;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.6;

    // Connect DSP chain
    this.inputGain.connect(this.resonantPeakFilter);
    this.resonantPeakFilter.connect(this.pickupRolloffFilter);
    this.pickupRolloffFilter.connect(this.toneLowpassFilter);
    this.toneLowpassFilter.connect(this.phaseCancelFilter);
    this.phaseCancelFilter.connect(this.phaseNasalFilter);
    this.phaseNasalFilter.connect(this.seriesBoostGain);
    this.seriesBoostGain.connect(this.volumeGain);
    this.volumeGain.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    // Setup 60Hz Hum Generator
    this.setupHumGenerator();
  }

  private setupHumGenerator() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0; // muted initially

    // Fundamental 60Hz
    this.humOsc1 = ctx.createOscillator();
    this.humOsc1.type = 'sine';
    this.humOsc1.frequency.value = 60;

    // 2nd Harmonic 120Hz (rectified diode buzz)
    this.humOsc2 = ctx.createOscillator();
    this.humOsc2.type = 'sine';
    this.humOsc2.frequency.value = 120;

    // 3rd Harmonic 180Hz
    this.humOsc3 = ctx.createOscillator();
    this.humOsc3.type = 'sine';
    this.humOsc3.frequency.value = 180;

    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    const g3 = ctx.createGain();
    g1.gain.value = 0.6;
    g2.gain.value = 0.3;
    g3.gain.value = 0.15;

    this.humOsc1.connect(g1);
    this.humOsc2.connect(g2);
    this.humOsc3.connect(g3);

    g1.connect(this.humGain);
    g2.connect(this.humGain);
    g3.connect(this.humGain);

    if (this.volumeGain) {
      this.humGain.connect(this.volumeGain);
    }

    this.humOsc1.start();
    this.humOsc2.start();
    this.humOsc3.start();
  }

  public updateCircuitParameters(analysis: CircuitAnalysisResult) {
    this.lastAnalysis = analysis;
    if (!this.ctx || !this.volumeGain || !this.resonantPeakFilter || !this.toneLowpassFilter) {
      return;
    }

    const t = this.ctx.currentTime;
    const rampTime = 0.05;

    if (!analysis.hasOutputSignal) {
      this.volumeGain.gain.setTargetAtTime(0, t, rampTime);
      if (this.humGain) this.humGain.gain.setTargetAtTime(0, t, rampTime);
      return;
    }

    // Volume level
    const vol = Math.max(0, Math.min(1.0, analysis.effectiveVolumeLevel));
    this.volumeGain.gain.setTargetAtTime(vol, t, rampTime);

    // Resonant Peak Filter (Pickup RLC modeling)
    const freq = Math.max(1200, Math.min(12000, analysis.resonantFrequencyHz));
    const boost = Math.max(0, Math.min(14, analysis.peakBoostDb));
    const q = Math.max(0.5, Math.min(6.5, analysis.qFactor));

    this.resonantPeakFilter.frequency.setTargetAtTime(freq, t, rampTime);
    this.resonantPeakFilter.gain.setTargetAtTime(boost, t, rampTime);
    this.resonantPeakFilter.Q.setTargetAtTime(q, t, rampTime);

    // Natural pickup high-frequency rolloff above resonant peak
    if (this.pickupRolloffFilter) {
      const rolloffHz = Math.max(2600, Math.min(18000, freq * 1.45));
      this.pickupRolloffFilter.frequency.setTargetAtTime(rolloffHz, t, rampTime);
    }

    // Tone Pot Rolloff and Woman Tone resonance
    const toneCutoff = Math.max(300, Math.min(20000, analysis.effectiveToneCutoffHz));
    this.toneLowpassFilter.frequency.setTargetAtTime(toneCutoff, t, rampTime);
    if (toneCutoff < 1200) {
      // "Woman Tone" resonant bump at 450Hz
      this.toneLowpassFilter.Q.setTargetAtTime(1.5, t, rampTime);
    } else {
      this.toneLowpassFilter.Q.setTargetAtTime(0.707, t, rampTime);
    }

    // Phase Cancellation Modeling (Peter Green hollow nasal acoustic sound)
    const isOutOfPhase = analysis.phaseRelationship === 'out-of-phase';
    if (this.phaseCancelFilter) {
      if (isOutOfPhase) {
        // High-pass bass cancellation: cuts out 80Hz - 340Hz string fundamental vibrations
        this.phaseCancelFilter.frequency.setTargetAtTime(360, t, rampTime);
        this.phaseCancelFilter.Q.setTargetAtTime(1.4, t, rampTime);
      } else {
        // In-phase: wide open bypass
        this.phaseCancelFilter.frequency.setTargetAtTime(10, t, rampTime);
        this.phaseCancelFilter.Q.setTargetAtTime(0.7, t, rampTime);
      }
    }

    if (this.phaseNasalFilter) {
      if (isOutOfPhase) {
        // Nasal vocal formant peak (+7dB at 1.8kHz)
        this.phaseNasalFilter.gain.setTargetAtTime(7.0, t, rampTime);
      } else {
        this.phaseNasalFilter.gain.setTargetAtTime(0, t, rampTime);
      }
    }

    // Series vs Coil-Split vs Parallel Gain Scaling
    if (this.seriesBoostGain) {
      const isSeries = analysis.wiringConfiguration === 'series';
      const isSplit = analysis.isCoilSplit;
      const isParCoils = analysis.activeCoils.some((c) => c.coilName.includes('Parallel'));
      let gainMult = 1.0;
      if (isSeries) {
        // Series humbucker / series pickups: +4dB boost (thick, driving sound)
        gainMult = 1.58;
      } else if (isSplit) {
        // Single split bobbin: -4.5dB drop in output
        gainMult = 0.60;
      } else if (isParCoils) {
        gainMult = 0.75;
      }
      this.seriesBoostGain.gain.setTargetAtTime(gainMult, t, rampTime);
    }

    // Hum sound calculation (only audible when audio source is actively playing or monitoring)
    if (this.humGain && this.humEnabled && (this.isRiffPlaying || this.isMicActive)) {
      if (!analysis.isHumCancelling && analysis.activeCoils.length > 0) {
        // Single coil hum present!
        const humLevel = 0.035 * vol;
        this.humGain.gain.setTargetAtTime(humLevel, t, rampTime);
      } else {
        // Hum cancelled or no pickups
        this.humGain.gain.setTargetAtTime(0, t, rampTime);
      }
    } else if (this.humGain) {
      this.humGain.gain.setTargetAtTime(0, t, rampTime);
    }
  }

  public async toggleMicrophone(): Promise<boolean> {
    this.setupGraph();
    if (!this.ctx || !this.inputGain) return false;

    if (this.isMicActive) {
      // Turn off mic
      if (this.micStream) {
        this.micStream.getTracks().forEach((track) => track.stop());
        this.micStream = null;
      }
      if (this.micSourceNode) {
        this.micSourceNode.disconnect();
        this.micSourceNode = null;
      }
      this.isMicActive = false;
      if (this.lastAnalysis) {
        this.updateCircuitParameters(this.lastAnalysis);
      }
      this.notify();
      return false;
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        this.micStream = stream;
        this.micSourceNode = this.ctx.createMediaStreamSource(stream);
        this.micSourceNode.connect(this.inputGain);
        this.isMicActive = true;
        if (this.lastAnalysis) {
          this.updateCircuitParameters(this.lastAnalysis);
        }
        this.notify();
        return true;
      } catch (err) {
        console.error('Failed to access microphone:', err);
        this.isMicActive = false;
        this.notify();
        throw err;
      }
    }
  }

  public toggleRiffLooper(riffType: 'funk' | 'blues' | 'chords' | 'lead' = 'chords') {
    this.setupGraph();
    this.currentRiffType = riffType;

    if (this.isRiffPlaying) {
      this.stopRiff();
    } else {
      this.startRiff(riffType);
    }
  }

  public setRiffType(riffType: 'funk' | 'blues' | 'chords' | 'lead') {
    this.currentRiffType = riffType;
    if (this.isRiffPlaying) {
      this.stopRiff();
      this.startRiff(riffType);
    } else {
      this.notify();
    }
  }

  public startRiff(riffType: 'funk' | 'blues' | 'chords' | 'lead') {
    // Ensure any existing audio playback and pending nodes are stopped cleanly first
    this.stopRiff();
    this.setupGraph();
    if (!this.ctx || !this.inputGain) return;

    // Restore full riff bus gain
    if (this.riffBusGain) {
      const now = this.ctx.currentTime;
      this.riffBusGain.gain.cancelScheduledValues(now);
      this.riffBusGain.gain.setValueAtTime(1.0, now);
    }

    this.currentRiffType = riffType;
    this.isRiffPlaying = true;
    this.isLooping = true;
    this.notify();

    if (this.lastAnalysis) {
      this.updateCircuitParameters(this.lastAnalysis);
    }

    const playSequence = () => {
      if (!this.isLooping || !this.isRiffPlaying || !this.ctx) return;

      const riffs = {
        chords: [
          // E Major chord strum
          { time: 0.0, freqs: [82.4, 123.47, 164.81, 207.65, 246.94, 329.63], dur: 1.6, decay: 2.2 },
          // A Major chord
          { time: 1.8, freqs: [110.0, 164.81, 220.0, 277.18, 329.63], dur: 1.4, decay: 2.0 },
          // B7 chord
          { time: 3.4, freqs: [123.47, 155.56, 185.0, 246.94, 370.0], dur: 1.4, decay: 2.0 },
          // E Major
          { time: 5.0, freqs: [82.4, 123.47, 164.81, 207.65, 246.94, 329.63], dur: 2.0, decay: 2.5 },
        ],
        funk: [
          // Funky E9 chord scratches and stabs
          { time: 0.0, freqs: [164.81, 207.65, 246.94, 329.63, 392.0], dur: 0.18, decay: 0.3 },
          { time: 0.35, freqs: [164.81, 207.65, 246.94, 329.63, 392.0], dur: 0.15, decay: 0.25 },
          { time: 0.65, freqs: [146.83, 174.61, 220.0, 293.66], dur: 0.22, decay: 0.4 },
          { time: 1.05, freqs: [164.81, 207.65, 246.94, 329.63, 392.0], dur: 0.18, decay: 0.3 },
          { time: 1.4, freqs: [196.0, 246.94, 329.63], dur: 0.3, decay: 0.5 },
        ],
        blues: [
          // Slow blues lick in A
          { time: 0.0, freqs: [110.0], dur: 0.5, decay: 0.8 },
          { time: 0.55, freqs: [130.81], dur: 0.4, decay: 0.7 },
          { time: 1.0, freqs: [146.83], dur: 0.5, decay: 0.8 },
          { time: 1.5, freqs: [155.56], dur: 0.3, decay: 0.6 },
          { time: 1.85, freqs: [164.81], dur: 0.7, decay: 1.2 },
          { time: 2.65, freqs: [196.0], dur: 0.6, decay: 1.0 },
          { time: 3.35, freqs: [220.0], dur: 1.2, decay: 1.8 },
        ],
        lead: [
          // Sustained rock guitar solo notes
          { time: 0.0, freqs: [329.63], dur: 0.8, decay: 1.4 },
          { time: 0.9, freqs: [370.0], dur: 0.7, decay: 1.3 },
          { time: 1.7, freqs: [392.0], dur: 1.2, decay: 1.8 },
          { time: 3.0, freqs: [440.0], dur: 1.8, decay: 2.2 },
        ],
      };

      const pattern = riffs[riffType] || riffs.chords;
      const totalDuration = pattern[pattern.length - 1].time + pattern[pattern.length - 1].dur + 0.5;

      const startTime = this.ctx.currentTime + 0.05;

      pattern.forEach((event) => {
        if (!this.isLooping || !this.isRiffPlaying) return;
        event.freqs.forEach((freq, idx) => {
          if (!this.isLooping || !this.isRiffPlaying) return;
          this.playSynthesizedString(freq, startTime + event.time + idx * 0.015, event.decay);
        });
      });

      this.looperTimer = window.setTimeout(playSequence, totalDuration * 1000);
    };

    playSequence();
  }

  /**
   * Immediately stops all audio playback from the riff looper and clears all scheduled events
   */
  public stopRiff() {
    this.isLooping = false;
    this.isRiffPlaying = false;

    // Clear recurring loop timer
    if (this.looperTimer) {
      clearTimeout(this.looperTimer);
      this.looperTimer = null;
    }

    // Clear all pending note cleanup timers
    for (const timerId of this.activeTimers) {
      clearTimeout(timerId);
    }
    this.activeTimers = [];

    if (this.ctx) {
      const now = this.ctx.currentTime;
      const stopWindow = 0.005; // 5ms micro-fade to eliminate any audio pops/clicks
      const stopTime = now + stopWindow;

      // 1. Immediately mute the dedicated riff bus gain
      if (this.riffBusGain) {
        try {
          this.riffBusGain.gain.cancelScheduledValues(now);
          this.riffBusGain.gain.setValueAtTime(this.riffBusGain.gain.value, now);
          this.riffBusGain.gain.linearRampToValueAtTime(0, stopTime);
        } catch (_) {}
      }

      // 2. Stop and cancel all scheduled and active oscillators
      for (const osc of this.activeOscillators) {
        try {
          osc.onended = null;
          osc.stop(stopTime);
        } catch (_) {}
      }

      // 3. Cancel scheduled ramps on all active note gains
      for (const gain of this.activeNoteGains) {
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(0, stopTime);
        } catch (_) {}
      }

      // 4. Mute hum generator if mic is also inactive
      if (this.humGain && !this.isMicActive) {
        try {
          this.humGain.gain.cancelScheduledValues(now);
          this.humGain.gain.setValueAtTime(0, stopTime);
        } catch (_) {}
      }

      // 5. Disconnect nodes after the 5ms stop window
      const oscs = [...this.activeOscillators];
      const gains = [...this.activeNoteGains];
      const filters = [...this.activeFilters];

      setTimeout(() => {
        for (const osc of oscs) {
          try { osc.disconnect(); } catch (_) {}
        }
        for (const g of gains) {
          try { g.disconnect(); } catch (_) {}
        }
        for (const f of filters) {
          try { f.disconnect(); } catch (_) {}
        }
      }, 20);
    }

    this.activeOscillators = [];
    this.activeNoteGains = [];
    this.activeFilters = [];

    this.notify();
  }

  /**
   * Global stop helper that immediately stops all sound generation (riff + mic)
   */
  public stopAllAudio() {
    this.stopRiff();
    if (this.isMicActive) {
      if (this.micStream) {
        this.micStream.getTracks().forEach((track) => track.stop());
        this.micStream = null;
      }
      if (this.micSourceNode) {
        this.micSourceNode.disconnect();
        this.micSourceNode = null;
      }
      this.isMicActive = false;
      this.notify();
    }
  }

  // Karplus-Strong / Multi-Harmonic Guitar String Synthesis
  private playSynthesizedString(freq: number, startTime: number, decaySec: number) {
    if (!this.isLooping || !this.isRiffPlaying || !this.ctx || !this.inputGain) return;
    const ctx = this.ctx;

    // Harmonic weights adapted dynamically to active pickup positions and types
    let harmonicWeights = [1.0, 0.65, 0.45, 0.25, 0.12];
    let attackLevel = 0.35;

    const analysis = this.lastAnalysis;
    if (analysis && analysis.activePickups.length > 0) {
      const activePositions = analysis.activePickups.map((p) => p.position);
      const isBridgeOnly = activePositions.length > 0 && activePositions.every((pos) => pos === 'bridge');
      const isNeckOnly = activePositions.length > 0 && activePositions.every((pos) => pos === 'neck');
      const isOutOfPhase = analysis.phaseRelationship === 'out-of-phase';
      const isSeries = analysis.wiringConfiguration === 'series';

      if (isOutOfPhase) {
        // Acoustic cancellation suppresses fundamental, nasal 2nd/3rd harmonics dominate
        harmonicWeights = [0.2, 0.55, 1.0, 0.8, 0.5, 0.3];
        attackLevel = 0.32;
      } else if (isBridgeOnly) {
        // Bridge pickup: prominent high harmonics, bright pick attack bite
        harmonicWeights = [0.7, 0.95, 0.85, 0.65, 0.45, 0.25];
        attackLevel = 0.42;
      } else if (isNeckOnly) {
        // Neck pickup: strong fundamental, warm 2nd harmonic, rounded attack
        harmonicWeights = [1.0, 0.5, 0.2, 0.08, 0.03];
        attackLevel = 0.32;
      } else if (isSeries) {
        // Series humbucker / pair: fat, loud, dense harmonics
        harmonicWeights = [1.1, 0.85, 0.7, 0.5, 0.3, 0.15];
        attackLevel = 0.40;
      } else {
        // Middle / Parallel / Both: balanced spread
        harmonicWeights = [0.9, 0.7, 0.5, 0.35, 0.2, 0.1];
        attackLevel = 0.35;
      }
    }

    const oscCount = harmonicWeights.length;

    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(attackLevel, startTime + 0.004); // pick attack
    noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decaySec);

    // Filter to simulate wooden body string damping over time
    const stringDampFilter = ctx.createBiquadFilter();
    stringDampFilter.type = 'lowpass';
    stringDampFilter.frequency.setValueAtTime(freq * 8, startTime);
    stringDampFilter.frequency.exponentialRampToValueAtTime(freq * 1.5, startTime + decaySec);

    noteGain.connect(stringDampFilter);
    // Connect to dedicated riff bus
    stringDampFilter.connect(this.riffBusGain || this.inputGain);

    this.activeNoteGains.push(noteGain);
    this.activeFilters.push(stringDampFilter);

    // Cleanup note nodes when decay finishes naturally
    const noteCleanTimer = window.setTimeout(() => {
      try { noteGain.disconnect(); } catch (_) {}
      try { stringDampFilter.disconnect(); } catch (_) {}
      const gIdx = this.activeNoteGains.indexOf(noteGain);
      if (gIdx !== -1) this.activeNoteGains.splice(gIdx, 1);
      const fIdx = this.activeFilters.indexOf(stringDampFilter);
      if (fIdx !== -1) this.activeFilters.splice(fIdx, 1);
      const tIdx = this.activeTimers.indexOf(noteCleanTimer);
      if (tIdx !== -1) this.activeTimers.splice(tIdx, 1);
    }, Math.max(100, (startTime - ctx.currentTime + decaySec + 0.2) * 1000));
    this.activeTimers.push(noteCleanTimer);

    for (let i = 0; i < oscCount; i++) {
      const harmonicOsc = ctx.createOscillator();
      harmonicOsc.type = i === 0 ? 'triangle' : 'sawtooth';
      harmonicOsc.frequency.setValueAtTime(freq * (i + 1), startTime);

      const oscGain = ctx.createGain();
      oscGain.gain.value = harmonicWeights[i] / oscCount;

      harmonicOsc.connect(oscGain);
      oscGain.connect(noteGain);

      this.activeOscillators.push(harmonicOsc);

      harmonicOsc.onended = () => {
        try {
          harmonicOsc.disconnect();
          oscGain.disconnect();
        } catch (_) {}
        const idx = this.activeOscillators.indexOf(harmonicOsc);
        if (idx !== -1) {
          this.activeOscillators.splice(idx, 1);
        }
      };

      harmonicOsc.start(startTime);
      harmonicOsc.stop(startTime + decaySec + 0.1);
    }
  }

  public getOutputLevel(): number {
    if (!this.analyser) return 0;
    if (!this.isMicActive && !this.isRiffPlaying) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    return Math.min(1.0, rms * 3.5);
  }

  public setHumEnabled(enabled: boolean) {
    this.humEnabled = enabled;
    if (this.lastAnalysis) {
      this.updateCircuitParameters(this.lastAnalysis);
    }
    this.notify();
  }

  public setMasterVolume(vol: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime, 0.05);
    }
  }

  public dispose() {
    this.stopRiff();
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
  }
}

export const guitarAudio = new GuitarAudioEngine();
