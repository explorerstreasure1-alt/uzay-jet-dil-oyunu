import React, { useEffect, useMemo, useState } from 'react';
import type { EngineApi } from '../hooks/useGameEngine';
import { VW } from '../hooks/useGameEngine';
import type { GameState, HeatMap, Settings } from '../types/game';
import type { CategoryId, CEFRLevel, LangCode } from '../data/vocabulary';
import {
  LANGUAGES, LEVEL_CONFIG, CATEGORIES, HEAT_META, getWords, countWords, allWords, WORDS_PER_LANGUAGE,
} from '../data/vocabulary';
import { heatBreakdown, highScoreKey, reviewSummary, getWrongWords, streakInfo, getDailyChallenge, requestDailyPush, scheduleDailyPush } from '../lib/storage';
import { NEON } from '../lib/theme';
import { ACHIEVEMENTS, xpFor } from '../lib/achievements';
import { audio } from '../lib/audio';

const btn = (color: string, strong = false): React.CSSProperties => ({
  background: strong ? `linear-gradient(135deg, ${color}38, ${color}18)` : 'rgba(255,255,255,0.045)',
  border: `1px solid ${strong ? color : 'rgba(255,255,255,0.14)'}`,
  boxShadow: strong ? `0 0 16px ${color}44, inset 0 1px 0 rgba(255,255,255,0.14)` : 'none',
});

function Title() {
  return (
    <div className="text-center">
      <div className="font-mono-tech text-[7px] tracking-[0.38em] text-white/30 mb-0.5">HOLOGRAPHIC SUBCONSCIOUS PROTOCOL v2.1</div>
      <div className="font-mono-tech text-[6px] tracking-[0.22em] text-[#00d4ff]/60 mb-1">NEURAL LINK ESTABLISHED — MEMORY SECTOR ACTIVE</div>
      <div className="font-mono-tech text-[8px] tracking-[0.42em] text-white/35 mb-1">POLYGLOT EDITION</div>
      <h1 className="font-orbitron text-[40px] font-black leading-[0.92] tracking-[0.06em]"
        style={{ color: '#00d4ff', textShadow: '0 0 18px rgba(0,212,255,0.9), 0 0 44px rgba(0,102,255,0.45)' }}>
        WORD
      </h1>
      <h1 className="font-orbitron text-[40px] font-black leading-[0.92] tracking-[0.06em] -mt-1"
        style={{ color: '#ff2e63', textShadow: '0 0 18px rgba(255,46,99,0.85), 0 0 44px rgba(255,46,99,0.35)' }}>
        INVADERS
      </h1>
      <div className="mx-auto mt-2 h-px w-40" style={{ background: 'linear-gradient(90deg,transparent,#00d4ff,transparent)' }} />
      <div className="font-mono-tech text-[6px] tracking-[0.18em] text-white/25 mt-1.5">BİLİNÇALTI HOLOGRAMI — KELİMELER İSTİLA EDİYOR</div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 z-30 flex flex-col px-4 py-4 overflow-y-auto no-bar">{children}</div>;
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="self-start glass rounded-lg px-3 py-1.5 mb-3 active:scale-95 transition-transform">
      <span className="font-mono-tech text-[10px] tracking-[0.2em] text-white/60">◀ GERİ</span>
    </button>
  );
}

/* ══════════════════ MENU ══════════════════ */
export function MenuScreen({ api, lang, setLang, go, pwa }: {
  api: EngineApi; lang: LangCode; setLang: (l: LangCode) => void;
  go: (v: 'setup' | 'deck' | 'stats' | 'settings' | 'install' | 'wrongbook' | 'daily') => void;
  pwa?: { canInstall: boolean; isInstalled: boolean; isIos: boolean; install: () => Promise<string> };
}) {
  const counts = useMemo(() => countWords(lang, api.customWords), [lang, api.customWords]);
  const accent = LANGUAGES.find(l => l.code === lang)!.accent;

  return (
    <Shell>
      <div className="pt-3"><Title /></div>

      <div className="mt-4">
        <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-2">HEDEF DİL</div>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map(l => {
            const on = l.code === lang;
            return (
              <button key={l.code} onClick={() => { setLang(l.code); audio.ui(); }}
                className="rounded-xl px-3 py-2.5 text-left active:scale-95 transition-all"
                style={{ ...btn(l.accent, on) }}>
                <div className="flex items-baseline gap-2">
                  <span className="font-orbitron text-[15px] font-black"
                    style={{ color: on ? l.accent : 'rgba(255,255,255,0.55)', textShadow: on ? `0 0 10px ${l.accent}` : 'none' }}>
                    {l.flag}
                  </span>
                  <span className="font-mono-tech text-[9px] text-white/45">{l.native}</span>
                </div>
                <div className="font-mono-tech text-[8px] text-white/30 mt-0.5">
                  {countWords(l.code, api.customWords).total} kelime
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 glass rounded-xl px-3 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono-tech text-[8px] tracking-[0.24em] text-white/35">KELİME BANKASI</span>
          <span className="font-pixel text-[16px]" style={{ color: accent, textShadow: `0 0 8px ${accent}` }}>
            {counts.total.toLocaleString('tr-TR')}
          </span>
        </div>
        <div className="flex gap-1">
          {counts.byLevel.map(b => {
            const max = Math.max(...counts.byLevel.map(x => x.n), 1);
            return (
              <div key={b.level} className="flex-1">
                <div className="h-[22px] flex items-end bg-white/5 rounded-sm overflow-hidden">
                  <div className="w-full rounded-sm" style={{ height: `${(b.n / max) * 100}%`, background: LEVEL_CONFIG[b.level].color, opacity: 0.85 }} />
                </div>
                <div className="font-mono-tech text-[7px] text-white/45 text-center mt-0.5">{b.level}</div>
                <div className="font-mono-tech text-[7px] text-white/25 text-center">{b.n}</div>
              </div>
            );
          })}
        </div>
        <div className="font-mono-tech text-[7px] text-white/25 mt-1.5 text-center">
          4 dil × {WORDS_PER_LANGUAGE.toLocaleString('tr-TR')} = {(WORDS_PER_LANGUAGE * 4).toLocaleString('tr-TR')} giriş · hepsi çevrimdışı
        </div>
      </div>

      {(() => {
        const si = streakInfo(api.stats);
        const done = si.today >= si.goal;
        const chestKey = `wi_chest_${new Date().toISOString().slice(0,10)}`;
        const chestOpened = (()=>{ try{ return localStorage.getItem(chestKey)==='1'; }catch{ return false; }})();
        const canOpen = si.today >= 5 && !chestOpened;
        return (
          <div className="mt-3 glass rounded-xl px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono-tech text-[8px] tracking-[0.2em] text-white/35">GÜNLÜK HEDEF {si.today}/{si.goal}</span>
              <span className="font-mono-tech text-[8px] tracking-[0.14em]" style={{ color: done ? '#00ffa3' : '#ffb300' }}>{done ? '✓ TAMAMLANDI' : `${si.goal - si.today} kaldı`}</span>
            </div>
            <div className="h-[7px] rounded-full bg-white/10 overflow-hidden mb-2">
              <div className="h-full rounded-full transition-all" style={{ width: `${si.pct}%`, background: done ? '#00ffa3' : 'linear-gradient(90deg,#00d4ff,#00ffa3)', boxShadow: `0 0 8px ${done ? '#00ffa3' : '#00d4ff'}` }} />
            </div>
            <div className="flex gap-2 text-center">
              <div className="flex-1 glass rounded-lg py-1.5">
                <div className="font-orbitron text-[14px] font-black" style={{ color: '#ffd166', textShadow: '0 0 8px #ffd166' }}>🔥 {si.current}</div>
                <div className="font-mono-tech text-[6px] tracking-[0.1em] text-white/35">GÜN SERİ</div>
              </div>
              <div className="flex-1 glass rounded-lg py-1.5">
                <div className="font-orbitron text-[14px] font-black" style={{ color: '#00d4ff', textShadow: '0 0 8px #00d4ff' }}>{si.best}</div>
                <div className="font-mono-tech text-[6px] tracking-[0.1em] text-white/35">EN İYİ SERİ</div>
              </div>
            </div>
            {/* Günlük sandık — 5 doğruda açılır, akıcılığı ödüllendirir */}
            <button onClick={()=>{
              if(!canOpen) return;
              try{ localStorage.setItem(chestKey,'1'); }catch{}
              audio.correct(); audio.combo();
            }} disabled={!canOpen && !chestOpened} className={`w-full mt-2.5 rounded-xl py-2.5 flex items-center justify-center gap-2 active:scale-95 transition-all ${canOpen ? '' : chestOpened ? 'opacity-60' : 'opacity-40'}`} style={canOpen ? { background:`linear-gradient(135deg, ${NEON.gold}22, rgba(255,140,0,0.18))`, border:`1px solid ${NEON.gold}`, boxShadow:`0 0 14px ${NEON.gold}55` } : chestOpened ? { background:`${NEON.aqua}1E`, border:`1px solid ${NEON.aqua}55` } : { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)' }}>
              <span className="text-[16px]">{chestOpened ? '✅' : canOpen ? '📦' : '🔒'}</span>
              <span className="font-mono-tech text-[9px] tracking-[0.14em]" style={{ color: canOpen ? NEON.gold : chestOpened ? NEON.aqua : 'rgba(255,255,255,0.35)' }}>{chestOpened ? 'SANDIK AÇILDI — YARIN YENİSİ' : canOpen ? 'GÜNLÜK SANDIK AÇ! (5✓)' : `SANDIK ${Math.max(0,5-si.today)}✓ KALDI`}</span>
            </button>
            {canOpen && <div className="font-mono-tech text-[7px] text-center mt-1" style={{ color: `${NEON.gold}B3` }}>Aç → +50 bonus + nadir kelime</div>}
            {/* Haftalık ilerleme — nereye gittiğini gör */}
            {(() => {
              const seen = Object.keys(api.heat).length;
              const total = 4500;
              const pctW = Math.min(100, (seen / total) * 100);
              const weeklyGoal = 50;
              const weekly = seen % weeklyGoal;
              const weeklyPct = (weekly / weeklyGoal) * 100;
              return (
                <div className="mt-2.5 glass rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono-tech text-[7px] tracking-[0.2em] text-white/35">HAFTALIK İLERLEME</span>
                    <span className="font-mono-tech text-[7px] text-white/40">{seen}/{total} · {pctW.toFixed(1)}%</span>
                  </div>
                  <div className="h-[6px] rounded-full bg-white/10 overflow-hidden mb-1.5">
                    <div className="h-full rounded-full" style={{ width: `${pctW}%`, background: `linear-gradient(90deg, ${NEON.cyan}, ${NEON.purple})`, boxShadow: `0 0 6px ${NEON.cyan}` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tech text-[6px] text-white/30">Bu hafta {weekly}/{weeklyGoal}</span>
                    <span className="font-mono-tech text-[6px] text-white/30">{weeklyGoal - weekly} kaldı → sandık</span>
                  </div>
                  <div className="h-[4px] rounded-full bg-white/8 overflow-hidden mt-1">
                    <div className="h-full rounded-full" style={{ width: `${weeklyPct}%`, background: NEON.gold }} />
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      <div className="mt-auto space-y-2 pt-4">
        {/* Tek tıkla kurulum banner — mobilde direkt kurulum */}
        {pwa && !pwa.isInstalled && (
          <div className="rounded-xl px-3 py-2.5 flex items-center gap-3"
            style={{ background: 'linear-gradient(135deg, rgba(0,255,163,0.16), rgba(0,212,255,0.1))', border: '1px solid rgba(0,255,163,0.42)', boxShadow: '0 0 18px rgba(0,255,163,0.22)' }}>
            <div className="flex-1 min-w-0">
              <div className="font-orbitron text-[11px] font-black tracking-[0.14em] text-[#dcfff2]">📲 TELEFONA YÜKLE</div>
              <div className="font-mono-tech text-[7px] text-white/45 leading-tight">Tek tıkla ana ekrana ekle · Çevrimdışı oyna</div>
            </div>
            {pwa.canInstall ? (
              <button onClick={async () => { audio.ui(); const r = await pwa.install(); if (r === 'accepted') audio.correct(); }}
                className="rounded-lg px-3 py-2 active:scale-95 transition-transform shrink-0"
                style={{ background: 'linear-gradient(135deg, #00ffa3, #00d4ff)', boxShadow: '0 0 12px rgba(0,255,163,0.45)' }}>
                <span className="font-orbitron text-[11px] font-black tracking-[0.12em] text-[#061a12]">YÜKLE</span>
              </button>
            ) : (
              <button onClick={() => { audio.ui(); go('install'); }}
                className="rounded-lg px-3 py-2 active:scale-95 transition-transform shrink-0 glass">
                <span className="font-mono-tech text-[9px] tracking-[0.12em] text-white/70">NASIL?</span>
              </button>
            )}
          </div>
        )}
        {pwa?.isInstalled && (
          <div className="rounded-xl px-3 py-2 text-center" style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.25)' }}>
            <span className="font-mono-tech text-[8px] tracking-[0.14em] text-[#00ffa3]">✓ UYGULAMA KURULU — Ana ekrandan aç</span>
          </div>
        )}
        <button onClick={() => { audio.ui(); go('wrongbook'); }}
          className="w-full rounded-xl py-2.5 active:scale-95 transition-transform flex items-center justify-center gap-2"
          style={{ background: 'rgba(255,46,99,0.12)', border: '1px solid rgba(255,46,99,0.38)', boxShadow: '0 0 14px rgba(255,46,99,0.18)' }}>
          <span className="font-mono-tech text-[10px] tracking-[0.16em] text-[#ff8fa8]">✕ YANLIŞ DEFTERİ</span>
          {(() => {
            const c = getWrongWords([...allWords(), ...api.customWords].filter(w => w.lang === lang), api.heat).length;
            return c ? <span className="font-orbitron text-[11px] font-black px-1.5 py-0.5 rounded" style={{ background: '#ff2e63', color: '#fff' }}>{c}</span> : null;
          })()}
        </button>
        <button onClick={() => { audio.ui(); go('daily'); }}
          className="w-full rounded-xl py-2.5 active:scale-95 transition-transform flex items-center justify-center gap-2"
          style={{ background: 'rgba(255,209,102,0.14)', border: '1px solid rgba(255,209,102,0.44)', boxShadow: '0 0 14px rgba(255,209,102,0.18)' }}>
          <span className="font-mono-tech text-[10px] tracking-[0.16em] text-[#ffd166]">⚡ GÜNLÜK MEYDAN OKUMA</span>
          {(() => { const si = streakInfo(api.stats); return si.today >= 10 ? <span className="font-mono-tech text-[8px] px-1.5 py-0.5 rounded" style={{background:'#00ffa3', color:'#061a12'}}>✓</span> : <span className="font-mono-tech text-[8px] text-white/40">{si.today}/10</span>; })()}
        </button>
        <button onClick={() => { audio.unlock(); audio.ui(); go('setup'); }}
          className="w-full rounded-xl py-3.5 active:scale-[0.97] transition-transform"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.3), rgba(0,102,255,0.16))',
            border: '1px solid #00d4ff',
            boxShadow: '0 0 22px rgba(0,212,255,0.42), inset 0 1px 0 rgba(255,255,255,0.18)',
          }}>
          <span className="font-orbitron text-[16px] font-black tracking-[0.3em] text-[#e6faff]"
            style={{ textShadow: '0 0 12px #00d4ff' }}>BAŞLAT</span>
        </button>
        <div className="grid grid-cols-4 gap-2">
          {([['deck', 'DESTE'], ['stats', 'İSTAT'], ['install', 'YÜKLE'], ['settings', 'AYAR']] as const).map(([k, label]) => (
            <button key={k} onClick={() => { audio.ui(); go(k); }} className="glass rounded-lg py-2.5 active:scale-95 transition-transform">
              <span className="font-mono-tech text-[8px] tracking-[0.14em] text-white/60">{label}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {([['leaderboard','LİDERLİK'],['campaign','SEFER'],['teacher','ÖĞRETMEN']] as const).map(([k,label])=>(
            <button key={k} onClick={()=>{ audio.ui(); go(k as any); }} className="glass rounded-lg py-2 active:scale-95 transition-transform">
              <span className="font-mono-tech text-[7px] tracking-[0.12em] text-white/55">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </Shell>
  );
}

/* ══════════════════ INSTALL / PWA ══════════════════ */
export function InstallScreen({ canInstall, installed, isIos, onInstall, onBack }: {
  canInstall: boolean;
  installed: boolean;
  isIos: boolean;
  onInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  onBack: () => void;
}) {
  const [result, setResult] = useState<string>('');
  const install = async () => {
    const outcome = await onInstall();
    setResult(outcome === 'accepted'
      ? 'Kurulum başlatıldı. Ana ekranda Word Invaders ikonunu görebilirsin.'
      : outcome === 'dismissed'
        ? 'Kurulum iptal edildi. İstediğin zaman tekrar deneyebilirsin.'
        : 'Bu tarayıcı otomatik kurulum penceresi göstermiyor. Aşağıdaki adımları kullan.');
  };

  return (
    <Shell>
      <BackBtn onClick={onBack} />
      <div className="font-orbitron text-[20px] font-black tracking-[0.14em] text-white/90 mb-3">TELEFONA YÜKLE</div>

      <div className="glass rounded-2xl px-4 py-4 mb-3 text-center">
        <div className="mx-auto mb-3 rounded-2xl overflow-hidden"
          style={{ width: 86, height: 86, border: '1px solid rgba(0,212,255,0.4)', boxShadow: '0 0 24px rgba(0,212,255,0.3)' }}>
          <img src="/icons/icon-512.png" alt="Word Invaders icon" className="w-full h-full" width={86} height={86} />
        </div>
        <div className="font-orbitron text-[16px] font-black text-[#e6faff] mb-1">WORD INVADERS</div>
        <div className="font-mono-tech text-[9px] text-white/42 leading-relaxed">
          Ana ekrana ekle, tam ekran oyna, çevrimdışı aç. Tarayıcı çubuğu yok, oyun uygulama gibi çalışır.
        </div>
      </div>

      {installed ? (
        <div className="rounded-xl px-3 py-3 mb-3" style={{ background: 'rgba(0,255,163,0.1)', border: '1px solid rgba(0,255,163,0.42)' }}>
          <div className="font-orbitron text-[13px] font-black text-[#00ffa3] mb-1">UYGULAMA MODU AKTİF</div>
          <div className="font-mono-tech text-[9px] text-white/50">Şu anda yüklü/standalone modda çalışıyor.</div>
        </div>
      ) : (
        <button onClick={install} disabled={!canInstall}
          className="w-full rounded-xl py-3.5 mb-3 active:scale-[0.97] disabled:opacity-45 transition-transform"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.3), rgba(0,102,255,0.16))',
            border: '1px solid #00d4ff',
            boxShadow: '0 0 22px rgba(0,212,255,0.42), inset 0 1px 0 rgba(255,255,255,0.18)',
          }}>
          <span className="font-orbitron text-[14px] font-black tracking-[0.22em] text-[#e6faff]">
            {canInstall ? 'UYGULAMA OLARAK YÜKLE' : 'MANUEL KURULUM'}
          </span>
        </button>
      )}

      {result && (
        <div className="glass rounded-xl px-3 py-2.5 mb-3 font-mono-tech text-[9px] text-white/55 leading-relaxed">
          {result}
        </div>
      )}

      <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">KURULUM ADIMLARI</div>
      <div className="space-y-2">
        {(isIos ? [
          ['1', 'Safari ile aç', 'iPhone/iPad için en doğru kurulum Safari üzerinden yapılır.'],
          ['2', 'Paylaş butonuna bas', 'Alt çubuktaki paylaş ikonunu aç.'],
          ['3', 'Ana Ekrana Ekle', '“Ana Ekrana Ekle” seçeneğine dokun ve onayla.'],
        ] : [
          ['1', 'Chrome/Edge ile aç', 'Android’de otomatik yükle butonu varsa kullan.'],
          ['2', 'Menüden yükle', 'Üç nokta menüsü → “Uygulamayı yükle” veya “Ana ekrana ekle”.'],
          ['3', 'Tam ekran oyna', 'Kurulumdan sonra ikonla açınca tarayıcı çubuğu kaybolur.'],
        ]).map(([n, title, text]) => (
          <div key={n} className="glass rounded-xl px-3 py-2.5 flex gap-3">
            <div className="font-orbitron text-[16px] font-black text-[#00d4ff] w-6">{n}</div>
            <div className="flex-1">
              <div className="font-mono-tech text-[10px] tracking-[0.12em] text-white/75">{title}</div>
              <div className="font-mono-tech text-[8px] text-white/35 leading-relaxed">{text}</div>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ══════════════════ SETUP WIZARD ══════════════════ */
export function SetupScreen({ api, lang, setLang, onStart, onBack }: {
  api: EngineApi; lang: LangCode; setLang: (l: LangCode) => void;
  onStart: (l: LangCode, lv: CEFRLevel, c: CategoryId, cloze?: boolean) => void; onBack: () => void;
}) {
  const [lv, setLv] = useState<CEFRLevel>('A1');
  const [cat, setCat] = useState<CategoryId>('all');
  const [cloze, setCloze] = useState(false);
  const words = useMemo(() => getWords(lang, lv, cat, api.customWords), [lang, lv, cat, api.customWords]);
  const bd = useMemo(() => heatBreakdown(getWords(lang, lv, 'all', api.customWords), api.heat), [lang, lv, api.heat, api.customWords]);
  const rs = useMemo(() => reviewSummary(words, api.heat), [words, api.heat]);
  const best = api.stats.highScores[highScoreKey(lang, lv)] ?? 0;

  return (
    <Shell>
      <BackBtn onClick={onBack} />
      <div className="font-orbitron text-[20px] font-black tracking-[0.14em] text-white/90 mb-3">GÖREV KURULUMU</div>

      <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">DİL</div>
      <div className="flex gap-1.5 mb-3">
        {LANGUAGES.map(l => (
          <button key={l.code} onClick={() => { setLang(l.code); audio.ui(); }}
            className="flex-1 rounded-lg py-2 active:scale-95 transition-all" style={btn(l.accent, l.code === lang)}>
            <span className="font-orbitron text-[12px] font-black"
              style={{ color: l.code === lang ? l.accent : 'rgba(255,255,255,0.45)' }}>{l.flag}</span>
          </button>
        ))}
      </div>

      <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">CEFR SEVİYESİ</div>
      <div className="space-y-1.5 mb-3">
        {(['A1', 'A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map(l => {
          const c = LEVEL_CONFIG[l];
          const on = lv === l;
          return (
            <button key={l} onClick={() => { setLv(l); audio.ui(); }}
              className="w-full rounded-lg px-3 py-2 flex items-center gap-3 active:scale-[0.98] transition-all" style={btn(c.color, on)}>
              <span className="font-orbitron text-[15px] font-black w-7" style={{ color: on ? c.color : 'rgba(255,255,255,0.4)' }}>{l}</span>
              <span className="font-mono-tech text-[9px] text-white/50 flex-1 text-left">{c.label.split('— ')[1]}</span>
              <span className="font-mono-tech text-[8px] text-white/30">{c.wavesToClear} dalga</span>
            </button>
          );
        })}
      </div>

      <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">KATEGORİ</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {CATEGORIES.map(c => {
          const on = cat === c.id;
          const n = getWords(lang, lv, c.id, api.customWords).length;
          if (n === 0) return null;
          return (
            <button key={c.id} onClick={() => { setCat(c.id); audio.ui(); }}
              className="rounded-full px-2.5 py-1.5 active:scale-95 transition-all" style={btn('#00d4ff', on)}>
              <span className="font-mono-tech text-[9px]" style={{ color: on ? '#8be9ff' : 'rgba(255,255,255,0.45)' }}>
                {c.icon} {c.label}
              </span>
              <span className="font-mono-tech text-[7px] ml-1 text-white/30">{n}</span>
            </button>
          );
        })}
      </div>

      <button onClick={() => { setCloze(!cloze); audio.ui(); }} className="w-full glass rounded-lg px-3 py-2.5 mb-3 flex items-center justify-between active:scale-95 transition-all">
        <div>
          <div className="font-mono-tech text-[9px] tracking-[0.12em] text-white/80">CÜMLE MODU (CLOZE)</div>
          <div className="font-mono-tech text-[7px] text-white/30">Boşluğu doldur — bağlamda öğren</div>
        </div>
        <div className={`w-10 h-5 rounded-full p-0.5 transition-colors ${cloze ? 'bg-[#00d4ff]' : 'bg-white/10'}`}><div className={`w-4 h-4 rounded-full bg-white transition-transform ${cloze ? 'translate-x-5' : ''}`} /></div>
      </button>

      <div className="glass rounded-xl px-3 py-2.5 mb-3">
        <div className="flex justify-between items-center mb-2">
          <span className="font-mono-tech text-[8px] tracking-[0.24em] text-white/35">SEÇİLİ HAVUZ</span>
          <span className="font-pixel text-[14px] text-white/80">{words.length} kelime</span>
        </div>
        <div className="flex gap-2 mb-2">
          {(['ice', 'amber', 'crimson'] as const).map(h => {
            const m = HEAT_META[h];
            const total = bd.ice + bd.amber + bd.crimson || 1;
            return (
              <div key={h} className="flex-1">
                <div className="h-[6px] rounded-full bg-white/8 overflow-hidden mb-1">
                  <div className="h-full rounded-full" style={{ width: `${(bd[h] / total) * 100}%`, background: m.core, boxShadow: `0 0 6px ${m.glow}` }} />
                </div>
                <div className="font-mono-tech text-[7px] text-center" style={{ color: m.core }}>{m.label} {bd[h]}</div>
              </div>
            );
          })}
        </div>
        <div className="font-mono-tech text-[8px] text-white/35">EN İYİ SKOR · <span className="text-[#00d4ff]">{best.toString().padStart(6, '0')}</span></div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 mb-3 text-center">
        {([
          ['TEKRAR', rs.due, '#ffb300'],
          ['YENİ', rs.new, '#8be9ff'],
          ['ÖĞREN', rs.learning, '#00ffa3'],
          ['USTA', rs.mastered, '#ff4d6d'],
        ] as const).map(([k, v, c]) => (
          <div key={k} className="glass rounded-lg px-1.5 py-2">
            <div className="font-orbitron text-[14px] font-black" style={{ color: c, textShadow: `0 0 7px ${c}` }}>{v}</div>
            <div className="font-mono-tech text-[6.5px] tracking-[0.12em] text-white/35">{k}</div>
          </div>
        ))}
      </div>

      {words.length < 4 && (
        <div className="rounded-lg px-3 py-2 mb-2 font-mono-tech text-[9px]"
          style={{ background: 'rgba(255,46,99,0.12)', border: '1px solid rgba(255,46,99,0.4)', color: '#ff8fa8' }}>
          Bu filtre için yeterli kelime yok — başka kategori seç.
        </div>
      )}

      <button disabled={words.length < 4} onClick={() => onStart(lang, lv, cat, cloze)}
        className="w-full rounded-xl py-3.5 active:scale-[0.97] transition-transform disabled:opacity-35"
        style={{ background: cloze ? 'linear-gradient(135deg, rgba(199,125,255,0.32), rgba(0,212,255,0.18))' : 'linear-gradient(135deg, rgba(0,212,255,0.3), rgba(0,102,255,0.16))', border: `1px solid ${cloze ? '#c77dff' : '#00d4ff'}`, boxShadow: `0 0 20px ${cloze ? 'rgba(199,125,255,0.4)' : 'rgba(0,212,255,0.4)'}` }}>
        <span className="font-orbitron text-[15px] font-black tracking-[0.28em] text-[#e6faff]">{cloze ? 'CÜMLE MODU — BAŞLAT' : 'SAVAŞA GİR'}</span>
      </button>
    </Shell>
  );
}

/* ══════════════════ LEVEL COMPLETE (constellation) ══════════════════ */
export function LevelCompleteScreen({ s, onNext, onMenu }: { s: GameState; onNext: () => void; onMenu: () => void }) {
  const [n, setN] = useState(0);
  const words = s.masteredThisLevel.slice(0, 12);
  useEffect(() => {
    const t = setInterval(() => setN(v => (v >= words.length ? (clearInterval(t), v) : v + 1)), 190);
    return () => clearInterval(t);
  }, [words.length]);

  const pts = words.map((w, i) => {
    const a = (i / Math.max(1, words.length)) * Math.PI * 2 - Math.PI / 2;
    const r = 92 + (i % 3) * 26;
    return { w, x: VW / 2 + Math.cos(a) * r, y: 250 + Math.sin(a) * r * 0.72 };
  });

  return (
    <Shell>
      <div className="text-center pt-2">
        <div className="font-mono-tech text-[8px] tracking-[0.4em] text-white/35">BEYİN FIRTINASI</div>
        <div className="font-orbitron text-[26px] font-black tracking-[0.1em] mt-1"
          style={{ color: '#ffd166', textShadow: '0 0 20px rgba(255,209,102,0.8)' }}>SEVİYE TAMAM</div>
      </div>

      <svg width={VW - 32} height={330} viewBox={`0 0 ${VW} 400`} className="mx-auto -mb-2">
        {pts.map((p, i) => i < n - 1 && (
          <line key={i} x1={p.x} y1={p.y} x2={pts[i + 1].x} y2={pts[i + 1].y}
            stroke="#00d4ff" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.45" />
        ))}
        {pts.map((p, i) => {
          const m = HEAT_META.crimson;
          const on = i < n;
          return (
            <g key={p.w.id} opacity={on ? 1 : 0} style={{ transition: 'opacity .35s' }}>
              <circle cx={p.x} cy={p.y} r="14" fill="#ffd166" opacity="0.09" />
              <path d={`M${p.x},${p.y - 9} L${p.x + 5},${p.y} L${p.x},${p.y + 9} L${p.x - 5},${p.y} Z`}
                fill={m.core} style={{ filter: `drop-shadow(0 0 7px ${m.glow})` }} />
              <text x={p.x} y={p.y + 22} textAnchor="middle" fill="#ffffff" opacity="0.85"
                style={{ fontFamily: "'VT323', monospace", fontSize: 13 }}>{p.w.foreign}</text>
              <text x={p.x} y={p.y + 32} textAnchor="middle" fill="#ffffff" opacity="0.35"
                style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7 }}>{p.w.native}</text>
            </g>
          );
        })}
      </svg>

      <div className="glass rounded-xl px-3 py-2.5 mb-3">
        <div className="font-mono-tech text-[9px] text-white/55 leading-relaxed text-center">
          {words.length
            ? `${words.length} kelime artık beyninin haritasında işaretlendi.`
            : 'Henüz kelime ustalaşmadı — aynı seviyeyi tekrarla, ısı barı kırmızıya dönsün.'}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
          {[['SKOR', s.score.toString().padStart(6, '0'), '#00d4ff'],
            ['DALGA', String(s.wavesCleared), '#c77dff'],
            ['KOMBO', `×${s.bestCombo}`, '#00ffa3']].map(([k, v, c]) => (
            <div key={k}>
              <div className="font-mono-tech text-[7px] tracking-[0.2em] text-white/30">{k}</div>
              <div className="font-orbitron text-[16px] font-black" style={{ color: String(c), textShadow: `0 0 9px ${c}` }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-2">
        <button onClick={onNext} className="w-full rounded-xl py-3 active:scale-[0.97] transition-transform"
          style={{ background: 'linear-gradient(135deg, rgba(0,255,163,0.26), rgba(0,180,120,0.12))', border: '1px solid #00ffa3', boxShadow: '0 0 18px rgba(0,255,163,0.35)' }}>
          <span className="font-orbitron text-[14px] font-black tracking-[0.26em] text-[#dcfff2]">SONRAKİ GÖREV</span>
        </button>
        <button onClick={onMenu} className="w-full glass rounded-xl py-2.5 active:scale-[0.97] transition-transform">
          <span className="font-mono-tech text-[10px] tracking-[0.24em] text-white/55">◀ ANA MENÜ</span>
        </button>
      </div>
    </Shell>
  );
}

/* ══════════════════ GAME OVER ══════════════════ */
export function GameOverScreen({ s, best, onRetry, onMenu }: { s: GameState; best: number; onRetry: () => void; onMenu: () => void }) {
  const runTotal = s.runCorrect + s.runWrong;
  const runAcc = runTotal ? Math.round((s.runCorrect / runTotal) * 100) : 0;
  return (
    <Shell>
      <div className="text-center pt-8">
        <div className="font-orbitron text-[32px] font-black tracking-[0.1em] glitch"
          style={{ color: '#ff2e63', textShadow: '0 0 22px rgba(255,46,99,0.85)' }}>SİNYAL KESİLDİ</div>
        <div className="font-mono-tech text-[9px] tracking-[0.34em] text-white/35 mt-1">NÖRON AĞI ÇÖKTÜ</div>
      </div>

      <div className="glass rounded-2xl px-4 py-4 mt-6">
        <div className="text-center mb-3">
          <div className="font-mono-tech text-[8px] tracking-[0.28em] text-white/30">FİNAL SKOR</div>
          <div className="font-orbitron text-[34px] font-black"
            style={{ color: '#00d4ff', textShadow: '0 0 16px rgba(0,212,255,0.85)' }}>{s.score.toString().padStart(6, '0')}</div>
          {s.score >= best && s.score > 0 && (
            <div className="font-pixel text-[13px] mt-0.5" style={{ color: '#ffd166', textShadow: '0 0 8px #ffd166' }}>★ YENİ REKOR ★</div>
          )}
          {runTotal > 0 && <div className="font-mono-tech text-[8px] tracking-[0.14em] text-white/35 mt-1">{s.runCorrect} doğru · {s.runWrong} kaçırma · %{runAcc} isabet</div>}
        </div>
        <div className="h-px w-full mb-3" style={{ background: 'linear-gradient(90deg,transparent,rgba(0,212,255,0.45),transparent)' }} />
        <div className="grid grid-cols-4 gap-2 text-center">
          {([['DALGA', String(s.wavesCleared), '#c77dff'], ['KOMBO', `×${s.bestCombo}`, '#00ffa3'],
            ['SEVİYE', s.level, '#ffd166'], ['KOŞU', `${s.runCorrect}/${runTotal || 0}`, '#8be9ff']] as const).map(([k, v, c]) => (
            <div key={k}>
              <div className="font-mono-tech text-[7px] tracking-[0.16em] text-white/30">{k}</div>
              <div className="font-orbitron text-[15px] font-black" style={{ color: c, textShadow: `0 0 8px ${c}` }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-2 pt-6">
        <button onClick={onRetry} className="w-full rounded-xl py-3 active:scale-[0.97] transition-transform"
          style={{ background: 'linear-gradient(135deg, rgba(255,46,99,0.28), rgba(180,0,50,0.14))', border: '1px solid #ff2e63', boxShadow: '0 0 18px rgba(255,46,99,0.4)' }}>
          <span className="font-orbitron text-[14px] font-black tracking-[0.26em] text-[#ffe3ea]">↺ YENİDEN</span>
        </button>
        <button onClick={onMenu} className="w-full glass rounded-xl py-2.5 active:scale-[0.97] transition-transform">
          <span className="font-mono-tech text-[10px] tracking-[0.24em] text-white/55">◀ ANA MENÜ</span>
        </button>
      </div>
    </Shell>
  );
}


/* ══════════════════ STATS ══════════════════ */
export function StatsScreen({ api, onBack }: { api: EngineApi; onBack: () => void }) {
  const all = useMemo(() => [...allWords(), ...api.customWords], [api.customWords]);
  const total = all.length;
  const seen = Object.keys(api.heat).length;
  const bd = useMemo(() => heatBreakdown(all, api.heat), [all, api.heat]);
  const rs = useMemo(() => reviewSummary(all, api.heat), [all, api.heat]);
  const acc = api.stats.totalCorrect + api.stats.totalWrong;

  return (
    <Shell>
      <BackBtn onClick={onBack} />
      <div className="font-orbitron text-[20px] font-black tracking-[0.14em] text-white/90 mb-3">ISI HARİTASI</div>

      <div className="glass rounded-xl px-3 py-3 mb-3">
        <div className="font-mono-tech text-[8px] tracking-[0.28em] text-white/35 mb-2">TEKRAR KUYRUĞU</div>
        <div className="grid grid-cols-4 gap-1.5 mb-3 text-center">
          {([
            ['BUGÜN', rs.due, '#ffb300'],
            ['GECİKMİŞ', rs.overdue, '#ff2e63'],
            ['YENİ', rs.new, '#8be9ff'],
            ['USTA', rs.mastered, '#ff4d6d'],
          ] as const).map(([k, v, c]) => (
            <div key={k} className="rounded-lg px-1 py-2" style={{ background: `${c}10`, border: `1px solid ${c}30` }}>
              <div className="font-orbitron text-[14px] font-black" style={{ color: c, textShadow: `0 0 7px ${c}` }}>{v}</div>
              <div className="font-mono-tech text-[6.5px] tracking-[0.08em] text-white/35">{k}</div>
            </div>
          ))}
        </div>

        {(['ice', 'amber', 'crimson'] as const).map(h => {
          const m = HEAT_META[h];
          const pct = total ? (bd[h] / total) * 100 : 0;
          return (
            <div key={h} className="mb-2.5 last:mb-0">
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-pixel text-[13px]" style={{ color: m.core, textShadow: `0 0 7px ${m.glow}` }}>{m.label}</span>
                <span className="font-mono-tech text-[8px] text-white/40">{bd[h]} · %{Math.round(pct)}</span>
              </div>
              <div className="h-[8px] rounded-full bg-white/8 overflow-hidden">
                <div className="h-full rounded-full liquid-metal" style={{ width: `${pct}%`, boxShadow: `0 0 8px ${m.glow}` }} />
              </div>
              <div className="font-mono-tech text-[7px] text-white/28 mt-0.5">{m.desc}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {[['TOPLAM DOĞRU', api.stats.totalCorrect, '#00ffa3'], ['TOPLAM YANLIŞ', api.stats.totalWrong, '#ff2e63'],
          ['İSABET ORANI', acc ? `%${Math.round((api.stats.totalCorrect / acc) * 100)}` : '—', '#8be9ff'],
          ['KEŞFEDİLEN', `${seen}/${total}`, '#c77dff'],
          ['BOSS AVI', api.stats.bossesKilled, '#ffd166'], ['OTURUM', api.stats.sessionsPlayed, '#00d4ff']].map(([k, v, c]) => (
            <div key={k as string} className="glass rounded-lg px-3 py-2">
              <div className="font-mono-tech text-[7px] tracking-[0.18em] text-white/30">{k}</div>
              <div className="font-orbitron text-[18px] font-black" style={{ color: String(c), textShadow: `0 0 9px ${c}` }}>{v}</div>
            </div>
        ))}
      </div>
      {(() => {
        const { xp, level, pct } = xpFor(api.stats);
        return (
          <div className="glass rounded-xl px-3 py-2.5 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono-tech text-[8px] tracking-[0.14em] text-white/35">SEVİYE {level} · {xp} XP</span>
              <span className="font-mono-tech text-[7px] text-white/30">{500 - (xp % 500)} XP → Lv{level+1}</span>
            </div>
            <div className="h-[7px] rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#00d4ff,#c77dff)', boxShadow: '0 0 8px #00d4ff' }} />
            </div>
          </div>
        );
      })()}
      {(() => {
        const unlocked = new Set(api.stats.achievements ?? []);
        return (
          <div className="mb-3">
            <div className="font-mono-tech text-[8px] tracking-[0.2em] text-white/30 mb-1.5">ROZETLER ({unlocked.size}/{ACHIEVEMENTS.length})</div>
            <div className="grid grid-cols-4 gap-1.5">
              {ACHIEVEMENTS.map(a => {
                const on = unlocked.has(a.id);
                return (
                  <div key={a.id} className="rounded-lg px-1.5 py-2 text-center" style={{ background: on ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? '#00d4ff55' : 'rgba(255,255,255,0.08)'}`, opacity: on ? 1 : 0.38 }}>
                    <div className="font-orbitron text-[13px]" style={{ filter: on ? 'drop-shadow(0 0 4px #00d4ff)' : undefined }}>{a.icon}</div>
                    <div className="font-mono-tech text-[6px] leading-tight mt-0.5" style={{ color: on ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)' }}>{a.title}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">REKORLAR</div>
      <div className="space-y-1 mb-4">
        {Object.entries(api.stats.highScores).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => {
          const [l, lv] = k.split(':');
          const meta = LANGUAGES.find(x => x.code === l);
          return (
            <div key={k} className="glass rounded-lg px-3 py-1.5 flex justify-between items-center">
              <span className="font-mono-tech text-[10px]" style={{ color: meta?.accent }}>
                {meta?.flag} · {lv}
              </span>
              <span className="font-pixel text-[14px] text-[#00d4ff]">{v.toString().padStart(6, '0')}</span>
            </div>
          );
        })}
        {Object.keys(api.stats.highScores).length === 0 && (
          <div className="font-mono-tech text-[9px] text-white/25 text-center py-3">Henüz rekor yok.</div>
        )}
      </div>

      <button onClick={() => { if (confirm('Tüm ilerleme silinsin mi?')) api.resetProgress(); }}
        className="w-full glass rounded-xl py-2.5 active:scale-[0.97] transition-transform"
        style={{ borderColor: 'rgba(255,46,99,0.35)' }}>
        <span className="font-mono-tech text-[10px] tracking-[0.2em] text-[#ff8fa8]">İLERLEMEYİ SIFIRLA</span>
      </button>
    </Shell>
  );
}

/* ══════════════════ CUSTOM DECK ══════════════════ */
export function DeckScreen({ api, onBack }: { api: EngineApi; onBack: () => void }) {
  const [foreign, setForeign] = useState('');
  const [native, setNative] = useState('');
  const [lang, setLang] = useState<LangCode>('en');
  const [lv, setLv] = useState<CEFRLevel>('A1');
  const [cat, setCat] = useState<Exclude<CategoryId, 'all'>>('daily');

  const submit = () => {
    if (!foreign.trim() || !native.trim()) return;
    api.addCustomWord({ foreign, native, lang, level: lv, category: cat });
    audio.correct();
    setForeign(''); setNative('');
  };

  return (
    <Shell>
      <BackBtn onClick={onBack} />
      <div className="font-orbitron text-[20px] font-black tracking-[0.14em] text-white/90 mb-1">ÖZEL DEK</div>
      <div className="font-mono-tech text-[9px] text-white/35 mb-3">Kendi kelimelerini kortekse ekle.</div>

      <div className="glass rounded-xl px-3 py-3 space-y-2 mb-3">
        <div className="flex gap-1.5">
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)} className="flex-1 rounded-md py-1.5 active:scale-95 transition-all" style={btn(l.accent, lang === l.code)}>
              <span className="font-orbitron text-[10px] font-black" style={{ color: lang === l.code ? l.accent : 'rgba(255,255,255,0.4)' }}>{l.flag}</span>
            </button>
          ))}
        </div>
        <input value={foreign} onChange={e => setForeign(e.target.value)} placeholder="Yabancı kelime"
          className="w-full rounded-md bg-black/40 border border-white/12 px-3 py-2 font-mono-tech text-[12px] text-white outline-none focus:border-[#00d4ff]" />
        <input value={native} onChange={e => setNative(e.target.value)} placeholder="Türkçe karşılığı"
          className="w-full rounded-md bg-black/40 border border-white/12 px-3 py-2 font-mono-tech text-[12px] text-white outline-none focus:border-[#00d4ff]" />
        <div className="flex gap-1.5">
          {(['A1', 'A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map(l => (
            <button key={l} onClick={() => setLv(l)} className="flex-1 rounded-md py-1.5 active:scale-95 transition-all" style={btn(LEVEL_CONFIG[l].color, lv === l)}>
              <span className="font-mono-tech text-[9px]" style={{ color: lv === l ? LEVEL_CONFIG[l].color : 'rgba(255,255,255,0.4)' }}>{l}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.filter(c => c.id !== 'all').map(c => (
            <button key={c.id} onClick={() => setCat(c.id as Exclude<CategoryId, 'all'>)} className="rounded-full px-2 py-1 active:scale-95 transition-all" style={btn('#00d4ff', cat === c.id)}>
              <span className="font-mono-tech text-[8px]" style={{ color: cat === c.id ? '#8be9ff' : 'rgba(255,255,255,0.4)' }}>{c.label}</span>
            </button>
          ))}
        </div>
        <button onClick={submit} className="w-full rounded-lg py-2.5 active:scale-[0.97] transition-transform"
          style={{ background: 'linear-gradient(135deg, rgba(0,255,163,0.24), rgba(0,180,120,0.1))', border: '1px solid #00ffa3' }}>
          <span className="font-orbitron text-[12px] font-black tracking-[0.24em] text-[#dcfff2]">+ EKLE</span>
        </button>
      </div>

      <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">
        KAYITLI ({api.customWords.length})
      </div>
      <div className="space-y-1 pb-4">
        {api.customWords.map(w => (
          <div key={w.id} className="glass rounded-lg px-3 py-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-mono-tech text-[11px] text-white/90 truncate">{w.foreign}</div>
              <div className="font-mono-tech text-[9px] text-white/40 truncate">{w.native}</div>
            </div>
            <span className="font-mono-tech text-[8px]" style={{ color: LEVEL_CONFIG[w.level].color }}>
              {LANGUAGES.find(l => l.code === w.lang)?.flag} {w.level}
            </span>
            <button onClick={() => api.removeCustomWord(w.id)} className="w-6 h-6 rounded active:scale-90"
              style={{ background: 'rgba(255,46,99,0.15)', border: '1px solid rgba(255,46,99,0.4)' }}>
              <span className="font-mono-tech text-[10px] text-[#ff8fa8]">✕</span>
            </button>
          </div>
        ))}
        {api.customWords.length === 0 && (
          <div className="font-mono-tech text-[9px] text-white/25 text-center py-4">Dek boş.</div>
        )}
      </div>
    </Shell>
  );
}

/* ══════════════════ WRONG BOOK ══════════════════ */
export function WrongBookScreen({ api, onBack, onStart }: { api: EngineApi; onBack: () => void; onStart: (lang: LangCode, lvl: CEFRLevel, ids: string[]) => void }) {
  const [lang, setLang] = useState<LangCode>('en');
  const [lvl, setLvl] = useState<CEFRLevel>('A1');
  const all = useMemo(() => [...allWords(), ...api.customWords].filter(w => w.lang === lang && w.level === lvl), [lang, lvl, api.customWords]);
  const wrong = useMemo(() => getWrongWords(all, api.heat), [all, api.heat]);
  const ids = wrong.map(r => r.word.id);

  return (
    <Shell>
      <BackBtn onClick={onBack} />
      <div className="font-orbitron text-[20px] font-black tracking-[0.14em] text-white/90 mb-1">YANLIŞ DEFTERİ</div>
      <div className="font-mono-tech text-[9px] text-white/35 mb-3">Hatalı vurduğun / kaçırdığın kelimeler — sadece bunlarla tekrar oyna.</div>

      <div className="flex gap-1.5 mb-3">
        {LANGUAGES.map(l => (
          <button key={l.code} onClick={() => setLang(l.code)} className="flex-1 rounded-md py-1.5 active:scale-95 transition-all" style={btn(l.accent, lang === l.code)}>
            <span className="font-orbitron text-[11px] font-black" style={{ color: lang === l.code ? l.accent : 'rgba(255,255,255,0.4)' }}>{l.flag}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 mb-3">
        {(['A1','A2','B1','B2','C1'] as CEFRLevel[]).map(l => (
          <button key={l} onClick={() => setLvl(l)} className="flex-1 rounded-md py-1.5 active:scale-95 transition-all" style={btn(LEVEL_CONFIG[l].color, lvl === l)}>
            <span className="font-mono-tech text-[9px]" style={{ color: lvl === l ? LEVEL_CONFIG[l].color : 'rgba(255,255,255,0.4)' }}>{l}</span>
          </button>
        ))}
      </div>

      <div className="glass rounded-xl px-3 py-2.5 mb-3 flex items-center justify-between">
        <span className="font-mono-tech text-[9px] tracking-[0.14em] text-white/50">HATALI KELİME</span>
        <span className="font-orbitron text-[16px] font-black" style={{ color: wrong.length ? '#ff2e63' : '#00ffa3', textShadow: `0 0 8px ${wrong.length ? '#ff2e63' : '#00ffa3'}` }}>{wrong.length}</span>
      </div>

      {wrong.length >= 2 ? (
        <button onClick={() => onStart(lang, lvl, ids)} className="w-full rounded-xl py-3 mb-3 active:scale-[0.97] transition-transform"
          style={{ background: 'linear-gradient(135deg, rgba(255,46,99,0.28), rgba(180,0,50,0.14))', border: '1px solid #ff2e63', boxShadow: '0 0 18px rgba(255,46,99,0.4)' }}>
          <span className="font-orbitron text-[13px] font-black tracking-[0.2em] text-[#ffe3ea]">↺ SADECE BUNLARI ÇALIŞ ({wrong.length})</span>
        </button>
      ) : (
        <div className="glass rounded-xl px-3 py-3 mb-3 text-center font-mono-tech text-[10px] text-white/40">En az 2 hatalı kelime birikince tekrar modu açılır. Oynamaya devam et!</div>
      )}

      <div className="space-y-1 pb-4">
        {wrong.slice(0, 40).map(({ word, stat }) => (
          <div key={word.id} className="glass rounded-lg px-3 py-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-mono-tech text-[11px] text-white/90 truncate">{word.foreign} <span className="text-white/30">→</span> {word.native}</div>
              <div className="font-mono-tech text-[7px] text-white/35">{word.category} · {stat.seen} kez · {stat.misses} hata · {stat.phase}</div>
            </div>
            <span className="font-mono-tech text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,46,99,0.15)', color: '#ff8fa8', border: '1px solid rgba(255,46,99,0.3)' }}>✕{stat.misses}</span>
          </div>
        ))}
        {wrong.length === 0 && <div className="font-mono-tech text-[9px] text-white/25 text-center py-6">Bu dil/seviyede hata yok. Tertemiz!</div>}
      </div>
    </Shell>
  );
}

export function DailyChallengeScreen({ api, onBack, onStart }: { api: EngineApi; onBack: () => void; onStart: (lang: LangCode, lvl: CEFRLevel, ids: string[]) => void }) {
  const [lang, setLang] = useState<LangCode>('en');
  const [lvl, setLvl] = useState<CEFRLevel>('A1');
  const [notif, setNotif] = useState<NotificationPermission>(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  const all = useMemo(() => [...allWords(), ...api.customWords].filter(w => w.lang === lang && w.level === lvl), [lang, lvl, api.customWords]);
  const challenge = useMemo(() => getDailyChallenge(all, api.heat, 10), [all, api.heat]);
  const ids = challenge.map(w => w.id);
  const si = streakInfo(api.stats);
  const doneToday = si.today >= 10;

  return (
    <Shell>
      <BackBtn onClick={onBack} />
      <div className="font-orbitron text-[20px] font-black tracking-[0.14em] text-white/90 mb-1">GÜNLÜK MEYDAN OKUMA</div>
      <div className="font-mono-tech text-[9px] text-white/35 mb-3">Her gün 10 kelime — due + yeni karışık. Bitir, serini koru.</div>

      <div className="flex gap-1.5 mb-3">
        {LANGUAGES.map(l => (
          <button key={l.code} onClick={() => setLang(l.code)} className="flex-1 rounded-md py-1.5 active:scale-95 transition-all" style={btn(l.accent, lang === l.code)}>
            <span className="font-orbitron text-[11px] font-black" style={{ color: lang === l.code ? l.accent : 'rgba(255,255,255,0.4)' }}>{l.flag}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 mb-3">
        {(['A1','A2','B1','B2','C1'] as CEFRLevel[]).map(l => (
          <button key={l} onClick={() => setLvl(l)} className="flex-1 rounded-md py-1.5 active:scale-95 transition-all" style={btn(LEVEL_CONFIG[l].color, lvl === l)}>
            <span className="font-mono-tech text-[9px]" style={{ color: lvl === l ? LEVEL_CONFIG[l].color : 'rgba(255,255,255,0.4)' }}>{l}</span>
          </button>
        ))}
      </div>

      <div className="glass rounded-xl px-3 py-2.5 mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono-tech text-[8px] tracking-[0.14em] text-white/35">BUGÜN</span>
          <span className="font-mono-tech text-[8px]" style={{ color: doneToday ? '#00ffa3' : '#ffb300' }}>{doneToday ? '✓ BİTTİ' : `${si.today}/10`}</span>
        </div>
        <div className="h-[6px] rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (si.today/10)*100)}%`, background: doneToday ? '#00ffa3' : '#ffd166', boxShadow: `0 0 8px ${doneToday ? '#00ffa3' : '#ffd166'}` }} />
        </div>
        <div className="font-mono-tech text-[7px] text-white/30 mt-1">Seri: 🔥 {si.current} gün · En iyi: {si.best}</div>
      </div>

      <button onClick={() => onStart(lang, lvl, ids)} className="w-full rounded-xl py-3 mb-3 active:scale-[0.97] transition-transform"
        style={{ background: 'linear-gradient(135deg, rgba(255,209,102,0.28), rgba(255,140,0,0.18))', border: '1px solid #ffd166', boxShadow: '0 0 18px rgba(255,209,102,0.35)' }}>
        <span className="font-orbitron text-[13px] font-black tracking-[0.14em] text-[#fff8e6]">⚡ 10 KELİME — MEYDAN OKU</span>
      </button>

      <div className="glass rounded-xl px-3 py-2.5 mb-3 flex items-center justify-between">
        <div>
          <div className="font-mono-tech text-[9px] text-white/70">BİLDİRİM</div>
          <div className="font-mono-tech text-[7px] text-white/30">20:00’da hatırlatma</div>
        </div>
        <button onClick={async () => { const p = await requestDailyPush(); setNotif(p); if (p==='granted') scheduleDailyPush(); }}
          className="rounded-full px-3 py-1.5 active:scale-95 transition-transform"
          style={{ background: notif==='granted' ? 'rgba(0,255,163,0.2)' : 'rgba(255,255,255,0.08)', border: `1px solid ${notif==='granted' ? '#00ffa3' : 'rgba(255,255,255,0.12)'}` }}>
          <span className="font-mono-tech text-[8px]" style={{ color: notif==='granted' ? '#00ffa3' : 'rgba(255,255,255,0.5)' }}>{notif==='granted' ? '✓ AÇIK' : 'AÇ'}</span>
        </button>
      </div>

      <div className="font-mono-tech text-[8px] tracking-[0.2em] text-white/30 mb-1.5">BUGÜNKÜ 10</div>
      <div className="space-y-1 pb-4">
        {challenge.map(w => (
          <div key={w.id} className="glass rounded-lg px-3 py-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-mono-tech text-[11px] text-white/90 truncate">{w.foreign} → {w.native}</div>
              <div className="font-mono-tech text-[7px] text-white/30">{w.category} · {w.level}</div>
            </div>
            <span className="font-mono-tech text-[7px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,209,102,0.12)', color: '#ffd166', border: '1px solid rgba(255,209,102,0.25)' }}>GÜN</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ══════════════════ SETTINGS ══════════════════ */
const SAMPLES: Record<LangCode, string> = {
  en: 'Good morning, welcome aboard.',
  es: 'Buenos días, bienvenido a bordo.',
  it: 'Buongiorno, benvenuto a bordo.',
  ru: 'Доброе утро, добро пожаловать.',
};

export function SettingsScreen({ api, onBack }: { api: EngineApi; onBack: () => void }) {
  const rows: [keyof typeof api.settings, string, string][] = [
    ['tts', 'TELAFFUZ (TTS)', 'Vuruşta ve dalga başında okur'],
    ['echo', 'ÖNCE DİNLE', 'Dalga başında hedefi seslendirir'],
    ['music', 'CHIPTUNE MÜZİK', 'Isıya göre adapte olur'],
    ['sfx', 'SES EFEKTLERİ', 'Lazer, patlama, uyaran'],
    ['haptics', 'TİTREŞİM', 'Doğru / yanlış hissi'],
    ['crt', 'CRT TARAMA ÇİZGİSİ', 'Retro ekran efekti'],
  ];
  const ASSIST: [Settings['assist'], string, string, string][] = [
    ['always', 'AÇIK', 'Doğru hedef hep yeşil işaretli', '#00ff9d'],
    ['delayed', 'GECİKMELİ', 'Yeni kelimede + 3sn sonra', '#ffb300'],
    ['off', 'KAPALI', 'Hiç ipucu yok', '#ff2e63'],
  ];
  return (
    <Shell>
      <BackBtn onClick={onBack} />
      <div className="font-orbitron text-[20px] font-black tracking-[0.14em] text-white/90 mb-3">AYARLAR</div>

      <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">HEDEF GÖSTERME (YARDIM)</div>
      <div className="grid grid-cols-3 gap-1.5 mb-1.5">
        {ASSIST.map(([k, l, , c]) => (
          <button key={k} onClick={() => { api.updateSettings({ assist: k }); audio.ui(); }}
            className="rounded-lg py-2.5 active:scale-95 transition-all" style={btn(c, api.settings.assist === k)}>
            <span className="font-mono-tech text-[9px] tracking-[0.1em]"
              style={{ color: api.settings.assist === k ? c : 'rgba(255,255,255,0.4)' }}>{l}</span>
          </button>
        ))}
      </div>
      <div className="font-mono-tech text-[8px] text-white/30 mb-4">
        {ASSIST.find(a => a[0] === api.settings.assist)?.[2]}
      </div>

      <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">KONUŞMA HIZI</div>
      <div className="glass rounded-xl px-3 py-2.5 mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono-tech text-[9px] text-white/50">Yavaş · Akıcı · Hızlı</span>
          <span className="font-pixel text-[14px] text-[#00d4ff]">{api.settings.ttsRate.toFixed(2)}×</span>
        </div>
        <input type="range" min={0.7} max={1.3} step={0.05} value={api.settings.ttsRate}
          onChange={e => api.updateSettings({ ttsRate: Number(e.target.value) })}
          className="w-full accent-[#00d4ff]" />
      </div>

      <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">MÜZİK SESİ</div>
      <div className="glass rounded-xl px-3 py-2.5 mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono-tech text-[9px] text-white/50">Kısık · Orta · Yüksek</span>
          <span className="font-pixel text-[14px] text-[#00d4ff]">{Math.round((api.settings.bgmVolume ?? 0.16) * 100)}%</span>
        </div>
        <input type="range" min={0} max={1} step={0.02} value={api.settings.bgmVolume ?? 0.16}
          onChange={e => { const v = Number(e.target.value); api.updateSettings({ bgmVolume: v }); }}
          onPointerDown={() => audio.unlock()}
          className="w-full accent-[#00d4ff] disabled:opacity-30"
          disabled={!api.settings.music} />
        {!api.settings.music && <div className="font-mono-tech text-[7px] text-white/30 mt-1">Müzik kapalıyken sessiz — yukarıdan aç.</div>}
      </div>

      <div className="space-y-1.5 mb-4">
        {rows.map(([k, label, sub]) => {
          const on = Boolean(api.settings[k]);
          return (
            <button key={k} onClick={() => { api.updateSettings({ [k]: !on } as never); audio.ui(); }}
              className="w-full glass rounded-lg px-3 py-2.5 flex items-center gap-3 active:scale-[0.98] transition-transform text-left">
              <div className="flex-1">
                <div className="font-mono-tech text-[10px] tracking-[0.14em] text-white/80">{label}</div>
                <div className="font-mono-tech text-[8px] text-white/32">{sub}</div>
              </div>
              <div className="w-10 h-[22px] rounded-full p-[2px] transition-colors"
                style={{ background: on ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.1)', border: `1px solid ${on ? '#00d4ff' : 'rgba(255,255,255,0.16)'}` }}>
                <div className="w-[16px] h-[16px] rounded-full transition-transform"
                  style={{ transform: on ? 'translateX(18px)' : 'none', background: on ? '#00d4ff' : 'rgba(255,255,255,0.4)', boxShadow: on ? '0 0 8px #00d4ff' : 'none' }} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">TELAFFUZ MOTORU</div>
      <div className="glass rounded-xl px-3 py-2.5 mb-4">
        <div className="font-mono-tech text-[8px] text-white/32 mb-2">
          Cihazındaki en kaliteli sesi otomatik seçer. Test etmek için dokun.
        </div>
        {LANGUAGES.map(l => (
          <button key={l.code}
            onClick={() => { audio.unlock(); audio.speak(SAMPLES[l.code], l.code, 0); }}
            className="w-full flex items-center gap-2.5 py-1.5 active:scale-[0.98] transition-transform text-left">
            <span className="font-orbitron text-[11px] font-black w-7" style={{ color: l.accent }}>{l.flag}</span>
            <div className="flex-1 min-w-0">
              <div className="font-mono-tech text-[9px] text-white/70 truncate">{SAMPLES[l.code]}</div>
              <div className="font-mono-tech text-[7px] text-white/28 truncate">{audio.voiceLabel(l.code)}</div>
            </div>
            <span className="font-pixel text-[14px]" style={{ color: l.accent, textShadow: `0 0 6px ${l.accent}` }}>▶</span>
          </button>
        ))}
      </div>

      <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">ZORLUK</div>
      <div className="grid grid-cols-3 gap-1.5 mb-4">
        {([['zen', 'ZEN', '#00ffa3'], ['normal', 'NORMAL', '#00d4ff'], ['hardcore', 'HARDCORE', '#ff2e63']] as const).map(([k, l, c]) => (
          <button key={k} onClick={() => api.updateSettings({ difficulty: k })}
            className="rounded-lg py-2.5 active:scale-95 transition-all" style={btn(c, api.settings.difficulty === k)}>
            <span className="font-mono-tech text-[9px] tracking-[0.1em]" style={{ color: api.settings.difficulty === k ? c : 'rgba(255,255,255,0.4)' }}>{l}</span>
          </button>
        ))}
      </div>

      <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">ERİŞİLEBİLİRLİK</div>
      <div className="glass rounded-xl px-3 py-3 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono-tech text-[9px] text-white/70">Yazı Boyutu</span>
          <div className="flex items-center gap-2">
            <span className="font-mono-tech text-[7px] text-white/40">%90</span>
            <input type="range" min={0.9} max={1.25} step={0.05} value={api.settings.fontScale ?? 1} onChange={e=>{ api.updateSettings({fontScale: Number(e.target.value)}); audio.ui(); }} className="w-24 accent-[#00d4ff]" />
            <span className="font-mono-tech text-[7px] text-white/40">%125</span>
            <span className="font-mono-tech text-[8px] text-[#00d4ff] w-8 text-right">{Math.round((api.settings.fontScale ?? 1)*100)}%</span>
          </div>
        </div>
        {([
          ['highContrast','YÜKSEK KONTRAST','Kenarlık ve metni güçlendir'],
          ['reduceMotion','HAREKETİ AZALT','Parallax ve shake’i yumuşat'],
          ['dyslexia','DISLEKSİ DOSTU FONT','Okunabilirliği artır'],
        ] as const).map(([k,label,sub])=> {
          const on = Boolean((api.settings as any)[k]);
          return (
            <button key={k} onClick={()=>{ (api.updateSettings as any)({[k]: !on}); audio.ui(); }} className="w-full flex items-center justify-between py-1.5 active:scale-95">
              <div className="text-left">
                <div className="font-mono-tech text-[9px] text-white/70">{label}</div>
                <div className="font-mono-tech text-[7px] text-white/30">{sub}</div>
              </div>
              <div className={`w-10 h-5 rounded-full p-0.5 transition-colors ${on?'bg-[#00d4ff]':'bg-white/10'}`}><div className={`w-4 h-4 rounded-full bg-white transition-transform ${on?'translate-x-5':''}`} /></div>
            </button>
          );
        })}
      </div>

      <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-1.5">ÇEVRİMDIŞI SES PAKETİ</div>
      <div className="glass rounded-xl px-3 py-3 mb-4">
        <div className="font-mono-tech text-[8px] text-white/35 mb-2">Telaffuz seslerini önbelleğe al — uçakta bile konuşur.</div>
        <button onClick={async ()=>{
          audio.unlock();
          const key='wi_voice_pack_cached';
          try{
            if('caches' in window){
              const c=await caches.open('voice-pack-v1');
              await c.addAll(['/','/manifest.webmanifest']);
            }
            // warm TTS voices
            try{ speechSynthesis.getVoices(); }catch{}
            localStorage.setItem(key, Date.now().toString());
            audio.correct();
            alert('Ses paketi önbelleğe alındı ✓');
          }catch(e){ alert('Önbellek hatası'); }
        }} className="w-full rounded-lg py-2.5 active:scale-95" style={{background:'linear-gradient(135deg, rgba(0,212,255,0.18), rgba(0,102,255,0.12))', border:'1px solid #00d4ff'}}>
          <span className="font-mono-tech text-[9px] tracking-[0.12em] text-white/80">⬇ SES PAKETİNİ İNDİR / ÖNBELLEĞE AL</span>
        </button>
        <div className="font-mono-tech text-[7px] text-white/25 mt-1.5 text-center">Bir kez indir, sonra çevrimdışı çalışır. PWA zaten müzik ve ikonları önbellekliyor.</div>
      </div>

      <div className="glass rounded-xl px-3 py-3 mb-3">
        <div className="font-mono-tech text-[8px] tracking-[0.3em] text-white/35 mb-2">KONTROLLER</div>
        {[['SÜRÜKLE', 'Gemi yatay kayar (ataletli)'], ['◀ ▶', 'Basılı tut → yönlü hareket'],
          ['ATEŞ', 'Lazer · Space / ↑ tuşu da çalışır'], ['ESC', 'Duraklat']].map(([a, b]) => (
          <div key={a} className="flex gap-3 py-1">
            <span className="font-pixel text-[12px] text-[#00d4ff] w-16">{a}</span>
            <span className="font-mono-tech text-[9px] text-white/45 flex-1">{b}</span>
          </div>
        ))}
      </div>
      <button onClick={() => { try { localStorage.removeItem('wi_tutorial_seen'); } catch {}; location.reload(); }}
        className="w-full glass rounded-xl py-2.5 active:scale-95 transition-transform">
        <span className="font-mono-tech text-[9px] tracking-[0.14em] text-white/60">◈ EĞİTİMİ TEKRAR GÖSTER</span>
      </button>
    </Shell>
  );
}

/* ══════════════════ PAUSE ══════════════════ */
export function PauseOverlay({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(3,7,20,0.86)', backdropFilter: 'blur(6px)' }}>
      <div className="glass rounded-2xl px-6 py-5 text-center w-[260px]">
        <div className="font-orbitron text-[20px] font-black tracking-[0.2em] text-white/85 mb-4">DURAKLADI</div>
        <button onClick={onResume} className="w-full rounded-xl py-2.5 mb-2 active:scale-[0.97] transition-transform"
          style={{ background: 'rgba(0,212,255,0.22)', border: '1px solid #00d4ff' }}>
          <span className="font-orbitron text-[13px] font-black tracking-[0.2em] text-[#dff6ff]">DEVAM</span>
        </button>
        <button onClick={onQuit} className="w-full glass rounded-xl py-2.5 active:scale-[0.97] transition-transform">
          <span className="font-mono-tech text-[10px] tracking-[0.2em] text-white/55">ÇIKIŞ</span>
        </button>
      </div>
    </div>
  );
}

/* ══════════════════ LEADERBOARD ══════════════════ */
export function LeaderboardScreen({ api, onBack }: { api: EngineApi; onBack: () => void }) {
  const entries = Object.entries(api.stats.highScores).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const share = async (key:string, score:number) => {
    const url = `${location.origin}${location.pathname}?challenge=${encodeURIComponent(key)}:${score}`;
    try { if (navigator.share) await navigator.share({ title: 'Word Invaders Meydan Okuma', text: `Skorum ${score} — geçebilir misin?`, url }); else await navigator.clipboard.writeText(url); audio.correct(); } catch {}
  };
  return (
    <Shell>
      <BackBtn onClick={onBack} />
      <div className="font-orbitron text-[20px] font-black tracking-[0.14em] text-white/90 mb-1">LİDERLİK</div>
      <div className="font-mono-tech text-[9px] text-white/35 mb-3">Lokal tablo — meydan okuma linki kopyala.</div>
      <div className="space-y-1.5 mb-4">
        {entries.length===0 && <div className="glass rounded-xl px-3 py-6 text-center font-mono-tech text-[9px] text-white/30">Henüz skor yok — oyna ve rekor kır.</div>}
        {entries.map(([k,score],i)=> {
          const [lc,lv]=k.split(':'); const meta=LANGUAGES.find(x=>x.code===lc);
          return (
            <div key={k} className="glass rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="font-orbitron text-[12px] font-black w-6" style={{color: i===0?'#ffd166':i===1?'#c0c0c0':'#cd7f32'}}>#{i+1}</span>
              <span className="font-mono-tech text-[10px] flex-1" style={{color: meta?.accent}}>{meta?.flag} {lv}</span>
              <span className="font-orbitron text-[13px] font-black" style={{color:'#00d4ff'}}>{score.toString().padStart(6,'0')}</span>
              <button onClick={()=>share(k,score)} className="ml-2 rounded-md px-2 py-1 text-[10px] glass active:scale-95">↗ Paylaş</button>
            </div>
          );
        })}
      </div>
      <div className="glass rounded-xl px-3 py-3">
        <div className="font-mono-tech text-[9px] text-white/50">Meydan okuma linki: ?challenge=EN:A1:004200 ile arkadaşına gönder, aynı skor üzerine oynasın.</div>
      </div>
    </Shell>
  );
}

/* ══════════════════ CAMPAIGN (5 Gezegen) ══════════════════ */
export function CampaignScreen({ api, onBack, onStart }: { api: EngineApi; onBack: ()=>void; onStart: (lang:LangCode, lv:CEFRLevel)=>void }) {
  const planets: { lv:CEFRLevel; name:string; color:string; icon:string }[] = [
    { lv:'A1', name:'Aqua', color:'#00d4ff', icon:'◈' },
    { lv:'A2', name:'Terra', color:'#00ffa3', icon:'✦' },
    { lv:'B1', name:'Ignis', color:'#ffb300', icon:'▲' },
    { lv:'B2', name:'Nimbus', color:'#ff6b1a', icon:'⬡' },
    { lv:'C1', name:'Void', color:'#ff2e63', icon:'⬢' },
  ];
  return (
    <Shell>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40" style={{ background: `radial-gradient(ellipse at bottom, ${NEON.cyan}14, transparent 65%)` }} />
      <BackBtn onClick={onBack} />
      <div className="font-orbitron text-[20px] font-black tracking-[0.14em] text-white/90 mb-1">HİKAYE SEFERİ</div>
      <div className="font-mono-tech text-[9px] text-white/35 mb-4">5 gezegen — her biri bir seviye, sırayla fethet.</div>
      <div className="space-y-2 pb-4">
        {planets.map((p,i)=>{
          const done = (api.stats.wavesTotal ?? 0) > i*12;
          const locked = i>0 && !(api.stats.wavesTotal > (i-1)*12);
          return (
            <button key={p.lv} disabled={locked} onClick={()=>{ if(!locked) onStart('en', p.lv); }} className="w-full rounded-xl px-3 py-3 flex items-center gap-3 active:scale-[0.97] disabled:opacity-40" style={{...btn(p.color, !locked), border: `1px solid ${p.color}55`}}>
              <span className="font-orbitron text-[18px] w-7" style={{color:p.color}}>{p.icon}</span>
              <div className="flex-1 text-left">
                <div className="font-orbitron text-[13px] font-black" style={{color:p.color}}>{i+1}. {p.name} — {p.lv}</div>
                <div className="font-mono-tech text-[7px] text-white/40">{locked?'Önce önceki gezegeni bitir':'Hazır'}</div>
              </div>
              <span className="font-mono-tech text-[8px] px-2 py-1 rounded-full" style={{background: done?'rgba(0,255,163,0.15)':'rgba(255,255,255,0.06)', color: done?'#00ffa3':'rgba(255,255,255,0.35)'}}>{done?'✓':'○'}</span>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

/* ══════════════════ TEACHER PANEL ══════════════════ */
export function TeacherScreen({ api, onBack }: { api: EngineApi; onBack: ()=>void }) {
  const [code] = useState(()=> Math.random().toString(36).slice(2,8).toUpperCase());
  const csv = useMemo(()=>{
    const header='dil,seviye,toplamDogru,toplamYanlis,boss,waves,seri';
    const row=`all,all,${api.stats.totalCorrect},${api.stats.totalWrong},${api.stats.bossesKilled},${api.stats.wavesTotal},${api.stats.bestStreak ?? 0}`;
    return header+'\n'+row;
  },[api.stats]);
  const download = () => {
    const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`sinif-${code}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <Shell>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32" style={{ background: `radial-gradient(ellipse at bottom, ${NEON.purple}12, transparent 65%)` }} />
      <BackBtn onClick={onBack} />
      <div className="font-orbitron text-[20px] font-black tracking-[0.14em] text-white/90 mb-1">ÖĞRETMEN PANELİ</div>
      <div className="font-mono-tech text-[9px] text-white/35 mb-3">Sınıf kodu ile ödev ver — CSV rapor al.</div>
      <div className="glass rounded-xl px-3 py-3 mb-3 text-center">
        <div className="font-mono-tech text-[8px] tracking-[0.2em] text-white/35">SINIF KODU</div>
        <div className="font-orbitron text-[28px] font-black tracking-[0.18em]" style={{color:'#ffd166', textShadow:'0 0 12px #ffd166'}}>{code}</div>
        <div className="font-mono-tech text-[7px] text-white/30">Öğrenciler giriş ekranında bu kodu girsin (yakında).</div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[['Öğrenci','—','—'],['Ödev','50 kelime','Haftalık']].map(([k,v,s])=>(
          <div key={k as string} className="glass rounded-lg px-3 py-2">
            <div className="font-mono-tech text-[7px] text-white/30">{k}</div>
            <div className="font-orbitron text-[14px] font-black" style={{color:'#00d4ff'}}>{v as string}</div>
            <div className="font-mono-tech text-[6px] text-white/30">{s as string}</div>
          </div>
        ))}
      </div>
      <button onClick={download} className="w-full rounded-xl py-3 active:scale-95" style={{background:'linear-gradient(135deg, rgba(0,212,255,0.22), rgba(0,102,255,0.12))', border:'1px solid #00d4ff'}}>
        <span className="font-mono-tech text-[10px] tracking-[0.14em] text-white/80">⬇ CSV RAPOR İNDİR</span>
      </button>
      <div className="font-mono-tech text-[7px] text-white/25 mt-2 text-center">Şimdilik lokal demo — çok yakında bulut senkron.</div>
    </Shell>
  );
}

export type MenuView = 'menu' | 'setup' | 'deck' | 'stats' | 'settings' | 'install' | 'wrongbook' | 'daily' | 'leaderboard' | 'campaign' | 'teacher';
export function heatOfUnused(h: HeatMap) { void h; }
