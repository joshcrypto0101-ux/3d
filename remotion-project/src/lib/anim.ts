export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 → 1 as `f` goes from `a` to `b` (clamped). */
export const seg = (f: number, a: number, b: number) => (b === a ? (f >= b ? 1 : 0) : clamp01((f - a) / (b - a)));
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
/** Smooth bump: 0 at t=0 and t=1, 1 at t=0.5. */
export const bump = (t: number) => Math.sin(Math.PI * clamp01(t));
export const fadeInOut = (f: number, start: number, end: number, fade: number) =>
  Math.min(seg(f, start, start + fade), 1 - seg(f, end - fade, end));
