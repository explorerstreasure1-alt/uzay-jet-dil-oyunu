import { useMemo, useState } from 'react';
import type { EngineApi } from '../hooks/useGameEngine';
import { LANGUAGES, LEVEL_CONFIG, getWords } from '../data/vocabulary';
import type { CEFRLevel, LangCode, VocabWord } from '../data/vocabulary';
import { store } from '../lib/storage';
import { audio } from '../lib/audio';
import { listenOnce, speechSupported } from '../lib/speech';
import { BackBtn, Shell } from './Screens';

const ROUNDS = 10;

/** Cümle öncelikli deste: önce çok kelimeliler, yetmezse tekiller. */
function buildDeck(lang: LangCode, level: CEFRLevel, extra: VocabWord[]): VocabWord[] {
  const pool = getWords(lang, level, 'all', extra);
  const sh = (a: VocabWord[]) => [...a].sort(() => Math.random() - 0.5);
  const multi = sh(pool.filter(w => w.foreign.includes(' ')));
  const single = sh(pool.filter(w => !w.foreign.includes(' ')));
  return [...multi, ...single].slice(0, ROUNDS);
}

type Phase = 'setup' | 'round' | 'done';
interface Last { score: number; transcript: string; ok: boolean; }

export function SpeakScreen({ api, onBack }: { api: EngineApi; onBack: () => void }) {
  const [lang, setLang] = useState<LangCode>('en');
  const [level, setLevel] = useState<CEFRLevel>('A1');
  const [phase, setPhase] = useState<Phase>('setup');
  const [deck, setDeck] = useState<VocabWord[]>([]);
  const [idx, setIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [last, setLast] = useState<Last | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const supported = useMemo(() => speechSupported(), []);
  const progress = useMemo(() => { try { return store.loadSpeak(); } catch { return { runs: 0, ok: 0, total: 0, best: {} as Record<string, number> }; } }, [phase]);

  const start = () => {
    const d = buildDeck(lang, level, api.customWords);
    if (!d.length) return;
    audio.unlock(); audio.ui();
    setDeck(d); setIdx(0); setLast(null); setShowAnswer(false); setResults([]);
    setPhase('round');
  };

  const speak = async () => {
    const w = deck[idx];
    if (!w || listening || !supported) return;
    try { await navigator.mediaDevices?.getUserMedia?.({ audio: true }).then(m => m.getTracks().forEach(t => t.stop())).catch(() => {}); } catch {}
    setListening(true); setLast(null);
    const res = await listenOnce(lang, w.foreign, 10000);
    setListening(false);
    if (res.ok) audio.correct(); else audio.wrong();
    setLast({ score: res.score, transcript: res.transcript, ok: res.ok });
  };

  const next = () => {
    const r = [...results, last?.ok ?? false];
    setResults(r);
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
        });
      } catch {}
      audio.levelUp();
      setPhase('done');
    } else {
      setIdx(idx + 1); setLast(null); setShowAnswer(false);
      audio.ui();
    }
  };

  if (phase === 'setup') {
    return (
      <Shell>
        <BackBtn onClick={onBack} />
        <div className="font-orbitron text-[20px] font-black tracking-[0.14em] text-white/90 mb-1">🎤 KONUŞMA</div>
        <div className="font-mono-tech text-[8px] text-white/35 mb-3">Türkçeyi oku → hedef dilde sesli söyle → puanla. A1'den C1'e.</div>

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

        <div className="glass rounded-xl px-3 py-2.5 mb-3">
          <div className="font-mono-tech text-[8px] text-white/40 text-center">
            {ROUNDS} cümle · {progress.runs} oturum · %{progress.total ? Math.round((progress.ok / progress.total) * 100) : 0} isabet
          </div>
        </div>
        {!supported && (
          <div className="rounded-lg px-3 py-2 mb-3 font-mono-tech text-[9px]"
            style={{ background: 'rgba(255,179,0,0.1)', border: '1px solid rgba(255,179,0,0.4)', color: '#ffd166' }}>
            Bu tarayıcı konuşma tanımıyor — Chrome/Edge ile aç. Dinleme yine çalışır.
          </div>
        )}
        <button onClick={start} className="w-full rounded-xl py-3.5 active:scale-[0.97] transition-transform"
          style={{ background: 'linear-gradient(135deg, rgba(0,255,163,0.26), rgba(0,180,120,0.12))', border: '1px solid #00ffa3', boxShadow: '0 0 18px rgba(0,255,163,0.35)' }}>
          <span className="font-orbitron text-[14px] font-black tracking-[0.26em] text-[#dcfff2]">🎤 BAŞLA</span>
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

      <div className="glass rounded-2xl px-4 py-5 mb-3 text-center">
        <div className="font-mono-tech text-[7px] tracking-[0.24em] text-white/30 mb-2">TÜRKÇESİNİ SÖYLE</div>
        <div className="font-orbitron text-[20px] font-black text-[#e6faff] leading-snug">{w.native}</div>
        {showAnswer && (
          <div className="font-mono-tech text-[13px] mt-2" style={{ color: '#8be9ff' }}>{w.foreign}</div>
        )}
      </div>

      {last && (
        <div className="rounded-xl px-3 py-2.5 mb-3 text-center"
          style={{ background: last.ok ? 'rgba(0,255,163,0.1)' : 'rgba(255,46,99,0.1)', border: `1px solid ${last.ok ? 'rgba(0,255,163,0.45)' : 'rgba(255,46,99,0.45)'}` }}>
          <div className="font-orbitron text-[18px] font-black" style={{ color: last.ok ? '#00ffa3' : '#ff8fa8' }}>
            {last.ok ? '✓' : '✕'} %{Math.round(last.score * 100)}
          </div>
          {last.transcript && <div className="font-mono-tech text-[9px] text-white/50 mt-0.5">“{last.transcript}”</div>}
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
              <button onClick={() => { audio.speak(w.foreign, lang); }} className="flex-1 glass rounded-xl py-2.5 active:scale-95 transition-transform">
                <span className="font-mono-tech text-[10px] tracking-[0.14em] text-white/60">🔊 DİNLE</span>
              </button>
              <button onClick={() => setShowAnswer(v => !v)} className="flex-1 glass rounded-xl py-2.5 active:scale-95 transition-transform">
                <span className="font-mono-tech text-[10px] tracking-[0.14em] text-white/60">{showAnswer ? 'CEVABI GİZLE' : 'CEVABI GÖR'}</span>
              </button>
            </div>
          </>
        ) : (
          <button onClick={next} className="w-full rounded-xl py-3.5 active:scale-[0.97] transition-transform"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.3), rgba(0,102,255,0.16))', border: '1px solid #00d4ff', boxShadow: '0 0 18px rgba(0,212,255,0.4)' }}>
            <span className="font-orbitron text-[14px] font-black tracking-[0.26em] text-[#e6faff]">
              {idx + 1 >= deck.length ? 'SONUCU GÖR ▶' : 'SONRAKİ ▶'}
            </span>
          </button>
        )}
      </div>
    </Shell>
  );
}
