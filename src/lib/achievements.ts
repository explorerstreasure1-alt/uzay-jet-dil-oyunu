import type { RunStats } from '../types/game';

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  check: (s: RunStats, ctx?: { combo?: number; waves?: number }) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_blood', title: 'İlk Kan', desc: 'İlk doğru vuruş', icon: '◈', check: s => s.totalCorrect >= 1 },
  { id: 'hundred', title: 'Yüzlük', desc: '100 doğru', icon: '◎', check: s => s.totalCorrect >= 100 },
  { id: 'five_hundred', title: 'Beş Yüz', desc: '500 doğru', icon: '⬢', check: s => s.totalCorrect >= 500 },
  { id: 'combo5', title: 'Kombo 5', desc: '5 kombo', icon: '⚡', check: (_s, c) => (c?.combo ?? 0) >= 5 },
  { id: 'combo10', title: 'Kombo 10', desc: '10 kombo', icon: '⚡⚡', check: (_s, c) => (c?.combo ?? 0) >= 10 },
  { id: 'streak3', title: '3 Gün Seri', desc: '3 gün üst üste oyna', icon: '🔥', check: s => (s.bestStreak ?? 0) >= 3 },
  { id: 'streak7', title: 'Haftalık Efsane', desc: '7 gün seri', icon: '🔥🔥', check: s => (s.bestStreak ?? 0) >= 7 },
  { id: 'boss5', title: 'Boss Avcısı', desc: '5 boss indir', icon: '👾', check: s => s.bossesKilled >= 5 },
  { id: 'waves50', title: 'Dalga Sörfçüsü', desc: '50 dalga temizle', icon: '🌊', check: s => s.wavesTotal >= 50 },
  { id: 'perfect3', title: 'Kusursuz 3', desc: '3 perfect dalga', icon: '◇', check: (_s, c) => (c?.waves ?? 0) >= 3 },
  { id: 'frenzy5', title: 'Frenzy Avcısı', desc: '5 frenzy temizle', icon: '⚡', check: s => (s as any).frenzyCleared >= 5 },
  { id: 'daily3', title: 'Günlük 3', desc: '3 günlük meydan okuma', icon: '📅', check: s => (s as any).dailyRuns >= 3 },
  { id: 'speech10', title: 'Konuşkan', desc: '10 kelimeyi söyle', icon: '🎤', check: s => (s as any).speechCount >= 10 },
  { id: 'lvl5', title: 'Seviye 5', desc: 'Seviye 5 ol', icon: '⬆', check: s => Math.floor((s.totalCorrect)/50)+1 >= 5 },
  { id: 'lvl10', title: 'Seviye 10', desc: 'Seviye 10 ol', icon: '⬆⬆', check: s => Math.floor((s.totalCorrect)/50)+1 >= 10 },
];

export function checkAchievements(stats: RunStats, ctx?: { combo?: number; waves?: number }): string[] {
  return ACHIEVEMENTS.filter(a => a.check(stats, ctx)).map(a => a.id);
}
export function xpFor(stats: RunStats): { xp: number; level: number; next: number; pct: number } {
  const xp = stats.totalCorrect * 10 + stats.bossesKilled * 50;
  const level = Math.floor(xp / 500) + 1;
  const next = level * 500;
  const pct = Math.min(100, ((xp % 500)/500)*100);
  return { xp, level, next, pct };
}
