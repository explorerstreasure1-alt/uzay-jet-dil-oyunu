import type { HeatMap, Settings, RunStats, WordStat } from '../types/game';
import type { HeatLevel, VocabWord, LangCode, CEFRLevel } from '../data/vocabulary';

const K = {
  heat: 'wi_heat_v1',
  custom: 'wi_custom_v1',
  settings: 'wi_settings_v1',
  stats: 'wi_stats_v1',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

export const DEFAULT_SETTINGS: Settings = {
  crt: true, music: true, sfx: true, tts: true, haptics: true, leftHanded: false,
  difficulty: 'normal', assist: 'always', echo: true, ttsRate: 1.0, bgmVolume: 0.16,
};
export const DEFAULT_STATS: RunStats = {
  highScores: {}, totalCorrect: 0, totalWrong: 0, wavesTotal: 0, bossesKilled: 0, sessionsPlayed: 0,
  streak: 0, bestStreak: 0, lastStreakDate: null, todayCount: 0, todayDate: null,
};

export const store = {
  loadHeat: (): HeatMap => read<HeatMap>(K.heat, {}),
  saveHeat: (h: HeatMap) => write(K.heat, h),

  loadCustom: (): VocabWord[] => read<VocabWord[]>(K.custom, []),
  saveCustom: (c: VocabWord[]) => write(K.custom, c),

  loadSettings: (): Settings => ({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(K.settings, {}) }),
  saveSettings: (s: Settings) => write(K.settings, s),

  loadStats: (): RunStats => ({ ...DEFAULT_STATS, ...read<Partial<RunStats>>(K.stats, {}) }),
  saveStats: (s: RunStats) => write(K.stats, s),
};

/* ───────── Spaced repetition: FSRS/SM-2 inspired scheduler ───────── */

const DAY = 86_400_000;
const MIN = 60_000;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function freshStat(): WordStat {
  return {
    hits: 0,
    misses: 0,
    streak: 0,
    seen: 0,
    last: 0,
    ease: 2.35,
    intervalDays: 0,
    due: 0,
    lapses: 0,
    stability: 0.25,
    difficulty: 0.45,
    phase: 'new',
  };
}

/** Upgrade old localStorage stats in-place without deleting user progress. */
export function upgradeStat(stat: WordStat | undefined): WordStat {
  if (!stat) return freshStat();
  const base = freshStat();
  const seen = stat.seen ?? 0;
  const accuracy = (stat.hits ?? 0) / Math.max(1, (stat.hits ?? 0) + (stat.misses ?? 0));
  const inferredInterval = stat.intervalDays ?? (seen === 0 ? 0 : stat.streak >= 4 ? 14 : stat.streak >= 2 ? 1 : 0.25);
  return {
    ...base,
    ...stat,
    ease: clamp(stat.ease ?? (2.05 + accuracy * 0.7), 1.3, 3.2),
    intervalDays: clamp(inferredInterval, 0, 365),
    due: stat.due ?? ((stat.last ?? 0) + inferredInterval * DAY),
    lapses: stat.lapses ?? 0,
    stability: clamp(stat.stability ?? Math.max(0.2, inferredInterval || 0.25), 0.05, 365),
    difficulty: clamp(stat.difficulty ?? (0.65 - accuracy * 0.3), 0.05, 0.95),
    phase: stat.phase ?? (seen === 0 ? 'new' : stat.streak >= 5 && inferredInterval >= 14 ? 'mastered' : stat.streak >= 2 ? 'review' : 'learning'),
  };
}

export function recallProbability(stat: WordStat | undefined, now = Date.now()): number {
  const s = upgradeStat(stat);
  if (!s.seen || !s.last) return 0;
  const elapsed = Math.max(0, (now - s.last) / DAY);
  return clamp(Math.exp(-elapsed / Math.max(0.12, s.stability)), 0, 1);
}

export function isDue(stat: WordStat | undefined, now = Date.now()): boolean {
  const s = upgradeStat(stat);
  return s.seen === 0 || s.due <= now || s.phase === 'relearning';
}

export function overdueDays(stat: WordStat | undefined, now = Date.now()): number {
  const s = upgradeStat(stat);
  if (!s.due || s.due > now) return 0;
  return (now - s.due) / DAY;
}

export function heatOf(stat: WordStat | undefined): HeatLevel {
  const s = upgradeStat(stat);
  if (s.seen === 0) return 'ice';
  const accuracy = s.hits / Math.max(1, s.hits + s.misses);
  if (s.phase === 'relearning' || s.lapses > 0 && s.streak < 2) return 'ice';
  if (isDue(s)) return overdueDays(s) > 1.2 || recallProbability(s) < 0.48 ? 'ice' : 'amber';
  if (s.phase === 'mastered' && s.streak >= 7 && accuracy >= 0.82 && s.intervalDays >= 14) return 'crimson';
  if (s.hits >= 3 || s.seen >= 4 || s.phase === 'review') return 'amber';
  return 'ice';
}

function waveWeight(word: VocabWord, heat: HeatMap, allowCrimson: boolean, now = Date.now()) {
  const stat = upgradeStat(heat[word.id]);
  const h = heatOf(stat);
  const due = isDue(stat, now);
  const overdue = overdueDays(stat, now);
  const recall = recallProbability(stat, now);

  if (h === 'crimson' && !due && !allowCrimson) return 0;
  // Tekrar pekiştirme: relearning ve yeni kelimeler daha agresif ağırlıkta
  if (stat.phase === 'relearning') return 18;
  if (stat.seen === 0) return 9;
  if (due) return Math.round(clamp(11 + overdue * 4 + (1 - recall) * 5, 10, 26));
  if (h === 'ice') return 7;
  if (h === 'amber') return 4;
  return allowCrimson ? 1 : 0;
}

/** Due-first weighted sampling: forgotten and scheduled cards naturally resurface. */
export function buildWavePool(
  words: VocabWord[],
  heat: HeatMap,
  allowCrimson = false,
): VocabWord[] {
  const out: VocabWord[] = [];
  for (const w of words) {
    const weight = waveWeight(w, heat, allowCrimson);
    for (let i = 0; i < weight; i++) out.push(w);
  }
  return out.length >= 4 ? out : words;
}

export function pickTarget(pool: VocabWord[]): VocabWord {
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
}

export function pickDecoys(words: VocabWord[], target: VocabWord, n: number): VocabWord[] {
  const others = words.filter(w => w.id !== target.id && w.native !== target.native && w.foreign !== target.foreign);
  const sameCategory = others.filter(w => w.category === target.category);
  const nearby = [...sameCategory, ...others.filter(w => w.category !== target.category)];
  const selected: VocabWord[] = [];
  const used = new Set<string>();
  for (const w of nearby.sort(() => Math.random() - 0.5)) {
    if (used.has(w.id)) continue;
    used.add(w.id);
    selected.push(w);
    if (selected.length >= n) break;
  }
  return selected;
}

export function applyResult(heat: HeatMap, wordId: string, correct: boolean): HeatMap {
  const prev = upgradeStat(heat[wordId]);
  const now = Date.now();
  const seen = prev.seen + 1;
  const hits = prev.hits + (correct ? 1 : 0);
  const misses = prev.misses + (correct ? 0 : 1);
  const accuracy = hits / Math.max(1, hits + misses);
  const recall = recallProbability(prev, now);

  let next: WordStat;
  if (correct) {
    const streak = prev.streak + 1;
    const ease = clamp(prev.ease + 0.04 + (recall < 0.55 ? 0.05 : 0) + (streak >= 5 ? 0.02 : 0), 1.3, 3.2);
    const difficulty = clamp(prev.difficulty - 0.03 - (recall < 0.45 ? 0.02 : 0), 0.05, 0.95);

    let intervalDays: number;
    // Pekiştirme: daha kısa interval, daha fazla tekrar gerektir — mastery eşiği yükseldi
    if (prev.phase === 'new' || prev.seen === 0) intervalDays = 0.18;       // ~4.3 saat (daha sık tekrar)
    else if (prev.phase === 'relearning') intervalDays = 0.35;               // ~8.4 saat
    else if (streak === 2) intervalDays = 0.75;
    else if (streak === 3) intervalDays = 2;
    else if (streak === 4) intervalDays = 5;
    else if (streak === 5) intervalDays = 9;
    else {
      const growth = ease * (1.05 + recall * 0.08) * (1 - difficulty * 0.15);
      intervalDays = Math.max(1, prev.intervalDays || 1) * growth;
    }

    intervalDays = clamp(intervalDays, 0.18, 365);
    const stability = clamp(Math.max(intervalDays, prev.stability * (1.18 + accuracy * 0.2)), 0.18, 365);
    // Mastery: 7 streak + 14 gün + %82 doğruluk gerekli (önce 5/10/%78 idi)
    const phase: WordStat['phase'] = streak >= 7 && intervalDays >= 14 && accuracy >= 0.82 ? 'mastered'
      : intervalDays >= 1 ? 'review'
        : 'learning';

    next = {
      ...prev,
      hits,
      misses,
      streak,
      seen,
      last: now,
      ease,
      intervalDays,
      due: now + intervalDays * DAY,
      stability,
      difficulty,
      phase,
    };
  } else {
    const intervalDays = prev.seen <= 1 ? 8 * MIN / DAY : 30 * MIN / DAY;
    next = {
      ...prev,
      hits,
      misses,
      streak: 0,
      seen,
      last: now,
      ease: clamp(prev.ease - 0.24, 1.3, 3.35),
      intervalDays,
      due: now + intervalDays * DAY,
      lapses: prev.lapses + 1,
      stability: clamp(prev.stability * 0.45, 0.08, 365),
      difficulty: clamp(prev.difficulty + 0.12, 0.05, 0.98),
      phase: 'relearning',
    };
  }

  return { ...heat, [wordId]: next };
}

export function heatBreakdown(words: VocabWord[], heat: HeatMap) {
  const c = { ice: 0, amber: 0, crimson: 0 };
  words.forEach(w => { c[heatOf(heat[w.id])]++; });
  return c;
}

export function reviewSummary(words: VocabWord[], heat: HeatMap, now = Date.now()) {
  const c = { new: 0, due: 0, learning: 0, review: 0, mastered: 0, overdue: 0 };
  for (const w of words) {
    const s = upgradeStat(heat[w.id]);
    if (s.seen === 0) c.new++;
    if (isDue(s, now)) c.due++;
    if (s.phase === 'learning' || s.phase === 'relearning') c.learning++;
    if (s.phase === 'review') c.review++;
    if (s.phase === 'mastered') c.mastered++;
    if (overdueDays(s, now) >= 1) c.overdue++;
  }
  return c;
}

export function highScoreKey(lang: LangCode, level: CEFRLevel) {
  return `${lang}:${level}`;
}

/* ───────── Wrong Book: hatalı kelimeler ───────── */
export function getWrongWords(words: VocabWord[], heat: HeatMap): { word: VocabWord; stat: WordStat }[] {
  const out: { word: VocabWord; stat: WordStat }[] = [];
  for (const w of words) {
    const s = upgradeStat(heat[w.id]);
    if (s.seen === 0) continue;
    if (s.misses > 0 || s.phase === 'relearning' || s.lapses > 0) {
      out.push({ word: w, stat: s });
    }
  }
  return out.sort((a, b) => {
    if (b.stat.misses !== a.stat.misses) return b.stat.misses - a.stat.misses;
    return b.stat.lapses - a.stat.lapses;
  });
}

/* ───────── Streak & Daily Goal ───────── */
const STREAK_GOAL = 15;
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
export function streakInfo(stats: RunStats): { current: number; best: number; today: number; goal: number; pct: number } {
  const today = todayKey();
  const isToday = stats.todayDate === today;
  return {
    current: stats.streak ?? 0,
    best: stats.bestStreak ?? 0,
    today: isToday ? (stats.todayCount ?? 0) : 0,
    goal: STREAK_GOAL,
    pct: Math.min(100, ((isToday ? (stats.todayCount ?? 0) : 0) / STREAK_GOAL) * 100),
  };
}
export function bumpStreak(stats: RunStats, correctDelta = 1): RunStats {
  const today = todayKey();
  const last = stats.lastStreakDate;
  const isToday = stats.todayDate === today;
  const todayCount = (isToday ? (stats.todayCount ?? 0) : 0) + correctDelta;

  // streak: ardışık gün sayacı
  let streak = stats.streak ?? 0;
  let bestStreak = stats.bestStreak ?? 0;
  if (!last) {
    streak = 1;
  } else if (last === today) {
    // aynı gün, streak değişmez
  } else {
    const lastD = new Date(last);
    const todayD = new Date(today);
    const diff = Math.floor((todayD.getTime() - lastD.getTime()) / 86_400_000);
    if (diff === 1) streak += 1;
    else if (diff > 1) streak = 1;
  }
  bestStreak = Math.max(bestStreak, streak);

  return {
    ...stats,
    streak,
    bestStreak,
    lastStreakDate: today,
    todayCount,
    todayDate: today,
  };
}
