import type { LangCode } from '../data/vocabulary';
import { LANGUAGES } from '../data/vocabulary';

function norm(s: string): string {
  return s.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a: string, b: string): number {
  const A = norm(a), B = norm(b);
  if (A === B) return 1;
  if (!A || !B) return 0;
  // token Jaccard — kelime sırası/ekleri için toleranslı
  const tA = new Set(A.split(' ')), tB = new Set(B.split(' '));
  let inter = 0; for (const t of tA) if (tB.has(t)) inter++;
  const jaccard = inter / Math.max(1, Math.max(tA.size, tB.size));
  if (jaccard === 1) return 1;
  // Levenshtein (normalize edilmiş)
  const lev = (() => {
    const m = A.length, n = B.length;
    if (m === 0) return n; if (n === 0) return m;
    const prev = Array(n + 1).fill(0).map((_, j) => j);
    const cur = Array(n + 1).fill(0);
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) cur[j] = A[i-1]===B[j-1] ? prev[j-1] : 1+Math.min(prev[j], cur[j-1], prev[j-1]);
      for (let j = 0; j <= n; j++) prev[j] = cur[j];
    }
    return prev[n];
  })();
  const maxLen = Math.max(A.length, B.length);
  const levScore = 1 - lev / maxLen;
  // substring bonus — “water” vs “water please” gibi ekleri affet
  const subBonus = (A.includes(B) || B.includes(A)) ? 0.12 : 0;
  // tek kelimede Jaccard çok cezalandırıyor, o zaman direkt Levenshtein kullan — hassasiyet için
  if (tA.size === 1 && tB.size === 1) return Math.min(1, levScore + subBonus);
  // ağırlıklı birleşim: %35 Jaccard + %65 Levenshtein + bonus
  return Math.min(1, jaccard * 0.35 + levScore * 0.65 + subBonus);
}

export function speechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
}

export function speechLangTag(lang: LangCode): string {
  return LANGUAGES.find(l => l.code === lang)?.tts ?? 'en-US';
}

export interface SpeechResult { transcript: string; score: number; ok: boolean; }

export function listenOnce(lang: LangCode, expected: string, timeoutMs = 6500): Promise<SpeechResult> {
  return new Promise((resolve) => {
    const Ctor: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) { resolve({ transcript: '', score: 0, ok: false }); return; }
    const rec = new Ctor();
    rec.lang = speechLangTag(lang);
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 7;
    // hassasiyet: dil bazlı eşik — Rusça ASR daha zayıf, eşiği düşür
    const threshold = lang === 'ru' ? 0.50 : lang === 'en' ? 0.55 : 0.58;
    let done = false;
    const finish = (r: SpeechResult) => { if (done) return; done = true; try{ rec.stop(); }catch{} try{ rec.abort?.(); }catch{} resolve(r); };
    const timer = window.setTimeout(() => finish({ transcript: '', score: 0, ok: false }), timeoutMs);
    // dil bazlı grammar bias (varsa) — hedef kelimeyi öne çıkar
    try {
      const SG: any = (window as any).SpeechGrammarList || (window as any).webkitSpeechGrammarList;
      if (SG && expected) {
        const grammars = new SG();
        const words = norm(expected).split(' ').filter(Boolean).slice(0, 6).join(' ');
        if (words) grammars.addFromString(`#JSGF V1.0; grammar words; public <word> = ${words} ;`, 1);
        rec.grammars = grammars;
      }
    } catch {}
    rec.onresult = (e: any) => {
      window.clearTimeout(timer);
      const results: any[] = Array.from(e.results[0] as any);
      let best = 0, bestTxt = '';
      for (const alt of results) {
        const txt: string = alt.transcript ?? '';
        const conf: number = typeof alt.confidence === 'number' ? alt.confidence : 1;
        const sim = similarity(txt, expected);
        // güven + benzerlik ağırlıklı skor — hassasiyet için conf'u hafif kat
        const weighted = sim * (0.82 + conf * 0.18);
        if (weighted > best) { best = weighted; bestTxt = txt; }
      }
      // kısa kelimelerde (<=3 harf) substring ve Jaccard zaten bonus verdi, eşiği biraz düşür
      const shortBonus = norm(expected).length <= 3 ? 0.06 : 0;
      finish({ transcript: bestTxt, score: best, ok: best + shortBonus >= threshold });
    };
    rec.onerror = (ev: any) => {
      window.clearTimeout(timer);
      // no-speech / audio-capture hatalarında hemen bitirme, onend'e bırak — bazı tarayıcılarda önce error sonra result geliyor
      const err = ev?.error ?? '';
      if (err === 'no-speech' || err === 'audio-capture') {
        // 400ms ek bekle, belki result gelir
        window.setTimeout(() => { if (!done) finish({ transcript: '', score: 0, ok: false }); }, 400);
      } else {
        finish({ transcript: '', score: 0, ok: false });
      }
    };
    rec.onend = () => { if (!done) { window.clearTimeout(timer); finish({ transcript: '', score: 0, ok: false }); } };
    rec.onspeechend = () => { try { rec.stop(); } catch {} };
    try { rec.start(); } catch { finish({ transcript: '', score: 0, ok: false }); }
  });
}
