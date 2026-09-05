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
  // FIX #13: as any kaldırıldı — unknown guard ile tip güvenli
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function speechLangTag(lang: LangCode): string {
  return LANGUAGES.find(l => l.code === lang)?.tts ?? 'en-US';
}

export interface SpeechResult { transcript: string; score: number; ok: boolean; }

export function listenOnce(lang: LangCode, expected: string, timeoutMs = 8000): Promise<SpeechResult> {
  return new Promise((resolve) => {
    // FIX: geliştirildi — interim + 10 alternatif + dil bazlı hassasiyet + uzun timeout
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition };
    const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition) as unknown as new () => SpeechRecognition;
    if (!Ctor) { resolve({ transcript: '', score: 0, ok: false }); return; }
    const rec = new Ctor() as unknown as SpeechRecognition & { grammars?: unknown; maxAlternatives?: number };
    rec.lang = speechLangTag(lang);
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 10;
    // hassasiyet: dil bazlı eşik — ASR zayıf dillerde daha toleranslı
    const threshold =
      lang === 'ru' ? 0.48 :
      lang === 'de' ? 0.50 :
      lang === 'fr' ? 0.52 :
      lang === 'pt' ? 0.52 :
      lang === 'en' ? 0.52 : 0.54;
    let done = false;
    const finish = (r: SpeechResult) => { if (done) return; done = true; try{ rec.stop(); }catch{} try{ rec.abort?.(); }catch{} resolve(r); };
    const timer = window.setTimeout(() => finish({ transcript: '', score: 0, ok: false }), timeoutMs);
    // dil bazlı grammar bias (varsa) — hedef kelimeyi öne çıkar
    try {
      // FIX #15: GrammarList any kaldırıldı
      const ww = window as unknown as { SpeechGrammarList?: new () => { addFromString: (s:string,n:number)=>void }; webkitSpeechGrammarList?: new () => { addFromString: (s:string,n:number)=>void } };
      const SG = ww.SpeechGrammarList || ww.webkitSpeechGrammarList;
      if (SG && expected) {
        const grammars = new SG();
        const words = norm(expected).split(' ').filter(Boolean).slice(0, 6).join(' ');
        if (words) grammars.addFromString(`#JSGF V1.0; grammar words; public <word> = ${words} ;`, 1);
        (rec as unknown as { grammars: unknown }).grammars = grammars;
      }
    } catch {}
    let interimTxt = '';
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const isFinal = (e.results[0] as unknown as { isFinal?: boolean })?.isFinal ?? true;
      if (!isFinal) {
        try { interimTxt = (e.results[0][0] as unknown as { transcript?: string })?.transcript ?? ''; } catch {}
        return;
      }
      window.clearTimeout(timer);
      const results = Array.from((e.results[0] as unknown as SpeechRecognitionAlternative[]));
      let best = 0, bestTxt = interimTxt;
      for (const alt of results) {
        const txt: string = alt.transcript ?? '';
        const conf: number = typeof alt.confidence === 'number' ? alt.confidence : 0.9;
        const sim = similarity(txt, expected);
        const weighted = sim * (0.78 + conf * 0.22);
        if (weighted > best) { best = weighted; bestTxt = txt; }
      }
      // interim'i de değerlendir — ASR kısa kelimeyi interimde yakalayabilir
      if (interimTxt && !bestTxt) {
        const simI = similarity(interimTxt, expected);
        if (simI > best) { best = simI * 0.92; bestTxt = interimTxt; }
      }
      const len = norm(expected).length;
      const shortBonus = len <= 3 ? 0.08 : len <= 6 ? 0.04 : 0;
      const subBonus2 = bestTxt && norm(expected).split(' ').some(w => norm(bestTxt).includes(w)) ? 0.06 : 0;
      finish({ transcript: bestTxt, score: best, ok: best + shortBonus + subBonus2 >= threshold });
    };
    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      window.clearTimeout(timer);
      const err = (ev as unknown as { error?: string })?.error ?? '';
      if (err === 'no-speech' || err === 'audio-capture') {
        window.setTimeout(() => { if (!done) finish({ transcript: interimTxt, score: similarity(interimTxt, expected), ok: false }); }, 500);
      } else if (err === 'not-allowed' || err === 'service-not-allowed') {
        finish({ transcript: '', score: 0, ok: false });
      } else {
        finish({ transcript: interimTxt, score: 0, ok: false });
      }
    };
    rec.onend = () => { if (!done) { window.clearTimeout(timer); finish({ transcript: interimTxt, score: interimTxt ? similarity(interimTxt, expected) : 0, ok: false }); } };
    rec.onspeechend = () => { try { rec.stop(); } catch {} };
    rec.onnomatch = () => { if (!done) finish({ transcript: interimTxt, score: 0, ok: false }); };
    try { rec.start(); } catch { finish({ transcript: '', score: 0, ok: false }); }
  });
}
