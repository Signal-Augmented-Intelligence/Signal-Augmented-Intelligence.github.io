/**
 * Falling-formula positions for the home hero's night phase, computed once at build time.
 * Positions are percentages of the field beside the lab name so the layout scales with the page width.
 */
const FIELD_W = 850;
const FIELD_H = 412;

/** Night phase length before the hero fades to the photo hero (ms). */
export const NIGHT_MS = 6000;

const FALLING = [
  'X(ω) = ∫ x(t) e^{−jωt} dt', 'softmax(QKᵀ/√d) V', 'y[n] = Σ h[k] x[n−k]', 'P(wₜ | w₁:ₜ₋₁)', 'SNR = 10 log₁₀ Pₛ/Pₙ',
  'H(X) = −Σ p log p', 'G = ξ / (1 + ξ)', '∂L / ∂θ', 'σ(Wx + b)',
];
/** Launch order alternates distant cells of the 3 x 3 start grid. */
const ORDER = [0, 8, 4, 2, 6, 1, 7, 3, 5];
const CYCLE_S = 12;

let seed = 7;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
const pct = (px: number, total: number) => `${((px / total) * 100).toFixed(2)}%`;

export type SkyItem = { text: string; left: string; top: string; size: number; duration: number; delay: number };

const FALL_X = -200;       // keyframes "fall": total travel
const FALL_Y = 200;
const VISIBLE = 0.45;      // share of the cycle a formula is on screen
const GAP = 14;            // minimum space kept between two formulas (px)

type Placed = { x: number; y: number; w: number; h: number; delay: number };

/** Box of a formula at time t (s), or null while it is hidden. */
function boxAt(m: Placed, t: number) {
  const phase = ((((t - m.delay) % CYCLE_S) + CYCLE_S) % CYCLE_S) / CYCLE_S;
  if (phase >= VISIBLE) return null;
  const k = phase / VISIBLE;
  return { x: m.x + FALL_X * k, y: m.y + FALL_Y * k, w: m.w, h: m.h };
}

/** True when the two formulas ever come closer than GAP while both are on screen. */
function collides(a: Placed, b: Placed) {
  for (let t = 0; t < CYCLE_S; t += 0.05) {
    const p = boxAt(a, t);
    const q = boxAt(b, t);
    if (p && q && p.x < q.x + q.w + GAP && q.x < p.x + p.w + GAP && p.y < q.y + q.h + GAP && q.y < p.y + p.h + GAP) return true;
  }
  return false;
}

/**
 * Falling formulas, staggered over one cycle. Start points are drawn at random (fixed seed)
 * and redrawn until no two formulas overlap at any moment of the cycle.
 */
const placed: Placed[] = [];
export const METEORS: SkyItem[] = FALLING.map((text, i) => {
  const size = 18 + rand() * 4;
  const w = text.length * size * 0.55 + 40;   // text plus the start of its trail
  const h = size * 1.3;
  const delay = -(ORDER.indexOf(i) / FALLING.length) * CYCLE_S;
  let m: Placed = { x: 0, y: 0, w, h, delay };
  for (let tries = 0; tries < 2000; tries++) {
    m = { x: 260 + rand() * 360, y: 8 + rand() * 190, w, h, delay };
    if (!placed.some((o) => collides(m, o))) break;
  }
  placed.push(m);
  return { text, left: pct(m.x, FIELD_W), top: pct(m.y, FIELD_H), size, duration: CYCLE_S, delay };
});

/** Photo carousel interval after the night phase (ms). */
export const SLIDE_MS = 6000;
