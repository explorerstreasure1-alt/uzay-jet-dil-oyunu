import type { HeatLevel, LangCode } from '../data/vocabulary';
import { LANGUAGES } from '../data/vocabulary';

/* ══════════════════════════════════════════════════════════════════
   AUDIO ENGINE
   · Procedural chiptune with a real 4-bar chord progression
   · Stereo-placed SFX (binaural intent: reward left, error right)
   · High-quality TTS with voice ranking + warm-up + safe queueing
   ══════════════════════════════════════════════════════════════════ */

const A_MINOR = [220.0, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0];
/* Am → F → C → G  (scale-degree roots) */
const PROGRESSION = [0, 5, 2, 6];

const STYLE: Record<HeatLevel, { bpm: number; arpVol: number; lead: boolean; hats: boolean; bell: boolean }> = {
  ice:     { bpm: 112, arpVol: 0.032, lead: false, hats: true,  bell: true  },
  amber:   { bpm: 132, arpVol: 0.042, lead: true,  hats: true,  bell: false },
  crimson: { bpm: 154, arpVol: 0.055, lead: true,  hats: true,  bell: false },
};

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private verb: ConvolverNode | null = null;
  private verbSend: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private seq: number | null = null;
  private step = 0;
  private nextT = 0;
  private heat: HeatLevel = 'ice';
  private waveIntensity = 0;

  musicOn = true;
  sfxOn = true;
  ttsOn = true;

  /* ─────────── adrenalin arka plan — prosedürel + MP3 hibrit ─────────── */
  private bgmVol = 0.16;
  private mp3: HTMLAudioElement | null = null;
  private mp3Ready = false;

  /* ─────────── graph ─────────── */
  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = 0.42;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 22;
      comp.ratio.value = 3.4; comp.attack.value = 0.004; comp.release.value = 0.2;
      this.master.connect(comp); comp.connect(ctx.destination);

      this.music = ctx.createGain(); this.music.gain.value = 0; this.music.connect(this.master);
      this.sfx = ctx.createGain(); this.sfx.gain.value = 0.72; this.sfx.connect(this.master);

      /* tiny algorithmic plate reverb */
      const dur = 1.5, sr = ctx.sampleRate;
      const ir = ctx.createBuffer(2, sr * dur, sr);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < d.length; i++) {
          const t = i / d.length;
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * 0.55;
        }
      }
      this.verb = ctx.createConvolver(); this.verb.buffer = ir;
      this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.16;
      this.verbSend.connect(this.verb); this.verb.connect(this.master);

      const nl = sr * 1.0;
      this.noiseBuf = ctx.createBuffer(1, nl, sr);
      const nd = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  unlock() { this.ensure(); void this.voices(); this.warmTTS(); }

  private pan(v: number): AudioNode | null {
    const ctx = this.ensure(); if (!ctx) return null;
    if (typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, v));
      return p;
    }
    return null;
  }

  private voice(o: {
    f: number; to?: number; dur: number; type: OscillatorType; vol: number;
    pan?: number; delay?: number; verb?: number; detune?: number; curve?: 'exp' | 'lin';
  }) {
    const ctx = this.ensure(); if (!ctx || !this.sfx) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(Math.max(20, o.f), t0);
    if (o.detune) osc.detune.value = o.detune;
    if (o.to) {
      if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g);
    const p = o.pan !== undefined ? this.pan(o.pan) : null;
    if (p) { g.connect(p); p.connect(this.sfx); } else g.connect(this.sfx);
    if (o.verb && this.verbSend) {
      const s = ctx.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(this.verbSend);
    }
    osc.start(t0); osc.stop(t0 + o.dur + 0.03);
  }

  private hiss(o: { dur: number; vol: number; hp?: number; lp?: number; pan?: number; delay?: number; verb?: number }) {
    const ctx = this.ensure(); if (!ctx || !this.sfx || !this.noiseBuf) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    let node: AudioNode = src;
    if (o.hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; node.connect(f); node = f; }
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp, t0); f.frequency.exponentialRampToValueAtTime(Math.max(120, o.lp * 0.18), t0 + o.dur); node.connect(f); node = f; }
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    node.connect(g);
    const p = o.pan !== undefined ? this.pan(o.pan) : null;
    if (p) { g.connect(p); p.connect(this.sfx); } else g.connect(this.sfx);
    if (o.verb && this.verbSend) { const s = ctx.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(this.verbSend); }
    src.start(t0); src.stop(t0 + o.dur + 0.03);
  }

  private deg(d: number, oct = 0) {
    const i = ((d % 7) + 7) % 7;
    const o = Math.floor(d / 7) + oct;
    return A_MINOR[i] * Math.pow(2, o);
  }

  /* ─────────── adrenalin prosedürel müzik + MP3 hibrit — arkada güçlü melodi ─────────── */
  private ensureMp3() {
    if (this.mp3 || typeof window === 'undefined') return;
    try {
      const a = new Audio();
      // iki adrenalin track'inden birini rastgele seç — ikisi de public/music'de
      const tracks = ['/music/Defiant_Horizon.mp3', '/music/Broadside_Command.mp3'];
      a.src = tracks[Math.floor(Math.random() * tracks.length)];
      a.loop = true;
      a.preload = 'auto';
      a.crossOrigin = 'anonymous';
      a.volume = 0;
      this.mp3 = a;
      a.addEventListener('canplaythrough', () => { this.mp3Ready = true; if (this.musicOn) this.fadeMp3(this.bgmVol * 0.42, 1.2); }, { once: true });
      a.load();
    } catch {}
  }
  private fadeMp3(to: number, time: number) {
    if (!this.mp3) return;
    try {
      const a = this.mp3;
      const start = a.volume;
      const t0 = performance.now();
      const tick = () => {
        const p = Math.min(1, (performance.now() - t0) / (time * 1000));
        a.volume = start + (to - start) * p;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {}
  }
  startMusic(heat: HeatLevel = 'ice') {
    const ctx = this.ensure(); if (!ctx || !this.music) return;
    this.heat = heat;
    this.music.gain.cancelScheduledValues(ctx.currentTime);
    this.music.gain.setTargetAtTime(this.musicOn ? this.bgmVol * 1.15 : 0, ctx.currentTime, 0.7);
    if (this.seq !== null) {
      if (this.mp3Ready && this.mp3 && this.musicOn) { void this.mp3.play().catch(()=>{}); this.fadeMp3(this.bgmVol * 0.44, 0.9); }
      return;
    }
    this.nextT = ctx.currentTime + 0.1;
    this.seq = window.setInterval(() => this.pump(), 25);
    // MP3 adrenalin altyapısı
    this.ensureMp3();
    if (this.mp3 && this.musicOn) {
      void this.mp3.play().catch(()=>{});
      this.fadeMp3(this.bgmVol * 0.44, 1.1);
    }
  }
  setHeat(h: HeatLevel) {
    if (h === this.heat) return;
    this.heat = h;
  }
  setWave(wave: number, frenzy = false) {
    this.waveIntensity = Math.min(0.55, wave * 0.015 + (frenzy ? 0.18 : 0));
  }
  stopMusic() {
    const ctx = this.ctx;
    if (ctx && this.music) this.music.gain.setTargetAtTime(0, ctx.currentTime, 0.35);
    if (this.seq !== null) { window.clearInterval(this.seq); this.seq = null; }
    if (this.mp3) { this.fadeMp3(0, 0.45); window.setTimeout(()=>{ try{ this.mp3!.pause(); }catch{} }, 500); }
  }
  setMusicEnabled(on: boolean) {
    this.musicOn = on;
    const ctx = this.ctx;
    if (ctx && this.music) this.music.gain.setTargetAtTime(on ? this.bgmVol * 1.15 : 0, ctx.currentTime, 0.3);
    if (this.mp3) {
      if (on) { this.ensureMp3(); void this.mp3.play().catch(()=>{}); this.fadeMp3(this.bgmVol * 0.44, 0.7); }
      else this.fadeMp3(0, 0.4);
    }
  }
  setSfxEnabled(on: boolean) { this.sfxOn = on; }
  setBgmVolume(v: number) {
    this.bgmVol = Math.max(0, Math.min(1, v));
    const ctx = this.ctx;
    if (ctx && this.music && this.musicOn) this.music.gain.setTargetAtTime(this.bgmVol * 1.15, ctx.currentTime, 0.25);
    if (this.mp3 && this.musicOn) this.fadeMp3(this.bgmVol * 0.44, 0.35);
  }

  private pump() {
    const ctx = this.ctx; if (!ctx) return;
    const baseBpm = STYLE[this.heat].bpm;
    const bpm = baseBpm * (1 + this.waveIntensity * 0.55);
    const spb = 60 / bpm / 4;
    while (this.nextT < ctx.currentTime + 0.15) {
      this.bar(this.step, this.nextT);
      this.nextT += spb;
      this.step = (this.step + 1) % 32;
    }
  }

  private mNote(o: { f: number; t: number; dur: number; type: OscillatorType; vol: number; verb?: number }) {
    const ctx = this.ctx!, bus = this.music!;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type; osc.frequency.value = o.f;
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.exponentialRampToValueAtTime(o.vol, o.t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    osc.connect(g); g.connect(bus);
    if (o.verb && this.verbSend) { const s = ctx.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(this.verbSend); }
    osc.start(o.t); osc.stop(o.t + o.dur + 0.03);
  }

  private bar(step: number, t: number) {
    const ctx = this.ctx!, bus = this.music!;
    const st = STYLE[this.heat];
    const chord = PROGRESSION[Math.floor(step / 8) % 4];
    const s8 = step % 8;

    // KICK — her 4'te, adrenalin dalgası arttıkça daha tok
    if (s8 % 2 === 0) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(148, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
      g.gain.setValueAtTime(0.22 + this.waveIntensity * 0.14, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.20);
    }
    // off-beat hat — ice'da bile hafif tik, amber/crimson'da daha agresif
    if (st.hats && s8 % 2 === 1) {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf!;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = st.heat === 'crimson' ? 9200 : 8200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(s8 === 3 ? 0.052 : 0.028, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      src.connect(f); f.connect(g); g.connect(bus); src.start(t); src.stop(t + 0.05);
    }
    // BASS — her barın 1 ve 3. vuruşunda, arp'ın altında sürükler
    if (s8 === 0 || s8 === 4) {
      const detune = this.heat === 'crimson' ? 1.008 : 1.004;
      this.mNote({ f: this.deg(chord, -2), t, dur: 0.32, type: 'triangle', vol: 0.11 });
      this.mNote({ f: this.deg(chord, -2) * detune, t, dur: 0.32, type: 'square', vol: 0.028 });
    }
    // ARP — 16'lık, crimson'da daha parlak saw
    const arpTones = this.heat === 'crimson' ? [0, 2, 4, 7] : [0, 2, 4, 2];
    this.mNote({
      f: this.deg(chord + arpTones[s8 % 4], s8 >= 4 ? 1 : 0),
      t, dur: 0.16, type: this.heat === 'crimson' ? 'sawtooth' : 'square',
      vol: st.arpVol * (1 + this.waveIntensity * 0.35), verb: 0.22,
    });
    // ikincil arp katmanı — amber/crimson'da adrenalin
    if ((st.lead || this.waveIntensity > 0.18) && s8 % 2 === 0) {
      this.mNote({
        f: this.deg(chord + arpTones[(s8 + 2) % 4], 1),
        t: t + 0.06, dur: 0.11, type: 'triangle', vol: st.arpVol * 0.42, verb: 0.18,
      });
    }
    if (st.bell && step % 16 === 10) {
      this.mNote({ f: this.deg(chord + 4, 1), t, dur: 1.15, type: 'sine', vol: 0.09, verb: 0.52 });
      this.mNote({ f: this.deg(chord + 2, 2), t: t + 0.28, dur: 0.95, type: 'sine', vol: 0.055, verb: 0.52 });
    }
    // LEAD — her 8'de değil, 4'te bir, daha melodik
    if (st.lead && s8 % 4 === 2) {
      const leadTones = [4, 7, 9, 7];
      const f = this.deg(chord + leadTones[Math.floor(step / 4) % 4], 1);
      this.mNote({ f, t, dur: 0.28, type: 'sawtooth', vol: 0.052, verb: 0.28 });
      this.mNote({ f: f * 1.007, t, dur: 0.28, type: 'sawtooth', vol: 0.038 });
    }
  }

  /* ─────────── SFX ─────────── */
  laser() {
    if (!this.sfxOn) return;
    this.voice({ f: 1400, to: 320, dur: 0.13, type: 'square', vol: 0.10, pan: 0 });
    this.voice({ f: 2600, to: 700, dur: 0.07, type: 'sawtooth', vol: 0.035 });
    this.hiss({ dur: 0.05, vol: 0.035, hp: 4200 });
  }
  explode(big = false) {
    if (!this.sfxOn) return;
    this.hiss({ dur: big ? 0.55 : 0.34, vol: big ? 0.3 : 0.2, lp: big ? 2600 : 3400, verb: 0.28 });
    this.voice({ f: big ? 150 : 190, to: 34, dur: big ? 0.42 : 0.26, type: 'square', vol: 0.12 });
    this.voice({ f: 70, to: 28, dur: 0.3, type: 'sine', vol: big ? 0.24 : 0.14 });
  }
  /* reward — placed slightly LEFT (language hemisphere cue) */
  correct() {
    if (!this.sfxOn) return;
    [[0, 0], [2, 0.055], [4, 0.11], [7, 0.17]].forEach(([d, dl]) => {
      this.voice({ f: this.deg(d, 1), dur: 0.28, type: 'triangle', vol: 0.13, pan: -0.55, delay: dl, verb: 0.42 });
      this.voice({ f: this.deg(d, 2), dur: 0.2, type: 'sine', vol: 0.05, pan: -0.55, delay: dl, verb: 0.5 });
    });
  }
  /* error — short glitch placed RIGHT */
  wrong() {
    if (!this.sfxOn) return;
    this.voice({ f: 420, to: 96, dur: 0.3, type: 'sawtooth', vol: 0.13, pan: 0.6, detune: 18 });
    this.voice({ f: 404, to: 92, dur: 0.3, type: 'square', vol: 0.07, pan: 0.6 });
    this.hiss({ dur: 0.16, vol: 0.1, hp: 900, pan: 0.6 });
  }
  combo() {
    if (!this.sfxOn) return;
    [0, 2, 4, 6, 9].forEach((d, i) =>
      this.voice({ f: this.deg(d, 1), dur: 0.2, type: 'square', vol: 0.1, delay: i * 0.045, pan: -0.25, verb: 0.35 }));
  }
  boss() {
    if (!this.sfxOn) return;
    this.voice({ f: 110, to: 55, dur: 1.1, type: 'sawtooth', vol: 0.16, verb: 0.4 });
    this.voice({ f: 220, to: 110, dur: 1.1, type: 'square', vol: 0.06, detune: 14 });
    this.hiss({ dur: 0.9, vol: 0.08, lp: 900, verb: 0.5 });
  }
  levelUp() {
    if (!this.sfxOn) return;
    [0, 2, 4, 7, 9, 11, 14].forEach((d, i) =>
      this.voice({ f: this.deg(d, 1), dur: 0.4, type: 'triangle', vol: 0.12, delay: i * 0.095, verb: 0.5 }));
  }
  repair() {
    if (!this.sfxOn) return;
    [4, 7, 11].forEach((d, i) =>
      this.voice({ f: this.deg(d, 1), dur: 0.26, type: 'sine', vol: 0.14, delay: i * 0.07, verb: 0.4 }));
  }
  breach() {
    if (!this.sfxOn) return;
    this.voice({ f: 300, to: 70, dur: 0.6, type: 'triangle', vol: 0.14, pan: 0.4, verb: 0.3 });
    this.hiss({ dur: 0.4, vol: 0.09, lp: 1400, pan: 0.4 });
  }
  ui() { if (!this.sfxOn) return; this.voice({ f: 1500, dur: 0.04, type: 'square', vol: 0.05 }); }
  tick() { if (!this.sfxOn) return; this.voice({ f: 900, to: 1500, dur: 0.05, type: 'square', vol: 0.045 }); }

  /* ══════════ TTS ══════════ */
  private cache: SpeechSynthesisVoice[] = [];
  private warmed = false;
  private speakTimer: number | null = null;

  private voices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !window.speechSynthesis) return [];
    const v = window.speechSynthesis.getVoices();
    if (v.length) this.cache = v;
    else if (!this.cache.length) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.cache = window.speechSynthesis.getVoices();
      };
    }
    return this.cache;
  }

  private warmTTS() {
    if (this.warmed || typeof window === 'undefined' || !window.speechSynthesis) return;
    this.warmed = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0; u.rate = 2;
      window.speechSynthesis.speak(u);
    } catch { /* noop */ }
  }

  /** Rank available voices so we never land on a novelty / robotic fallback. */
  private bestVoice(tag: string): SpeechSynthesisVoice | null {
    const all = this.voices();
    if (!all.length) return null;
    const want = tag.toLowerCase().replace('_', '-');
    const base = want.slice(0, 2);
    const pool = all.filter(v => (v.lang || '').toLowerCase().replace('_', '-').startsWith(base));
    if (!pool.length) return null;

    const BAD = /(compact|espeak|novelty|whisper|bells|organ|zarvox|trinoids|bubbles|cellos|bad news|good news|jester|boing|deranged|hysterical|bahh|albert|wobble|superstar)/;
    const GREAT = /(natural|neural|premium|enhanced|wavenet|studio|siri|multilingual)/;

    const score = (v: SpeechSynthesisVoice) => {
      const n = (v.name || '').toLowerCase();
      const l = (v.lang || '').toLowerCase().replace('_', '-');
      let s = 0;
      if (l === want) s += 45;
      else if (l.startsWith(base)) s += 18;
      if (GREAT.test(n)) s += 34;
      if (n.includes('google')) s += 26;
      if (n.includes('microsoft')) s += 18;
      if (n.includes('apple')) s += 10;
      if (!v.localService) s += 8;
      if (v.default) s += 4;
      if (BAD.test(n)) s -= 120;
      return s;
    };
    return [...pool].sort((a, b) => score(b) - score(a))[0] ?? null;
  }

  /**
   * Speak a word in its own language.
   * `delay` lets us duck under the explosion SFX so the word stays intelligible.
   */
  /** user-tunable playback speed (0.7 … 1.3) */
  ttsRate = 1.0;
  private voiceFor = new Map<string, SpeechSynthesisVoice | null>();

  /**
   * Instant, fluent pronunciation. No artificial delay — the SFX bus is
   * ducked instead, so the word lands crisply on the same frame as the kill.
   */
  speak(text: string, lang: LangCode, delay = 0) {
    if (!this.ttsOn || !text) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const tag = LANGUAGES.find(l => l.code === lang)?.tts ?? 'en-US';

    const run = () => {
      this.speakTimer = null;
      try {
        const synth = window.speechSynthesis;
        synth.cancel();                                  // never queue up a backlog
        const u = new SpeechSynthesisUtterance(text);
        u.lang = tag;
        if (!this.voiceFor.has(tag)) this.voiceFor.set(tag, this.bestVoice(tag));
        const v = this.voiceFor.get(tag);
        if (v) u.voice = v;
        /* Natural conversational pace — short items get a touch more air. */
        const long = text.length > 14;
        u.rate = Math.max(0.6, Math.min(1.4, this.ttsRate * (long ? 0.97 : 1.06)));
        u.pitch = 1.0;
        u.volume = 1;
        /* duck the SFX bus so the voice always sits on top */
        this.duck(0.34, 0.7);
        u.onend = () => this.duck(0.85, 0.25);
        u.onerror = () => this.duck(0.85, 0.25);
        synth.speak(u);
        window.setTimeout(() => { try { if (synth.paused) synth.resume(); } catch { /* noop */ } }, 90);
      } catch { /* noop */ }
    };

    if (this.speakTimer !== null) window.clearTimeout(this.speakTimer);
    if (delay <= 0) run();
    else this.speakTimer = window.setTimeout(run, delay);
  }

  private duck(to: number, time: number) {
    const ctx = this.ctx;
    if (!ctx || !this.sfx || !this.music) return;
    this.sfx.gain.setTargetAtTime(to, ctx.currentTime, time * 0.3);
    this.music.gain.setTargetAtTime(this.musicOn ? (to < 0.5 ? this.bgmVol * 0.55 : this.bgmVol * 1.35) : 0, ctx.currentTime, time * 0.4);
  }

  setRate(r: number) { this.ttsRate = r; }

  stopSpeech() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (this.speakTimer !== null) { window.clearTimeout(this.speakTimer); this.speakTimer = null; }
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
  }

  voiceLabel(lang: LangCode): string {
    const meta = LANGUAGES.find(l => l.code === lang);
    const v = this.bestVoice(meta?.tts ?? 'en-US');
    return v ? v.name : 'Sistem sesi bulunamadı';
  }
}

export const audio = new AudioEngine();

/* ─────────── Haptics ─────────── */
type HapticKind = 'hit' | 'miss' | 'boss' | 'level' | 'tap' | 'breach';
const HAPTICS: Record<HapticKind, number | number[]> = {
  tap: 8,
  hit: [0, 18, 26, 34],
  miss: [0, 70, 45, 110],
  breach: [0, 130],
  boss: [0, 36, 26, 36, 26, 140],
  level: [0, 45, 40, 45, 40, 180],
};
export function haptic(kind: HapticKind, enabled = true) {
  if (!enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try { navigator.vibrate(HAPTICS[kind]); } catch { /* noop */ }
}
