/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d: Date | number = Date.now()): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Whole days from a to b (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);
}

const weekdayFmt = safeFormat({ weekday: 'short' });
const dayMonthFmt = safeFormat({ day: 'numeric', month: 'long' });
const fullFmt = safeFormat({ day: 'numeric', month: 'long', year: 'numeric' });

function safeFormat(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', opts);
  } catch {
    return new Intl.DateTimeFormat('en-US', opts);
  }
}

export const weekdayShort = (key: string) => weekdayFmt.format(fromKey(key));
export const dayMonth = (key: string) => dayMonthFmt.format(fromKey(key));
export const fullDate = (ms: number) => fullFmt.format(new Date(ms));

export function minutesLabel(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'کمتر از ۱ دقیقه';
  if (m < 60) return `${m} دقیقه`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} ساعت و ${r} دقیقه` : `${h} ساعت`;
}

export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'شب بخیر';
  if (h < 12) return 'صبح بخیر';
  if (h < 17) return 'روز بخیر';
  if (h < 21) return 'عصر بخیر';
  return 'شب بخیر';
}

/* ---------------- The Persian (solar hijri) calendar ---------------- */

export const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'] as const;

const persianParts = (() => {
  try {
    return new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' });
  } catch {
    return null;
  }
})();

/** Days in a Persian year before the first of month `m`. */
const daysBefore = (m: number) => (m <= 7 ? (m - 1) * 31 : 186 + (m - 7) * 30);

/** A day (YYYY-MM-DD) in the Persian calendar: year, month 1–12, day. */
export function persianOf(key: string): { y: number; m: number; d: number } {
  const date = fromKey(key);
  const p = persianParts ? Object.fromEntries(persianParts.formatToParts(date).map((x) => [x.type, x.value])) : {};
  const y = parseInt(p.year, 10);
  if (!Number.isFinite(y)) return { y: date.getFullYear() - 621, m: 1, d: 1 };
  return { y, m: parseInt(p.month, 10), d: parseInt(p.day, 10) };
}

/** The day (YYYY-MM-DD) of a Persian date. */
export function fromPersian(y: number, m: number, d: number): string {
  // Start near 1 Farvardin (about 21 March), add the days before this date, then correct by what the calendar says.
  let key = addDays(dayKey(new Date(y + 621, 2, 21, 12)), daysBefore(m) + d - 1);
  for (let k = 0; k < 4; k++) {
    const p = persianOf(key);
    const gap = (y - p.y) * 365 + daysBefore(m) - daysBefore(p.m) + d - p.d;
    if (!gap) break;
    key = addDays(key, gap);
  }
  return key;
}

/** Days in a Persian month: 31 in the first half of the year, 30 after, and 29 or 30 in Esfand. */
export function persianMonthDays(y: number, m: number): number {
  if (m <= 6) return 31;
  if (m <= 11) return 30;
  const p = persianOf(fromPersian(y, 12, 30));
  return p.m === 12 && p.d === 30 ? 30 : 29;
}

/** «۱ خرداد ۱۴۰۶» */
export const fullDay = (key: string) => fullFmt.format(fromKey(key));

/** «شنبه» */
const weekdayLongFmt = safeFormat({ weekday: 'long' });
export const weekdayLong = (key: string) => weekdayLongFmt.format(fromKey(key));
