/*
 * Probability lab maths (screens/ProbLab.tsx): a closed set of textbook experiments (coins, dice, a bag of
 * marbles), the exact probability of an event by counting equally likely outcomes, and random trials to
 * compare relative frequency with it. Pure functions, no AI; everything runs on the phone.
 */

export type Exp =
  | { kind: 'coin'; count: 1 | 2 | 3 }
  | { kind: 'die'; count: 1 | 2 }
  | { kind: 'urn'; red: number; blue: number; draws: 1 | 2; replace: boolean };

/** One outcome: coin faces (1 = رو, 0 = پشت), die faces 1–6, or marble colours (1 = red, 0 = blue). */
export type Outcome = number[];

export interface EventDef {
  id: string;
  label: string;
  test: (o: Outcome) => boolean;
}

const sum = (o: Outcome) => o.reduce((a, b) => a + b, 0);
const PRIMES = new Set([2, 3, 5]);

export function eventsFor(e: Exp): EventDef[] {
  if (e.kind === 'coin') {
    if (e.count === 1) return [{ id: 'head', label: 'رو بیاید', test: (o) => o[0] === 1 }];
    return [
      { id: 'all', label: 'همه رو بیایند', test: (o) => o.every((x) => x === 1) },
      { id: 'one', label: 'دقیقاً یکی رو بیاید', test: (o) => sum(o) === 1 },
      { id: 'some', label: 'دست‌کم یکی رو بیاید', test: (o) => sum(o) >= 1 },
    ];
  }
  if (e.kind === 'die') {
    if (e.count === 1)
      return [
        { id: 'even', label: 'عدد زوج بیاید', test: (o) => o[0] % 2 === 0 },
        { id: 'prime', label: 'عدد اول بیاید', test: (o) => PRIMES.has(o[0]) },
        { id: 'gt4', label: 'عدد بزرگ‌تر از ۴ بیاید', test: (o) => o[0] > 4 },
        { id: 'six', label: 'عدد ۶ بیاید', test: (o) => o[0] === 6 },
      ];
    return [
      { id: 'sum7', label: 'مجموع دو عدد ۷ شود', test: (o) => sum(o) === 7 },
      { id: 'double', label: 'دو عدد برابر بیایند', test: (o) => o[0] === o[1] },
      { id: 'sum10', label: 'مجموع دست‌کم ۱۰ شود', test: (o) => sum(o) >= 10 },
      { id: 'six', label: 'دست‌کم یک ۶ بیاید', test: (o) => o.includes(6) },
    ];
  }
  if (e.draws === 1) return [{ id: 'red', label: 'مهره قرمز باشد', test: (o) => o[0] === 1 }];
  return [
    { id: 'both', label: 'هر دو قرمز باشند', test: (o) => sum(o) === 2 },
    { id: 'mixed', label: 'یکی قرمز و یکی آبی باشد', test: (o) => sum(o) === 1 },
    { id: 'some', label: 'دست‌کم یکی قرمز باشد', test: (o) => sum(o) >= 1 },
  ];
}

/**
 * Every equally likely outcome. Marbles are told apart by number (red ones first), so each draw of a
 * marble is equally likely. Two draws without putting back are unordered pairs, as the book counts them
 * with «انتخاب»; with putting back they are ordered pairs.
 */
export function sampleSpace(e: Exp): Outcome[] {
  if (e.kind === 'coin') return Array.from({ length: 2 ** e.count }, (_, i) => Array.from({ length: e.count }, (_, k) => (i >> (e.count - 1 - k)) & 1));
  if (e.kind === 'die') {
    const faces = [1, 2, 3, 4, 5, 6];
    return e.count === 1 ? faces.map((f) => [f]) : faces.flatMap((a) => faces.map((b) => [a, b]));
  }
  const n = e.red + e.blue;
  const colour = (i: number) => (i < e.red ? 1 : 0);
  const out: Outcome[] = [];
  if (e.draws === 1) for (let i = 0; i < n; i++) out.push([colour(i)]);
  else if (e.replace) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push([colour(i), colour(j)]);
  else for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([colour(i), colour(j)]);
  return out;
}

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** n(A), n(S) and P(A) as a reduced fraction. */
export function exact(e: Exp, ev: EventDef): { nA: number; nS: number; num: number; den: number; p: number } {
  const S = sampleSpace(e);
  const nA = S.filter(ev.test).length;
  const nS = S.length;
  const g = gcd(nA, nS) || 1;
  return { nA, nS, num: nA / g, den: nS / g, p: nS ? nA / nS : 0 };
}

/** A small seeded random generator (mulberry32), so tests can repeat a run. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One random trial, done the way the experiment is done by hand (not by picking from the list above). */
export function trial(e: Exp, rnd: () => number = Math.random): Outcome {
  const pick = (n: number) => Math.floor(rnd() * n);
  if (e.kind === 'coin') return Array.from({ length: e.count }, () => (rnd() < 0.5 ? 1 : 0));
  if (e.kind === 'die') return Array.from({ length: e.count }, () => pick(6) + 1);
  const n = e.red + e.blue;
  const first = pick(n);
  if (e.draws === 1) return [first < e.red ? 1 : 0];
  let second = pick(e.replace ? n : n - 1);
  if (!e.replace && second >= first) second += 1;
  return [first < e.red ? 1 : 0, second < e.red ? 1 : 0];
}

/** Whether the experiment can be run at all (a bag needs enough marbles for the draws). */
export function playable(e: Exp): boolean {
  if (e.kind !== 'urn') return true;
  const n = e.red + e.blue;
  return e.draws === 1 || e.replace ? n >= 1 : n >= 2;
}

/** How n(S) is counted, in the book's words, as TeX for the result card. */
export function countTex(e: Exp): string {
  if (e.kind === 'coin') return e.count === 1 ? 'n(S) = 2' : `n(S) = 2^{${e.count}} = ${2 ** e.count}`;
  if (e.kind === 'die') return e.count === 1 ? 'n(S) = 6' : 'n(S) = 6 \\times 6 = 36';
  const n = e.red + e.blue;
  if (e.draws === 1) return `n(S) = ${n}`;
  return e.replace ? `n(S) = ${n} \\times ${n} = ${n * n}` : `n(S) = \\binom{${n}}{2} = ${(n * (n - 1)) / 2}`;
}
