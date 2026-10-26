// Deck layout in deck units: the turntable is 1000 x 640, top-down.
export const DECK = { w: 1000, h: 640 };
export const CENTER = { x: 300, y: 320 }; // spindle
export const PLATTER_R = 262;
export const RECORD_R = 240;
export const LABEL_R = 80;
export const PIVOT = { x: 830, y: 96 }; // tonearm pivot
export const ARM_L = 482; // pivot to stylus
export const GROOVE = { out: 228, in: 112 }; // lead-in and run-out radii

/** Deck units to container query units (the deck is 1000 units wide). */
export const u = (n: number) => `${n / 10}cqw`;

export const circle = (c: { x: number; y: number }, r: number) => ({
  left: u(c.x - r),
  top: u(c.y - r),
  width: u(2 * r),
  height: u(2 * r),
});

/** Arm rotation in degrees (clockwise from pointing straight down) that puts the stylus at radius r. */
export function armAngleFor(r: number) {
  const dx = CENTER.x - PIVOT.x;
  const dy = CENTER.y - PIVOT.y;
  const d = Math.hypot(dx, dy);
  const off = Math.acos((d * d + ARM_L * ARM_L - r * r) / (2 * d * ARM_L));
  return ((Math.atan2(dy, dx) - off) * 180) / Math.PI - 90;
}

/** Arm rotation for song progress 0..1, lead-in to run-out. */
export const armAngleAt = (p: number) =>
  armAngleFor(GROOVE.out - (GROOVE.out - GROOVE.in) * Math.min(1, Math.max(0, p || 0)));
