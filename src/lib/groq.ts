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

/** Seviyeye göre uzunluk + yapı rehberi — AI kalitesiz/sapık cümle kurmasın. */
const LEVEL_GUIDE: Record<CEFRLevel, string> = {
  A1: '4-7 words, only present simple, SVO order, no subordinate clauses, top-500 everyday words (family, food, home, school)',
  A2: '6-9 words, present + going-to future, one time/place complement, everyday situations (shopping, travel, weather)',
  B1: '8-12 words, past + future + connectors (because, when, if, but), one coherent scene per sentence',
  B2: '10-14 words, varied tenses + relative clause or passive allowed, opinions and reasons',
  C1: '12-16 words, natural complex sentences, idiom-free but native-like, nuanced but clear',
};

const TOPICS = [
  'morning routine and breakfast', 'family and friends', 'food and drinks',
  'school and learning', 'travel and directions', 'weather and seasons',
  'shopping and prices', 'health and sport', 'home and daily chores',
  'work and free time', 'city life and transport', 'hobbies and cinema',
];

/** Hedef dilde + seviyede n cümle üret (yabancı + Türkçe). Tutana kadar 3 kez dener. Hata fırlatır. */
export async function genSentences(key: string, lang: LangCode, level: CEFRLevel, n: number): Promise<AiSentence[]> {
  if (!key.trim()) throw new Error('no key');
  const L = langName(lang);
  const count = Math.max(1, Math.min(12, n));
  const guide = LEVEL_GUIDE[level] ?? LEVEL_GUIDE.A1;
  const system =
    `You write short CEFR ${level} ${L} sentences for Turkish speakers learning ${L}. Reply ONLY with JSON, no other text: {"items":[{"foreign":"...","native":"..."}]}. ` +
    `Rules: EVERY foreign sentence MUST be written in ${L} (never Turkish, never another language); ${guide}; ` +
    `no quotes inside sentences; start with capital letter, end with ./?/!; ` +
    `each sentence ONE complete meaningful everyday situation (no fragments, no word salad, no repeated sentence patterns); ` +
    `native = its plain natural Turkish translation (never the same as foreign). Vary everyday topics, no two sentences about the same scene.`;
  const out: AiSentence[] = [];
  const seen = new Set<string>();
  for (let attempt = 0; attempt < 3 && out.length < count; attempt++) {
    const need = count - out.length;
    const topicSlice = [...TOPICS].sort(() => Math.random() - 0.5).slice(0, Math.min(4, need)).join(', ');
    const content = await chat(
      key, GEN_MODEL, system,
      `Write ${need} NEW ${level} sentences (topics: ${topicSlice}). Do not repeat previous patterns.`,
      25000, 0.9,
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
      if (!foreign || !native) continue;
      if (foreign.toLowerCase() === native.toLowerCase()) continue;
      if (native.length > 180) continue;
      if (!langOk(lang, foreign)) continue;
      if (seen.has(k)) continue;
      const wc = foreign.split(/\s+/).filter(Boolean).length;
      if (wc < 3 || wc > 18) continue;
      seen.add(k);
      out.push({ foreign, native });
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
