// FIX #1: organizeImports — type import önce, value sonra (biome)
import type { CatId, CEFRLevel, LangCode } from './wordbank';
import { buildLanguage } from './wordbank';

export type { LangCode, CEFRLevel } from './wordbank';
export { WORDS_PER_LANGUAGE } from './wordbank';
export type HeatLevel = 'ice' | 'amber' | 'crimson';
export type CategoryId = 'all' | CatId;

export interface VocabWord {
  id: string;
  foreign: string;
  native: string;
  lang: LangCode;
  level: CEFRLevel;
  category: CatId;
  custom?: boolean;
}

export const LANGUAGES: {
  code: LangCode; name: string; native: string; flag: string; tts: string; accent: string;
}[] = [
  { code: 'en', name: 'English',  native: 'İngilizce',  flag: 'EN', tts: 'en-US', accent: '#00d4ff' },
  { code: 'es', name: 'Español',  native: 'İspanyolca', flag: 'ES', tts: 'es-ES', accent: '#ffb300' },
  { code: 'it', name: 'Italiano', native: 'İtalyanca',  flag: 'IT', tts: 'it-IT', accent: '#00ff9d' },
  { code: 'ru', name: 'Русский',  native: 'Rusça',      flag: 'RU', tts: 'ru-RU', accent: '#ff4d6d' },
  { code: 'pt', name: 'Português', native: 'Portekizce', flag: 'PT', tts: 'pt-PT', accent: '#00ff88' },
  { code: 'fr', name: 'Français', native: 'Fransızca',  flag: 'FR', tts: 'fr-FR', accent: '#6f42c1' },
  { code: 'de', name: 'Deutsch',  native: 'Almanca',    flag: 'DE', tts: 'de-DE', accent: '#ffd700' },
];

export const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: 'all',      label: 'Tümü',       icon: '◈' },
  { id: 'daily',    label: 'Günlük',     icon: '☀' },
  { id: 'phrase',   label: 'Kalıplar',   icon: '❝' },
  { id: 'verb',     label: 'Fiiller',    icon: '⇉' },
  { id: 'number',   label: 'Sayı & Saat', icon: '№' },
  { id: 'travel',   label: 'Seyahat',    icon: '✈' },
  { id: 'food',     label: 'Gastronomi', icon: '♨' },
  { id: 'business', label: 'İş Dünyası', icon: '▲' },
  { id: 'tech',     label: 'Teknoloji',  icon: '⌁' },
  { id: 'nature',   label: 'Doğa',       icon: '❋' },
  { id: 'emotion',  label: 'Duygular',   icon: '♥' },
  { id: 'slang',    label: 'Sokak Dili', icon: '✦' },
];

/* ── lazily materialised per language (4.000 each, 16.000 total) ── */
const packs = new Map<LangCode, VocabWord[]>();
export function wordsOf(lang: LangCode): VocabWord[] {
  const hit = packs.get(lang);
  if (hit) return hit;
  const built = buildLanguage(lang).map((e, i) => ({
    id: `${lang}-${i}`,
    foreign: e.f,
    native: e.n,
    lang,
    level: e.lv,
    category: e.c,
  }));
  packs.set(lang, built);
  return built;
}

export function allWords(): VocabWord[] {
  return LANGUAGES.flatMap(l => wordsOf(l.code));
}

export const LEVEL_CONFIG: Record<CEFRLevel, {
  label: string; short: string; color: string;
  lanes: number; speed: number; wavesToClear: number;
}> = {
  A1: { label: 'A1 — Başlangıç', short: 'A1', color: '#00d4ff', lanes: 3, speed: 0.88, wavesToClear: 40 },
  A2: { label: 'A2 — Temel',     short: 'A2', color: '#00ffa3', lanes: 3, speed: 1.08, wavesToClear: 50 },
  B1: { label: 'B1 — Orta',      short: 'B1', color: '#ffb300', lanes: 4, speed: 1.34, wavesToClear: 60 },
  B2: { label: 'B2 — Üst Orta',  short: 'B2', color: '#ff6b1a', lanes: 4, speed: 1.62, wavesToClear: 70 },
  C1: { label: 'C1 — İleri',     short: 'C1', color: '#ff2e63', lanes: 5, speed: 1.95, wavesToClear: 80 },
};

export const HEAT_META: Record<HeatLevel, {
  label: string; core: string; glow: string; deep: string; desc: string;
}> = {
  ice:     { label: 'BUZ',  core: '#8be9ff', glow: '#00b3ff', deep: '#0a3a66', desc: 'Yeni / sık kaçırılan — daha sık gelir' },
  amber:   { label: 'ILIK', core: '#ffc247', glow: '#ff9500', deep: '#663c00', desc: 'Öğreniliyor — dengeli gelir' },
  crimson: { label: 'ALEV', core: '#ff4d6d', glow: '#ff0044', deep: '#66001c', desc: 'Ustalaşıldı — havuzdan düşer, Boss olarak döner' },
};
export const HEAT_COLORS = HEAT_META;

export function getWords(
  lang: LangCode, level: CEFRLevel, category: CategoryId, extra: VocabWord[] = [],
): VocabWord[] {
  const base = wordsOf(lang);
  const custom = extra.filter(w => w.lang === lang);
  return [...base, ...custom].filter(
    w => w.level === level && (category === 'all' || w.category === category),
  );
}

export function countWords(lang: LangCode, extra: VocabWord[] = []) {
  const pool = [...wordsOf(lang), ...extra.filter(w => w.lang === lang)];
  return {
    total: pool.length,
    byLevel: (['A1', 'A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map(l => ({
      level: l, n: pool.filter(p => p.level === l).length,
    })),
  };
}

export function categoryCount(lang: LangCode, level: CEFRLevel, cat: CategoryId, extra: VocabWord[] = []) {
  return getWords(lang, level, cat, extra).length;
}
export function getSeriesCount(lang: LangCode, level: CEFRLevel, extra: VocabWord[] = []): number {
  return Math.max(1, Math.ceil(getWords(lang, level, 'all', extra).length / 50));
}
export function getSeriesWords(lang: LangCode, level: CEFRLevel, idx: number, extra: VocabWord[] = []): VocabWord[] {
  const all = getWords(lang, level, 'all', extra);
  return all.slice(idx * 50, idx * 50 + 50);
}
export function isSeriesCompleted(lang: LangCode, level: CEFRLevel, idx: number, heat: import('../types/game').HeatMap, extra: VocabWord[] = []): boolean {
  const words = getSeriesWords(lang, level, idx, extra);
  return words.length > 0 && words.every(w => {
    const s = heat[w.id];
    return s && s.seen > 0 && s.hits > 0;
  });
}
