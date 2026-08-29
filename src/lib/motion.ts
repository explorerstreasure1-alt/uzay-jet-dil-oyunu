/* motion helpers — reduceMotion’a saygılı */
export const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const dur = (v: string) => (prefersReduced() ? '0s' : v);
