import { compile, ExprError, tidy } from './expr';

/*
 * Sequence lab maths (screens/SeqLab.tsx): terms of a rule in n, the arithmetic/geometric test, sums and
 * "which term equals m?". Pure functions, no AI; everything runs on the phone.
 */

export type Rule = (n: number) => number;

/** Compile a general term typed in n, e.g. «2n+1» or «3*2^(n-1)». Throws ExprError with a Persian message. */
export function compileRule(src: string): { fn: Rule; tex: string } {
  const c = compile(src);
  const other = [...c.vars].filter((v) => v !== 'n');
  if (other.length) throw new ExprError(`در جملهٔ عمومی فقط از n استفاده کن (نه ${other.join('، ')}).`);
  return { fn: (n) => c.fn(0, { n }), tex: c.tex };
}

/** a_1 … a_count. */
export function termsOf(fn: Rule, count: number): number[] {
  return Array.from({ length: count }, (_, i) => tidy(fn(i + 1)));
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

export type Kind =
  | { type: 'const'; value: number }
  | { type: 'arith'; d: number }
  | { type: 'geo'; q: number }
  | { type: 'none'; why: string };

/**
 * Is the sequence arithmetic (same difference) or geometric (same ratio)? Judged on the terms shown, at
 * least three. A constant sequence is both (d = 0; q = 1 when it is not zero).
 */
export function kindOf(t: number[]): Kind {
  if (t.length < 3) return { type: 'none', why: 'برای تشخیص دست‌کم سه جمله لازم است.' };
  if (t.some((x) => !Number.isFinite(x))) return { type: 'none', why: 'بعضی جمله‌ها تعریف نشده‌اند.' };
  const diffs = t.slice(1).map((x, i) => x - t[i]);
  if (diffs.every((d) => close(d, 0))) return { type: 'const', value: t[0] };
  if (diffs.every((d) => close(d, diffs[0]))) return { type: 'arith', d: tidy(diffs[0]) };
  if (t.every((x) => x !== 0)) {
    const ratios = t.slice(1).map((x, i) => x / t[i]);
    if (ratios.every((q) => close(q, ratios[0]))) return { type: 'geo', q: tidy(ratios[0]) };
  }
  return { type: 'none', why: 'نه فاصلهٔ جمله‌ها ثابت است و نه نسبتشان.' };
}

/** a_{n+1} − a_n for the terms shown. */
export const diffsOf = (t: number[]) => t.slice(1).map((x, i) => tidy(x - t[i]));

/** a_{n+1} / a_n, NaN where a term is zero. */
export const ratiosOf = (t: number[]) => t.slice(1).map((x, i) => (t[i] === 0 ? NaN : tidy(x / t[i])));

export const sumOf = (t: number[]) => tidy(t.reduce((a, b) => a + b, 0));

/** The first n (1 … max) with a_n = m, or null. */
export function indexOf(fn: Rule, m: number, max = 2000): number | null {
  for (let n = 1; n <= max; n++) {
    const v = fn(n);
    if (Number.isFinite(v) && close(v, m)) return n;
  }
  return null;
}

/** General term of an arithmetic or geometric sequence from its first term, as TeX. */
export function generalTex(k: Kind, a1: number, num: (v: number) => string): string | null {
  if (k.type === 'arith') {
    // a_n = a1 + (n-1)d = dn + (a1 - d)
    const b = tidy(a1 - k.d);
    const lead = k.d === 1 ? 'n' : k.d === -1 ? '-n' : `${num(k.d)}n`;
    const tail = b === 0 ? '' : b > 0 ? ` + ${num(b)}` : ` - ${num(-b)}`;
    return `a_n = ${lead}${tail}`;
  }
  if (k.type === 'geo') {
    const q = k.q < 0 ? `\\left(${num(k.q)}\\right)` : num(k.q);
    const lead = a1 === 1 ? '' : a1 === -1 ? '-' : `${num(a1)} \\times `;
    return `a_n = ${lead}${q}^{\\,n-1}`;
  }
  if (k.type === 'const') return `a_n = ${num(k.value)}`;
  return null;
}
