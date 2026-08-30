import { useCallback, useEffect, useRef, useState } from 'react';
import type { Alien, GameState, Settings, RunStats, HeatMap } from '../types/game';
import type { CategoryId, CEFRLevel, HeatLevel, LangCode, VocabWord } from '../data/vocabulary';
import { LEVEL_CONFIG, getWords, HEAT_META } from '../data/vocabulary';
import {
  store, heatOf, isDue, applyResult, highScoreKey, DEFAULT_SETTINGS, bumpStreak,
} from '../lib/storage';
import { ACHIEVEMENTS } from '../lib/achievements';
import { audio, haptic } from '../lib/audio';

export const VW = 400;
export const VH = 760;
export const SHIP_Y = 542;
export const FLOOR_Y = 488;
const SPRITE_H = 40;
const PLATE_H = 18;
const HIT_H = SPRITE_H + PLATE_H + 6;
const LASER_SPEED = 58;
const COMBO_TO_OVERCHARGE = 5;
const OVERCHARGE_MS = 9000;
const FOCUS_MS = 2600;
const BOSS_EVERY = 5;

let idc = 0;
const uid = () => `e${++idc}`;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const DIFF = {
  zen:      { lives: 7, speed: 0.82, score: 0.8, label: 'ZEN' },
  normal:   { lives: 5, speed: 1.00, score: 1.0, label: 'NORMAL' },
  hardcore: { lives: 3, speed: 1.55, score: 1.7, label: 'HARDCORE' },
};

/** Her dalgada hız %5.5 artar — adrenalin için belirgin hızlanma. Max %90 artışta sabitlenir. */
const WAVE_SPEED_RAMP = 0.055;
const MAX_RAMP = 1.90;

function makeNeurons(): GameState['neurons'] {
  const heats: HeatLevel[] = ['ice', 'amber', 'crimson'];
  return Array.from({ length: 18 }, (_, i) => ({
    id: `n${i}`, x: rnd(0, VW), y: rnd(0, VH),
    baseOpacity: rnd(0.05, 0.16), pulsePhase: rnd(0, Math.PI * 2),
    pulseSpeed: rnd(0.008, 0.022), size: rnd(1, 2.5),
    heat: heats[i % 3], color: '#00d4ff',
  }));
}
function makeStars(): GameState['parallaxStars'] {
  return Array.from({ length: 36 }, (_, i) => ({
    id: `s${i}`, x: rnd(0, VW), y: rnd(0, VH), layer: 1 + (i % 3),
    opacity: rnd(0.22, 0.8), pulsePhase: rnd(0, Math.PI * 2), size: 1 + (i % 3),
  }));
}

const initialState = (): GameState => ({
  phase: 'menu', lang: 'en', level: 'A1', category: 'all',
  wave: 0, wavesCleared: 0, score: 0, multiplier: 1, combo: 0, bestCombo: 0,
  lives: 3, maxLives: 3, overcharged: false, overchargeTimer: 0,
  shield: false, focusTimer: 0, perfectStreak: 0,
  shipX: VW / 2, shipY: SHIP_Y, shipVx: 0,
  wingmen: [
    { id: 'wL', side: -1, x: VW / 2 - 44, y: SHIP_Y + 14, cooldown: 18 },
    { id: 'wR', side: 1, x: VW / 2 + 44, y: SHIP_Y + 14, cooldown: 42 },
  ],
  aliens: [], bullets: [], explosions: [], floats: [],
  neurons: makeNeurons(), parallaxStars: makeStars(),
  repairStation: null, targetWord: null, targetHeat: 'ice',
  bossWave: false, gameTime: 0, lastShot: 0, shake: 0, flash: null,
  vignette: 0, correctThisWave: 0, wrongThisWave: 0, runCorrect: 0, runWrong: 0,
  waveBanner: null, masteredThisLevel: [], hitCard: null, speechNudge: 0, repeatMode: false, uslukCharge: 88, uslukArrow: null, waveAge: 0, danger: 0, frenzy: false, hitPause: 0, cloze: null, isCloze: false,
});

/* ════════════════════════════════════════════════════════════════
   LANE LAYOUT — the fix for "başka kelimeler önüne geçiyor".
   Every alien owns an exclusive vertical corridor. A shot fired
   from lane N can ONLY ever reach the alien in lane N, so the
   target is always reachable no matter the vertical arrangement.
   Sway is purely cosmetic; the hitbox is the whole lane band.
   ════════════════════════════════════════════════════════════════ */
function pickVariant(wave: number, level: CEFRLevel): import('../types/game').AlienVariant {
  const eliteChance = Math.min(0.58, 0.06 + wave * 0.028 + (['B1', 'B2', 'C1'].includes(level) ? 0.10 : 0));
  if (Math.random() > eliteChance) return 'standard';
  const r = Math.random();
  // wave 10+ phantom daha sık
  if (wave >= 10 && r < 0.22) return 'phantom';
  if (r < 0.42) return 'swift';
  if (r < 0.78) return 'tank';
  return 'phantom';
}

function layoutWave(
  entries: { w: VocabWord; heat: HeatLevel }[],
  level: CEFRLevel,
  bossIndex: number,
  targetId: string,
  speedMul: number,
  wave: number,
): Alien[] {
  const cfg = LEVEL_CONFIG[level];
  const n = entries.length;
  const laneW = VW / n;
  const ramp = Math.min(MAX_RAMP, 1 + (wave - 1) * WAVE_SPEED_RAMP);
  const baseVy = cfg.speed * speedMul * ramp;
  return entries.map((e, i) => {
    const laneX = laneW * i;
    const stagger = (i % 2) * 74;
    const isBoss = i === bossIndex;
    let variant: import('../types/game').AlienVariant = 'standard';
    let vy = baseVy * rnd(0.95, 1.05);
    let hp = 1;
    let swayMag = Math.min(laneW * 0.14, 9);
    if (isBoss) {
      variant = 'standard'; // boss kendi tipi
      hp = 3;
    } else {
      variant = pickVariant(wave, level);
      if (variant === 'swift') { vy *= 1.42; swayMag *= 1.75; hp = 1; }
      else if (variant === 'tank') { vy *= 0.74; swayMag *= 0.55; hp = wave >= 12 ? 3 : 2; }
      else if (variant === 'phantom') { vy *= 1.18; swayMag *= 1.25; hp = 1; }
    }
    // Hedef canavar her zaman bir tık daha hızlı — oyuncu doğru olanı öncelikle vurmak zorunda
    const isTarget = e.w.id === targetId;
    if (isTarget && !isBoss) vy *= 1.22;
    return {
      id: uid(),
      word: e.w,
      heat: e.heat,
      variant,
      lane: i,
      laneX,
      laneW,
      drawX: laneX + laneW / 2,
      y: 68 - stagger,
      vy,
      sway: swayMag * (Math.random() < 0.5 ? -1 : 1),
      hp, maxHp: hp,
      isBoss,
      isTarget,
      glowPhase: rnd(0, Math.PI * 2),
      hitFlash: 0,
      dead: false,
      deathT: 0,
      cloakPhase: rnd(0, Math.PI * 2),
    };
  });
}

export interface EngineApi {
  state: GameState;
  settings: Settings;
  stats: RunStats;
  heat: HeatMap;
  customWords: VocabWord[];
  /** lane the ship is currently aimed at — drives the lock-on reticle */
  lockedId: string | null;
  /** alien the player *should* shoot — non-null while assist is showing */
  hintId: string | null;
  stepLane: (d: -1 | 1) => void;
  gotoX: (x: number) => void;
  replay: () => void;
  startRun: (lang: LangCode, level: CEFRLevel, category: CategoryId, cloze?: boolean) => void;
  startWrongRun: (lang: LangCode, level: CEFRLevel, ids: string[]) => void;
  addSpeechBonus: (pts: number) => void;
  triggerMine: () => void;
  toggleRepeat: () => void;
  fireUsluk: () => boolean;
  setUslukHeld: (v: boolean) => void;
  fire: () => void;
  setMoveTarget: (x: number | null) => void;
  holdDir: (d: -1 | 0 | 1) => void;
  pause: () => void;
  resume: () => void;
  quit: () => void;
  updateSettings: (s: Partial<Settings>) => void;
  addCustomWord: (w: { foreign: string; native: string; lang: LangCode; level: CEFRLevel; category: Exclude<CategoryId, 'all'> }) => void;
  removeCustomWord: (id: string) => void;
  resetProgress: () => void;
}

export function useGameEngine(onEnd: (kind: 'gameOver' | 'levelComplete') => void): EngineApi {
  const ref = useRef<GameState>(initialState());
  const [, force] = useState(0);
  const sync = useCallback(() => force(v => (v + 1) % 1e9), []);

  const [settings, setSettings] = useState<Settings>(() => store.loadSettings());
  const [stats, setStats] = useState<RunStats>(() => store.loadStats());
  const [heat, setHeat] = useState<HeatMap>(() => store.loadHeat());
  const [customWords, setCustomWords] = useState<VocabWord[]>(() => store.loadCustom());

  const heatRef = useRef(heat);
  const statsRef = useRef(stats);
  const setRef = useRef(settings);
  const customRef = useRef(customWords);
  useEffect(() => { setRef.current = settings; }, [settings]);
  useEffect(() => { customRef.current = customWords; }, [customWords]);

  const moveTarget = useRef<number | null>(null);
  const dirHold = useRef<-1 | 0 | 1>(0);
  const keys = useRef<Set<string>>(new Set());
  const endCb = useRef(onEnd);
  useEffect(() => { endCb.current = onEnd; }, [onEnd]);

  /** Yanlış defteri filtresi: sadece bu id'ler havuzda kalır */
  const wrongFilterRef = useRef<Set<string> | null>(null);
  const clozeModeRef = useRef(false);
  /** Koşu boyunca her hedefin kaç kez sorulduğu — en fazla 2 tekrar, sonra taze kelimeye geç. */
  const sessionCountsRef = useRef<Map<string, number>>(new Map());
  const frameTick = useRef(0);
  const uslukHeldRef = useRef(false);

  /* ── debounced persistence (keeps localStorage out of the hot path) ── */
  const flushT = useRef<number | null>(null);
  const flushNow = useCallback(() => {
    if (flushT.current !== null) { window.clearTimeout(flushT.current); flushT.current = null; }
    store.saveHeat(heatRef.current);
    store.saveStats(statsRef.current);
    setHeat({ ...heatRef.current });
    setStats({ ...statsRef.current });
  }, []);
  const flushSoon = useCallback(() => {
    if (flushT.current !== null) return;
    flushT.current = window.setTimeout(() => { flushT.current = null; flushNow(); }, 400);
  }, [flushNow]);
  useEffect(() => () => { if (flushT.current !== null) window.clearTimeout(flushT.current); }, []);

  /* ── wave construction — taze kelime öncelikli, en fazla 2 tekrar, havuz bitince başa sar ── */
  const spawnWave = useCallback((wave: number, banner?: string, sub?: string) => {
    const s = ref.current;
    let pool = getWords(s.lang, s.level, s.category, customRef.current);
    if (wrongFilterRef.current) {
      const filtered = pool.filter(w => wrongFilterRef.current!.has(w.id));
      if (filtered.length >= 2) pool = filtered;
      else if (filtered.length === 1) {
        const extra = pool.filter(w => !wrongFilterRef.current!.has(w.id)).slice(0, 6);
        pool = [...filtered, ...extra];
      }
    }
    if (pool.length < 2) return;

    const cfg = LEVEL_CONFIG[s.level];
    const diff = DIFF[setRef.current.difficulty];
    const isFrenzy = wave >= 8 && wave % 8 === 0;
    const isBoss = !isFrenzy && wave % BOSS_EVERY === 0;
    let lanes = Math.min(cfg.lanes, Math.max(2, pool.length));
    if (isFrenzy) lanes = Math.min(5, Math.max(4, pool.length));

    const getCnt = (id: string) => sessionCountsRef.current.get(id) ?? 0;
    const isRepeat = (ref.current as any).repeatMode;
    const maxRep = isRepeat ? 5 : 2;
    // pekiştirme modunda her kelime aralıklı tekrar — limit 5, yoksa taze mod 2
    let available = pool.filter(w => getCnt(w.id) < maxRep);
    if (available.length === 0) {
      sessionCountsRef.current.clear();
      available = pool;
    }
    if (available.length < 2 && wrongFilterRef.current) available = pool;
    // pekiştirme modunda ice/amber öncelikli havuzu daralt
    if (isRepeat) {
      const need = available.filter(w => heatOf(heatRef.current[w.id]) !== 'crimson');
      if (need.length >= 2) available = need;
    }

    let target: VocabWord;
    if (isBoss) {
      const pickBoss = (src: VocabWord[]) => {
        const never = src.filter(w => !heatRef.current[w.id] || heatRef.current[w.id].seen === 0);
        const tier = never.length ? never : src.filter(w => getCnt(w.id) === 0).length ? src.filter(w => getCnt(w.id) === 0) : src;
        return tier[Math.floor(Math.random() * tier.length)];
      };
      const dueCrimson = available.filter(w => heatOf(heatRef.current[w.id]) === 'crimson' && isDue(heatRef.current[w.id]));
      const dueAny = available.filter(w => isDue(heatRef.current[w.id]));
      const crimson = available.filter(w => heatOf(heatRef.current[w.id]) === 'crimson');
      const amber = available.filter(w => heatOf(heatRef.current[w.id]) === 'amber');
      const ice = available.filter(w => heatOf(heatRef.current[w.id]) === 'ice');
      let src: VocabWord[] = [];
      if (dueCrimson.length) src = dueCrimson;
      else if (dueAny.length) src = dueAny;
      else if (crimson.length) src = crimson;
      else if (amber.length) src = amber;
      else if (ice.length) src = ice;
      else src = available;
      target = pickBoss(src) ?? available[Math.floor(Math.random() * available.length)];
    } else {
      const neverSeen = available.filter(w => !heatRef.current[w.id] || heatRef.current[w.id].seen === 0);
      let candidateSet: VocabWord[];
      if (neverSeen.length) candidateSet = neverSeen;
      else {
        const notYet = available.filter(w => getCnt(w.id) === 0);
        candidateSet = notYet.length ? notYet : available;
      }
      target = candidateSet[Math.floor(Math.random() * candidateSet.length)];
    }

    // tazelik öncelikli decoy seçimi: aynı havuzdan, en az görülenden başla, kategori çeşitliliği korunsun
    const decoyNeed = lanes - 1;
    const others = pool.filter(w => w.id !== target.id && w.native !== target.native && w.foreign !== target.foreign);
    const decoySelected: VocabWord[] = [];
    const tiers: VocabWord[][] = [[], [], []];
    for (const w of others) {
      const c = getCnt(w.id);
      if (c === 0) tiers[0].push(w);
      else if (c === 1) tiers[1].push(w);
      else tiers[2].push(w);
    }
    // her tier içinde: önce hiç görülmemişleri öne al, sonra aynı kategoriyi hafif öne al, sonra karıştır
    const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
    const ordered: VocabWord[] = [];
    for (const tier of tiers) {
      const unseen = shuffle(tier.filter(w => !heatRef.current[w.id] || heatRef.current[w.id].seen === 0));
      const seen = shuffle(tier.filter(w => heatRef.current[w.id] && heatRef.current[w.id].seen !== 0));
      // aynı kategori hafif öncelik: hedefle aynı kategoride olanları başa al
      const prio = (arr: VocabWord[]) => {
        const same = arr.filter(w => w.category === target.category);
        const diffCat = arr.filter(w => w.category !== target.category);
        return [...shuffle(same), ...shuffle(diffCat)];
      };
      ordered.push(...prio(unseen), ...prio(seen));
    }
    for (const w of ordered) {
      if (decoySelected.some(x => x.id === w.id)) continue;
      decoySelected.push(w);
      if (decoySelected.length >= decoyNeed) break;
    }
    // havuz çok darsa kalanı rastgele doldur
    if (decoySelected.length < decoyNeed) {
      const rest = shuffle(others.filter(w => !decoySelected.some(s => s.id === w.id)));
      for (const w of rest) {
        decoySelected.push(w);
        if (decoySelected.length >= decoyNeed) break;
      }
    }
    const decoys = decoySelected.slice(0, decoyNeed);
    const shuffled = [target, ...decoys].sort(() => Math.random() - 0.5);
    const entries = shuffled.map(w => ({ w, heat: heatOf(heatRef.current[w.id]) }));
    const bossIndex = isBoss ? entries.findIndex(e => e.w.id === target.id) : -1;
    let aliens = layoutWave(entries, s.level, bossIndex, target.id, diff.speed, wave);
    if (isFrenzy) {
      for (const a of aliens) {
        if (!a.isBoss) { a.variant = 'swift'; a.vy *= 1.38; a.sway *= 1.45; }
      }
    }
    // koşu sayacını güncelle: hedef 2'ye ulaştı, sonraki dalgalarda gelmeyecek (havuz bitene kadar)
    sessionCountsRef.current.set(target.id, getCnt(target.id) + 1);

    const autoBanner = banner ?? (isFrenzy ? '⚡ FRENZY' : `DALGA ${wave}`);
    const autoSub = sub ?? (isFrenzy ? 'TÜM ŞERİTLER HIZLI — HİÇ DURMA' : '');
    let clozeData: GameState['cloze'] = null;
    // Otomatik akıcılık: cümle modu kapalı olsa bile her 4. dalga cümle dalgası — bağlamda öğrenme
    const autoCloze = !clozeModeRef.current && wave % 4 === 0 && wave >= 4 && !isBoss && !isFrenzy;
    let isCloze = clozeModeRef.current || autoCloze;
    if (isCloze) {
      const isVerb = target.category === 'verb';
      let foreignBlank: string, nativeBlank: string;
      if (s.lang === 'en') { foreignBlank = isVerb ? 'I want to ___' : 'Where is ___?'; nativeBlank = isVerb ? `___ ${target.native}` : `___ nerede?`; }
      else if (s.lang === 'es') { foreignBlank = isVerb ? 'Quiero ___' : '¿Dónde está ___?'; nativeBlank = isVerb ? `___ ${target.native}` : `___ nerede?`; }
      else if (s.lang === 'it') { foreignBlank = isVerb ? 'Voglio ___' : 'Dov\'è ___?'; nativeBlank = isVerb ? `___ ${target.native}` : `___ nerede?`; }
      else { foreignBlank = isVerb ? 'Я хочу ___' : 'Где ___?'; nativeBlank = isVerb ? `___ ${target.native}` : `___ nerede?`; }
      clozeData = { foreign: foreignBlank, native: nativeBlank };
    }
    const bannerText = autoCloze ? '💬 CÜMLE DALGASI' : autoBanner;
    const bannerSubText = autoCloze ? 'Bağlamda öğren — boşluğu doldur' : autoSub;
    ref.current = {
      ...s,
      wave,
      aliens,
      bullets: [],
      targetWord: target,
      targetHeat: heatOf(heatRef.current[target.id]),
      bossWave: isBoss,
      frenzy: isFrenzy,
      correctThisWave: 0,
      wrongThisWave: 0,
      waveAge: 0,
      hitCard: null,
      danger: 0,
      hitPause: 0,
      cloze: clozeData,
      isCloze,
      waveBanner: { text: bannerText, sub: bannerSubText, t: 1 },
    };
    audio.setHeat(ref.current.targetHeat);
    audio.setWave(wave, isFrenzy);
    if (isBoss) audio.boss();
    if (isFrenzy) { audio.combo(); haptic('boss', setRef.current.haptics); }
    /* Hear-then-find: speaking the target teaches pronunciation before the hunt. */
    if (setRef.current.echo) audio.speak(target.foreign, s.lang, isBoss ? 520 : isFrenzy ? 340 : 260);
    sync();
  }, [sync]);

  /* ── controls ── */
  const startRun = useCallback((lang: LangCode, level: CEFRLevel, category: CategoryId, cloze = false) => {
    const diff = DIFF[setRef.current.difficulty];
    const vig = { A1: 0, A2: 0.12, B1: 0.24, B2: 0.36, C1: 0.5 }[level];
    audio.unlock();
    audio.setMusicEnabled(setRef.current.music);
    audio.setSfxEnabled(setRef.current.sfx);
    audio.setBgmVolume(setRef.current.bgmVolume ?? 0);
    audio.ttsOn = setRef.current.tts;
    audio.setRate(setRef.current.ttsRate ?? 1);

    clozeModeRef.current = cloze;
    statsRef.current = { ...statsRef.current, sessionsPlayed: statsRef.current.sessionsPlayed + 1 };
    ref.current = {
      ...initialState(),
      phase: 'playing', lang, level, category,
      lives: diff.lives, maxLives: diff.lives, vignette: vig,
      neurons: ref.current.neurons, parallaxStars: ref.current.parallaxStars,
      gameTime: ref.current.gameTime,
    };
    moveTarget.current = null; dirHold.current = 0;
    sessionCountsRef.current.clear();
    wrongFilterRef.current = null;
    spawnWave(1, cloze ? 'CÜMLE MODU' : 'HAZIR OL', cloze ? 'Boşluğu doldur' : LEVEL_CONFIG[level].label);
    audio.startMusic('ice');
    flushSoon();
  }, [spawnWave, flushSoon]);

  const startWrongRun = useCallback((lang: LangCode, level: CEFRLevel, ids: string[]) => {
    const diff = DIFF[setRef.current.difficulty];
    const vig = { A1: 0, A2: 0.12, B1: 0.24, B2: 0.36, C1: 0.5 }[level];
    audio.unlock();
    audio.setMusicEnabled(setRef.current.music);
    audio.setSfxEnabled(setRef.current.sfx);
    audio.setBgmVolume(setRef.current.bgmVolume ?? 0.16);
    audio.ttsOn = setRef.current.tts;
    audio.setRate(setRef.current.ttsRate ?? 1);

    wrongFilterRef.current = new Set(ids);
    const isDaily = ids.length === 10;
    statsRef.current = {
      ...statsRef.current,
      sessionsPlayed: statsRef.current.sessionsPlayed + 1,
      wrongBookRuns: (statsRef.current.wrongBookRuns ?? 0) + (isDaily ? 0 : 1),
      dailyRuns: (statsRef.current.dailyRuns ?? 0) + (isDaily ? 1 : 0),
    };
    ref.current = {
      ...initialState(),
      phase: 'playing', lang, level, category: 'all' as CategoryId,
      lives: diff.lives, maxLives: diff.lives, vignette: vig,
      neurons: ref.current.neurons, parallaxStars: ref.current.parallaxStars,
      gameTime: ref.current.gameTime,
    };
    moveTarget.current = null; dirHold.current = 0;
    sessionCountsRef.current.clear();
    spawnWave(1, 'YANLIŞ DEFTERİ', `${ids.length} kelime · tekrar modu`);
    audio.startMusic('ice');
    flushSoon();
  }, [spawnWave, flushSoon]);

  const addSpeechBonus = useCallback((pts: number) => {
    const s = ref.current;
    if (s.phase !== 'playing') return;
    s.score += pts;
    s.floats.push({ id: uid(), x: s.shipX, y: SHIP_Y - 92, text: `🎤 +${pts}`, color: '#00ffa3', life: 1.4, vy: -0.9 });
    s.combo += 1;
    statsRef.current = { ...statsRef.current, speechCount: (statsRef.current.speechCount ?? 0) + 1 };
    {
      const before = new Set(statsRef.current.achievements ?? []);
      const after = ACHIEVEMENTS.filter(x => x.check(statsRef.current, { combo: s.combo })).map(x => x.id);
      const newly = after.filter(id => !before.has(id));
      if (newly.length) {
        statsRef.current = { ...statsRef.current, achievements: after };
        for (const nid of newly) {
          const ach = ACHIEVEMENTS.find(x => x.id === nid);
          if (ach) s.floats.push({ id: uid(), x: VW/2, y: 170, text: `🏆 ${ach.title}`, color: '#ffd166', life: 2, vy: -0.4 });
        }
      }
    }
    flushSoon();
    sync();
  }, [sync, flushSoon]);

  const triggerMine = useCallback(() => {
    const s = ref.current;
    if (s.phase !== 'playing') return;
    const tgt = s.aliens.find(a => a.isTarget);
    if (!tgt) return;
    const cx = tgt.drawX, cy = tgt.y + SPRITE_H / 2;
    // mayın patlaması: devasa, zincirleme, tüm decoy'lara sıçrar
    s.explosions.push({ id: uid(), x: cx, y: cy, radius: 8, maxRadius: 140, opacity: 1, color: '#ffd166', isChain: false });
    s.explosions.push({ id: uid(), x: cx, y: cy, radius: 4, maxRadius: 90, opacity: 0.95, color: '#ffffff', isChain: true });
    // yakındaki decoy'ları da mayın dalgası silsin
    const near = s.aliens.filter(a => !a.isTarget && Math.abs(a.drawX - cx) < 120);
    for (const n of near) {
      s.explosions.push({ id: uid(), x: n.drawX, y: n.y + SPRITE_H / 2, radius: 6, maxRadius: 64, opacity: 1, color: '#ff9500', isChain: true });
    }
    const removedIds = new Set([tgt.id, ...near.map(n => n.id)]);
    s.aliens = s.aliens.filter(a => !removedIds.has(a.id));
    s.score += 180 + near.length * 45;
    s.combo += 1 + near.length;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.runCorrect += 1;
    heatRef.current = applyResult(heatRef.current, tgt.word.id, true);
    statsRef.current = bumpStreak({ ...statsRef.current, totalCorrect: statsRef.current.totalCorrect + 1, speechCount: (statsRef.current.speechCount ?? 0) + 1, bossesKilled: statsRef.current.bossesKilled + (tgt.isBoss ? 1 : 0) }, 1);
    s.hitCard = { foreign: tgt.word.foreign, native: tgt.word.native, ok: true, t: 1, seen: (heatRef.current[tgt.word.id]?.seen ?? 0), category: tgt.word.category, sessionSeen: sessionCountsRef.current.get(tgt.word.id) ?? 1 };
    s.flash = { color: '#ffd166', t: 0.55 };
    s.shake = 9;
    s.floats.push({ id: uid(), x: cx, y: cy - 26, text: '💥 MAYIN PATLADI!', color: '#ffd166', life: 1.5, vy: -1.1 });
    s.floats.push({ id: uid(), x: cx, y: cy - 6, text: `🎤 +180`, color: '#00ffa3', life: 1.3, vy: -1 });
    audio.explode(true); audio.correct(); haptic('boss', setRef.current.haptics);
    flushSoon(); sync();
  }, [sync, flushSoon]);

  const toggleRepeat = useCallback(() => {
    const s = ref.current;
    if (s.phase !== 'playing') return;
    s.repeatMode = !s.repeatMode;
    s.floats.push({ id: uid(), x: VW/2, y: 210, text: s.repeatMode ? '🔁 PEKIŞTIRME AÇIK — her kelime aralıklı tekrar' : '🔁 PEKIŞTIRME KAPALI — taze kelime modu', color: s.repeatMode ? '#ffd166' : '#8be9ff', life: 1.8, vy: -0.4 });
    s.waveBanner = { text: s.repeatMode ? '🔁 PEKIŞTIRME MODU' : '✦ TAZE MOD', sub: s.repeatMode ? 'BİLİNMEYENLER ARALIKLI TEKRAR' : 'YENİ KELİMELER ÖNCELİKLİ', t: 1 };
    if (s.repeatMode) sessionCountsRef.current.clear();
    audio.ui(); haptic('tap', setRef.current.haptics); sync();
  }, [sync]);

  const fireUsluk = useCallback(() => {
    const s = ref.current;
    if (s.phase !== 'playing') return false;
    // Geri çağırma: ok havadaysa aynı tuşla geri çağır
    if (s.uslukArrow?.active) {
      if (!s.uslukArrow.returning) {
        s.uslukArrow.returning = true;
        s.floats.push({ id: uid(), x: VW/2, y: 300, text: '🏹 GERİ ÇAĞRILDI — USLUK!', color: '#ff1a1a', life: 1, vy: -0.4 });
        audio.tick(); sync();
      }
      return true;
    }
    if (s.uslukCharge < 22) {
      s.floats.push({ id: uid(), x: VW/2, y: 300, text: `⏳ USLUK DOLUYOR %${Math.floor(s.uslukCharge)} — ${Math.ceil((100 - s.uslukCharge)/18)}sn`, color: '#ffd166', life: 1.1, vy: -0.4 });
      audio.tick(); sync(); return false;
    }
    const power = Math.min(100, s.uslukCharge);
    s.uslukCharge = Math.max(0, s.uslukCharge - 72);
    const vy = -34 - (power / 100) * 10;
    s.uslukArrow = { x: s.shipX, y: SHIP_Y - 28, vx: 0, vy, active: true, trail: [], returning: false, orbitT: 0, timeLeft: 30000 };
    s.floats.push({ id: uid(), x: VW/2, y: 300, text: '🏹 CANLI OK UYANDI — USLUK!', color: '#ff6bff', life: 1.6, vy: -0.55 });
    s.flash = { color: '#ff6bff', t: 0.36 };
    // fantastik usluk ıslığı — nefesli, titrek, çift ton (dizi ıslığı gibi)
    audio.combo(); audio.correct();
    try {
      const ctx: any = (audio as any).ctx;
      const sfx: any = (audio as any).sfx;
      if (ctx && sfx) {
        const t0 = ctx.currentTime;
        // Yondu Yaka ıslığı: tiz, keskin, titrek (dizi ıslığı)
        for (let i = 0; i < 2; i++) {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = i === 0 ? 'sine' : 'triangle';
          const base = i === 0 ? 2460 : 4920;
          const target = i === 0 ? 720 : 1440;
          o.frequency.setValueAtTime(base, t0);
          o.frequency.setValueAtTime(base * 1.022, t0 + 0.06);
          o.frequency.setValueAtTime(base * 0.982, t0 + 0.12);
          o.frequency.setValueAtTime(base * 1.015, t0 + 0.20);
          o.frequency.exponentialRampToValueAtTime(target, t0 + 0.52);
          g.gain.setValueAtTime(i === 0 ? 0.16 : 0.055, t0);
          g.gain.linearRampToValueAtTime(i === 0 ? 0.13 : 0.045, t0 + 0.32);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.62);
          // hafif nefes için bandpass gürültü
          if (i === 0) {
            const buf: any = (audio as any).noiseBuf;
            if (buf) {
              const src = ctx.createBufferSource(); src.buffer = buf;
              const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.9;
              const ng = ctx.createGain(); ng.gain.setValueAtTime(0.028, t0); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
              src.connect(bp); bp.connect(ng); ng.connect(sfx); src.start(t0); src.stop(t0 + 0.40);
            }
          }
          o.connect(g); g.connect(sfx); o.start(t0 + i * 0.015); o.stop(t0 + 0.64);
        }
        // yankı kuyruğu
        const echo = ctx.createOscillator(); const eg = ctx.createGain();
        echo.type = 'sine'; echo.frequency.setValueAtTime(620, t0 + 0.58); echo.frequency.linearRampToValueAtTime(520, t0 + 0.85);
        eg.gain.setValueAtTime(0.06, t0 + 0.58); eg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.92);
        echo.connect(eg); eg.connect(sfx); echo.start(t0 + 0.58); echo.stop(t0 + 0.95);
      }
    } catch {}
    haptic('boss', setRef.current.haptics); sync(); return true;
  }, [sync]);

  const setUslukHeld = useCallback((v: boolean) => { uslukHeldRef.current = v; }, []);

  const fire = useCallback(() => {
    const s = ref.current;
    if (s.phase !== 'playing') return;
    const now = performance.now();
    if (now - s.lastShot < 118) return;
    s.lastShot = now;
    s.bullets.push({ id: uid(), x: s.shipX, y: SHIP_Y - 24, vy: s.overcharged ? -72 : -LASER_SPEED, power: s.overcharged ? 3 : 1, from: 'player' });
    // GC azalt: spread yok, push
    if (s.bullets.length > 18) s.bullets.shift();
    audio.laser();
    haptic('tap', setRef.current.haptics);
  }, []);

  const setMoveTarget = useCallback((x: number | null) => { moveTarget.current = x; }, []);
  const holdDir = useCallback((d: -1 | 0 | 1) => { dirHold.current = d; }, []);

  /** One tap = snap to the next lane. The primary mobile control. */
  const stepLane = useCallback((dir: -1 | 1) => {
    const s = ref.current;
    if (s.phase !== 'playing' || !s.aliens.length) return;
    const lanes = [...s.aliens].sort((a, b) => a.lane - b.lane);
    const cur = lanes.findIndex(a => s.shipX >= a.laneX && s.shipX < a.laneX + a.laneW);
    const idx = Math.max(0, Math.min(lanes.length - 1, (cur < 0 ? 0 : cur) + dir));
    moveTarget.current = lanes[idx].laneX + lanes[idx].laneW / 2;
    audio.tick();
    haptic('tap', setRef.current.haptics);
  }, []);

  /** Tap anywhere on the field to fly to that lane. */
  const gotoX = useCallback((x: number) => {
    const s = ref.current;
    if (s.phase !== 'playing') return;
    const lane = s.aliens.find(a => x >= a.laneX && x < a.laneX + a.laneW);
    moveTarget.current = lane ? lane.laneX + lane.laneW / 2 : x;
  }, []);

  /** Replay the current target's pronunciation on demand. */
  const replay = useCallback(() => {
    const s = ref.current;
    if (s.targetWord) audio.speak(s.targetWord.foreign, s.lang, 0);
  }, []);

  const pause = useCallback(() => {
    if (ref.current.phase !== 'playing') return;
    ref.current = { ...ref.current, phase: 'paused' };
    audio.stopMusic(); audio.stopSpeech(); sync();
  }, [sync]);
  const resume = useCallback(() => {
    if (ref.current.phase !== 'paused') return;
    ref.current = { ...ref.current, phase: 'playing' };
    audio.startMusic(ref.current.targetHeat); sync();
  }, [sync]);
  const quit = useCallback(() => {
    ref.current = { ...ref.current, phase: 'menu' };
    wrongFilterRef.current = null;
    clozeModeRef.current = false;
    sessionCountsRef.current.clear();
    audio.stopMusic(); audio.stopSpeech(); flushNow(); sync();
  }, [sync, flushNow]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      setRef.current = next;
      store.saveSettings(next);
      if (patch.music !== undefined) {
        audio.setMusicEnabled(patch.music);
        if (patch.music && ref.current.phase === 'playing') audio.startMusic(ref.current.targetHeat);
        if (!patch.music) audio.stopMusic();
      }
      if (patch.sfx !== undefined) audio.setSfxEnabled(patch.sfx);
      if (patch.tts !== undefined) { audio.ttsOn = patch.tts; if (!patch.tts) audio.stopSpeech(); }
      if (patch.ttsRate !== undefined) audio.setRate(patch.ttsRate);
      if (patch.bgmVolume !== undefined) audio.setBgmVolume(patch.bgmVolume);
      return next;
    });
  }, []);

  const addCustomWord: EngineApi['addCustomWord'] = useCallback((w) => {
    const word: VocabWord = {
      id: `custom-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      foreign: w.foreign.trim(), native: w.native.trim(),
      lang: w.lang, level: w.level, category: w.category, custom: true,
    };
    setCustomWords(prev => { const next = [...prev, word]; store.saveCustom(next); customRef.current = next; return next; });
  }, []);
  const removeCustomWord = useCallback((id: string) => {
    setCustomWords(prev => { const next = prev.filter(w => w.id !== id); store.saveCustom(next); customRef.current = next; return next; });
  }, []);
  const resetProgress = useCallback(() => {
    const blank: RunStats = { highScores: {}, totalCorrect: 0, totalWrong: 0, wavesTotal: 0, bossesKilled: 0, sessionsPlayed: 0, streak: 0, bestStreak: 0, lastStreakDate: null, todayCount: 0, todayDate: null };
    heatRef.current = {}; statsRef.current = blank;
    store.saveHeat({}); store.saveStats(blank);
    setHeat({}); setStats(blank);
  }, []);

  /* ════════════════ simulation step ════════════════ */
  const stepRef = useRef<(dt: number) => void>(() => {});
  stepRef.current = (dt: number) => {
    const s = ref.current;
    if (s.phase !== 'playing') return;

    const diff = DIFF[setRef.current.difficulty];
    const cfg = LEVEL_CONFIG[s.level];
    const hap = setRef.current.haptics;

    s.gameTime += dt * 16.667;
    s.waveAge += dt * 16.667;
    if (s.hitCard) { s.hitCard.t -= dt * 0.011; if (s.hitCard.t <= 0) s.hitCard = null; }
    if (s.speechNudge > 0) s.speechNudge -= dt;
    // Usluk şarjı — combo hızlandırır, ~7sn'de dolu; basılı tutarken dolunca otomatik fırlar
    if (!s.uslukArrow?.active) {
      const gain = 0.26 * dt + (s.combo >= 3 ? 0.16 * dt : 0) + (s.frenzy ? 0.14 * dt : 0);
      s.uslukCharge = Math.min(100, s.uslukCharge + gain);
      if (uslukHeldRef.current && s.uslukCharge >= 100) {
        s.uslukCharge = 0;
        s.uslukArrow = { x: s.shipX, y: SHIP_Y - 28, vx: 0, vy: -48, active: true, trail: [], returning: false, orbitT: 0, timeLeft: 30000 };
        s.floats.push({ id: uid(), x: VW/2, y: 300, text: '🏹 YAKA OKU FIRLADI!', color: '#ff1a1a', life: 1.4, vy: -0.5 });
        s.flash = { color: '#ff1a1a', t: 0.30 };
        audio.combo();
        try {
          const ctx: any = (audio as any).ctx; const sfx: any = (audio as any).sfx;
          if (ctx && sfx) {
            const t0 = ctx.currentTime;
            for (let i = 0; i < 2; i++) {
              const o = ctx.createOscillator(); const g = ctx.createGain();
              o.type = i === 0 ? 'sine' : 'triangle';
              const base = i === 0 ? 2460 : 4920; const target = i === 0 ? 720 : 1440;
              o.frequency.setValueAtTime(base, t0); o.frequency.setValueAtTime(base*1.022, t0+0.06); o.frequency.setValueAtTime(base*0.982, t0+0.12); o.frequency.exponentialRampToValueAtTime(target, t0+0.52);
              g.gain.setValueAtTime(i===0?0.16:0.055, t0); g.gain.linearRampToValueAtTime(i===0?0.13:0.045, t0+0.32); g.gain.exponentialRampToValueAtTime(0.0001, t0+0.62);
              o.connect(g); g.connect(sfx); o.start(t0+i*0.015); o.stop(t0+0.64);
            }
          }
        } catch {}
        haptic('boss', hap);
      }
    }

    /* ── ship: momentum + soft brake ── */
    let want = 0;
    if (keys.current.has('ArrowLeft') || keys.current.has('a') || keys.current.has('A')) want = -1;
    if (keys.current.has('ArrowRight') || keys.current.has('d') || keys.current.has('D')) want = 1;
    if (dirHold.current !== 0) { want = dirHold.current; moveTarget.current = null; }

    if (want !== 0) {
      s.shipVx += want * 6.2 * dt;
    } else if (moveTarget.current !== null) {
      const d = moveTarget.current - s.shipX;
      if (Math.abs(d) < 1.5) s.shipVx *= Math.pow(0.28, dt);
      else s.shipVx += Math.max(-16, Math.min(16, d * 0.95)) * dt;
    }
    s.shipVx *= Math.pow(0.68, dt);
    s.shipVx = Math.max(-26, Math.min(26, s.shipVx));
    s.shipX = Math.max(24, Math.min(VW - 24, s.shipX + s.shipVx * dt));

    /* ── wingmen: tam otonom avcı — senden bağımsız hedef bulup vurur ── */
    const assigned = new Set<string>();
    for (const w of s.wingmen) {
      let targetX: number;
      const decoys = s.aliens.filter(a => !a.isTarget && !a.dead && !assigned.has(a.id));
      const pool = decoys.length ? decoys : s.aliens.filter(a => !a.isTarget && !a.dead);
      if (pool.length) {
        let best: typeof pool[0] | null = null;
        let bestD = Infinity;
        for (const a of pool) {
          const laneCx = a.laneX + a.laneW / 2;
          const d = Math.abs(laneCx - w.x) + a.y * 0.12;
          if (d < bestD) { bestD = d; best = a; }
        }
        if (best) {
          assigned.add(best.id);
          targetX = best.laneX + best.laneW / 2;
        } else {
          targetX = s.shipX + w.side * 44;
        }
      } else {
        // av yoksa hafif devriye — senden ayrı süzül
        const patrol = Math.sin(s.gameTime * 0.0012 + (w.side === -1 ? 0 : 2.2)) * 58;
        targetX = Math.max(22, Math.min(VW - 22, VW / 2 + patrol + w.side * 18));
      }
      const spring = (targetX - w.x) * 0.38;
      w.x += spring * dt;
      w.x = Math.max(14, Math.min(VW - 14, w.x));
      w.y = SHIP_Y + 14 + Math.sin(s.gameTime * 0.008 + (w.side === -1 ? 0 : Math.PI)) * 3.5 + Math.abs(w.x - targetX) * 0.06;
    }

    // basılı tutunca tarama (klavye) — push, GC yok
    if ((keys.current.has(' ') || keys.current.has('ArrowUp') || keys.current.has('w') || keys.current.has('W')) && s.phase === 'playing') {
      const now = performance.now();
      if (now - s.lastShot >= 118) {
        s.lastShot = now;
        s.bullets.push({ id: uid(), x: s.shipX, y: SHIP_Y - 24, vy: s.overcharged ? -72 : -LASER_SPEED, power: s.overcharged ? 3 : 1, from: 'player' });
        if (s.bullets.length > 18) s.bullets.shift();
        audio.laser();
        haptic('tap', hap);
      }
    }

    /* ── timers ── */
    if (s.overcharged) {
      s.overchargeTimer -= dt * 16.667;
      if (s.overchargeTimer <= 0) { s.overcharged = false; s.overchargeTimer = 0; }
    }
    if (s.focusTimer > 0) s.focusTimer = Math.max(0, s.focusTimer - dt * 16.667);
    if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 0.85);
    if (s.flash) { s.flash.t -= dt * 0.075; if (s.flash.t <= 0) s.flash = null; }
    if (s.waveBanner) { s.waveBanner.t -= dt * 0.013; if (s.waveBanner.t <= 0) s.waveBanner = null; }

    /* ── wingmen auto-fire: sadece decoy, hedefe ASLA — throttled for performance ── */
    // mermi sayısını cap'le: fazla yığılma donma yapar
    if (s.bullets.length < 14) {
      for (const w of s.wingmen) {
        w.cooldown -= dt;
        if (w.cooldown <= 0) {
          const decoys = s.aliens.filter(a => !a.isTarget && !a.dead);
          if (decoys.length) {
            let best: typeof decoys[0] | null = null;
            let bestD = Infinity;
            for (const a of decoys) {
              const d = Math.abs(a.drawX - w.x) + a.y * 0.15;
              if (d < bestD) { bestD = d; best = a; }
            }
            if (best) {
              const laneMatch = Math.abs(best.drawX - w.x) < best.laneW * 0.85;
              if (laneMatch || Math.random() < 0.25) {
                s.bullets.push({ id: uid(), x: w.x, y: w.y - 16, vy: -46, power: 1, from: 'wingman' });
                if (Math.random() < 0.3) audio.tick();
                w.cooldown = 42 + Math.random() * 22; // ~700-1000ms — daha seyrek, donma önler
              } else {
                w.cooldown = 12;
              }
            } else {
              w.cooldown = 24;
            }
          } else {
            w.cooldown = 40;
          }
        }
      }
    } else {
      for (const w of s.wingmen) w.cooldown = Math.max(w.cooldown, 10);
    }

    // ── Yondu Yaka Oku — 7sn boyunca etrafta dolanır, sonra geri döner (veya uslukla çağrılır)
    if (s.uslukArrow?.active) {
      const arr = s.uslukArrow;
      arr.trail.push({ x: arr.x, y: arr.y });
      if (arr.trail.length > 22) arr.trail.shift();
      if (!arr.returning) arr.timeLeft -= dt * 16.667;
      // SIFIRDAN, SORUNSUZ: düz yukarı süzül + hafif yılan, her hizadaki düşmanı deler
      arr.x += Math.sin(s.gameTime * 0.06) * 0.9 * dt;
      arr.y += arr.vy * dt;
      arr.x = Math.max(12, Math.min(VW - 12, arr.x));
      // delip geçme — SORUNSUZ: yatay ışın gibi, aynı hizadaki her canavarı deler
      const hitIds: string[] = [];
      for (const a of s.aliens) {
        if (a.dead) continue;
        const dy = Math.abs(arr.y - (a.y + 18));
        if (dy < 26) hitIds.push(a.id);
      }
      if (hitIds.length) {
        for (const hid of hitIds) {
          const a = s.aliens.find(x => x.id === hid);
          if (!a) continue;
          const isT = a.isTarget;
          const cx = a.drawX, cy = a.y + SPRITE_H / 2;
          const cols = ['#ff3b5c', '#ff9500', '#ffd166', '#00ffa3', '#00d4ff', '#9d4edd'];
          const col = cols[Math.floor(Math.random() * cols.length)];
          s.explosions.push({ id: uid(), x: cx, y: cy, radius: 7, maxRadius: a.isBoss ? 116 : 74, opacity: 1, color: isT ? '#ffd166' : col, isChain: false });
          s.explosions.push({ id: uid(), x: cx, y: cy, radius: 3, maxRadius: 38, opacity: 0.92, color: '#ffffff', isChain: true });
          if (isT) {
            s.score += 180; s.combo += 1; s.bestCombo = Math.max(s.bestCombo, s.combo); s.runCorrect += 1;
            heatRef.current = applyResult(heatRef.current, a.word.id, true);
            statsRef.current = bumpStreak({ ...statsRef.current, totalCorrect: statsRef.current.totalCorrect + 1, bossesKilled: statsRef.current.bossesKilled + (a.isBoss ? 1 : 0) }, 1);
            s.hitCard = { foreign: a.word.foreign, native: a.word.native, ok: true, t: 1, seen: (heatRef.current[a.word.id]?.seen ?? 0), category: a.word.category, sessionSeen: sessionCountsRef.current.get(a.word.id) ?? 1 };
            s.flash = { color: '#ffd166', t: 0.38 };
          } else {
            s.score += 46; s.floats.push({ id: uid(), x: cx, y: a.y - 2, text: '+46 OK', color: col, life: 0.9, vy: -0.9 });
          }
          audio.tick();
        }
        s.aliens = s.aliens.filter(a => !hitIds.includes(a.id));
        s.shake = Math.max(s.shake, 2.4);
      }
      if (!arr.returning) {
        // harb alanında dolan — tepeye kaçma, 80-320 bandında kal
        if (!arr.returning) {
          if (arr.y < 80) { arr.y = 80; arr.vy = Math.abs(arr.vy) * 0.32 + 2; arr.vx += (Math.random() - 0.5) * 5; }
          if (arr.y > 340) { arr.y = 340; arr.vy = -Math.abs(arr.vy) * 0.32 - 2; }
          if (arr.timeLeft <= 0) {
            arr.returning = true;
            arr.vy = 28;
            s.floats.push({ id: uid(), x: VW / 2, y: 200, text: '🏹 SÜRE DOLDU — DÖNÜYOR!', color: '#ff1a1a', life: 0.9, vy: -0.5 });
          }
        }
      } else {
        // dönüş — hızlıca gemiye, kısa yörünge sonra takıl
        const dx = s.shipX - arr.x;
        const dy = (SHIP_Y - 12) - arr.y;
        arr.vx += dx * 0.072 * dt;
        arr.vy += dy * 0.072 * dt;
        arr.vx *= Math.pow(0.84, dt);
        arr.vy *= Math.pow(0.84, dt);
        const dist = Math.hypot(dx, dy);
        if (dist < 20) {
          arr.orbitT += dt * 0.32;
          if (arr.orbitT > 48) {
            s.uslukArrow = null;
            s.floats.push({ id: uid(), x: s.shipX, y: SHIP_Y - 40, text: '🏹 YANINA TAKILDI', color: '#ff1a1a', life: 1.1, vy: -0.5 });
            s.shield = true;
            audio.repair();
          } else {
            const ang = arr.orbitT * 0.26;
            arr.x = s.shipX + Math.cos(ang) * 20;
            arr.y = SHIP_Y - 10 + Math.sin(ang) * 8;
            arr.vx = -Math.sin(ang) * 5.2;
            arr.vy = Math.cos(ang) * 2.6;
          }
        }
        if (arr.y > VH + 40) { s.uslukArrow = null; }
      }
    }

    // hit-stop: doğru vuruşta 45ms donma (göz yormadan tatmin)
    if (s.hitPause > 0) s.hitPause = Math.max(0, s.hitPause - dt);
    /* ── aliens descend; sway is cosmetic only ── */
    const focusSlow = s.focusTimer > 0 ? 0.46 : 1;
    const freeze = s.hitPause > 0 ? 0 : 1;
    for (const a of s.aliens) {
      a.y += a.vy * dt * focusSlow * freeze;
      a.glowPhase += 0.045 * dt * freeze;
      a.cloakPhase += (a.variant === 'phantom' ? 0.09 : 0.015) * dt * freeze;
      if (s.frenzy) a.glowPhase += 0.02 * dt * freeze;
      const swayMul = a.variant === 'swift' ? 1.35 : 1;
      a.drawX = a.laneX + a.laneW / 2 + Math.sin(s.gameTime * 0.0018 * swayMul + a.glowPhase) * a.sway;
      if (a.hitFlash > 0) a.hitFlash = Math.max(0, a.hitFlash - dt * 0.11);
    }
    // ── adrenalin: hedef tabana yaklaşınca tehlike seviyesi ──
    const tgt = s.aliens.find(a => a.isTarget);
    if (tgt) {
      const dist = FLOOR_Y - (tgt.y + SPRITE_H);
      const raw = 1 - Math.max(0, Math.min(1, dist / 220));
      s.danger = raw;
      if (raw > 0.65) {
        // kalp atışı titreşimi
        const pulse = Math.sin(s.gameTime * 0.018) * raw;
        if (pulse > 0.85 && Math.random() < 0.35) {
          s.shake = Math.max(s.shake, raw * 2.2);
          if (raw > 0.85) haptic('tap', hap);
        }
        if (s.frenzy && raw > 0.5 && Math.random() < 0.04) s.flash = { color: '#ff2e63', t: 0.14 * raw };
      }
    } else s.danger = 0;

    /* ── bullets — swept AABB (turbo mermi tünellemez) ── */
    for (const b of s.bullets) { b.py = b.y; b.y += b.vy * dt; }
    s.bullets = s.bullets.filter(b => b.y > -30);

    /* ── collision: bullet ↔ lane band — geniş, affedici vuruş ── */
    const spentBullets = new Set<string>();
    const removed = new Set<string>();
    let gameEnded = false;
    const LANE_BLEED = 8; // şerit dışına 8px taşma affı — zor vuruyor şikayeti biter
    const TOP_PAD = 18;
    const BOT_PAD = 14;

    for (const b of s.bullets) {
      if (spentBullets.has(b.id)) continue;
      for (const a of s.aliens) {
        if (a.dead || removed.has(a.id)) continue;
        if ((b.from === 'wingman') && a.isTarget) continue;
        const inLane = b.x >= a.laneX - LANE_BLEED && b.x < a.laneX + a.laneW + LANE_BLEED;
        if (!inLane) continue;
        const top = a.y - (a.isBoss ? 10 : 0) - TOP_PAD;
        const bot = a.y + HIT_H * (a.isBoss ? 1.6 : 1.25) + BOT_PAD;
        // swept: mermi bir frame'de top-bot'u atladıysa da yakala
        const py = (b as any).py ?? b.y;
        const lo = Math.min(py, b.y);
        const hi = Math.max(py, b.y);
        if (hi < top || lo > bot) continue;

        spentBullets.add(b.id);
        a.hitFlash = 1;
        a.hp -= b.power;

        if (a.hp > 0) {
          s.explosions.push({ id: uid(), x: b.x, y: b.y, radius: 4, maxRadius: 26, opacity: 1, color: '#ffffff', isChain: false });
          s.floats.push({ id: uid(), x: a.drawX, y: a.y - 6, text: `${a.hp} / ${a.maxHp}`, color: '#ffd166', life: 0.8, vy: -0.9 });
          audio.tick(); haptic('tap', hap);
          break;
        }

        removed.add(a.id);
        const meta = HEAT_META[a.heat];
        const cx = a.drawX, cy = a.y + SPRITE_H / 2;

        if (a.isTarget) {
          /* ─── CORRECT ─── */
          s.combo += 1;
          s.bestCombo = Math.max(s.bestCombo, s.combo);
          s.multiplier = Math.min(8, 1 + Math.floor(s.combo / 3));
          const heatBonus = a.heat === 'ice' ? 1.5 : a.heat === 'amber' ? 1.2 : 1;
          const gained = Math.round(100 * s.multiplier * heatBonus * diff.score * (a.isBoss ? 4 : 1));
          s.score += gained;
          s.correctThisWave += 1;
          s.runCorrect += 1;
          if (s.runCorrect % 3 === 0) { s.speechNudge = 180; s.floats.push({ id: uid(), x: VW/2, y: 168, text: '🎤 SÖYLE +80 BONUS', color: '#00ffa3', life: 1.6, vy: -0.35 }); }

          heatRef.current = applyResult(heatRef.current, a.word.id, true);
          statsRef.current = bumpStreak({
            ...statsRef.current,
            totalCorrect: statsRef.current.totalCorrect + 1,
            bossesKilled: statsRef.current.bossesKilled + (a.isBoss ? 1 : 0),
          }, 1);
          // rozet kontrol
          {
            const before = new Set(statsRef.current.achievements ?? []);
            const after = ACHIEVEMENTS.filter(x => x.check(statsRef.current, { combo: s.combo })).map(x => x.id);
            const newly = after.filter(id => !before.has(id));
            if (newly.length) {
              statsRef.current = { ...statsRef.current, achievements: after };
              for (const nid of newly) {
                const ach = ACHIEVEMENTS.find(x => x.id === nid);
                if (ach) s.floats.push({ id: uid(), x: VW/2, y: 190 + newly.indexOf(nid)*18, text: `🏆 ${ach.title}`, color: '#ffd166', life: 2, vy: -0.4 });
              }
              audio.combo();
            }
          }
          flushSoon();

          // Adrenalin: combo ve frenzy ile patlama büyür
          const frenzyBonus = s.frenzy ? 1.55 : 1;
          const comboScale = 1 + Math.min(0.6, s.combo * 0.07);
          s.explosions.push({ id: uid(), x: cx, y: cy, radius: 6, maxRadius: (a.isBoss ? 120 : 66) * comboScale * frenzyBonus, opacity: 1, color: meta.core, isChain: false });
          if (s.combo >= 3 || s.frenzy) {
            s.explosions.push({ id: uid(), x: cx, y: cy, radius: 2, maxRadius: 38 * comboScale, opacity: 0.9, color: '#ffffff', isChain: true });
          }
          s.floats.push({ id: uid(), x: cx, y: a.y - 4, text: `+${gained}`, color: meta.core, life: 1.15, vy: -1.5 });
          s.flash = { color: meta.core, t: 0.22 + (s.frenzy ? 0.08 : 0) };
          s.shake = Math.max(s.shake, s.frenzy ? 1.4 : s.combo >= 5 ? 0.9 : 0);
          s.hitPause = 1.8;
          s.hitCard = { foreign: a.word.foreign, native: a.word.native, ok: true, t: 1, seen: (heatRef.current[a.word.id]?.seen ?? 0), category: a.word.category, sessionSeen: sessionCountsRef.current.get(a.word.id) ?? 1 };

          audio.explode(a.isBoss);
          audio.correct();
          audio.speak(a.word.foreign, a.word.lang, a.isBoss ? 320 : 200);
          haptic(a.isBoss ? 'boss' : 'hit', hap);

          if (heatOf(heatRef.current[a.word.id]) === 'crimson' && !s.masteredThisLevel.some(m => m.id === a.word.id)) {
            s.masteredThisLevel = [...s.masteredThisLevel, a.word];
            s.floats.push({ id: uid(), x: cx, y: a.y + 34, text: '★ HAFIZAYA KAZINDI', color: '#ffd166', life: 1.6, vy: -0.55 });
          }

          if (s.combo === COMBO_TO_OVERCHARGE) {
            s.overcharged = true; s.overchargeTimer = OVERCHARGE_MS;
            audio.combo();
            s.floats.push({ id: uid(), x: VW / 2, y: 330, text: '⚡ OVERCHARGE', color: '#c77dff', life: 1.7, vy: -0.5 });
          }

          if (s.combo >= 4 && !s.shield) {
            s.shield = true;
            audio.repair();
            s.floats.push({ id: uid(), x: s.shipX, y: SHIP_Y - 86, text: '◇ NÖRAL KALKAN', color: '#8be9ff', life: 1.45, vy: -0.65 });
          }

          if (s.combo > 0 && s.combo % 6 === 0) {
            s.focusTimer = FOCUS_MS;
            s.flash = { color: '#00d4ff', t: 0.75 };
            audio.combo();
            s.floats.push({ id: uid(), x: VW / 2, y: 276, text: '◎ ODAK TÜNELİ', color: '#00d4ff', life: 1.55, vy: -0.45 });
          }

          /* chain reaction clears neighbouring decoys */
          if (s.overcharged) {
            const near = s.aliens
              .filter(o => !o.isTarget && !o.dead && !removed.has(o.id))
              .sort((p, q) => Math.abs(p.lane - a.lane) - Math.abs(q.lane - a.lane))
              .slice(0, 2);
            for (const o of near) {
              removed.add(o.id);
              s.explosions.push({ id: uid(), x: o.drawX, y: o.y + SPRITE_H / 2, radius: 6, maxRadius: 58, opacity: 1, color: '#c77dff', isChain: true });
              s.score += Math.round(45 * diff.score);
            }
            if (near.length) audio.explode(false);
          }
        } else {
          /* ─── WRONG or WINGMAN CLEANUP ─── */
          if (b.from === 'wingman') {
            // Wingman decoyu temizler: ödül, ceza yok, combo bozulmaz
            s.score += Math.round(35 * diff.score);
            s.explosions.push({ id: uid(), x: cx, y: cy, radius: 5, maxRadius: 48, opacity: 1, color: '#7af7ff', isChain: true });
            s.floats.push({ id: uid(), x: cx, y: a.y - 2, text: '+35 DRONE', color: '#7af7ff', life: 0.9, vy: -0.9 });
            audio.tick();
          } else {
            const absorbed = s.shield;
            s.combo = 0; s.multiplier = 1; s.wrongThisWave += 1; s.runWrong += 1;
            if (absorbed) s.shield = false;
            else s.lives -= 1;
          s.shake = 3.2;
          s.flash = { color: '#ff2e63', t: 0.28 };
            heatRef.current = applyResult(heatRef.current, a.word.id, false);
            statsRef.current = { ...statsRef.current, totalWrong: statsRef.current.totalWrong + 1 };
            flushSoon();

            s.explosions.push({ id: uid(), x: cx, y: cy, radius: 6, maxRadius: 56, opacity: 1, color: '#ff2e63', isChain: false });
            s.hitCard = { foreign: a.word.foreign, native: a.word.native, ok: false, t: 1, seen: (heatRef.current[a.word.id]?.seen ?? 0), category: a.word.category, sessionSeen: sessionCountsRef.current.get(a.word.id) ?? 0 };
            // Wingman öğretici fısıldaması — yanlışta doğruyu göster, akıcı öğrenme
            s.floats.push({ id: uid(), x: cx, y: a.y + 18, text: `💡 ${a.word.foreign} → ${a.word.native}`, color: '#ffd166', life: 1.9, vy: -0.32 });
            if (absorbed) {
              s.floats.push({ id: uid(), x: s.shipX, y: SHIP_Y - 74, text: 'KALKAN EMİLDİ', color: '#8be9ff', life: 1.3, vy: -0.7 });
              audio.repair();
            }
            audio.wrong();
            haptic('miss', hap);

            if (s.lives <= 0) { gameEnded = true; }
          }
        }
        break;
      }
      if (gameEnded) break;
    }

    s.bullets = s.bullets.filter(b => !spentBullets.has(b.id));
    if (removed.size) s.aliens = s.aliens.filter(a => !removed.has(a.id));

    if (gameEnded) { endRun(s, 'gameOver'); return; }

    /* ── breach line: only the TARGET costs a life.
         Letting a wrong word slip past is the correct play. ── */
    const survivors: Alien[] = [];
    let targetBreached = false;
    for (const a of s.aliens) {
      if (a.y + SPRITE_H < FLOOR_Y) { survivors.push(a); continue; }
      if (a.isTarget) {
        targetBreached = true;
        const absorbed = s.shield;
        if (absorbed) s.shield = false;
        else s.lives -= 1;
        s.combo = 0; s.multiplier = 1; s.wrongThisWave += 1; s.runWrong += 1;
        s.shake = 3.8;
        s.flash = { color: '#ff2e63', t: 0.30 };
        heatRef.current = applyResult(heatRef.current, a.word.id, false);
        statsRef.current = { ...statsRef.current, totalWrong: statsRef.current.totalWrong + 1 };
        flushSoon();
        s.floats.push({
          id: uid(), x: a.drawX, y: FLOOR_Y - 24,
          text: absorbed ? `KALKAN · ${a.word.foreign}` : `KAÇTI · ${a.word.foreign} = ${a.word.native}`,
          color: absorbed ? '#8be9ff' : '#ff8fa8', life: 1.9, vy: -0.7,
        });
        if (absorbed) audio.repair(); else audio.breach();
        haptic(absorbed ? 'hit' : 'breach', hap);
      } else {
        /* restraint reward — you correctly held fire */
        s.score += Math.round(15 * diff.score);
        s.floats.push({ id: uid(), x: a.drawX, y: FLOOR_Y - 10, text: '+15 İTİDAL', color: '#7fe3ff', life: 0.9, vy: -0.8 });
      }
    }
    s.aliens = survivors;
    if (targetBreached && s.lives <= 0) { endRun(s, 'gameOver'); return; }

    /* ── repair station: deterministic reward for a flawless wave ── */
    if (s.repairStation?.active && Math.abs(s.shipX - s.repairStation.x) < 42) {
      s.lives = Math.min(s.maxLives, s.lives + 1);
      s.repairStation = null;
      audio.repair(); haptic('level', hap);
      s.floats.push({ id: uid(), x: s.shipX, y: SHIP_Y - 56, text: '+1 CAN', color: '#00ffa3', life: 1.4, vy: -1.2 });
    }

    /* ── particles — cap'li, donma önleyici ── */
    const _isMob = typeof window !== 'undefined' && window.innerWidth < 700;
    for (const e of s.explosions) {
      e.radius += (e.maxRadius - e.radius) * 0.2 * dt;
      e.opacity -= 0.05 * dt;
    }
    s.explosions = s.explosions.filter(e => e.opacity > 0.02);
    if (s.explosions.length > 14) s.explosions.splice(0, s.explosions.length - 14);
    if (_isMob && s.explosions.length > 8) s.explosions.splice(0, s.explosions.length - 8);
    for (const f of s.floats) { f.y += f.vy * dt; f.life -= 0.015 * dt; }
    s.floats = s.floats.filter(f => f.life > 0);
    if (s.floats.length > 18) s.floats.splice(0, s.floats.length - 18);
    if (_isMob && s.floats.length > 10) s.floats.splice(0, s.floats.length - 10);
    if (s.bullets.length > 18) s.bullets.splice(0, s.bullets.length - 18);
    if (_isMob && s.bullets.length > 10) s.bullets.splice(0, s.bullets.length - 10);
    // mobilde shake/flash'i neredeyse kapat — translate donması biter
    if (_isMob) { s.shake *= 0.35; if (s.flash) s.flash.t *= 0.45; }

    if (!_isMob || frameTick.current % 2 === 0) {
      for (const n of s.neurons) { n.pulsePhase += n.pulseSpeed * dt; n.heat = s.targetHeat; }
      for (const p of s.parallaxStars) p.pulsePhase += 0.009 * dt * p.layer;
    }

    /* ── wave resolution ── */
    const targetAlive = s.aliens.some(a => a.isTarget && !a.dead);
    if (!targetAlive) {
      const wasFrenzy = s.frenzy;
      s.wavesCleared += 1;
      statsRef.current = {
        ...statsRef.current,
        wavesTotal: statsRef.current.wavesTotal + 1,
        frenzyCleared: (statsRef.current.frenzyCleared ?? 0) + (wasFrenzy ? 1 : 0),
      };

      if (s.wrongThisWave === 0 && !targetBreached) {
        s.perfectStreak += 1;
        const bonus = 60 * s.perfectStreak;
        s.score += bonus;
        s.floats.push({ id: uid(), x: VW / 2, y: 242, text: `PERFECT ×${s.perfectStreak} +${bonus}`, color: '#00ffa3', life: 1.5, vy: -0.55 });
        if (s.perfectStreak > 0 && s.perfectStreak % 2 === 0) {
          s.shield = true;
          s.focusTimer = Math.max(s.focusTimer, 1800);
          audio.combo();
          s.floats.push({ id: uid(), x: VW / 2, y: 292, text: 'SERİ ÖDÜLÜ · KALKAN + ODAK', color: '#ffd166', life: 1.65, vy: -0.5 });
        }
      } else {
        s.perfectStreak = 0;
      }

      /* flawless wave + missing health → drop a repair beacon next wave */
      if (!targetBreached && s.wrongThisWave === 0 && s.lives < s.maxLives && s.wavesCleared % 2 === 0) {
        s.repairStation = { id: uid(), x: rnd(70, VW - 70), active: true, opacity: 1 };
        s.floats.push({ id: uid(), x: VW / 2, y: 300, text: '🔧 TAMİR İSTASYONU', color: '#00ffa3', life: 1.6, vy: -0.4 });
      }

      if (s.wavesCleared >= cfg.wavesToClear) {
        // ── Sonsuz mod: seviye bitmesin, döngü yap ve bonus ver ──
        const loopBonus = 2000 + cfg.wavesToClear * 40;
        s.score += loopBonus;
        s.wavesCleared = 0;
        // can yenile (ödül)
        s.lives = Math.min(s.maxLives, s.lives + 1);
        s.floats.push({ id: uid(), x: VW / 2, y: 210, text: `★ SEVİYE EFSANESİ +${loopBonus}`, color: '#ffd166', life: 2.2, vy: -0.45 });
        s.floats.push({ id: uid(), x: VW / 2, y: 250, text: `+1 CAN · SONSUZ MOD DEVAM`, color: '#00ffa3', life: 2, vy: -0.4 });
        s.waveBanner = { text: '★ SEVİYE EFSANESİ', sub: `SONSUZ MOD — DALGA ${s.wave + 1} DEVAM`, t: 1 };
        s.flash = { color: '#ffd166', t: 0.42 };
        audio.levelUp(); haptic('level', hap);
      }

      const next = s.wave + 1;
      s.aliens = [];
      spawnWave(
        next,
        next % BOSS_EVERY === 0 ? '⚠ BOSS' : `DALGA ${next}`,
        next % BOSS_EVERY === 0 ? 'KARA DELİK HAFIZA PATLAMASI' : '',
      );
      return;
    }

    frameTick.current++;
    const _mobSync = typeof window !== 'undefined' && window.innerWidth < 700;
    if (_mobSync && frameTick.current % 2 === 0) return;
    sync();
  };

  const endRun = useCallback((s: GameState, kind: 'gameOver' | 'levelComplete') => {
    const key = highScoreKey(s.lang, s.level);
    statsRef.current = {
      ...statsRef.current,
      highScores: { ...statsRef.current.highScores, [key]: Math.max(statsRef.current.highScores[key] ?? 0, s.score) },
    };
    s.phase = kind === 'gameOver' ? 'gameOver' : 'levelComplete';
    if (kind === 'gameOver') s.lives = 0;
    s.aliens = []; s.bullets = [];
    audio.stopMusic();
    if (kind === 'levelComplete') { audio.levelUp(); haptic('level', setRef.current.haptics); }
    flushNow();
    sync();
    endCb.current(kind);
  }, [flushNow, sync]);

  /* ════════════════ persistent RAF driver ════════════════
     Never re-created, never cancelled by a state change — the
     previous build could stall between waves. */
  useEffect(() => {
    let id = 0;
    let prev = performance.now();
    const frame = (t: number) => {
      const dt = Math.min((t - prev) / 16.667, 2.5);
      prev = t;
      try { stepRef.current(dt); } catch { /* keep the loop alive */ }
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, []);

  /* ── keyboard ── */
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
      keys.current.add(e.key);
      if (e.key === ' ' || e.key === 'ArrowUp') fire();
      if (e.key === 'Escape') { if (ref.current.phase === 'playing') pause(); else if (ref.current.phase === 'paused') resume(); }
    };
    const ku = (e: KeyboardEvent) => keys.current.delete(e.key);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    };
  }, [fire, pause, resume]);

  /* auto-pause when the tab hides */
  useEffect(() => {
    const vis = () => { if (document.hidden && ref.current.phase === 'playing') pause(); };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [pause]);

  /* lock-on: which lane is the ship under right now */
  const st = ref.current;
  let lockedId: string | null = null;
  for (const a of st.aliens) {
    if (st.shipX >= a.laneX && st.shipX < a.laneX + a.laneW) { lockedId = a.id; break; }
  }

  /* assist: reveal the correct alien.
     always  → from the first frame
     delayed → after 2.4s of searching (hızlı tempo için kısaltıldı), veya yeni kelimede anında
     off     → never */
  let hintId: string | null = null;
  const mode = settings.assist;
  if (mode !== 'off' && st.phase === 'playing') {
    const tgt = st.aliens.find(a => a.isTarget);
    if (tgt) {
      const brandNew = !heat[tgt.word.id];
      if (mode === 'always' || brandNew || st.waveAge > 2400) hintId = tgt.id;
    }
  }

  return {
    state: st, settings, stats, heat, customWords, lockedId, hintId,
    startRun, startWrongRun, addSpeechBonus, triggerMine, toggleRepeat, fireUsluk, setUslukHeld, fire, setMoveTarget, holdDir, stepLane, gotoX, replay,
    pause, resume, quit,
    updateSettings, addCustomWord, removeCustomWord, resetProgress,
  };
}

export { DEFAULT_SETTINGS, DIFF, HIT_H, SPRITE_H };
