import React, { useCallback, useMemo, useRef } from 'react';
import type { GameState, Alien } from '../types/game';
import { HEAT_META, LEVEL_CONFIG, LANGUAGES } from '../data/vocabulary';
import { VW, VH, SHIP_Y, FLOOR_Y, SPRITE_H } from '../hooks/useGameEngine';
import type { EngineApi } from '../hooks/useGameEngine';

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
        /* Keep every label inside its own lane. This prevents neighbouring
           invader words from ever covering each other on narrow phones. */
        const plateW = Math.max(54, a.laneW - (a.isBoss ? 4 : 8));
        const cx = a.laneX + a.laneW / 2;
        const len = a.word.foreign.length;
        const size = len > 34 ? 9.5 : len > 26 ? 10.5 : len > 18 ? 12 : len > 11 ? 14 : 16;
        const lines = len > 24 ? 3 : len > 12 ? 2 : 1;

        return (
          <div key={`p-${a.id}`}
            className="absolute -translate-x-1/2 pointer-events-none flex items-center justify-center"
            style={{
              left: cx,
              top: a.y + h + (a.isBoss ? 12 : 4),
              width: plateW,
              minHeight: Math.max(22, lines * (size + 3) + 6),
              padding: '3px 4px',
              borderRadius: 5,
              background: isHint ? 'rgba(0,40,26,0.94)' : 'rgba(4,9,26,0.92)',
              border: `1px solid ${isHint ? '#00ff9d' : color}`,
              borderWidth: isHint || isLock ? 1.4 : 0.8,
              boxShadow: isHint ? '0 0 14px rgba(0,255,157,0.55)' : `0 0 8px ${color}44`,
              zIndex: 12,
            }}>
            <span style={{
              fontFamily: "'Share Tech Mono', ui-monospace, monospace",
              fontSize: size,
              lineHeight: 1.08,
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

/* ══════════ ship ══════════ */
function Ship({ x, over, shield, vx, t }: { x: number; over: boolean; shield: boolean; vx: number; t: number }) {
  const c1 = over ? '#c77dff' : '#00d4ff';
  const c2 = over ? '#ff2e9d' : '#0066ff';
  const speed = Math.min(1, Math.abs(vx) / 15.5);
  const dir = vx === 0 ? 0 : Math.sign(vx);
  const flame = 20 + speed * 22 + Math.sin(t * 0.04) * 4;
  return (
    <g transform={`translate(${x}, ${SHIP_Y})`}>
      {/* Horizontal warp afterimages: appear when the ship accelerates left/right. */}
      {speed > 0.08 && [1, 2, 3].map(i => (
        <g key={i} transform={`translate(${-dir * i * (8 + speed * 9)}, ${i * 1.4})`} opacity={(0.22 - i * 0.045) * speed}
          style={{ filter: `drop-shadow(0 0 ${7 - i}px ${c1})` }}>
          <path d="M0,-21 L7,-4 L17,10 L10,8 L6,13 L-6,13 L-10,8 L-17,10 L-7,-4 Z" fill={c1} />
        </g>
      ))}

      {over && (
        <>
          <circle r={36} fill="none" stroke="#c77dff" strokeWidth="1" opacity="0.5" strokeDasharray="6 5">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3.4s" repeatCount="indefinite" />
          </circle>
          <circle r={26} fill="#c77dff" opacity="0.09" />
        </>
      )}

      {shield && (
        <g opacity="0.86" style={{ filter: 'drop-shadow(0 0 10px #8be9ff)' }}>
          <circle r={31 + Math.sin(t * 0.012) * 2} fill="rgba(139,233,255,0.06)" stroke="#8be9ff" strokeWidth="1.5" strokeDasharray="5 4" />
          <circle r={21} fill="none" stroke="#ffffff" strokeWidth="0.7" opacity="0.35" />
        </g>
      )}

      {/* Main thruster flame. It grows with movement and overcharge. */}
      <g style={{ filter: `drop-shadow(0 0 ${8 + speed * 10}px ${over ? '#ff2e9d' : '#00ffa3'})` }}>
        <path d={`M-8,12 C-5,${18 + speed * 5} -3,${flame} 0,${flame + 9} C3,${flame} 5,${18 + speed * 5} 8,12 Z`}
          fill={over ? '#ff2e9d' : '#00ffa3'} opacity={0.85 + speed * 0.15}>
          <animate attributeName="opacity" values="1;0.48;1" dur="0.12s" repeatCount="indefinite" />
        </path>
        <path d={`M-4,13 C-2,${18 + speed * 3} -1,${flame - 2} 0,${flame + 3} C1,${flame - 2} 2,${18 + speed * 3} 4,13 Z`}
          fill="#ffffff" opacity="0.85">
          <animate attributeName="opacity" values="0.9;0.35;0.9" dur="0.09s" repeatCount="indefinite" />
        </path>
        {speed > 0.12 && (
          <>
            <path d={`M${-dir * 9},10 C${-dir * 20},${18 + speed * 3} ${-dir * 30},${24 + speed * 10} ${-dir * 43},${27 + speed * 6}`}
              fill="none" stroke={over ? '#c77dff' : '#7fe3ff'} strokeWidth="2.2" strokeLinecap="round" opacity={0.35 * speed} />
            <path d={`M${-dir * 5},3 C${-dir * 18},${8 + speed * 4} ${-dir * 31},${12 + speed * 8} ${-dir * 49},${15 + speed * 8}`}
              fill="none" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity={0.22 * speed} />
          </>
        )}
      </g>

      <g style={{ filter: `drop-shadow(0 0 7px ${c1}) drop-shadow(0 0 15px ${c2})` }}>
        <path d="M0,-21 L7,-4 L17,10 L10,8 L6,13 L-6,13 L-10,8 L-17,10 L-7,-4 Z" fill={c1} />
        <path d="M0,-21 L4,-6 L-4,-6 Z" fill="#ffffff" opacity="0.9" />
        <rect x="-12" y="4" width="5" height="5" fill={c2} />
        <rect x="7" y="4" width="5" height="5" fill={c2} />
      </g>
      <circle cx="0" cy="0" r="4" fill="#060d26" stroke={c1} strokeWidth="1.2" />
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

  return (
    <svg className="absolute inset-0" width={VW} height={VH}>
      <defs>
        <radialGradient id="bgA" cx="30%" cy="16%"><stop offset="0%" stopColor="#132a6b" stopOpacity="0.9" /><stop offset="100%" stopColor="#060d26" stopOpacity="0" /></radialGradient>
        <radialGradient id="bgB" cx="76%" cy="84%"><stop offset="0%" stopColor="#3a1160" stopOpacity="0.75" /><stop offset="100%" stopColor="#060d26" stopOpacity="0" /></radialGradient>
        <radialGradient id="bgC" cx="50%" cy="52%"><stop offset="0%" stopColor={meta.deep} stopOpacity="0.5" /><stop offset="100%" stopColor="#060d26" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width={VW} height={VH} fill="#060d26" />
      <rect width={VW} height={VH} fill="url(#bgA)" />
      <rect width={VW} height={VH} fill="url(#bgB)" />
      <rect width={VW} height={VH} fill="url(#bgC)" />
      {s.parallaxStars.map(p => {
        const tw = Math.sin(p.pulsePhase) * 0.35 + 0.65;
        return <rect key={p.id} x={p.x} y={p.y} width={p.size} height={p.size}
          fill={p.layer === 3 ? meta.core : '#cfe9ff'} opacity={p.opacity * tw * 0.5} />;
      })}
      {links.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={meta.glow} strokeWidth="0.5" opacity={l.o} />)}
      {s.neurons.map(n => {
        const pu = Math.sin(n.pulsePhase) * 0.5 + 0.5;
        return (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.size * 5} fill={meta.glow} opacity={n.baseOpacity * pu * 0.18} />
            <circle cx={n.x} cy={n.y} r={n.size} fill={meta.core} opacity={n.baseOpacity + pu * 0.28} />
          </g>
        );
      })}
    </svg>
  );
}

/* ══════════ HUD ══════════ */
function Hud({ s, onPause }: { s: GameState; onPause: () => void }) {
  const meta = HEAT_META[s.targetHeat];
  const lang = LANGUAGES.find(l => l.code === s.lang)!;
  const cfg = LEVEL_CONFIG[s.level];
  const pct = Math.min(100, (s.wavesCleared / cfg.wavesToClear) * 100);

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
        <div className="absolute inset-0" style={{ transform: `translate(${shakeX}px, ${shakeY}px)` }}>
          <Cortex s={s} />

          <svg className="absolute inset-0 pointer-events-none" width={VW} height={VH}>
            <defs>
              <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={onTarget ? '#00ff9d' : s.overcharged ? '#c77dff' : '#00d4ff'} stopOpacity="0.22" />
                <stop offset="100%" stopColor={onTarget ? '#00ff9d' : s.overcharged ? '#c77dff' : '#00d4ff'} stopOpacity="0" />
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

            {s.bullets.map(b => (
              <g key={b.id}>
                <rect x={b.x - 2.2} y={b.y - 43} width="4.4" height="47" rx="2.2" fill={s.overcharged ? '#c77dff' : '#8be9ff'} opacity="0.9"
                  style={{ filter: `drop-shadow(0 0 9px ${s.overcharged ? '#c77dff' : '#00d4ff'})` }} />
                <rect x={b.x - 0.8} y={b.y - 43} width="1.6" height="18" fill="#fff" opacity="0.95" />
                <rect x={b.x - 5.5} y={b.y - 18} width="11" height="2" rx="1" fill={s.overcharged ? '#ff2e9d' : '#00d4ff'} opacity="0.55" />
              </g>
            ))}

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

            <Ship x={s.shipX} over={s.overcharged} shield={s.shield} vx={s.shipVx} t={s.gameTime} />
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
          </div>
        </div>
      )}

      {/* ── tehlike vignette: hedef tabana yaklaşınca kalp atışı gibi kızarır ── */}
      {s.danger > 0.15 && (
        <div className="absolute inset-0 pointer-events-none z-24"
          style={{
            background: `radial-gradient(ellipse at center, transparent 42%, rgba(255,46,99,${0.18 + s.danger * 0.32}) 100%)`,
            opacity: 0.55 + Math.sin(s.gameTime * 0.018) * 0.35 * s.danger,
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

      <Hud s={s} onPause={api.pause} />

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
        </div>

        {/* lane-snap steering + fire */}
        <div className="flex items-center gap-2">
          <button
            onPointerDown={holdLeftDown} onPointerUp={endHold} onPointerCancel={endHold} onPointerLeave={endHold} onClick={() => api.stepLane(-1)}
            className="glass rounded-xl h-[60px] w-[68px] flex flex-col items-center justify-center active:scale-95 transition-transform touch-none select-none"
            style={guideLeft ? { border: '1.4px solid #00ff9d', boxShadow: '0 0 18px rgba(0,255,157,0.5)' } : undefined}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 5px ${guideLeft ? '#00ff9d' : '#00d4ff'})` }}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span className="font-mono-tech text-[6.5px] tracking-[0.14em] mt-0.5" style={{ color: guideLeft ? '#00ff9d' : 'rgba(255,255,255,0.4)' }}>
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 5px ${guideRight ? '#00ff9d' : '#00d4ff'})` }}>
              <path d="M9 18l6-6-6-6" />
            </svg>
            <span className="font-mono-tech text-[6.5px] tracking-[0.14em] mt-0.5" style={{ color: guideRight ? '#00ff9d' : 'rgba(255,255,255,0.4)' }}>
              {guideRight ? 'HEDEF' : 'ŞERİT'}
            </span>
          </button>
        </div>
      </div>

      {crt && <div className="crt absolute inset-0 pointer-events-none z-40" />}
    </div>
  );
}
