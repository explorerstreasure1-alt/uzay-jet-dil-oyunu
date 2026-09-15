import { useEffect, useMemo, useState } from 'react';
import type { EngineApi } from '../hooks/useGameEngine';
import { LANGUAGES, LEVEL_CONFIG, getWords } from '../data/vocabulary';
import type { CEFRLevel, LangCode, VocabWord } from '../data/vocabulary';
import { store, DEFAULT_SPEAK } from '../lib/storage';
import type { SpeakProgress } from '../lib/storage';
import { audio, haptic } from '../lib/audio';
import { listenOnce, speechSupported } from '../lib/speech';
import { transliterate } from '../lib/pronounce';
import { genSentences, judgeSpeaking, resolveGroqKey, viteGroqKey } from '../lib/groq';
import { BackBtn, Shell } from './Screens';

const ROUNDS = 10;

const SPEEDS = [
  { id: 'slow', label: '🐢 YAVAŞ', rate: 0.7 },
  { id: 'mid', label: '▶ ORTA', rate: 1.0 },
  { id: 'fast', label: '🐇 HIZLI', rate: 1.3 },
] as const;
type SpeedId = typeof SPEEDS[number]['id'];
const speedRate = (id: SpeedId): number => SPEEDS.find(s => s.id === id)?.rate ?? 1.0;

/** Cümle öncelikli deste: önce çok kelimeliler, yetmezse tekiller. */
function buildDeck(lang: LangCode, level: CEFRLevel, extra: VocabWord[]): VocabWord[] {
  const pool = getWords(lang, level, 'all', extra);
  const sh = (a: VocabWord[]) => [...a].sort(() => Math.random() - 0.5);
  const multi = sh(pool.filter(w => w.foreign.includes(' ')));
  const single = sh(pool.filter(w => !w.foreign.includes(' ')));
  return [...multi, ...single].slice(0, ROUNDS);
}

type Phase = 'setup' | 'round' | 'done';
interface Last { score: number; transcript: string; ok: boolean; note: string; }
type Source = 'bank' | 'ai';

/** Doğru cevapta hedef dilde, A1 sadeliğinde övgü (rastgele biri seslenir). */
const PRAISE: Record<LangCode, [string, string, string]> = {
  en: ['Perfect!', 'Excellent!', 'Great job!'],
  es: ['¡Perfecto!', '¡Excelente!', '¡Muy bien!'],
  it: ['Perfetto!', 'Eccellente!', 'Bravissimo!'],
  ru: ['Отлично!', 'Превосходно!', 'Молодец!'],
  pt: ['Perfeito!', 'Excelente!', 'Muito bem!'],
  fr: ['Parfait!', 'Excellent!', 'Très bien!'],
  de: ['Perfekt!', 'Ausgezeichnet!', 'Sehr gut!'],
};

export function SpeakScreen({ api, onBack, initialLang, initialLevel }: {
  api: EngineApi; onBack: () => void; initialLang?: LangCode; initialLevel?: CEFRLevel;
}) {
  const [lang, setLang] = useState<LangCode>(initialLang ?? 'en');
  const [level, setLevel] = useState<CEFRLevel>(initialLevel ?? 'A1');
  const [phase, setPhase] = useState<Phase>('setup');
  const [deck, setDeck] = useState<VocabWord[]>([]);
  const [idx, setIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [last, setLast] = useState<Last | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [boom, setBoom] = useState(false);
  const [source, setSource] = useState<Source>(() => (api.settings.groqKey ? 'ai' : 'bank'));
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [praise, setPraise] = useState<string | null>(null);
  const [speed, setSpeed] = useState<SpeedId>(() => {
    try { const v = localStorage.getItem('wi_speak_rate'); return v === 'slow' || v === 'fast' ? v : 'mid'; }
    catch { return 'mid'; }
  });
  const groqKey = resolveGroqKey(api.settings.groqKey, viteGroqKey());

  // Bölümde hafif arka plan melodisi; çıkınca susar
  useEffect(() => {
    try {
      audio.unlock();
      if (api.settings.music) audio.startMusic('ice');
    } catch {}
    return () => { try { audio.stopMusic(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [results, setResults] = useState<boolean[]>([]);
  const supported = useMemo(() => speechSupported(), []);
  // İşletim sistemi azaltılmış hareket isterse düşme animasyonu yok → otomatik kaçırma da yok
  const staticFall = useMemo(() => {
    try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; }
    catch { return false; }
  }, []);
  const progress = useMemo((): SpeakProgress => { try { return store.loadSpeak(); } catch { return { ...DEFAULT_SPEAK }; } }, [phase]);

  const start = async () => {
    audio.unlock(); audio.ui();
    // AI modu: Groq cümle yazar; hata/anahtarsızlıkta oyun havuzuna düş
    if (source === 'ai' && groqKey) {
      setGenMsg('AI cümle yazıyor…');
      try {
        const items = await genSentences(groqKey, lang, level, ROUNDS);
        const d: VocabWord[] = items.map((it, i) => ({
          id: `ai-${lang}-${level}-${Date.now()}-${i}`,
          foreign: it.foreign, native: it.native, lang, level, category: 'phrase' as const,
        }));
        setDeck(d); setIdx(0); setLast(null); setAttempt(0); setBoom(false); setPraise(null); setResults([]);
        setGenMsg(null);
        setPhase('round');
      } catch {
        // AI düşerse sessizce oyun havuzuna geç (kullanıcı takılmaz)
        setSource('bank');
        const d = buildDeck(lang, level, api.customWords);
        if (!d.length) { setGenMsg(null); return; }
        setDeck(d); setIdx(0); setLast(null); setAttempt(0); setBoom(false); setPraise(null); setResults([]);
        setGenMsg(null);
        setPhase('round');
      }
      return;
    }
    const d = buildDeck(lang, level, api.customWords);
    if (!d.length) return;
    setDeck(d); setIdx(0); setLast(null); setAttempt(0); setBoom(false); setPraise(null); setResults([]);
    setGenMsg(null);
    setPhase('round');
  };

  const speak = async () => {
    const w = deck[idx];
    if (!w || listening || !supported) return;
    try { await navigator.mediaDevices?.getUserMedia?.({ audio: true }).then(m => m.getTracks().forEach(t => t.stop())).catch(() => {}); } catch {}
    setListening(true); setLast(null);
    const res = await listenOnce(lang, w.foreign, 10000);
    setListening(false);
    // AI hakem: anahtar + AI turu + duyulan metin varsa Groq karar verir, yoksa yerel puan
    let score = res.score, ok = res.ok, note = '';
    if (source === 'ai' && groqKey && res.transcript.trim()) {
      try {
        const j = await judgeSpeaking(groqKey, lang, w.foreign, res.transcript);
        score = j.score / 100; ok = j.ok; note = j.note;
      } catch { /* yerel puana düş */ }
    }
    if (ok) {
      // canavar patlaması + dalga sesi + ödül + yeşil parlama (anlam kartı zaten yeşil glow'lu)
      audio.explode(false);
      audio.shockwave();
      audio.correct();
      haptic('hit', api.settings.haptics);
      // hedef dilde A1 övgü (patlama bitince, seçili hızda)
      const [p1, p2, p3] = PRAISE[lang];
      const line = [p1, p2, p3][Math.floor(Math.random() * 3)];
      setPraise(line);
      const rate = speedRate(speed);
      window.setTimeout(() => { try { audio.speakAt(line, lang, rate); } catch {} }, 700);
      setBoom(true);
      window.setTimeout(() => setBoom(false), 850);
    } else {
      audio.wrong();
      haptic('miss', api.settings.haptics);
    }
    setLast({ score, transcript: res.transcript, ok, note });
  };

  const next = () => {
    const r = [...results, last?.ok ?? false];
    setResults(r);
    // kelime karnesi: bu turun kelimesini doğru/deneme ile işle
    try {
      const w = deck[idx];
      if (w) {
        const p0 = store.loadSpeak();
        const wk = `${lang}:${level}:${w.id.startsWith('ai-') ? `t:${w.foreign}` : w.id}`;
        const rec = p0.words[wk] ?? { f: w.foreign, n: w.native, ok: 0, total: 0 };
        rec.total += 1;
        if (last?.ok) rec.ok += 1;
        store.saveSpeak({ ...p0, words: { ...p0.words, [wk]: rec } });
      }
    } catch {}
    setPraise(null);
    if (idx + 1 >= deck.length) {
      const okCount = r.filter(Boolean).length;
      try {
        const p = store.loadSpeak();
        const key = `${lang}:${level}`;
        store.saveSpeak({
          runs: p.runs + 1,
          ok: p.ok + okCount,
          total: p.total + r.length,
          best: { ...p.best, [key]: Math.max(p.best[key] ?? 0, okCount) },
          words: p.words ?? {},
        });
      } catch {}
      audio.levelUp();
      setPhase('done');
    } else {
      setIdx(idx + 1); setLast(null); setAttempt(0);
      audio.ui();
    }
  };

  /** Seçili hızda seslendir (genel oyun hızını değiştirmez). */
  const playForeign = (w: VocabWord) => {
    audio.unlock();
    audio.speakAt(w.foreign, lang, speedRate(speed));
  };

  const pickSpeed = (id: SpeedId) => {
    setSpeed(id);
    try { localStorage.setItem('wi_speak_rate', id); } catch {}
    audio.ui();
  };

  // Tur açılınca (ve tekrarda) önce uygulama okur, sonra kullanıcı söyler
  const roundWord = phase === 'round' ? (deck[idx] ?? null) : null;
  useEffect(() => {
    if (phase !== 'round' || !roundWord || last || listening) return;
    const t = window.setTimeout(() => playForeign(roundWord), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx, attempt, deck, last, listening, lang, speed]);

  if (phase === 'setup') {
    return (
      <Shell>
        <BackBtn onClick={onBack} />
        <div className="font-orbitron text-[20px] font-black tracking-[0.14em] text-white/90 mb-1">🎤 KONUŞMA</div>
        <div className="font-mono-tech text-[8px] text-white/35 mb-3">Yabancı cümleyi oku → sesli söyle → patlat, anlamı gör. A1'den C1'e.</div>

        <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">DİL</div>
        <div className="flex gap-1.5 mb-3">
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => { setLang(l.code); audio.ui(); }}
              className="flex-1 rounded-lg py-2 active:scale-95 transition-all"
              style={{ background: l.code === lang ? `${l.accent}26` : 'rgba(255,255,255,0.045)', border: `1px solid ${l.code === lang ? l.accent : 'rgba(255,255,255,0.14)'}` }}>
              <span className="font-orbitron text-[12px] font-black"
                style={{ color: l.code === lang ? l.accent : 'rgba(255,255,255,0.45)' }}>{l.flag}</span>
            </button>
          ))}
        </div>

        <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">SEVİYE</div>
        <div className="space-y-1.5 mb-3">
          {(['A1', 'A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map(l => {
            const c = LEVEL_CONFIG[l];
            const on = level === l;
            const n = getWords(lang, l, 'all', api.customWords).length;
            return (
              <button key={l} onClick={() => { setLevel(l); audio.ui(); }}
                className="w-full rounded-lg px-3 py-2 flex items-center gap-3 active:scale-[0.98] transition-all"
                style={{ background: on ? `${c.color}26` : 'rgba(255,255,255,0.045)', border: `1px solid ${on ? c.color : 'rgba(255,255,255,0.14)'}` }}>
                <span className="font-orbitron text-[15px] font-black w-7" style={{ color: on ? c.color : 'rgba(255,255,255,0.4)' }}>{l}</span>
                <span className="font-mono-tech text-[9px] text-white/50 flex-1 text-left">{c.label.split('— ')[1]}</span>
                <span className="font-mono-tech text-[8px] text-white/30">{n} kelime</span>
              </button>
            );
          })}
        </div>

        <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">CÜMLE KAYNAĞI</div>
        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          {([['bank', 'OYUN HAVUZU'], ['ai', 'AI CÜMLELER']] as const).map(([k, label]) => {
            const on = source === k;
            const c = k === 'ai' ? '#c77dff' : '#00d4ff';
            return (
              <button key={k} onClick={() => { setSource(k); audio.ui(); }}
                className="rounded-lg py-2.5 active:scale-95 transition-all"
                style={{ background: on ? `${c}26` : 'rgba(255,255,255,0.045)', border: `1px solid ${on ? c : 'rgba(255,255,255,0.14)'}` }}>
                <span className="font-mono-tech text-[9px] tracking-[0.1em]"
                  style={{ color: on ? c : 'rgba(255,255,255,0.4)' }}>{label}</span>
              </button>
            );
          })}
        </div>
        <div className="font-mono-tech text-[7px] text-white/30 mb-3">
          {source === 'ai'
            ? (groqKey ? 'Groq yazar + hakemlik yapar (internet gerekir)' : 'AI için Ayarlar → Groq anahtarı gerekli — şimdilik havuz çalışır')
            : 'Çevrimdışı oyun kelimeleriyle çalışır'}
        </div>
        <button onClick={() => audio.preview(lang, speedRate(speed))} className="w-full glass rounded-xl py-2.5 mb-3 active:scale-95 transition-transform">
          <span className="font-mono-tech text-[9px] tracking-[0.12em] text-white/60">🔊 SESİ DENE · {audio.voiceName(lang).slice(0, 28)}</span>
        </button>
        {genMsg && (
          <div className="rounded-lg px-3 py-2 mb-3 font-mono-tech text-[9px] text-center"
            style={{ background: 'rgba(199,125,255,0.1)', border: '1px solid rgba(199,125,255,0.4)', color: '#d9b8ff' }}>
            {genMsg}
          </div>
        )}
        {(() => {
          const pool = getWords(lang, level, 'all', api.customWords).length;
          const prefix = `${lang}:${level}:`;
          const mine = Object.entries(progress.words ?? {}).filter(([k]) => k.startsWith(prefix));
          const learned = mine.filter(([, v]) => v.ok > 0).length;
          const left = Math.max(0, pool - learned);
          const recent = mine.filter(([, v]) => v.ok > 0).slice(-5).reverse();
          return (
            <div className="glass rounded-xl px-3 py-2.5 mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono-tech text-[8px] tracking-[0.2em] text-white/35">KARNE · {level}</span>
                <span className="font-mono-tech text-[8px]" style={{ color: '#00ffa3' }}>{learned}/{pool} · {left} kaldı</span>
              </div>
              <div className="h-[6px] rounded-full bg-white/10 overflow-hidden mb-1.5">
                <div className="h-full rounded-full" style={{ width: `${pool ? (learned / pool) * 100 : 0}%`, background: '#00ffa3', boxShadow: '0 0 6px #00ffa3' }} />
              </div>
              <div className="font-mono-tech text-[8px] text-white/40 text-center">
                {ROUNDS} cümle · {progress.runs} oturum · %{progress.total ? Math.round((progress.ok / progress.total) * 100) : 0} isabet
              </div>
              {recent.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {recent.map(([k, v]) => (
                    <div key={k} className="font-mono-tech text-[8px] text-white/50 truncate">✓ {v.f} <span className="text-white/30">= {v.n}</span></div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
        {!supported && (
          <div className="rounded-lg px-3 py-2 mb-3 font-mono-tech text-[9px]"
            style={{ background: 'rgba(255,179,0,0.1)', border: '1px solid rgba(255,179,0,0.4)', color: '#ffd166' }}>
            Bu tarayıcı konuşma tanımıyor — Chrome/Edge ile aç. Dinleme yine çalışır.
          </div>
        )}
        <button onClick={start} disabled={genMsg === 'AI cümle yazıyor…'} className="w-full rounded-xl py-3.5 active:scale-[0.97] transition-transform disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, rgba(0,255,163,0.26), rgba(0,180,120,0.12))', border: '1px solid #00ffa3', boxShadow: '0 0 18px rgba(0,255,163,0.35)' }}>
          <span className="font-orbitron text-[14px] font-black tracking-[0.26em] text-[#dcfff2]">{genMsg === 'AI cümle yazıyor…' ? '…YAZIYOR' : '🎤 BAŞLA'}</span>
        </button>
      </Shell>
    );
  }

  if (phase === 'done') {
    const okCount = results.filter(Boolean).length;
    const pct = results.length ? Math.round((okCount / results.length) * 100) : 0;
    return (
      <Shell>
        <div className="text-center pt-6">
          <div className="font-mono-tech text-[8px] tracking-[0.4em] text-white/35">KONUŞMA TURU BİTTİ</div>
          <div className="font-orbitron text-[44px] font-black mt-1"
            style={{ color: pct >= 70 ? '#00ffa3' : pct >= 40 ? '#ffd166' : '#ff8fa8', textShadow: '0 0 18px currentColor' }}>
            %{pct}
          </div>
          <div className="font-mono-tech text-[10px] text-white/50 mt-1">{okCount}/{results.length} doğru · {LANGUAGES.find(l => l.code === lang)?.flag} {level}</div>
        </div>
        {(() => {
          const good = deck.filter((_, i) => results[i]);
          if (!good.length) return null;
          return (
            <div className="glass rounded-xl px-3 py-2.5 mt-3 max-h-[30vh] overflow-y-auto no-bar">
              <div className="font-mono-tech text-[7px] tracking-[0.2em] text-center mb-1.5" style={{ color: '#00ffa3' }}>DOĞRU SÖYLEDİKLERİN</div>
              {good.map(w => (
                <div key={w.id} className="font-mono-tech text-[9px] text-white/65 py-0.5 truncate">✓ {w.foreign} <span className="text-white/30">= {w.native}</span></div>
              ))}
            </div>
          );
        })()}
        <div className="mt-auto space-y-2 pt-6">
          <button onClick={() => { setPhase('setup'); audio.ui(); }} className="w-full rounded-xl py-3 active:scale-[0.97] transition-transform"
            style={{ background: 'linear-gradient(135deg, rgba(0,255,163,0.26), rgba(0,180,120,0.12))', border: '1px solid #00ffa3' }}>
            <span className="font-orbitron text-[14px] font-black tracking-[0.26em] text-[#dcfff2]">↺ YENİ TUR</span>
          </button>
          <button onClick={onBack} className="w-full glass rounded-xl py-2.5 active:scale-[0.97] transition-transform">
            <span className="font-mono-tech text-[10px] tracking-[0.24em] text-white/55">◀ ANA MENÜ</span>
          </button>
        </div>
      </Shell>
    );
  }

  const w = deck[idx];
  if (!w) return <Shell><BackBtn onClick={onBack} /></Shell>;
  const reading = transliterate(lang, w.foreign);
  const missed = () => {
    if (!last && !listening) {
      audio.wrong();
      setLast({ score: 0, transcript: '', ok: false, note: '' });
    }
  };
  const retry = () => {
    audio.ui();
    setLast(null);
    setPraise(null);
    setAttempt(a => a + 1);
  };
  return (
    <Shell>
      <BackBtn onClick={onBack} />
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono-tech text-[8px] tracking-[0.2em] text-white/35">CÜMLE {idx + 1}/{deck.length}</span>
        <span className="font-mono-tech text-[8px] tracking-[0.14em]" style={{ color: LEVEL_CONFIG[level].color }}>{LANGUAGES.find(l => l.code === lang)?.flag} {level}</span>
      </div>
      <div className="h-[6px] rounded-full bg-white/10 overflow-hidden mb-3">
        <div className="h-full rounded-full transition-all" style={{ width: `${((idx) / deck.length) * 100}%`, background: '#00ffa3', boxShadow: '0 0 8px #00ffa3' }} />
      </div>

      {(!last || !last.ok) && (
        <div key={`${idx}-${attempt}`} className={staticFall ? undefined : 'speak-fall'} onAnimationEnd={staticFall ? undefined : missed}>
          <div className="glass rounded-2xl px-4 py-5 mb-2 text-center"
            style={{ border: '1px solid rgba(0,212,255,0.35)', boxShadow: '0 0 22px rgba(0,212,255,0.25)' }}>
            <div className="font-mono-tech text-[7px] tracking-[0.24em] text-white/30 mb-2">OKU VE SESLENDİR</div>
            <div className="font-orbitron text-[19px] font-black text-[#e6faff] leading-snug">{w.foreign}</div>
            <div className="font-mono-tech text-[13px] mt-2" style={{ color: '#ffd166' }}>{reading}</div>
            <div className="font-mono-tech text-[6px] tracking-[0.2em] text-white/25 mt-1">YAKLAŞIK OKUNUŞ</div>
          </div>
        </div>
      )}

      {boom && (
        <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 speak-flash" style={{ background: 'radial-gradient(circle, rgba(0,255,163,0.5), transparent 70%)' }} />
          {[0, 1, 2].map(i => (
            <div key={i} className="absolute rounded-full speak-ring"
              style={{
                width: 240, height: 240,
                border: `2px solid ${i === 1 ? '#8be9ff' : '#00ffa3'}`,
                boxShadow: `0 0 22px ${i === 1 ? '#8be9ff88' : '#00ffa388'}, inset 0 0 18px rgba(0,255,163,0.25)`,
                animationDelay: `${i * 0.16}s`,
              }} />
          ))}
          <div className="absolute rounded-full speak-ring"
            style={{ width: 120, height: 120, background: 'rgba(0,255,163,0.22)', animationDelay: '0.05s' }} />
        </div>
      )}

      {last?.ok && !boom && (
        <div className="glass rounded-2xl px-4 py-4 mb-3 text-center"
          style={{ border: '1px solid #00ffa3', boxShadow: '0 0 22px rgba(0,255,163,0.35)' }}>
          <div className="font-orbitron text-[18px] font-black" style={{ color: '#00ffa3', textShadow: '0 0 12px #00ffa3' }}>
            ✓ %{Math.round(last.score * 100)} PATLADI!
          </div>
          {praise && <div className="font-orbitron text-[15px] font-black mt-1" style={{ color: '#ffd166', textShadow: '0 0 10px #ffd166' }}>{praise}</div>}
          <div className="font-mono-tech text-[9px] text-white/45 mt-1">{w.foreign}</div>
          <div className="font-orbitron text-[20px] font-black text-[#e6faff] mt-1">= {w.native} =</div>
          {last.note && <div className="font-mono-tech text-[8px] mt-1.5" style={{ color: '#c77dff' }}>🤖 {last.note}</div>}
        </div>
      )}

      {last && !last.ok && (
        <div className="rounded-xl px-3 py-2.5 mb-3 text-center"
          style={{ background: 'rgba(255,46,99,0.1)', border: '1px solid rgba(255,46,99,0.45)' }}>
          <div className="font-orbitron text-[16px] font-black" style={{ color: '#ff8fa8' }}>
            {last.transcript ? `✕ %{Math.round(last.score * 100)}` : '✕ KAÇTI!'}
          </div>
          <div className="font-mono-tech text-[9px] text-white/50 mt-0.5">
            {last.transcript ? `“${last.transcript}” — tekrar dene` : 'cümle tabana ulaştı — tekrar dene ya da geç'}
          </div>
        </div>
      )}

      <div className="mt-auto space-y-2">
        {!last ? (
          <>
            <button onClick={speak} disabled={listening || !supported}
              className="w-full rounded-xl py-4 active:scale-[0.97] transition-transform disabled:opacity-50"
              style={{ background: listening ? 'rgba(255,179,0,0.2)' : 'linear-gradient(135deg, rgba(255,46,99,0.28), rgba(180,0,50,0.14))', border: `1px solid ${listening ? '#ffb300' : '#ff2e63'}`, boxShadow: '0 0 18px rgba(255,46,99,0.4)' }}>
              <span className="font-orbitron text-[16px] font-black tracking-[0.2em] text-[#ffe3ea]">
                {listening ? '● DİNLİYOR…' : '🎤 SÖYLE'}
              </span>
            </button>
            <div className="flex gap-2">
              <button onClick={() => playForeign(w)} disabled={listening} className="flex-[1.4] glass rounded-xl py-2.5 active:scale-95 transition-transform disabled:opacity-50">
                <span className="font-mono-tech text-[10px] tracking-[0.14em] text-white/60">🔊 DİNLE</span>
              </button>
              {SPEEDS.map(s => {
                const on = speed === s.id;
                return (
                  <button key={s.id} onClick={() => pickSpeed(s.id)} className="flex-1 rounded-xl py-2.5 active:scale-95 transition-transform"
                    style={{ background: on ? 'rgba(0,212,255,0.18)' : 'rgba(255,255,255,0.045)', border: `1px solid ${on ? '#00d4ff' : 'rgba(255,255,255,0.14)'}` }}>
                    <span className="font-mono-tech text-[8px] tracking-[0.08em]" style={{ color: on ? '#8be9ff' : 'rgba(255,255,255,0.4)' }}>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : last.ok ? (
          <button onClick={next} className="w-full rounded-xl py-3.5 active:scale-[0.97] transition-transform"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.3), rgba(0,102,255,0.16))', border: '1px solid #00d4ff', boxShadow: '0 0 18px rgba(0,212,255,0.4)' }}>
            <span className="font-orbitron text-[14px] font-black tracking-[0.26em] text-[#e6faff]">
              {idx + 1 >= deck.length ? 'SONUCU GÖR ▶' : 'SONRAKİ ▶'}
            </span>
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={retry} className="flex-1 rounded-xl py-3 active:scale-95 transition-transform"
              style={{ background: 'rgba(255,179,0,0.14)', border: '1px solid #ffb300' }}>
              <span className="font-mono-tech text-[10px] tracking-[0.14em] text-[#ffd166]">↻ TEKRAR DENE</span>
            </button>
            <button onClick={next} className="flex-1 glass rounded-xl py-3 active:scale-95 transition-transform">
              <span className="font-mono-tech text-[10px] tracking-[0.14em] text-white/55">PAS GEÇ ▶</span>
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
