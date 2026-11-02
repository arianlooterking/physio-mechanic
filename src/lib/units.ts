import { toEn } from './digits';

/*
 * Unit lab maths (screens/UnitLab.tsx and the فیزیک ۱ widgets): SI prefixes, chain conversion of lengths,
 * areas and volumes, scientific notation, order of magnitude, the precision of a reading and density.
 * Pure functions, no AI; everything runs on the phone.
 */

export interface Prefix {
  sym: string;
  /** Persian name, as in the فیزیک ۱ table. */
  name: string;
  exp: number;
}

/** The prefixes of the فیزیک ۱ table, largest first. */
export const PREFIXES: Prefix[] = [
  { sym: 'T', name: 'ترا', exp: 12 },
  { sym: 'G', name: 'گیگا', exp: 9 },
  { sym: 'M', name: 'مگا', exp: 6 },
  { sym: 'k', name: 'کیلو', exp: 3 },
  { sym: '', name: '', exp: 0 },
  { sym: 'd', name: 'دسی', exp: -1 },
  { sym: 'c', name: 'سانتی', exp: -2 },
  { sym: 'm', name: 'میلی', exp: -3 },
  { sym: 'μ', name: 'میکرو', exp: -6 },
  { sym: 'n', name: 'نانو', exp: -9 },
  { sym: 'p', name: 'پیکو', exp: -12 },
];

export const prefixOf = (exp: number): Prefix => {
  const p = PREFIXES.find((x) => x.exp === exp);
  if (!p) throw new Error(`no prefix 10^${exp}`);
  return p;
};

/**
 * Convert a value between two prefixes of the same unit raised to `power` (1 length, 2 area, 3 volume):
 * 1 cm² = (10⁻²)² m² = 10⁻⁴ m². Exact for the usual school sizes because the power of ten is applied once.
 */
export function convert(value: number, fromExp: number, toExp: number, power: 1 | 2 | 3 = 1): number {
  const shift = (fromExp - toExp) * power;
  // Multiplying by 10^-k loses digits (0.1 is not exact); dividing by 10^k does not.
  const out = shift >= 0 ? value * 10 ** shift : value / 10 ** -shift;
  return Number(out.toPrecision(12));
}

/** The power of ten that a chain of conversion factors adds, e.g. km → cm is 10⁵. */
export const conversionPower = (fromExp: number, toExp: number, power: 1 | 2 | 3 = 1) => (fromExp - toExp) * power;

/** Time units the book converts between, in seconds. */
export const TIME_UNITS = [
  { id: 's', name: 'ثانیه', s: 1 },
  { id: 'min', name: 'دقیقه', s: 60 },
  { id: 'h', name: 'ساعت', s: 3600 },
  { id: 'day', name: 'شبانه‌روز', s: 86400 },
] as const;

/** Speed: km/h ↔ m/s (÷ 3.6 and × 3.6). */
export const kmhToMs = (v: number) => Number((v / 3.6).toPrecision(12));
export const msToKmh = (v: number) => Number((v * 3.6).toPrecision(12));

/** a × 10^e with 1 ≤ |a| < 10 (0 → 0 × 10⁰). */
export function scientific(v: number): { a: number; e: number } {
  if (v === 0 || !Number.isFinite(v)) return { a: v, e: 0 };
  let e = Math.floor(Math.log10(Math.abs(v)));
  let a = Number((v / 10 ** e).toPrecision(12));
  // log10 can land just below an integer (log10(1000) = 2.9999…).
  if (Math.abs(a) >= 10) {
    a = Number((a / 10).toPrecision(12));
    e += 1;
  }
  return { a, e };
}

/**
 * Order of magnitude as the book teaches it: write the number in scientific notation; if the coefficient is
 * 5 or more, round up to the next power of ten.
 */
export function orderOfMagnitude(v: number): number {
  const { a, e } = scientific(Math.abs(v));
  return a >= 5 ? e + 1 : e;
}

/** Parse what a student types: Persian or Latin digits, «٫» or «.» as the decimal point, a leading minus. */
export function parseReading(src: string): number | null {
  const s = toEn(src).trim().replace(/[٫,]/g, '.').replace(/[−–]/g, '-');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return Number(s);
}

/** Decimal places of a typed reading: «12.30» → 2. The last written digit is the uncertain one. */
export function decimalsOf(src: string): number {
  const s = toEn(src).trim().replace(/[٫,]/g, '.');
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

/**
 * The precision of a reading on an instrument with smallest division `step` (a ruler in mm, a scale in 0.1 g):
 * the value is rounded to that step and reported with as many decimals as the step has.
 */
export function readWithPrecision(value: number, step: number): { value: number; decimals: number } {
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const rounded = Math.round(value / step) * step;
  return { value: Number(rounded.toFixed(decimals)), decimals };
}

/** Density ρ = m / V in g/cm³, and the same in kg/m³ (× 1000). */
export function density(massG: number, volumeCm3: number): { gcm3: number; kgm3: number } {
  const g = massG / volumeCm3;
  return { gcm3: Number(g.toPrecision(12)), kgm3: Number((g * 1000).toPrecision(12)) };
}

/** Densities from the book's table (g/cm³), used by the density lab and its questions. */
export const DENSITIES: { name: string; rho: number }[] = [
  { name: 'چوب بلوط', rho: 0.7 },
  { name: 'یخ', rho: 0.92 },
  { name: 'آب', rho: 1 },
  { name: 'آلومینیم', rho: 2.7 },
  { name: 'آهن', rho: 7.9 },
  { name: 'مس', rho: 8.9 },
  { name: 'سرب', rho: 11.3 },
  { name: 'جیوه', rho: 13.6 },
  { name: 'طلا', rho: 19.3 },
];

/** The closest material in the table to a density, and whether it floats on water. */
export function materialFor(rho: number): { name: string; rho: number; floats: boolean } {
  const best = DENSITIES.reduce((b, d) => (Math.abs(d.rho - rho) < Math.abs(b.rho - rho) ? d : b));
  return { ...best, floats: rho < 1 };
}
