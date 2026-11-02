/*
 * Significant figures for the units lab (components/widgets/SigFigLab.tsx): which digits of a written number are
 * significant and why, and rounding the result of × and ÷ (fewest significant figures) and of + and −
 * (fewest decimal places). Exact decimal arithmetic with BigInt, so 7.8525 never becomes 7.85249999.
 * Numbers are written with «.» and, in scientific notation, «e»: «1.20e3» is 1.20 × 10³.
 */

export type Rule = 'nonzero' | 'between' | 'leading' | 'trailingPoint' | 'trailingWhole';

export const RULE_SIG: Record<Rule, boolean> = { nonzero: true, between: true, leading: false, trailingPoint: true, trailingWhole: false };

/** Why a digit counts or not (Rich markup). */
export const RULE_TEXT: Record<Rule, string> = {
  nonzero: 'رقم‌های غیرصفر همیشه بامعنا هستند.',
  between: 'صفری که بین دو رقم غیرصفر نشسته بامعناست.',
  leading: 'صفرهای اول عدد بامعنا نیستند؛ فقط جای ممیز را نشان می‌دهند.',
  trailingPoint: 'صفرهای آخر عددی که ممیز دارد بامعنا هستند؛ یعنی اندازه‌گیری تا همان رقم دقیق بوده است.',
  trailingWhole: 'صفرهای آخر عدد صحیحِ بی‌ممیز را بامعنا حساب نمی‌کنیم، چون معلوم نیست اندازه‌گیر آن‌ها را خوانده یا فقط جای خالی را پر کرده است. اگر بامعنا باشند، عدد را با نمادگذاری علمی می‌نویسند.',
};

export const SCI_TEXT = 'در نمادگذاری علمی فقط رقم‌های ضریب شمرده می‌شوند؛ توان ۱۰ فقط جای ممیز را عوض می‌کند.';

export interface Digit {
  ch: string;
  rule: Rule;
  sig: boolean;
}

export interface Written {
  /** The digits (of the coefficient, in scientific notation), in order. */
  digits: Digit[];
  /** How many digits come before the decimal point; null when there is none. */
  point: number | null;
  /** The power of ten in scientific notation, or null. */
  exp: number | null;
}

/** «0.00450», «1200», «1.20e3» → every digit with the rule that decides it. */
export function analyse(src: string): Written {
  const [mant, e] = src.split('e');
  const m = mant.replace(/^[-+]/, '');
  const i = m.indexOf('.');
  const ds = [...m.replace('.', '')];
  const point = i < 0 ? null : i;
  const first = ds.findIndex((d) => d !== '0');
  const last = ds.length - 1 - [...ds].reverse().findIndex((d) => d !== '0');
  const digits = ds.map((ch, k): Digit => {
    const rule: Rule =
      ch !== '0' ? 'nonzero' : first < 0 || k < first ? 'leading' : k < last ? 'between' : point !== null ? 'trailingPoint' : 'trailingWhole';
    return { ch, rule, sig: RULE_SIG[rule] };
  });
  return { digits, point, exp: e === undefined ? null : Number(e) };
}

export const countSig = (src: string) => analyse(src).digits.filter((d) => d.sig).length;

/** Decimal places as written; in scientific notation the power moves them: «1.20e3» has −1. */
export function decimalsWritten(src: string): number {
  const [mant, e] = src.split('e');
  const i = mant.indexOf('.');
  return (i < 0 ? 0 : mant.length - i - 1) - (e === undefined ? 0 : Number(e));
}

/** A written number as TeX with the Persian decimal sign and its trailing zeros kept: «1.20e3» → 1{\dec}20\times10^{3}. */
export function writtenTex(src: string): string {
  const [mant, e] = src.split('e');
  const m = mant.replace('.', '{\\dec}');
  return e === undefined ? m : `${m}\\times10^{${Number(e)}}`;
}

/* ───── exact decimals ───── */

/** value = n / 10^s */
export interface Dec {
  n: bigint;
  s: number;
}

export function dec(src: string): Dec {
  const [mant, e] = src.split('e');
  const neg = mant.startsWith('-');
  const m = mant.replace(/^[-+]/, '');
  const i = m.indexOf('.');
  let s = i < 0 ? 0 : m.length - i - 1;
  let n = BigInt(m.replace('.', '') || '0');
  let ex = e === undefined ? 0 : Number(e);
  if (ex >= 0) {
    const drop = Math.min(s, ex);
    s -= drop;
    ex -= drop;
    n *= 10n ** BigInt(ex);
  } else s += -ex;
  return { n: neg ? -n : n, s };
}

const align = (a: Dec, b: Dec): [bigint, bigint, number] => {
  const s = Math.max(a.s, b.s);
  return [a.n * 10n ** BigInt(s - a.s), b.n * 10n ** BigInt(s - b.s), s];
};
export const add = (a: Dec, b: Dec): Dec => {
  const [x, y, s] = align(a, b);
  return { n: x + y, s };
};
export const sub = (a: Dec, b: Dec): Dec => {
  const [x, y, s] = align(a, b);
  return { n: x - y, s };
};
export const mul = (a: Dec, b: Dec): Dec => ({ n: a.n * b.n, s: a.s + b.s });

/** a ÷ b to `places` decimals, rounded half up, like a calculator's last digit. */
export function div(a: Dec, b: Dec, places: number): Dec {
  const num = a.n * 10n ** BigInt(b.s + places + 1);
  const den = b.n * 10n ** BigInt(a.s);
  const q = num / den;
  return { n: (q + (q >= 0n ? 5n : -5n)) / 10n, s: places };
}

/** Round half up to `places` decimals (negative: to tens, hundreds…), keeping the zeros that precision needs. */
export function roundTo(d: Dec, places: number): Dec {
  if (places >= d.s) return { n: d.n * 10n ** BigInt(places - d.s), s: places };
  const drop = 10n ** BigInt(d.s - places);
  const sign = d.n < 0n ? -1n : 1n;
  const q = (d.n * sign + drop / 2n) / drop;
  return places >= 0 ? { n: q * sign, s: places } : { n: q * sign * 10n ** BigInt(-places), s: 0 };
}

/** The decimal as written with «.», all its decimals kept: {785, 2} → «7.85». */
export function show(d: Dec): string {
  const neg = d.n < 0n;
  let t = (neg ? -d.n : d.n).toString();
  if (d.s > 0) {
    t = t.padStart(d.s + 1, '0');
    t = `${t.slice(0, -d.s)}.${t.slice(-d.s)}`;
  }
  return (neg ? '-' : '') + t;
}

/** As a calculator shows it: no zeros after the last decimal digit. */
export const showRaw = (d: Dec) => {
  const t = show(d);
  return t.includes('.') ? t.replace(/0+$/, '').replace(/\.$/, '') : t;
};

/** The power of ten of the first non-zero digit: 6.384 → 0, 0.9175 → −1, 102.6 → 2. */
export function leadExp(d: Dec): number {
  const t = (d.n < 0n ? -d.n : d.n).toString();
  return t.length - 1 - d.s;
}

/* ───── rounding results ───── */

export type Op = '×' | '÷' | '+' | '−';

export interface RoundProblem {
  id: string;
  op: Op;
  terms: string[];
  /** Where the numbers come from (Rich markup). */
  context: string;
}

export const ROUND_PROBLEMS: RoundProblem[] = [
  { id: 'area', op: '×', terms: ['4.56', '1.4'], context: 'مساحت کارتی به طول $4{\\dec}56\\,\\mathrm{cm}$ و عرض $1{\\dec}4\\,\\mathrm{cm}$' },
  { id: 'rope', op: '+', terms: ['12.52', '3.1'], context: 'طول دو طناب پشت هم: $12{\\dec}52\\,\\mathrm{m}$ و $3{\\dec}1\\,\\mathrm{m}$' },
  { id: 'rho', op: '÷', terms: ['25.3', '9.2'], context: 'چگالی جسمی با جرم $25{\\dec}3\\,\\mathrm{g}$ و حجم $9{\\dec}2\\,\\mathrm{cm^3}$' },
  { id: 'cut', op: '−', terms: ['105.3', '2.68'], context: 'از لوله‌ای به طول $105{\\dec}3\\,\\mathrm{cm}$ تکه‌ای به طول $2{\\dec}68\\,\\mathrm{cm}$ بریده شده' },
  { id: 'circle', op: '×', terms: ['2.50', '3.141'], context: 'محیط دایره‌ای به قطر $2{\\dec}50\\,\\mathrm{cm}$ با $\\pi \\approx 3{\\dec}141$' },
  { id: 'mix', op: '+', terms: ['0.75', '2.1', '10.346'], context: 'جرم سه نمونه که روی ترازوهای مختلف وزن شده‌اند (گرم)' },
  { id: 'speed', op: '÷', terms: ['8.3', '2.75'], context: 'تندی متوسط: مسافت $8{\\dec}3\\,\\mathrm{m}$ در زمان $2{\\dec}75\\,\\mathrm{s}$' },
  { id: 'diff', op: '−', terms: ['50.07', '49.9'], context: 'اختلاف جرم دو سکه که با دو ترازوی مختلف وزن شده‌اند (گرم)' },
  { id: 'sheet', op: '×', terms: ['0.050', '12.34'], context: 'حجم ورقه‌ای به ضخامت $0{\\dec}050\\,\\mathrm{cm}$ و مساحت $12{\\dec}34\\,\\mathrm{cm^2}$' },
  { id: 'walk', op: '+', terms: ['20.4', '1.322', '83'], context: 'مسافت سه تکهٔ یک مسیر پیاده‌روی (متر)' },
];

export const isProduct = (op: Op) => op === '×' || op === '÷';

/** What a calculator shows for the problem (division to 7 decimals). */
export function rawResult(p: RoundProblem): Dec {
  const ds = p.terms.map(dec);
  if (p.op === '÷') return div(ds[0], ds[1], 7);
  return ds.slice(1).reduce((acc, d) => (p.op === '×' ? mul(acc, d) : p.op === '+' ? add(acc, d) : sub(acc, d)), ds[0]);
}

export interface Target {
  /** Significant figures (× ÷) or decimal places (+ −) of each term. */
  per: number[];
  /** The fewest of them: what the answer keeps. */
  need: number;
  /** Terms that set the precision (the ones with the fewest). */
  limiting: number[];
  /** Decimal place of the last digit to keep. */
  places: number;
  answer: string;
}

export function target(p: RoundProblem): Target {
  const raw = rawResult(p);
  const per = p.terms.map(isProduct(p.op) ? countSig : decimalsWritten);
  const need = Math.min(...per);
  const limiting = per.flatMap((x, i) => (x === need ? [i] : []));
  const places = isProduct(p.op) ? need - 1 - leadExp(raw) : need;
  return { per, need, limiting, places, answer: show(roundTo(raw, places)) };
}

/** The digits a calculator shows, each with its decimal place (tens −1, units 0, tenths 1…). */
export function rawDigits(p: RoundProblem): { ch: string; place: number; point: boolean }[] {
  const t = showRaw(rawResult(p));
  const i = t.indexOf('.');
  const ints = i < 0 ? t.length : i;
  return [...t.replace('.', '')].map((ch, k) => ({ ch, place: k - ints + 1, point: i >= 0 && k === ints - 1 }));
}

/** The raw result rounded at the digit the learner picked. */
export const roundedAt = (p: RoundProblem, place: number) => show(roundTo(rawResult(p), place));

/* ───── counting ───── */

export interface CountProblem {
  n: string;
  /** Unit TeX after the number, if any. */
  unit?: string;
}

export const COUNT_PROBLEMS: CountProblem[] = [
  { n: '4.56', unit: '\\mathrm{g}' },
  { n: '205', unit: '\\mathrm{m}' },
  { n: '0.0045', unit: '\\mathrm{kg}' },
  { n: '2.50', unit: '\\mathrm{cm}' },
  { n: '100.0', unit: '\\mathrm{mL}' },
  { n: '0.070', unit: '\\mathrm{mm}' },
  { n: '1200', unit: '\\mathrm{m}' },
  { n: '1.20e3', unit: '\\mathrm{m}' },
  { n: '3.0080', unit: '\\mathrm{g}' },
  { n: '0.000300', unit: '\\mathrm{s}' },
  { n: '6.02e23' },
  { n: '5.0e-4', unit: '\\mathrm{m}' },
];
