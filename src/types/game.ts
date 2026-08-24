import type { CEFRLevel, HeatLevel, LangCode, CategoryId, VocabWord } from '../data/vocabulary';

export type AlienVariant = 'standard' | 'swift' | 'tank' | 'phantom';

export interface Alien {
  id: string;
  word: VocabWord;
  heat: HeatLevel;
  variant: AlienVariant;
  /** exclusive vertical corridor — guarantees the alien can always be shot */
  lane: number;
  laneX: number;
  laneW: number;
  /** visual centre (lane centre + sway); hitbox stays the full lane band */
  drawX: number;
  y: number;
  vy: number;
  sway: number;
  hp: number; maxHp: number;
  isBoss: boolean;
  isTarget: boolean;
  glowPhase: number;
  hitFlash: number;
  dead: boolean;
  deathT: number;
  /** phantom cloak phase */
  cloakPhase: number;
}

export interface Bullet { id: string; x: number; y: number; vy: number; power: number }

export interface Explosion {
  id: string; x: number; y: number;
  radius: number; maxRadius: number;
  opacity: number; color: string; isChain: boolean;
}

export interface FloatText {
  id: string; x: number; y: number; text: string; color: string; life: number; vy: number;
}

export interface Neuron {
  id: string; x: number; y: number;
  baseOpacity: number; pulsePhase: number; pulseSpeed: number;
  size: number; heat: HeatLevel; color: string;
}

export interface ParallaxStar {
  id: string; x: number; y: number; layer: number;
  opacity: number; pulsePhase: number; size: number;
}

export interface RepairStation { id: string; x: number; active: boolean; opacity: number }

export type GamePhase = 'menu' | 'playing' | 'levelComplete' | 'gameOver' | 'paused';

export interface GameState {
  phase: GamePhase;
  lang: LangCode;
  level: CEFRLevel;
  category: CategoryId;
  wave: number;
  wavesCleared: number;
  score: number;
  multiplier: number;
  combo: number;
  bestCombo: number;
  lives: number;
  maxLives: number;
  overcharged: boolean;
  overchargeTimer: number;
  /** absorbs one mistake or target breach without losing a life */
  shield: boolean;
  /** slows incoming aliens and adds a time-tunnel visual */
  focusTimer: number;
  /** consecutive waves cleared without a mistake */
  perfectStreak: number;
  shipX: number; shipY: number; shipVx: number;
  aliens: Alien[];
  bullets: Bullet[];
  explosions: Explosion[];
  floats: FloatText[];
  neurons: Neuron[];
  parallaxStars: ParallaxStar[];
  repairStation: RepairStation | null;
  targetWord: VocabWord | null;
  targetHeat: HeatLevel;
  bossWave: boolean;
  gameTime: number;
  lastShot: number;
  shake: number;
  flash: { color: string; t: number } | null;
  vignette: number;
  correctThisWave: number;
  wrongThisWave: number;
  waveBanner: { text: string; sub: string; t: number } | null;
  masteredThisLevel: VocabWord[];
  /** large centre read-out of the word that was just hit */
  hitCard: HitCard | null;
  /** ms the current wave has been alive — drives delayed assist */
  waveAge: number;
  /** adrenalin: hedef tabana yakınken 0..1 arası tehlike seviyesi */
  danger: number;
  /** frenzy dalgası mı */
  frenzy: boolean;
}

export interface TouchState {
  joystickActive: boolean;
  joystickOrigin: { x: number; y: number };
  joystickCurrent: { x: number; y: number };
}

export interface WordStat {
  hits: number;
  misses: number;
  streak: number;
  seen: number;
  last: number;
  /** SM-2/FSRS inspired ease multiplier. Higher = longer review gaps. */
  ease: number;
  /** Current interval in days. Fractions are minutes/hours for relearning. */
  intervalDays: number;
  /** Next review timestamp. Due words are weighted heavily in waves. */
  due: number;
  /** Number of times a learned word fell back to relearning. */
  lapses: number;
  /** Memory strength in days, used for retrievability. */
  stability: number;
  /** 0 easy, 1 hard. Wrong answers push it up. */
  difficulty: number;
  phase: 'new' | 'learning' | 'review' | 'mastered' | 'relearning';
}
export type HeatMap = Record<string, WordStat>;

export interface Settings {
  crt: boolean;
  music: boolean;
  sfx: boolean;
  tts: boolean;
  haptics: boolean;
  leftHanded: boolean;
  difficulty: 'zen' | 'normal' | 'hardcore';
  /** how much help finding the correct alien */
  assist: 'always' | 'delayed' | 'off';
  /** speak the prompt in the foreign language at wave start */
  echo: boolean;
  ttsRate: number;
  bgmVolume: number;
}

export interface HitCard {
  foreign: string;
  native: string;
  ok: boolean;
  t: number;
}

export interface RunStats {
  highScores: Record<string, number>;
  totalCorrect: number;
  totalWrong: number;
  wavesTotal: number;
  bossesKilled: number;
  sessionsPlayed: number;
  streak: number;
  bestStreak: number;
  lastStreakDate: string | null;
  todayCount: number;
  todayDate: string | null;
}

export interface StreakInfo {
  current: number;
  best: number;
  today: number;
  goal: number;
  lastDate: string | null;
}
