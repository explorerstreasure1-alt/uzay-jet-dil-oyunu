import { useState } from 'react';

const STEPS = [
  {
    icon: '◈',
    title: 'HOŞ GELDİN, PILOT',
    desc: 'Word Invaders beynini arcade ile çalıştırır. Yukarıdan gelen yabancı kelimeleri vur, Türkçesini öğren.',
    color: '#00d4ff',
  },
  {
    icon: '◀ ▶',
    title: 'ŞERİT SİSTEMİ',
    desc: 'Her kelime kendi şeridinde. Sol/sağ buton veya sürükle ile gemini hizala. İsabet sadece kendi şeridinde çalışır.',
    color: '#00ffa3',
  },
  {
    icon: '✓ ✕',
    title: 'DOĞRU / YANLIŞ',
    desc: 'Doğru vur → skor + combo + kalkan. Yanlış vurursan can gider, kelime hemen tekrar sorulur (pekiştirme).',
    color: '#ffd166',
  },
  {
    icon: '⚡ ◆ ◈',
    title: 'DÜŞMAN TİPLERİ',
    desc: 'HIZLI (cyan, çok hızlı), ZIRHLI (amber, 2-3 can), HAYALET (mor, görünmezleşir), BOSS (sarı, 3 can). Dalga ilerledikçe hız ×1.9’a kadar çıkar.',
    color: '#c77dff',
  },
  {
    icon: '◎',
    title: 'HAZIRSIN',
    desc: 'Ayarlardan müzik sesini ayarla, günlük hedef 15 kelime. Şimdi görev kurulumuna geç!',
    color: '#ff2e63',
  },
] as const;

export function TutorialOverlay({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [idx, setIdx] = useState(0);
  const s = STEPS[idx];
  const last = idx === STEPS.length - 1;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(3,6,15,0.88)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-[340px] glass rounded-2xl px-5 py-5 text-center">
        <div className="font-mono-tech text-[7px] tracking-[0.3em] text-white/30 mb-2">EĞİTİM {idx + 1}/{STEPS.length}</div>
        <div className="mx-auto mb-3 w-14 h-14 rounded-xl flex items-center justify-center"
          style={{ background: `${s.color}18`, border: `1px solid ${s.color}55`, boxShadow: `0 0 16px ${s.color}44` }}>
          <span className="font-orbitron text-[18px] font-black" style={{ color: s.color, textShadow: `0 0 8px ${s.color}` }}>{s.icon}</span>
        </div>
        <div className="font-orbitron text-[15px] font-black tracking-[0.12em] mb-2" style={{ color: s.color, textShadow: `0 0 10px ${s.color}` }}>{s.title}</div>
        <div className="font-mono-tech text-[11px] leading-relaxed text-white/70 mb-4 min-h-[54px]">{s.desc}</div>

        <div className="flex justify-center gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <div key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === idx ? 22 : 8, background: i === idx ? s.color : 'rgba(255,255,255,0.15)', boxShadow: i === idx ? `0 0 6px ${s.color}` : 'none' }} />
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onSkip} className="flex-1 glass rounded-xl py-2.5 active:scale-95 transition-transform">
            <span className="font-mono-tech text-[9px] tracking-[0.14em] text-white/45">ATLA</span>
          </button>
          {idx > 0 && (
            <button onClick={() => setIdx(i => i - 1)} className="flex-1 glass rounded-xl py-2.5 active:scale-95 transition-transform">
              <span className="font-mono-tech text-[9px] tracking-[0.14em] text-white/60">◀ GERİ</span>
            </button>
          )}
          <button
            onClick={() => (last ? onDone() : setIdx(i => i + 1))}
            className="flex-[1.6] rounded-xl py-2.5 active:scale-95 transition-transform"
            style={{ background: `linear-gradient(135deg, ${s.color}33, ${s.color}18)`, border: `1px solid ${s.color}`, boxShadow: `0 0 16px ${s.color}44` }}>
            <span className="font-orbitron text-[11px] font-black tracking-[0.14em]" style={{ color: '#e6faff' }}>{last ? 'BAŞLA →' : 'İLERİ ▶'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
