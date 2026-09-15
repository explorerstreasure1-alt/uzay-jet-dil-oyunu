import type { CEFRLevel, LangCode } from '../data/vocabulary';

/* Çalışma anında vocabulary'e bağımlılık yok (sadece tip) — test edilebilir. */
const LANG_NAMES: Record<LangCode, string> = {
  en: 'English', es: 'Español', it: 'Italiano', ru: 'Русский',
  pt: 'Português', fr: 'Français', de: 'Deutsch',
};

/* ══════════════════════════════════════════════════════════════════════
   GROQ — AI cümle üretimi + konuşma hakemliği.
   Anahtar ASLA repoya gömülmez: Ayarlar ekranından girilir (localStorage)
   ya da derleme anında VITE_GROQ_API_KEY env'inden okunur.
   Anahtar yoksa çağıran taraf oyun-havuzu + yerel puana düşer.
   ══════════════════════════════════════════════════════════════════════ */

const API = 'https://api.groq.com/openai/v1/chat/completions';
const GEN_MODEL = 'openai/gpt-oss-20b';
const JUDGE_MODEL = 'openai/gpt-oss-20b';

/** Ayarlardaki anahtar → env → boş. Boşsa AI kapalı demektir. */
export function resolveGroqKey(settingsKey?: string, envKey?: string): string {
  const stored = (settingsKey ?? '').trim();
  if (stored) return stored;
  return (envKey ?? '').trim();
}

/** Vite derlemesinde env'den okur (tarayıcıda process yoktur). */
export function viteGroqKey(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GROQ_API_KEY ?? '';
    return env.trim();
  } catch {
    return '';
  }
}

async function chat(key: string, model: string, system: string, user: string, timeoutMs: number, temperature: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(API, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`groq ${res.status}`);
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) throw new Error('groq empty');
    return content;
  } finally {
    window.clearTimeout(timer);
  }
}

export interface AiSentence { foreign: string; native: string; }

const langName = (lang: LangCode): string => LANG_NAMES[lang] ?? 'English';

/** Türkçe sızıntı dedektörü: tek isabet yeten güçlü + çift isabet isteyen zayıf kelimeler. */
const TR_STRONG = [
  'nerede', 'nasıl', 'neden', 'niçin', 'merhaba', 'selam', 'teşekkür', 'sağol',
  'lütfen', 'pardon', 'günaydın', 'hoşça', 'güle', 'görüşürüz', 'buyurun', 'buyur',
  'efendim', 'tamam', 'peki', 'belki', 'aslında', 'gerçekten', 'zaten', 'şey',
  'kimse', 'herkes', 'burada', 'şurada', 'orada', 'şimdi', 'yarın', 'dün',
  'bugün', 'kahvaltı', 'çok',
];
const TR_WEAK = [
  've', 'bir', 'bu', 'şu', 'o', 'ne', 'mi', 'mı', 'mu', 'mü',
  'de', 'da', 'ki', 'ya', 'hem', 'en', 'daha',
];
function looksTurkish(s: string): boolean {
  const toks = s.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  if (toks.some(t => TR_STRONG.includes(t))) return true;
  return toks.filter(t => TR_WEAK.includes(t)).length >= 2;
}

/** Hedef dil kontrolü: yanlış dilde/boş cümle elenir. */
function langOk(lang: LangCode, foreign: string): boolean {
  if (!foreign || foreign.length > 140) return false;
  if (looksTurkish(foreign)) return false;
  if (lang === 'ru') return /[\u0400-\u04FF]/.test(foreign);
  if (/[\u0400-\u04FF]/.test(foreign)) return false;
  // ğ/ı/ş 7 hedefin hiçbirinde yok (fr ç'si hariç) → Türkçe sızıntısı
  if (/[ğĞışŞ]/.test(foreign)) return false;
  return true;
}

/** Hedef dilde + seviyede n cümle üret (yabancı + Türkçe). Tutana kadar 1 kez dener. Hata fırlatır. */
export async function genSentences(key: string, lang: LangCode, level: CEFRLevel, n: number): Promise<AiSentence[]> {
  if (!key.trim()) throw new Error('no key');
  const L = langName(lang);
  const count = Math.max(1, Math.min(12, n));
  const system =
    `You write short CEFR ${level} ${L} sentences for Turkish speakers learning ${L}. Reply ONLY with JSON, no other text: {"items":[{"foreign":"...","native":"..."}]}. ` +
    `Rules: EVERY foreign sentence MUST be written in ${L} (never Turkish, never another language); 4-12 words, strictly ${level} level, no quotes inside; ` +
    `native = its plain Turkish translation. Vary everyday topics.`;
  const out: AiSentence[] = [];
  const seen = new Set<string>();
  for (let attempt = 0; attempt < 2 && out.length < count; attempt++) {
    const content = await chat(
      key, GEN_MODEL, system,
      `Write ${count} sentences.`,
      25000, 0.8,
    );
    let items: { foreign?: unknown; native?: unknown }[] = [];
    try {
      const parsed = JSON.parse(content) as { items?: { foreign?: unknown; native?: unknown }[] };
      if (Array.isArray(parsed.items)) items = parsed.items;
    } catch { /* tekrar dene */ }
    for (const it of items) {
      const foreign = typeof it.foreign === 'string' ? it.foreign.trim() : '';
      const native = typeof it.native === 'string' ? it.native.trim() : '';
      const k = foreign.toLowerCase();
      if (foreign && native && langOk(lang, foreign) && !seen.has(k)) {
        seen.add(k);
        out.push({ foreign, native });
      }
      if (out.length >= count) break;
    }
  }
  if (!out.length) throw new Error('groq empty items');
  return out;
}

export interface JudgeResult { ok: boolean; score: number; note: string; }

/** ASR çıktısını hedef cümleye karşı hakemle. Hata fırlatır (çağıran yerele düşer). */
export async function judgeSpeaking(key: string, lang: LangCode, expected: string, transcript: string): Promise<JudgeResult> {
  if (!key.trim()) throw new Error('no key');
  const L = langName(lang);
  const content = await chat(
    key, JUDGE_MODEL,
    `You judge a pronunciation exercise. Target ${L} sentence: "${expected}". The learner said (speech-recognition transcript, may contain recognition noise, lowercase, no punctuation): "${transcript}". Reply ONLY with JSON, no other text: {"score":0-100,"ok":true/false,"note":"..."}. Rules: ok=true when score>=60. Be tolerant of ASR noise, missing articles and small word swaps; fail when the meaning/content is clearly different or empty. note = one short encouraging sentence in Turkish.`,
    `Target: ${expected} | Said: ${transcript}`,
    20000, 0.2,
  );
  const parsed = JSON.parse(content) as { score?: unknown; ok?: unknown; note?: unknown };
  const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
  return {
    ok: parsed.ok === true || score >= 60,
    score,
    note: typeof parsed.note === 'string' ? parsed.note.slice(0, 120) : '',
  };
}
