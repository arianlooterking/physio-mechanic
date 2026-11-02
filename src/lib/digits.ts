const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';

/** Latin digits → Persian digits. (The UI font already draws digits in Persian; this is for plain-text contexts.) */
export function toFa(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => FA[Number(d)]);
}

/** Persian/Arabic digits → Latin digits. */
export function toEn(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)));
}

/** Format a number the Persian way: «٫» as decimal separator, «٬» for thousands. */
export function fmt(n: number, maxFraction = 2): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  const raw = abs.toFixed(maxFraction);
  // Trim trailing zeros of the fraction only (never of the integer part: 10 stays 10).
  const fixed = raw.includes('.') ? raw.replace(/\.?0+$/, '') : raw;
  const [int, frac] = fixed.split('.');
  const intGrouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const body = intGrouped + (frac ? '٫' + frac : '');
  // Isolate negative numbers so the minus sign stays on the left inside Persian text.
  return fixed === '0' || !sign ? body : `⁦${sign}${body}⁩`;
}

/** The same number as TeX (Persian decimal separator, ASCII minus), for use inside $...$. */
export function texOf(n: number, maxFraction = 2): string {
  return fmt(n, maxFraction).replace(/[⁦⁩٬]/g, '').replace('٫', '{\\dec}').replace('−', '-');
}

/** Percent with the sign on the left, as in Persian; isolated so the surrounding text cannot flip it. */
export function pct(n: number): string {
  return `⁦٪${fmt(Math.round(n * 100), 0)}⁩`;
}

/**
 * Parse what a student typed into a number answer.
 * Students in Iran write decimals as «۰/۵» or «۰٫۵», so «/» can mean a decimal point or a fraction;
 * both readings are returned and the caller accepts either.
 */
export function parseAnswer(raw: string): number[] {
  let s = toEn(raw).trim().replace(/\s+/g, '');
  s = s.replace(/[−–—]/g, '-').replace(/٫/g, '.').replace(/،/g, ',');
  if (!s) return [];
  const out: number[] = [];
  const push = (v: number) => {
    if (Number.isFinite(v) && !out.some((o) => Math.abs(o - v) < 1e-12)) out.push(v);
  };
  if (/^[-+]?\d+,\d+$/.test(s)) push(Number(s.replace(',', '.')));
  if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) push(Number(s));
  const slash = s.match(/^([-+]?)(\d+)\/(\d+)$/);
  if (slash) {
    const sign = slash[1] === '-' ? -1 : 1;
    push(sign * Number(`${slash[2]}.${slash[3]}`));
    if (Number(slash[3]) !== 0) push((sign * Number(slash[2])) / Number(slash[3]));
  }
  const frac = s.match(/^([-+]?\d+\.?\d*)\/([-+]?\d+\.?\d*)$/);
  if (frac && !slash && Number(frac[2]) !== 0) push(Number(frac[1]) / Number(frac[2]));
  return out;
}

export function answerMatches(raw: string, answer: number, tol?: number): boolean {
  const t = tol ?? (Number.isInteger(answer) ? 1e-6 : Math.max(Math.abs(answer) * 0.01, 1e-6));
  return parseAnswer(raw).some((v) => Math.abs(v - answer) <= t + 1e-12);
}
