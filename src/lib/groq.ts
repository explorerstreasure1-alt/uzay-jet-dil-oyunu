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

/** Hedef dilde + seviyede n cümle üret (yabancı + Türkçe). Hata fırlatır. */
export async function genSentences(key: string, lang: LangCode, level: CEFRLevel, n: number): Promise<AiSentence[]> {
  if (!key.trim()) throw new Error('no key');
  const L = langName(lang);
  const content = await chat(
    key, GEN_MODEL,
    `You write short CEFR ${level} ${L} sentences for Turkish speakers learning ${L}. Reply ONLY with JSON, no other text: {"items":[{"foreign":"...","native":"..."}]}. Rules: foreign = one natural ${L} sentence, 4-12 words, strictly ${level} level, no quotes inside; native = its plain Turkish translation. Vary everyday topics.`,
    `Write ${Math.max(1, Math.min(12, n))} sentences.`,
    25000, 0.8,
  );
  const parsed = JSON.parse(content) as { items?: { foreign?: unknown; native?: unknown }[] };
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const out: AiSentence[] = [];
  for (const it of items) {
    const foreign = typeof it.foreign === 'string' ? it.foreign.trim() : '';
    const native = typeof it.native === 'string' ? it.native.trim() : '';
    if (foreign && native && foreign.length <= 140) out.push({ foreign, native });
    if (out.length >= n) break;
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
