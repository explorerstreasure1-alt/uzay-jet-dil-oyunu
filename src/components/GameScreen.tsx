import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { GameState, Alien } from '../types/game';
import { HEAT_META, LEVEL_CONFIG, LANGUAGES } from '../data/vocabulary';
import { VW, VH, SHIP_Y, FLOOR_Y, SPRITE_H } from '../hooks/useGameEngine';
import type { EngineApi } from '../hooks/useGameEngine';
import { speechSupported, listenOnce } from '../lib/speech';

const CAT_EMOJI: Record<string, string> = { food:'🍎', daily:'🏠', travel:'✈️', business:'💼', tech:'💻', nature:'🌲', emotion:'💜', slang:'💬', verb:'⚡', number:'🔢', phrase:'💬' };
const BODY = ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'];
const BOSS = ['X....X....X', '.X..XXX..X.', '..XXXXXXX..', '.XXX.X.XXX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.X.X.X.X', '..X.....X..'];

function Pixels({ rows, color, w }: { rows: string[]; color: string; w: number }) {
  const cell = w / rows[0].length;
  return <>{rows.map((r, y) => r.split('').map((c, x) =>
    c === 'X' ? <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell + 0.6} height={cell + 0.6} fill={color} /> : null))}</>;
}

/* ══════════ sprites (SVG) ══════════ */
function Sprite({ a, t, locked, hint }: { a: Alien; t: number; locked: boolean; hint: boolean }) {
  const meta = HEAT_META[a.heat];
  const isPhantom = a.variant === 'phantom';
  const isSwift = a.variant === 'swift';
  const isTank = a.variant === 'tank';
  // phantom periyodik görünmezleşir, swift cyan, tank amber zırh
  const cloak = isPhantom ? 0.32 + Math.sin(a.cloakPhase) * 0.32 + 0.36 : 1;
  const baseColor = a.isBoss ? '#ffd166' : isSwift ? '#00ffd0' : isTank ? '#ffb300' : isPhantom ? '#c77dff' : meta.core;
  const glow = a.isBoss ? '#ff9500' : isSwift ? '#00ffa3' : isTank ? '#ff8c00' : isPhantom ? '#9d4edd' : meta.glow;
  const color = a.hitFlash > 0.35 ? '#ffffff' : baseColor;
  const pulse = Math.sin(a.glowPhase + t * 0.003) * 0.5 + 0.5;
  const scaleMul = a.isBoss ? 1 : isSwift ? 0.86 : isTank ? 1.18 : isPhantom ? 0.95 : 1;
  const w = a.isBoss ? Math.min(a.laneW * 1.45, 92) : Math.min(a.laneW * 0.7, 56) * scaleMul;
  const h = (w / 11) * 8;
  const hpMax = a.maxHp;

  return (
    <g opacity={a.dead ? 0 : cloak}>
      {hint && (
        <>
          <rect x={a.laneX + 1} y={a.y - 16} width={a.laneW - 2} height={h + 46} rx={7}
            fill="#00ff9d" opacity={0.07 + pulse * 0.05} stroke="#00ff9d" strokeOpacity={0.55} strokeWidth="1.4" />
          <g transform={`translate(${a.drawX}, ${a.y - 26 + Math.sin(t * 0.006) * 3})`}>
            <path d="M-10,-6 L0,5 L10,-6" fill="none" stroke="#00ff9d" strokeWidth="3.4"
              strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px #00ff9d)' }} />
          </g>
        </>
      )}
      {locked && !hint && (
        <rect x={a.laneX + 1} y={a.y - 12} width={a.laneW - 2} height={h + 40} rx={6}
          fill="#ffffff" opacity={0.05} stroke="#ffffff" strokeOpacity={0.2} strokeWidth="1" strokeDasharray="3 4" />
      )}

      <g transform={`translate(${a.drawX - w / 2}, ${a.y})`} style={{ filter: `drop-shadow(0 0 ${3 + pulse * 5}px ${glow})` }}>
        {a.isBoss && <circle cx={w / 2} cy={h / 2} r={w * 0.8} fill="#ffd166" opacity={0.05 + pulse * 0.07} />}
        {isTank && <rect x={-2} y={-2} width={w + 4} height={h + 4} rx={3} fill="#ffb300" opacity={0.14} />}
        {isPhantom && <ellipse cx={w / 2} cy={h / 2} rx={w * 0.65} ry={h * 0.9} fill="#c77dff" opacity={0.08 + pulse * 0.06} />}
        <Pixels rows={a.isBoss ? BOSS : BODY} color={color} w={w} />
        <rect x={w * 0.27} y={h * 0.44} width={w * 0.1} height={h * 0.15} fill="#060d26" />
        <rect x={w * 0.63} y={h * 0.44} width={w * 0.1} height={h * 0.15} fill="#060d26" />
        {isSwift && <rect x={w * 0.45} y={-4} width={w * 0.1} height={4} rx={1} fill="#00ffd0" opacity={0.9} style={{ filter: 'drop-shadow(0 0 4px #00ffd0)' }} />}
      </g>

      {(a.isBoss || (isTank && hpMax > 1)) && (
        <g transform={`translate(${a.drawX - (hpMax === 3 ? 24 : 16)}, ${a.y + h + 3})`}>
          {Array.from({ length: hpMax }).map((_, i) => (
            <rect key={i} x={i * (hpMax === 3 ? 17 : 17)} y={0} width={hpMax === 3 ? 13 : 13} height={4} rx={1}
              fill={i < a.hp ? (a.isBoss ? '#ffd166' : '#ffb300') : 'rgba(255,255,255,0.15)'}
              style={i < a.hp ? { filter: `drop-shadow(0 0 4px ${a.isBoss ? '#ffd166' : '#ffb300'})` } : undefined} />
          ))}
        </g>
      )}
      {isSwift && <g transform={`translate(${a.drawX}, ${a.y + h + 7})`}><text textAnchor="middle" fill="#00ffd0" opacity="0.85" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, filter: 'drop-shadow(0 0 4px #00ffd0)' }}>⚡ HIZLI</text></g>}
      {isTank && !a.isBoss && <g transform={`translate(${a.drawX}, ${a.y + h + 7})`}><text textAnchor="middle" fill="#ffb300" opacity="0.9" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, filter: 'drop-shadow(0 0 4px #ffb300)' }}>◆ ZIRHLI</text></g>}
      {isPhantom && <g transform={`translate(${a.drawX}, ${a.y + h + 7})`}><text textAnchor="middle" fill="#c77dff" opacity={0.9 * cloak} style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, filter: 'drop-shadow(0 0 4px #c77dff)' }}>◈ HAYALET</text></g>}
    </g>
  );
}

/* ══════════ word plates — real HTML for crisp, always-legible type ══════════ */
function Plates({ s, hintId, lockedId }: { s: GameState; hintId: string | null; lockedId: string | null }) {
  return (
    <>
      {s.aliens.map(a => {
        const meta = HEAT_META[a.heat];
        const color = a.isBoss ? '#ffd166' : meta.core;
        const isHint = a.id === hintId;
        const isLock = a.id === lockedId;
        const w = a.isBoss ? Math.min(a.laneW * 1.45, 92) : Math.min(a.laneW * 0.7, 56);
        const h = (w / 11) * 8;
        const plateW = Math.max(54, a.laneW - (a.isBoss ? 4 : 8));
        const cx = a.laneX + a.laneW / 2;
        const len = a.word.foreign.length;
        const size = len > 34 ? 10.5 : len > 26 ? 11.5 : len > 18 ? 13 : len > 11 ? 15 : 17;
        const lines = len > 24 ? 3 : len > 12 ? 2 : 1;
        return (
          <div key={`p-${a.id}`}
            className="absolute -translate-x-1/2 pointer-events-none flex flex-col items-center justify-center"
            style={{
              left: cx,
              top: a.y + h + (a.isBoss ? 12 : 4),
              width: plateW,
              minHeight: Math.max(24, lines * (size + 3) + 8),
              padding: '4px 5px',
              borderRadius: 6,
              background: isHint ? 'rgba(0,40,26,0.96)' : 'rgba(4,9,26,0.96)',
              border: `1px solid ${isHint ? '#00ff9d' : color}`,
              borderWidth: isHint || isLock ? 1.4 : 0.9,
              boxShadow: isHint ? '0 0 10px rgba(0,255,157,0.35)' : `0 0 6px ${color}33`,
              zIndex: 12,
            }}>
            {a.heat === 'ice' && !a.isBoss && (
              <span className="font-mono-tech text-[6px] tracking-[0.18em] leading-none mb-0.5"
                style={{ color: isHint ? '#00ff9d' : meta.core, opacity: 0.9 }}>
                ★ YENİ
              </span>
            )}
            <span style={{
              fontFamily: "'Share Tech Mono', ui-monospace, monospace",
              fontSize: size,
              lineHeight: 1.12,
              fontWeight: 700,
              color: isHint ? '#b6ffe4' : '#ffffff',
              textShadow: `0 0 7px ${isHint ? '#00ff9d' : color}`,
              textAlign: 'center',
              wordBreak: 'normal',
              overflowWrap: 'anywhere',
              hyphens: 'auto',
              letterSpacing: len > 18 ? '0px' : '0.2px',
              maxWidth: '100%',
              display: 'block',
            }}>
              {a.word.foreign}
            </span>
          </div>
        );
      })}
    </>
  );
}

/* ══════════ ship — karizmatik interceptor ══════════ */
function Ship({ x, over, shield, vx, t, reduceMotion }: { x: number; over: boolean; shield: boolean; vx: number; t: number; reduceMotion?: boolean }) {
  const c1 = over ? '#e0a6ff' : '#00e5ff';
  const c2 = over ? '#ff2ea6' : '#0066ff';
  const accent = over ? '#ffb3ff' : '#7af7ff';
  const speed = Math.min(1, Math.abs(vx) / 15.5);
  const dir = vx === 0 ? 0 : Math.sign(vx);
  const bank = dir * speed * 8;
  const flame = 22 + speed * 26 + Math.sin(t * 0.05) * 5;
  const flame2 = flame * 0.72;
  return (
    <g transform={`translate(${x}, ${SHIP_Y}) rotate(${bank})`}>
      {/* speed warp ghost — daha belirgin */}
      {speed > 0.06 && [1, 2, 3].map(i => (
        <g key={i} transform={`translate(${-dir * i * (9 + speed * 11)}, ${i * 1.2})`} opacity={(0.18 - i * 0.04) * speed}
          style={{ filter: `drop-shadow(0 0 ${8 - i}px ${c1})` }}>
          <path d="M0,-30 L8,-10 L20,10 L14,14 L7,16 L-7,16 L-14,14 L-20,10 L-8,-10 Z" fill={c1} />
        </g>
      ))}

      {over && !reduceMotion && (
        <>
          <circle r={42} fill="none" stroke="#e0a6ff" strokeWidth="1.1" opacity="0.45" strokeDasharray="8 6">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2.8s" repeatCount="indefinite" />
          </circle>
          <circle r={30} fill="none" stroke="#ff2ea6" strokeWidth="0.8" opacity="0.35" strokeDasharray="4 8">
            <animateTransform attributeName="transform" type="rotate" from="360" to="0" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle r={24} fill="#e0a6ff" opacity="0.07" />
        </>
      )}
      {over && reduceMotion && <circle r={28} fill="none" stroke="#e0a6ff" strokeWidth="1" opacity="0.25" />}

      {shield && (
        <g opacity="0.9" style={{ filter: 'drop-shadow(0 0 14px #7af7ff)' }}>
          <path d="M0,-34 L20,-16 L26,10 L0,26 L-26,10 L-20,-16 Z" fill="rgba(122,247,255,0.07)" stroke="#7af7ff" strokeWidth="1.4" strokeDasharray="6 4" />
          <circle r={36 + Math.sin(t * 0.014) * 1.5} fill="none" stroke="#ffffff" strokeWidth="0.6" opacity="0.28" />
        </g>
      )}

      {/* Çift egzoz alevi — çok daha karizmatik */}
      <g style={{ filter: `drop-shadow(0 0 ${6 + speed * 6}px ${over ? '#ff2ea6' : '#00ffcc'})` }}>
        {/* sol motor */}
        <path d={`M-11,14 C-9,${18 + speed * 4} -10,${flame2} -7,${flame2 + 8} C-5,${flame2} -4,${18 + speed * 4} -2,14 Z`}
          fill={over ? '#ff2ea6' : '#00ffcc'} opacity={0.88}>
          <animate attributeName="opacity" values="1;0.55;1" dur="0.11s" repeatCount="indefinite" />
        </path>
        <path d={`M-9,14 C-8,${16 + speed * 3} -8,${flame2 * 0.6} -7,${flame2 * 0.6 + 4} C-6,${flame2 * 0.6} -6,${16 + speed * 3} -4,14 Z`}
          fill="#ffffff" opacity="0.92">
          <animate attributeName="opacity" values="0.95;0.4;0.95" dur="0.08s" repeatCount="indefinite" />
        </path>
        {/* sağ motor */}
        <path d={`M2,14 C4,${18 + speed * 4} 5,${flame2} 7,${flame2 + 8} C9,${flame2} 10,${18 + speed * 4} 11,14 Z`}
          fill={over ? '#ff2ea6' : '#00ffcc'} opacity={0.88}>
          <animate attributeName="opacity" values="1;0.55;1" dur="0.11s" begin="0.05s" repeatCount="indefinite" />
        </path>
        <path d={`M4,14 C6,${16 + speed * 3} 6,${flame2 * 0.6} 7,${flame2 * 0.6 + 4} C8,${flame2 * 0.6} 8,${16 + speed * 3} 9,14 Z`}
          fill="#ffffff" opacity="0.92">
          <animate attributeName="opacity" values="0.95;0.4;0.95" dur="0.08s" begin="0.05s" repeatCount="indefinite" />
        </path>
        {/* orta afterburner çekirdeği */}
        <path d={`M-5,16 C-3,${20 + speed * 6} -2,${flame} 0,${flame + 10} C2,${flame} 3,${20 + speed * 6} 5,16 Z`}
          fill={over ? '#ffd1ff' : '#ffffff'} opacity={0.18 + speed * 0.12} />
        {speed > 0.10 && (
          <>
            <path d={`M${-dir * 10},12 C${-dir * 22},${20 + speed * 5} ${-dir * 36},${28 + speed * 12} ${-dir * 52},${31 + speed * 8}`}
              fill="none" stroke={over ? '#e0a6ff' : '#7af7ff'} strokeWidth="2.4" strokeLinecap="round" opacity={0.32 * speed} />
            <path d={`M${-dir * 6},4 C${-dir * 20},${10 + speed * 5} ${-dir * 38},${16 + speed * 9} ${-dir * 58},${19 + speed * 9}`}
              fill="none" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity={0.2 * speed} />
          </>
        )}
      </g>

      <defs>
        <linearGradient id="cockpitGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7af7ff" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#00e5ff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0066ff" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {/* gövde — delta interceptor — tek gölge (mobil dostu) */}
      <g style={{ filter: `drop-shadow(0 0 8px ${c1})` }}>
        {/* ana gövde */}
        <path d="M0,-30 L9,-11 L21,10 L15,15 L8,17 L-8,17 L-15,15 L-21,10 L-9,-11 Z" fill="#0a162e" stroke={c1} strokeWidth="1.2" />
        {/* üst kaplama — metalik */}
        <path d="M0,-30 L7,-12 L14,8 L8,12 L0,14 L-8,12 L-14,8 L-7,-12 Z" fill={c1} opacity="0.96" />
        {/* kanat vurguları */}
        <path d="M-21,10 L-28,6 L-26,12 L-15,15 Z" fill={c2} opacity="0.9" />
        <path d="M21,10 L28,6 L26,12 L15,15 Z" fill={c2} opacity="0.9" />
        <path d="M-14,8 L-9,-6 L-6,-4 L-11,10 Z" fill="#ffffff" opacity="0.22" />
        <path d="M14,8 L9,-6 L6,-4 L11,10 Z" fill="#ffffff" opacity="0.22" />
        {/* burun — keskin */}
        <path d="M0,-30 L3,-18 L0,-14 L-3,-18 Z" fill="#ffffff" opacity="0.95" />
        {/* kokpit — holografik cam */}
        <ellipse cx="0" cy="-4" rx="6.5" ry="8.5" fill="#061a2e" stroke={accent} strokeWidth="1" />
        <ellipse cx="0" cy="-4" rx="4.2" ry="5.8" fill="url(#cockpitGrad)" opacity="0.95" />
        <ellipse cx="-1.5" cy="-6.5" rx="1.8" ry="1.2" fill="#ffffff" opacity="0.75" />
        {/* motor nozulları */}
        <rect x="-13" y="13" width="7" height="6" rx="1.5" fill="#061a2e" stroke={c2} strokeWidth="0.8" />
        <rect x="6" y="13" width="7" height="6" rx="1.5" fill="#061a2e" stroke={c2} strokeWidth="0.8" />
        <rect x="-11.5" y="14.5" width="4" height="3" rx="0.8" fill={over ? '#ff2ea6' : '#00ffcc'} opacity="0.9" />
        <rect x="7.5" y="14.5" width="4" height="3" rx="0.8" fill={over ? '#ff2ea6' : '#00ffcc'} opacity="0.9" />
        {/* kanat LED'leri */}
        <circle cx="-24" cy="9" r="1.6" fill={over ? '#ff2ea6' : '#00ffcc'} opacity="0.95">
          <animate attributeName="opacity" values="1;0.3;1" dur="0.45s" repeatCount="indefinite" />
        </circle>
        <circle cx="24" cy="9" r="1.6" fill={over ? '#ff2ea6' : '#00ffcc'} opacity="0.95">
          <animate attributeName="opacity" values="1;0.3;1" dur="0.45s" begin="0.22s" repeatCount="indefinite" />
        </circle>
      </g>
      {/* alt karın ışığı */}
      <ellipse cx="0" cy="10" rx="9" ry="2.2" fill={c1} opacity={0.18} style={{ filter: 'blur(2px)' }} />
    </g>
  );
}

function Wingman({ x, y, side, t, reduceMotion }: { x: number; y: number; side: -1 | 1; t: number; reduceMotion?: boolean }) {
  const bob = reduceMotion ? 0 : Math.sin(t * 0.01 + (side === -1 ? 0 : 2.1)) * 1.2;
  return (
    <g transform={`translate(${x}, ${y + bob})`}>
      {/* drone gölgesi */}
      <ellipse cx="0" cy="10" rx="10" ry="2" fill="#00e5ff" opacity={reduceMotion ? 0.03 : 0.06} />
      {/* mini egzoz — hafif gölge */}
      <g style={{ filter: reduceMotion ? undefined : 'drop-shadow(0 0 3px #7af7ff)' }}>
        <path d="M-3,6 C-2,9 -1,11 0,13 C1,11 2,9 3,6 Z" fill="#00ffcc" opacity="0.85">
          {!reduceMotion && <animate attributeName="opacity" values="0.9;0.5;0.9" dur="0.14s" repeatCount="indefinite" />}
        </path>
        <path d="M-1.5,6 C-1,8 -0.5,9 0,10 C0.5,9 1,8 1.5,6 Z" fill="#ffffff" opacity="0.9" />
      </g>
      {/* drone gövde — küçük elmas — tek gölge */}
      <g style={{ filter: 'drop-shadow(0 0 5px #00e5ff)' }}>
        <path d="M0,-10 L7,-2 L5,7 L0,9 L-5,7 L-7,-2 Z" fill="#0a162e" stroke="#7af7ff" strokeWidth="1" />
        <path d="M0,-10 L4,-2 L2,5 L0,7 L-2,5 L-4,-2 Z" fill="#00e5ff" opacity="0.95" />
        <path d="M0,-10 L1.8,-4 L0,-1 L-1.8,-4 Z" fill="#ffffff" opacity="0.88" />
        {/* kanatçıklar */}
        <path d="M-7,-2 L-11,0 L-9,3 L-5,4 Z" fill="#0066ff" />
        <path d="M7,-2 L11,0 L9,3 L5,4 Z" fill="#0066ff" />
        <circle cx="-9.5" cy="1.5" r="1" fill="#00ffcc" opacity="0.9" />
        <circle cx="9.5" cy="1.5" r="1" fill="#00ffcc" opacity="0.9" />
        <circle cx="0" cy="0" r="1.8" fill="#061a2e" stroke="#7af7ff" strokeWidth="0.7" />
        <circle cx="0" cy="0" r="0.9" fill="#ff3b5c" opacity={reduceMotion ? 0.7 : 0.95}>
          {!reduceMotion && <animate attributeName="opacity" values="1;0.35;1" dur="0.6s" repeatCount="indefinite" />}
        </circle>
      </g>
      {/* formation ışını — ana gemiye bağlı */}
      <line x1={side * -14} y1={-2} x2={side * -26} y2={-6} stroke="#7af7ff" strokeWidth="0.7" opacity={reduceMotion ? 0.14 : 0.28} strokeDasharray="3 4" />
    </g>
  );
}

/* ══════════ backdrop ══════════ */
function Cortex({ s }: { s: GameState }) {
  const meta = HEAT_META[s.targetHeat];
  const links = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; o: number }[] = [];
    for (let i = 0; i < s.neurons.length; i++)
      for (let j = i + 1; j < s.neurons.length; j++) {
        const d = Math.hypot(s.neurons[i].x - s.neurons[j].x, s.neurons[i].y - s.neurons[j].y);
        if (d < 108) out.push({ x1: s.neurons[i].x, y1: s.neurons[i].y, x2: s.neurons[j].x, y2: s.neurons[j].y, o: (1 - d / 108) * 0.1 });
      }
    return out;
  }, [s.neurons.length]);

  const isMob = typeof window !== 'undefined' && window.innerWidth < 700;
  return (
    <svg className="absolute inset-0" width={VW} height={VH}>
      <defs>
        <radialGradient id="bgA" cx="28%" cy="14%"><stop offset="0%" stopColor="#14307a" stopOpacity="0.95" /><stop offset="55%" stopColor="#102060" stopOpacity="0.35" /><stop offset="100%" stopColor="#060d26" stopOpacity="0" /></radialGradient>
        <radialGradient id="bgB" cx="78%" cy="88%"><stop offset="0%" stopColor="#4a136b" stopOpacity="0.82" /><stop offset="100%" stopColor="#060d26" stopOpacity="0" /></radialGradient>
        <radialGradient id="bgC" cx="50%" cy="48%"><stop offset="0%" stopColor={meta.deep} stopOpacity="0.62" /><stop offset="100%" stopColor="#060d26" stopOpacity="0" /></radialGradient>
        <linearGradient id="horizon" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={meta.glow} stopOpacity="0" /><stop offset="70%" stopColor={meta.glow} stopOpacity="0.18" /><stop offset="100%" stopColor={meta.core} stopOpacity="0.32" /></linearGradient>
        <linearGradient id="gridGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00e5ff" stopOpacity="0.14" /><stop offset="100%" stopColor="#00e5ff" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width={VW} height={VH} fill="#040a1e" />
      <rect width={VW} height={VH} fill="url(#bgA)" />
      <rect width={VW} height={VH} fill="url(#bgB)" />
      <rect width={VW} height={VH} fill="url(#bgC)" />
      {/* aurora horizon — mobilde blur yok */}
      <ellipse cx={VW / 2} cy={VH + 40} rx={VW * 0.9} ry={180} fill="url(#horizon)" opacity={isMob ? 0.55 : 0.9} />
      {!isMob && <ellipse cx={VW / 2} cy={VH + 22} rx={VW * 1.1} ry={10} fill={meta.core} opacity="0.18" style={{ filter: 'blur(6px)' }} />}
      {/* tron grid floor — mobilde kapalı (ciddi GPU) */}
      {!isMob && (
        <g opacity="0.09">
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={`hg-${i}`} x1="0" y1={FLOOR_Y + 18 + i * 18} x2={VW} y2={FLOOR_Y + 18 + i * 18} stroke="#00e5ff" strokeWidth="0.6" />
          ))}
          {Array.from({ length: 6 }).map((_, i) => {
            const x = (i + 0.5) * (VW / 6);
            return <line key={`vg-${i}`} x1={x} y1={FLOOR_Y + 18} x2={x + (i - 2.5) * 18} y2={VH} stroke="#00e5ff" strokeWidth="0.4" opacity="0.5" />;
          })}
        </g>
      )}
      {s.parallaxStars.slice(0, isMob ? 18 : 36).map(p => {
        const tw = Math.sin(p.pulsePhase) * 0.35 + 0.65;
        const isHot = p.layer === 3;
        return (
          <g key={p.id} opacity={p.opacity * tw * (isHot ? 0.7 : 0.45)}>
            <rect x={p.x} y={p.y} width={p.size} height={p.size}
              fill={isHot ? meta.core : '#cfe9ff'} />
          </g>
        );
      })}
      {!isMob && links.slice(0, 12).map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={meta.glow} strokeWidth="0.6" opacity={l.o * 1.2} />)}
      {isMob ? links.slice(0, 6).map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={meta.glow} strokeWidth="0.5" opacity={l.o * 0.9} />) : null}
      {s.neurons.slice(0, isMob ? 9 : 18).map(n => {
        const pu = Math.sin(n.pulsePhase) * 0.5 + 0.5;
        return (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.size * (isMob ? 4 : 6)} fill={meta.glow} opacity={n.baseOpacity * pu * (isMob ? 0.14 : 0.22)} />
            <circle cx={n.x} cy={n.y} r={n.size} fill={meta.core} opacity={n.baseOpacity + pu * 0.28} />
          </g>
        );
      })}
      {/* üst vignette */}
      <rect width={VW} height={90} fill="url(#gridGrad)" opacity={isMob ? 0.28 : 0.5} />
    </svg>
  );
}

/* ══════════ HUD ══════════ */
function Hud({ s, onPause, onRepeat }: { s: GameState; onPause: () => void; onRepeat: () => void }) {
  const meta = HEAT_META[s.targetHeat];
  const lang = LANGUAGES.find(l => l.code === s.lang)!;
  const cfg = LEVEL_CONFIG[s.level];
  const pct = Math.min(100, (s.wavesCleared / cfg.wavesToClear) * 100);
  const runTotal = s.runCorrect + s.runWrong;
  const runAcc = runTotal ? Math.round((s.runCorrect / runTotal) * 100) : 0;

  return (
    <div className="absolute top-0 left-0 right-0 z-30 px-2 pt-2 pointer-events-none">
      <div className="flex items-start gap-1.5">
        <div className="glass px-2 py-1 rounded-md flex-1 min-w-0">
          <div className="font-mono-tech text-[7px] tracking-[0.22em] text-white/35">SCORE</div>
          <div className="font-orbitron text-[16px] font-black leading-none"
            style={{ color: '#00d4ff', textShadow: '0 0 10px rgba(0,212,255,0.85)' }}>
            {s.score.toString().padStart(6, '0')}
          </div>
        </div>
        <div className="glass px-2 py-1 rounded-md text-center">
          <div className="font-orbitron text-[12px] font-black leading-none" style={{ color: cfg.color, textShadow: `0 0 8px ${cfg.color}` }}>{s.level}</div>
          <div className="font-mono-tech text-[7px] tracking-widest" style={{ color: lang.accent }}>{lang.flag}</div>
        </div>
        <div className="glass px-2 py-1 rounded-md">
          <div className="font-mono-tech text-[7px] tracking-[0.22em] text-white/35 mb-[3px]">CAN</div>
          <div className="flex gap-[3px] h-[11px] items-center">
            {Array.from({ length: s.maxLives }).map((_, i) => (
              <svg key={i} width="12" height="10" viewBox="0 0 13 11" opacity={i < s.lives ? 1 : 0.16}>
                <path d="M6.5,0 L8.5,5 L12,8 L9,7.5 L7.5,10 L5.5,10 L4,7.5 L1,8 L4.5,5 Z"
                  fill={i < s.lives ? '#ff2e63' : '#fff'}
                  style={i < s.lives ? { filter: 'drop-shadow(0 0 4px #ff2e63)' } : undefined} />
              </svg>
            ))}
          </div>
        </div>
        <button
          type="button"
          onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onRepeat(); }}
          onClick={e => { e.stopPropagation(); onRepeat(); }}
          className="glass rounded-md px-2.5 h-[36px] min-w-[56px] pointer-events-auto active:scale-95 transition-transform flex flex-col items-center justify-center touch-manipulation select-none" style={s.repeatMode ? { border: '1.4px solid #ffd166', boxShadow: '0 0 12px rgba(255,209,102,0.6)', background: 'rgba(255,209,102,0.14)' } : { border: '1px solid rgba(255,255,255,0.14)' }}>
          <span className="text-[11px] leading-none" style={{ filter: s.repeatMode ? 'drop-shadow(0 0 5px #ffd166)' : undefined }}>{s.repeatMode ? '🔁' : '🔁'}</span>
          <span className="font-mono-tech text-[5.5px] tracking-[0.12em] leading-none mt-0.5" style={{ color: s.repeatMode ? '#ffd166' : 'rgba(255,255,255,0.45)' }}>{s.repeatMode ? 'PEKİŞTİR' : 'TEKRAR'}</span>
        </button>
        <button onClick={onPause} className="glass rounded-md w-7 h-[32px] pointer-events-auto active:scale-95 transition-transform">
          <span className="font-mono-tech text-[11px] text-white/70">II</span>
        </button>
      </div>

      <div className="glass rounded-md px-2 py-1 mt-1.5">
        <div className="flex items-center justify-between mb-[3px]">
          <span className="font-mono-tech text-[7px] tracking-[0.2em] text-white/40">
            DALGA {s.wave} · {s.wavesCleared}/{cfg.wavesToClear} {s.wave > 2 && (
              <span style={{ color: s.wave > 10 ? '#ff2e63' : s.wave > 6 ? '#ffb300' : '#00ffa3' }}>
                · ×{(Math.min(1.90, 1 + (s.wave - 1) * 0.055)).toFixed(2)} HIZ
              </span>
            )}
          </span>
          <span className="font-pixel text-[11px] leading-none" style={{ color: meta.core, textShadow: `0 0 7px ${meta.glow}` }}>{meta.label}</span>
        </div>
        <div className="relative h-[7px] rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="absolute inset-y-0 left-0 rounded-full liquid-metal"
            style={{ width: `${Math.max(6, pct)}%`, boxShadow: `0 0 9px ${meta.glow}` }} />
        </div>
        {runTotal > 0 && (
          <div className="flex justify-between mt-1">
            <span className="font-mono-tech text-[6px] tracking-[0.12em] text-white/30">KOŞU {s.runCorrect} ✓ / {s.runWrong} ✕</span>
            <span className="font-mono-tech text-[6px] tracking-[0.12em]" style={{ color: runAcc >= 70 ? '#00ffa3' : runAcc >= 45 ? '#ffd166' : '#ff8fa8' }}>%{runAcc} İSABET</span>
          </div>
        )}
      </div>

      {s.overcharged && (
        <div className="mt-1.5 rounded-md overflow-hidden h-[4px]" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="h-full" style={{ width: `${(s.overchargeTimer / 9000) * 100}%`, background: 'linear-gradient(90deg,#c77dff,#ff2e9d)', boxShadow: '0 0 10px #c77dff' }} />
        </div>
      )}

      {(s.shield || s.focusTimer > 0 || s.perfectStreak > 0) && (
        <div className="mt-1.5 flex gap-1.5">
          {s.shield && (
            <div className="glass rounded-md px-2 py-1 font-mono-tech text-[7px] tracking-[0.15em]" style={{ color: '#8be9ff', textShadow: '0 0 6px #00b3ff' }}>
              KALKAN
            </div>
          )}
          {s.focusTimer > 0 && (
            <div className="glass rounded-md px-2 py-1 flex-1 min-w-0">
              <div className="font-mono-tech text-[7px] tracking-[0.15em] text-[#8be9ff] mb-0.5">ODAK</div>
              <div className="h-[3px] rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (s.focusTimer / 2600) * 100)}%`, background: '#8be9ff', boxShadow: '0 0 8px #00b3ff' }} />
              </div>
            </div>
          )}
          {s.perfectStreak > 0 && (
            <div className="glass rounded-md px-2 py-1 font-mono-tech text-[7px] tracking-[0.15em] text-[#00ffa3]">
              PERFECT ×{s.perfectStreak}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════ main ══════════ */
export function GameScreen({ api, crt }: { api: EngineApi; crt: boolean }) {
  const s = api.state;
  const meta = HEAT_META[s.targetHeat];
  const surface = useRef<HTMLDivElement>(null);
  const dragId = useRef<number | null>(null);
  const moved = useRef(false);
  // basılı tutunca tarama
  const fireHeld = useRef<number | null>(null);
  const startFire = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    api.fire();
    if (fireHeld.current !== null) return;
    fireHeld.current = window.setInterval(() => api.fire(), 118);
  }, [api]);
  const stopFire = useCallback((e?: React.PointerEvent) => {
    if (e) try { (e.currentTarget as Element).releasePointerCapture?.(e.pointerId); } catch {}
    if (fireHeld.current !== null) { window.clearInterval(fireHeld.current); fireHeld.current = null; }
  }, []);

  const toLocal = useCallback((clientX: number) => {
    const r = surface.current?.getBoundingClientRect();
    if (!r) return VW / 2;
    return ((clientX - r.left) / r.width) * VW;
  }, []);

  // sol/sağ basılı tut — esnek kaydırma
  const holdLeftDown = useCallback((e: React.PointerEvent) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); api.holdDir(-1); }, [api]);
  const holdRightDown = useCallback((e: React.PointerEvent) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); api.holdDir(1); }, [api]);
  const endHold = useCallback((e: React.PointerEvent) => { try { (e.currentTarget as Element).releasePointerCapture?.(e.pointerId); } catch {} api.holdDir(0); }, [api]);
  const [micListening, setMicListening] = useState(false);
  const [micMsg, setMicMsg] = useState<string | null>(null);
  const doMic = useCallback(async () => {
    if (!speechSupported() || !s.targetWord || micListening) return;
    setMicListening(true); setMicMsg(null);
    const res = await listenOnce(s.targetWord.lang, s.targetWord.foreign);
    setMicListening(false);
    if (res.ok) {
      api.triggerMine();
      setMicMsg('💥 ' + Math.round(res.score * 100) + '% MAYIN!');
      setTimeout(() => setMicMsg(null), 1600);
    } else {
      setMicMsg(res.transcript ? `✕ ${res.transcript.slice(0,12)}` : '✕ duyamadım');
      setTimeout(() => setMicMsg(null), 1400);
    }
  }, [s.targetWord, micListening, api]);

  const down = useCallback((e: React.PointerEvent) => {
    if (dragId.current !== null) return;
    dragId.current = e.pointerId;
    moved.current = false;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    api.gotoX(toLocal(e.clientX));
  }, [api, toLocal]);
  const move = useCallback((e: React.PointerEvent) => {
    if (dragId.current !== e.pointerId) return;
    moved.current = true;
    api.setMoveTarget(toLocal(e.clientX));
  }, [api, toLocal]);
  const up = useCallback((e: React.PointerEvent) => {
    if (dragId.current !== e.pointerId) return;
    dragId.current = null;
    if (moved.current) api.setMoveTarget(null);
  }, [api]);

  const locked = s.aliens.find(a => a.id === api.lockedId) ?? null;
  const hint = s.aliens.find(a => a.id === api.hintId) ?? null;
  const onTarget = Boolean(locked && hint && locked.id === hint.id);
  const guideLeft = Boolean(locked && hint && hint.lane < locked.lane);
  const guideRight = Boolean(locked && hint && hint.lane > locked.lane);
  const aimText = onTarget
    ? '✓ HEDEF KİLİTLENDİ'
    : guideLeft
      ? '◀ HEDEF SOLDA'
      : guideRight
        ? 'HEDEF SAĞDA ▶'
        : locked
          ? locked.word.foreign
          : 'ŞERİT SEÇ';
  const shakeX = s.shake ? Math.sin(s.gameTime * 0.85) * s.shake * 0.55 : 0;
  const shakeY = s.shake ? Math.cos(s.gameTime * 1.05) * s.shake * 0.45 : 0;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#060d26' }}>
      <div ref={surface} className="absolute inset-0 touch-none"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="absolute inset-0" style={{ transform: `translate3d(${shakeX}px, ${shakeY}px, 0)`, willChange: shakeX || shakeY ? 'transform' : 'auto' }}>
          <Cortex s={s} />

          <svg className="absolute inset-0 pointer-events-none" width={VW} height={VH}>
            <defs>
              <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={onTarget ? '#00ff9d' : s.overcharged ? '#c77dff' : '#00d4ff'} stopOpacity="0.22" />
                <stop offset="100%" stopColor={onTarget ? '#00ff9d' : s.overcharged ? '#c77dff' : '#00d4ff'} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="rainbowGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ff3b5c" /><stop offset="16%" stopColor="#ff9500" /><stop offset="33%" stopColor="#ffd166" /><stop offset="50%" stopColor="#00ffa3" /><stop offset="66%" stopColor="#00d4ff" /><stop offset="83%" stopColor="#9d4edd" /><stop offset="100%" stopColor="#ff6bff" />
              </linearGradient>
            </defs>

            {s.aliens.map(a => (
              <line key={`ln-${a.id}`} x1={a.laneX} y1={78} x2={a.laneX} y2={FLOOR_Y} stroke="#8be9ff" strokeWidth="0.5" opacity="0.06" />
            ))}

            {locked && (
              <>
                <rect x={locked.laneX} y={locked.y + SPRITE_H} width={locked.laneW}
                  height={Math.max(0, SHIP_Y - locked.y - SPRITE_H - 24)} fill="url(#beam)" />
                <line x1={s.shipX} y1={SHIP_Y - 24} x2={s.shipX} y2={locked.y + SPRITE_H + 4}
                  stroke={onTarget ? '#00ff9d' : '#7fe3ff'} strokeWidth="1" strokeDasharray="2 6" opacity="0.6" />
              </>
            )}

            <line x1="0" y1={FLOOR_Y} x2={VW} y2={FLOOR_Y} stroke="#ff2e63" strokeWidth="1" strokeDasharray="4 7" opacity="0.3" />

            {s.aliens.map(a => <Sprite key={a.id} a={a} t={s.gameTime} locked={a.id === api.lockedId} hint={a.id === api.hintId} />)}

            {s.focusTimer > 0 && [0, 1, 2, 3].map(i => (
              <ellipse key={`focus-${i}`} cx={VW / 2} cy={FLOOR_Y - 150} rx={58 + i * 52 + Math.sin(s.gameTime * 0.006 + i) * 7} ry={112 + i * 34}
                fill="none" stroke="#8be9ff" strokeWidth="0.8" opacity={(0.22 - i * 0.04) * Math.min(1, s.focusTimer / 900)} />
            ))}

            {Math.abs(s.shipVx) > 1.4 && Array.from({ length: 7 }).map((_, i) => {
              const dir = Math.sign(s.shipVx);
              const y = SHIP_Y - 46 - i * 16;
              const x1 = s.shipX - dir * (18 + i * 5);
              const x2 = s.shipX - dir * (52 + Math.min(1, Math.abs(s.shipVx) / 15.5) * 34 + i * 7);
              return (
                <line key={`warp-${i}`} x1={x1} y1={y} x2={x2} y2={y + 4}
                  stroke={s.overcharged ? '#c77dff' : '#7fe3ff'} strokeWidth={i % 2 ? 1 : 1.6}
                  strokeLinecap="round" opacity={(0.28 - i * 0.025) * Math.min(1, Math.abs(s.shipVx) / 15.5)} />
              );
            })}

            {s.bullets.map(b => {
              const isWing = (b as any).from === 'wingman';
              return (
                <g key={b.id}>
                  {/* mobilde drop-shadow kaldırıldı — GPU donması bitirir */}
                  <rect x={b.x - (isWing ? 1.5 : 2.2)} y={b.y - (isWing ? 32 : 43)} width={isWing ? 3 : 4.4} height={isWing ? 34 : 47} rx={isWing ? 1.5 : 2.2}
                    fill={isWing ? '#7af7ff' : s.overcharged ? '#e0a6ff' : '#8be9ff'} opacity={isWing ? 0.88 : 0.92} />
                  <rect x={b.x - 0.7} y={b.y - (isWing ? 32 : 43)} width={isWing ? 1.2 : 1.6} height={isWing ? 12 : 18} fill="#fff" opacity={0.95} />
                  {!isWing && <rect x={b.x - 5.5} y={b.y - 18} width="11" height="2" rx="1" fill={s.overcharged ? '#ff2ea6' : '#00d4ff'} opacity={0.45} />}
                  {isWing && <circle cx={b.x} cy={b.y - 28} r="1.1" fill="#ffffff" opacity={0.9} />}
                </g>
              );
            })}


            {s.explosions.map(e => (
              <g key={e.id} opacity={e.opacity}>
                <circle cx={e.x} cy={e.y} r={e.radius} fill="none" stroke={e.color} strokeWidth="2" />
                <circle cx={e.x} cy={e.y} r={e.radius * 0.5} fill={e.color} opacity="0.3" />
              </g>
            ))}

            {s.repairStation?.active && (
              <g transform={`translate(${s.repairStation.x}, ${FLOOR_Y + 22})`}>
                <circle r="18" fill="none" stroke="#00ffa3" strokeWidth="1.2" opacity="0.5">
                  <animate attributeName="r" values="14;25;14" dur="1.5s" repeatCount="indefinite" />
                </circle>
                <rect x="-12" y="-12" width="24" height="24" rx="5" fill="rgba(0,255,163,0.14)" stroke="#00ffa3" strokeWidth="1.2" />
                <path d="M-6,0 L6,0 M0,-6 L0,6" stroke="#00ffa3" strokeWidth="3" strokeLinecap="round" />
              </g>
            )}

            {/* wingmen — iki yancı drone */}
            {s.wingmen.map(w => <Wingman key={w.id} x={w.x} y={w.y} side={w.side} t={s.gameTime} reduceMotion={api.settings.reduceMotion} />)}
            <Ship x={s.shipX} over={s.overcharged} shield={s.shield} vx={s.shipVx} t={s.gameTime} reduceMotion={api.settings.reduceMotion} />
          </svg>

          <Plates s={s} hintId={api.hintId} lockedId={api.lockedId} />

          {s.floats.map(f => (
            <div key={f.id} className="absolute pointer-events-none z-20 -translate-x-1/2 whitespace-nowrap"
              style={{
                left: f.x, top: f.y, opacity: Math.max(0, Math.min(1, f.life)), color: f.color,
                textShadow: `0 0 8px ${f.color}`, fontFamily: "'VT323', monospace", fontSize: 16,
              }}>{f.text}</div>
          ))}

          {s.waveBanner && (
            <div className="absolute inset-x-0 top-[34%] z-20 text-center pointer-events-none"
              style={{ opacity: Math.min(1, s.waveBanner.t * 1.7) }}>
              <div className="font-orbitron text-[30px] font-black tracking-[0.14em]"
                style={{ color: s.bossWave ? '#ffd166' : meta.core, textShadow: `0 0 22px ${s.bossWave ? '#ffd166' : meta.glow}` }}>
                {s.waveBanner.text}
              </div>
              {s.waveBanner.sub && <div className="font-mono-tech text-[9px] tracking-[0.3em] text-white/55 mt-1">{s.waveBanner.sub}</div>}
            </div>
          )}
        </div>
      </div>

      {/* ══ HIT CARD — the word you just shot, big and unmissable ══ */}
      {s.hitCard && (
        <div className="absolute inset-x-4 top-[30%] z-30 pointer-events-none flex justify-center"
          style={{ opacity: Math.min(1, s.hitCard.t * 1.5), transform: `scale(${0.94 + Math.min(1, s.hitCard.t) * 0.06})` }}>
          <div className="rounded-2xl px-5 py-3 text-center max-w-full"
            style={{
              background: s.hitCard.ok ? 'rgba(2,26,18,0.94)' : 'rgba(34,3,12,0.94)',
              border: `1.6px solid ${s.hitCard.ok ? '#00ff9d' : '#ff2e63'}`,
              boxShadow: `0 0 26px ${s.hitCard.ok ? 'rgba(0,255,157,0.4)' : 'rgba(255,46,99,0.4)'}`,
              backdropFilter: 'blur(6px)',
            }}>
            <div className="font-mono-tech text-[8px] tracking-[0.3em] mb-1"
              style={{ color: s.hitCard.ok ? 'rgba(0,255,157,0.75)' : 'rgba(255,143,168,0.8)' }}>
              {s.hitCard.ok ? '✓ DOĞRU' : '✕ YANLIŞ'}
            </div>
            <div className="font-orbitron font-black leading-tight break-words"
              style={{
                fontSize: s.hitCard.foreign.length > 20 ? 17 : s.hitCard.foreign.length > 12 ? 21 : 26,
                color: '#ffffff',
                textShadow: `0 0 14px ${s.hitCard.ok ? '#00ff9d' : '#ff2e63'}`,
              }}>
              {s.hitCard.foreign}
            </div>
            <div className="font-mono-tech text-[13px] mt-1 break-words" style={{ color: 'rgba(255,255,255,0.72)' }}>
              {s.hitCard.native}
            </div>
            {s.hitCard.ok && (()=> {
              const cat = s.hitCard!.category ?? 'daily';
              const sessionSeen = s.hitCard!.sessionSeen ?? 1;
              const seen = s.hitCard!.seen ?? 1;
              const pct = Math.min(100, sessionSeen*50);
              return (
                <div className="mt-2">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="text-[14px]">{CAT_EMOJI[cat] ?? '🧠'}</span>
                    <span className="font-mono-tech text-[7px] tracking-[0.2em] text-white/40">HAFIZA İZİ</span>
                    <span className="font-mono-tech text-[7px] text-[#00ffa3]">{Math.min(sessionSeen,2)}/2 bu koşu · {Math.min(seen,7)} toplam</span>
                  </div>
                  <div className="h-[5px] rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct>=100?'#00ffa3':'#00d4ff', boxShadow: `0 0 6px ${pct>=100?'#00ffa3':'#00d4ff'}` }} />
                  </div>
                  <div className="font-mono-tech text-[6px] text-white/30 mt-1">{pct>=100?'✓ 2/2 — SIRADAKİ TAZE KELİME GELECEK':'Bir kez daha gelirse havuzdan çıkacak, taze kelime sırası'}</div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── tehlike vignette: göz yormayacak kadar hafif ── */}
      {s.danger > 0.2 && (
        <div className="absolute inset-0 pointer-events-none z-24"
          style={{
            background: `radial-gradient(ellipse at center, transparent 56%, rgba(255,46,99,${0.09 + s.danger * 0.14}) 100%)`,
            opacity: 0.35 + Math.sin(s.gameTime * 0.014) * 0.18 * s.danger,
          }} />
      )}
      {s.frenzy && (
        <div className="absolute inset-0 pointer-events-none z-24" style={{
          background: 'linear-gradient(180deg, rgba(255,46,99,0.08) 0%, transparent 45%, rgba(0,255,208,0.06) 100%)',
          opacity: 0.5 + Math.sin(s.gameTime * 0.012) * 0.25,
        }} />
      )}
      {s.danger > 0.6 && (
        <div className="absolute top-[42%] left-1/2 -translate-x-1/2 z-26 pointer-events-none">
          <div className="font-orbitron text-[10px] font-black tracking-[0.32em] animate-pulse" style={{ color: '#ff2e63', textShadow: '0 0 14px #ff2e63' }}>
            {s.danger > 0.85 ? '● TEHLİKE ●' : '▲ YAKLAŞIYOR ▲'}
          </div>
        </div>
      )}
      {s.vignette > 0 && (
        <div className="absolute inset-0 pointer-events-none z-25"
          style={{ background: `radial-gradient(ellipse at center, transparent 46%, rgba(0,0,0,${s.vignette}) 100%)` }} />
      )}
      {s.flash && (
        <div className="absolute inset-0 pointer-events-none z-25 mix-blend-screen"
          style={{ background: s.flash.color, opacity: s.flash.t * 0.14 }} />
      )}

      <Hud s={s} onPause={api.pause} onRepeat={api.toggleRepeat} />

      {/* ══ prompt bar + controls ══ */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-2.5 pb-3 pt-6"
        style={{ background: 'linear-gradient(to top, rgba(6,13,38,0.98) 40%, rgba(6,13,38,0.6) 78%, transparent)' }}>

        {/* what to shoot — native prompt + replay */}
        <div className="flex items-stretch gap-2 mb-2">
          <div className="flex-1 min-w-0 rounded-xl px-3 py-1.5 flex flex-col justify-center"
            style={{
              background: 'rgba(4,9,26,0.92)',
              border: `1.3px solid ${onTarget ? '#00ff9d' : meta.core}`,
              boxShadow: `0 0 12px ${onTarget ? 'rgba(0,255,157,0.4)' : `${meta.glow}44`}`,
            }}>
            <div className="font-mono-tech text-[7px] tracking-[0.26em] text-white/38">BUNU VUR</div>
            <div className="font-orbitron font-black leading-tight truncate"
              style={{
                fontSize: (s.targetWord?.native.length ?? 0) > 22 ? 13 : (s.targetWord?.native.length ?? 0) > 15 ? 15 : 18,
                color: '#ffffff', textShadow: `0 0 9px ${onTarget ? '#00ff9d' : meta.glow}`,
              }}>
              {s.targetWord?.native ?? '—'}
            </div>
          </div>
          <button onPointerDown={api.replay}
            className="glass rounded-xl w-[52px] flex flex-col items-center justify-center active:scale-95 transition-transform touch-none">
            <span className="text-[15px] leading-none">🔊</span>
            <span className="font-mono-tech text-[6.5px] tracking-[0.1em] text-white/45 mt-0.5">DİNLE</span>
          </button>
          <button onPointerDown={doMic}
            className="glass rounded-xl w-[52px] flex flex-col items-center justify-center active:scale-95 transition-transform touch-none"
            style={micListening ? { border: '1.4px solid #00ffa3', boxShadow: '0 0 14px rgba(0,255,163,0.5)' } : s.speechNudge > 0 ? { border: '1.6px solid #00ffa3', boxShadow: '0 0 16px rgba(0,255,163,0.6)', animation: 'pulse 0.9s infinite' } : micMsg ? { border: `1px solid ${micMsg.startsWith('✓') ? '#00ffa3' : '#ff2e63'}` } : undefined}>
            <span className="text-[15px] leading-none" style={{ filter: micListening || s.speechNudge > 0 ? 'drop-shadow(0 0 6px #00ffa3)' : undefined }}>{micListening ? '●' : '🎤'}</span>
            <span className="font-mono-tech text-[6px] tracking-[0.08em] mt-0.5" style={{ color: micListening ? '#00ffa3' : s.speechNudge > 0 ? '#00ffa3' : micMsg ? (micMsg.startsWith('✓') ? '#00ffa3' : '#ff8fa8') : 'rgba(255,255,255,0.45)' }}>
              {micListening ? 'DİNLİYOR' : s.speechNudge > 0 ? '+80' : micMsg ?? 'SÖYLE'}
            </span>
          </button>
        </div>


        {/* lane-snap steering + fire */}
        <div className="flex items-center gap-2">
          <button
            onPointerDown={holdLeftDown} onPointerUp={endHold} onPointerCancel={endHold} onPointerLeave={endHold} onClick={() => api.stepLane(-1)}
            className="glass rounded-xl h-[60px] w-[68px] flex flex-col items-center justify-center active:scale-95 transition-transform touch-none select-none"
            style={guideLeft ? { border: '1.4px solid #00ff9d', boxShadow: '0 0 18px rgba(0,255,157,0.5)' } : undefined}>
            <span className="font-mono-tech text-[8px] tracking-[0.14em]" style={{ color: guideLeft ? '#00ff9d' : 'rgba(255,255,255,0.55)', fontWeight: 700 }}>
              {guideLeft ? 'HEDEF' : 'ŞERİT'}
            </span>
          </button>

          <button onPointerDown={startFire} onPointerUp={stopFire} onPointerCancel={stopFire} onPointerLeave={stopFire}
            className="relative flex-1 h-[60px] rounded-xl active:scale-[0.97] transition-transform touch-none overflow-hidden select-none"
            style={{
              background: onTarget
                ? 'linear-gradient(135deg, rgba(0,255,157,0.34), rgba(0,180,110,0.2))'
                : s.overcharged
                  ? 'linear-gradient(135deg, rgba(199,125,255,0.36), rgba(255,46,157,0.3))'
                  : 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,102,255,0.16))',
              border: `1.4px solid ${onTarget ? '#00ff9d' : s.overcharged ? '#c77dff' : '#00d4ff'}`,
              boxShadow: `0 0 20px ${onTarget ? 'rgba(0,255,157,0.55)' : s.overcharged ? 'rgba(199,125,255,0.55)' : 'rgba(0,212,255,0.4)'}, inset 0 1px 0 rgba(255,255,255,0.16)`,
            }}>
            <span className="font-orbitron text-[18px] font-black tracking-[0.3em]"
              style={{ color: onTarget ? '#dcffef' : '#dff6ff', textShadow: `0 0 12px ${onTarget ? '#00ff9d' : '#00d4ff'}` }}>
              ATEŞ
            </span>
            <span className="absolute bottom-1 left-0 right-0 text-center font-mono-tech text-[7px] tracking-[0.12em] truncate px-2"
              style={{ color: onTarget ? 'rgba(0,255,157,0.85)' : 'rgba(255,255,255,0.4)' }}>
              {aimText}
            </span>
          </button>

          <button
            onPointerDown={holdRightDown} onPointerUp={endHold} onPointerCancel={endHold} onPointerLeave={endHold} onClick={() => api.stepLane(1)}
            className="glass rounded-xl h-[60px] w-[68px] flex flex-col items-center justify-center active:scale-95 transition-transform touch-none select-none"
            style={guideRight ? { border: '1.4px solid #00ff9d', boxShadow: '0 0 18px rgba(0,255,157,0.5)' } : undefined}>
            <span className="font-mono-tech text-[8px] tracking-[0.14em]" style={{ color: guideRight ? '#00ff9d' : 'rgba(255,255,255,0.55)', fontWeight: 700 }}>
              {guideRight ? 'HEDEF' : 'ŞERİT'}
            </span>
          </button>
        </div>
      </div>

      {crt && <div className="crt absolute inset-0 pointer-events-none z-40" />}
    </div>
  );
}
