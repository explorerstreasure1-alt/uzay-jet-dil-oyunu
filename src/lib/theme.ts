/* ══════════════════════════════════════════════════════════════
   THEME TOKENS — Holographic Subconscious v2.1
   Tek kaynak: renk, cam, gölge, radius, motion.
   Hard-code hex dağınıklığını bitirir.
   ══════════════════════════════════════════════════════════════ */

export const NEON = {
  cyan: '#00d4ff',
  cyanSoft: '#00e5ff',
  aqua: '#00ffa3',
  aquaSoft: '#7af7ff',
  magenta: '#ff2e63',
  pink: '#ff2ea6',
  gold: '#ffd166',
  goldSoft: '#ffb300',
  purple: '#c77dff',
  violet: '#9d4edd',
} as const;

export const HEAT = {
  ice: { core: '#8be9ff', glow: '#00b3ff', deep: '#0a3a66' },
  amber: { core: '#ffc247', glow: '#ff9500', deep: '#663c00' },
  crimson: { core: '#ff4d6d', glow: '#ff0044', deep: '#66001c' },
} as const;

export const BG = {
  base: '#040a1e',
  deep: '#060d26',
  overlay: 'rgba(3,7,20,0.86)',
} as const;

export const GLASS = {
  bg: 'rgba(255,255,255,0.045)',
  border: 'rgba(255,255,255,0.14)',
  activeBg: (c: string) => `linear-gradient(135deg, ${c}38, ${c}18)`,
  activeBorder: (c: string) => c,
  shadow: (c: string) => `0 0 16px ${c}44, inset 0 1px 0 rgba(255,255,255,0.14)`,
} as const;

export const RADIUS = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const MOTION = {
  fast: '0.11s',
  medium: '0.22s',
  slow: '0.45s',
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
  pulse: '0.9s',
} as const;

export const TYPO = {
  display: "'Orbitron', sans-serif",
  mono: "'Share Tech Mono', ui-monospace, monospace",
  pixel: "'VT323', monospace",
} as const;
