import type { LangCode } from '../data/vocabulary';
import { LANGUAGES } from '../data/vocabulary';

function norm(s: string): string {
  return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

function similarity(a: string, b: string): number {
  const A = norm(a), B = norm(b);
  if (A === B) return 1;
  if (!A || !B) return 0;
  // simple token Jaccard + edit distance hybrid
  const lev = (() => {
    const m = A.length, n = B.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = A[i-1]===B[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
  })();
  const maxLen = Math.max(A.length, B.length);
  return 1 - lev / maxLen;
}

export function speechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
}

export function speechLangTag(lang: LangCode): string {
  return LANGUAGES.find(l => l.code === lang)?.tts ?? 'en-US';
}

export interface SpeechResult { transcript: string; score: number; ok: boolean; }

export function listenOnce(lang: LangCode, expected: string, timeoutMs = 4500): Promise<SpeechResult> {
  return new Promise((resolve) => {
    const Ctor: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) { resolve({ transcript: '', score: 0, ok: false }); return; }
    const rec = new Ctor();
    rec.lang = speechLangTag(lang);
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    let done = false;
    const finish = (r: SpeechResult) => { if (done) return; done = true; try{ rec.stop(); }catch{} resolve(r); };
    const timer = window.setTimeout(() => finish({ transcript: '', score: 0, ok: false }), timeoutMs);
    rec.onresult = (e: any) => {
      window.clearTimeout(timer);
      const alts: string[] = Array.from(e.results[0] as any).map((a: any) => a.transcript as string);
      let best = 0, bestTxt = alts[0] ?? '';
      for (const t of alts) { const s = similarity(t, expected); if (s > best) { best = s; bestTxt = t; } }
      // eşik %72
      finish({ transcript: bestTxt, score: best, ok: best >= 0.72 });
    };
    rec.onerror = () => { window.clearTimeout(timer); finish({ transcript: '', score: 0, ok: false }); };
    rec.onend = () => { if (!done) { window.clearTimeout(timer); finish({ transcript: '', score: 0, ok: false }); } };
    try { rec.start(); } catch { finish({ transcript: '', score: 0, ok: false }); }
  });
}
