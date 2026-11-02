/*
 * «موازنهٔ واکنش» (screens/BalanceLab.tsx): a closed set of reactions from شیمی ۱ to ۳, atom counting on each
 * side, the balance check (smallest whole-number coefficients) and step hints by the inspection method.
 * Pure functions, no AI; everything runs on the phone.
 */

export type State = 's' | 'l' | 'g' | 'aq';

export interface Species {
  /** Formula as mhchem writes it: «Ca3(PO4)2». */
  f: string;
  state: State;
}

export interface Reaction {
  id: string;
  level: 1 | 2 | 3;
  /** Short Persian name, for the picker. */
  name: string;
  left: Species[];
  right: Species[];
  /** Smallest whole-number coefficients, reactants then products (checked by tests/balance.test.ts). */
  answer: number[];
  /** One line on where the reaction is seen in real life (Rich markup). */
  note: string;
  /** A trick that helps with this reaction, shown with the first hint (Rich markup). */
  tip?: string;
}

const sp = (f: string, state: State): Species => ({ f, state });

/** Ordered from easy to hard in three levels. */
export const REACTIONS: Reaction[] = [
  /* ───── level 1 ───── */
  {
    id: 'water',
    level: 1,
    name: 'ساختن آب',
    left: [sp('H2', 'g'), sp('O2', 'g')],
    right: [sp('H2O', 'l')],
    answer: [2, 1, 2],
    note: 'موتور شاتل فضایی و پیل سوختی با همین واکنش انرژی می‌گیرند و تنها فراورده‌اش آب است.',
  },
  {
    id: 'haber',
    level: 1,
    name: 'فرایند هابر',
    left: [sp('N2', 'g'), sp('H2', 'g')],
    right: [sp('NH3', 'g')],
    answer: [1, 3, 2],
    note: 'بیشتر آمونیاکی که در دنیا ساخته می‌شود کود شیمیایی می‌شود و غذای میلیاردها نفر به آن بند است.',
  },
  {
    id: 'magnesium',
    level: 1,
    name: 'سوختن منیزیم',
    left: [sp('Mg', 's'), sp('O2', 'g')],
    right: [sp('MgO', 's')],
    answer: [2, 1, 2],
    note: 'نور سفید و خیره‌کنندهٔ فشفشه و منور از سوختن منیزیم است.',
  },
  {
    id: 'peroxide',
    level: 1,
    name: 'تجزیهٔ آب اکسیژنه',
    left: [sp('H2O2', 'aq')],
    right: [sp('H2O', 'l'), sp('O2', 'g')],
    answer: [2, 2, 1],
    note: 'آب اکسیژنه روی زخم کف می‌کند، چون آنزیمی در خون تجزیه‌اش را تند می‌کند و گاز اکسیژن بیرون می‌زند.',
  },
  {
    id: 'methane',
    level: 1,
    name: 'سوختن متان',
    left: [sp('CH4', 'g'), sp('O2', 'g')],
    right: [sp('CO2', 'g'), sp('H2O', 'g')],
    answer: [1, 2, 1, 2],
    note: 'شعلهٔ آبی اجاق گاز همین واکنش است؛ گاز شهری بیشترش متان است.',
  },
  {
    id: 'barium',
    level: 1,
    name: 'رسوب باریم سولفات',
    left: [sp('BaCl2', 'aq'), sp('Na2SO4', 'aq')],
    right: [sp('BaSO4', 's'), sp('NaCl', 'aq')],
    answer: [1, 1, 1, 2],
    note: 'باریم سولفات در آب حل نمی‌شود؛ پیش از عکس‌برداری از معده آن را می‌نوشند تا معده در تصویر پرتو ایکس دیده شود.',
    tip: 'یون $\\ce{SO4}$ در دو طرف دست‌نخورده می‌ماند؛ آن را یک تکه بشمار.',
  },
  /* ───── level 2 ───── */
  {
    id: 'propane',
    level: 2,
    name: 'سوختن پروپان',
    left: [sp('C3H8', 'g'), sp('O2', 'g')],
    right: [sp('CO2', 'g'), sp('H2O', 'g')],
    answer: [1, 5, 3, 4],
    note: 'کپسول‌های گاز پیک‌نیکی بیشتر پروپان دارند.',
  },
  {
    id: 'airbag',
    level: 2,
    name: 'کیسهٔ هوای خودرو',
    left: [sp('NaN3', 's')],
    right: [sp('Na', 's'), sp('N2', 'g')],
    answer: [2, 2, 3],
    note: 'موقع تصادف، تجزیهٔ سدیم آزید در چند صدم ثانیه کیسهٔ هوا را از گاز نیتروژن پر می‌کند.',
    tip: '$\\ce{N3}$ سه نیتروژن دارد و $\\ce{N2}$ دو تا؛ کوچک‌ترین مضرب مشترک ۲ و ۳ را پیدا کن.',
  },
  {
    id: 'sodium',
    level: 2,
    name: 'سدیم در آب',
    left: [sp('Na', 's'), sp('H2O', 'l')],
    right: [sp('NaOH', 'aq'), sp('H2', 'g')],
    answer: [2, 2, 2, 1],
    note: 'سدیم را زیر نفت نگه می‌دارند، چون با آب تند واکنش می‌دهد و گاز هیدروژن آزاد می‌کند.',
  },
  {
    id: 'antacid',
    level: 2,
    name: 'شیر منیزی و اسید معده',
    left: [sp('Mg(OH)2', 's'), sp('HCl', 'aq')],
    right: [sp('MgCl2', 'aq'), sp('H2O', 'l')],
    answer: [1, 2, 1, 2],
    note: 'داروی ضد اسید (شیر منیزی) هیدروکلریک اسید معده را خنثی می‌کند و سوزش معده را کم می‌کند.',
    tip: 'در خنثی شدن، هر $\\ce{OH}$ باز با یک $\\ce{H}$ اسید یک مولکول آب می‌سازد.',
  },
  {
    id: 'lead',
    level: 2,
    name: 'باران طلایی',
    left: [sp('Pb(NO3)2', 'aq'), sp('KI', 'aq')],
    right: [sp('PbI2', 's'), sp('KNO3', 'aq')],
    answer: [1, 2, 1, 2],
    note: 'دو محلول بی‌رنگ را که روی هم بریزی، رسوب زرد و براق سرب یدید ته‌نشین می‌شود.',
    tip: 'یون $\\ce{NO3}$ در دو طرف دست‌نخورده می‌ماند؛ آن را یک تکه بشمار.',
  },
  {
    id: 'rust',
    level: 2,
    name: 'زنگ زدن آهن',
    left: [sp('Fe', 's'), sp('O2', 'g')],
    right: [sp('Fe2O3', 's')],
    answer: [4, 3, 2],
    note: 'آهن در هوای مرطوب کم‌کم زنگ می‌زند؛ رنگ زدن و گالوانیزه کردن جلویش را می‌گیرد.',
    tip: '$\\ce{O2}$ دو اکسیژن دارد و $\\ce{Fe2O3}$ سه تا؛ تعداد اکسیژن را به کوچک‌ترین مضرب مشترک ۲ و ۳ برسان.',
  },
  {
    id: 'thermite',
    level: 2,
    name: 'ترمیت',
    left: [sp('Al', 's'), sp('Fe2O3', 's')],
    right: [sp('Al2O3', 's'), sp('Fe', 'l')],
    answer: [2, 1, 1, 2],
    note: 'گرمای این واکنش آهن را ذوب می‌کند؛ با آن ریل‌های راه‌آهن را به هم جوش می‌دهند.',
  },
  /* ───── level 3 ───── */
  {
    id: 'furnace',
    level: 3,
    name: 'کورهٔ ذوب آهن',
    left: [sp('Fe2O3', 's'), sp('CO', 'g')],
    right: [sp('Fe', 'l'), sp('CO2', 'g')],
    answer: [1, 3, 2, 3],
    note: 'در کورهٔ بلند کارخانه‌های فولاد، کربن مونوکسید اکسیژن سنگ آهن را می‌گیرد و آهن مذاب می‌ماند.',
    tip: 'هر $\\ce{CO}$ فقط یک اکسیژن از $\\ce{Fe2O3}$ می‌گیرد و $\\ce{CO2}$ می‌شود.',
  },
  {
    id: 'ostwald',
    level: 3,
    name: 'اکسایش آمونیاک',
    left: [sp('NH3', 'g'), sp('O2', 'g')],
    right: [sp('NO', 'g'), sp('H2O', 'g')],
    answer: [4, 5, 4, 6],
    note: 'نخستین مرحلهٔ ساختن نیتریک اسید برای کود است و روی توری پلاتینی داغ انجام می‌شود.',
    tip: 'اگر ضریب $\\ce{O2}$ کسری شد (مثل $\\frac{5}{2}$)، همهٔ ضریب‌ها را دو برابر کن.',
  },
  {
    id: 'respiration',
    level: 3,
    name: 'سوختن گلوکز',
    left: [sp('C6H12O6', 'aq'), sp('O2', 'g')],
    right: [sp('CO2', 'g'), sp('H2O', 'l')],
    answer: [1, 6, 6, 6],
    note: 'یاخته‌های بدنت همین حالا با این واکنش (تنفس یاخته‌ای) از قند انرژی می‌گیرند.',
  },
  {
    id: 'photosynthesis',
    level: 3,
    name: 'فتوسنتز',
    left: [sp('CO2', 'g'), sp('H2O', 'l')],
    right: [sp('C6H12O6', 'aq'), sp('O2', 'g')],
    answer: [6, 6, 1, 6],
    note: 'برگ‌ها با انرژی نور خورشید این واکنش را پیش می‌برند؛ درست وارونهٔ تنفس یاخته‌ای است.',
  },
  {
    id: 'phosphate',
    level: 3,
    name: 'سنگ فسفات و سولفوریک اسید',
    left: [sp('Ca3(PO4)2', 's'), sp('H2SO4', 'aq')],
    right: [sp('CaSO4', 's'), sp('H3PO4', 'aq')],
    answer: [1, 3, 3, 2],
    note: 'فسفریک اسید این واکنش مادهٔ اولیهٔ کودهای فسفاته است.',
    tip: '$\\ce{PO4}$ و $\\ce{SO4}$ دست‌نخورده می‌مانند؛ هر کدام را یک تکه بشمار.',
  },
  {
    id: 'aluminium',
    level: 3,
    name: 'آلومینیم در اسید',
    left: [sp('Al', 's'), sp('HCl', 'aq')],
    right: [sp('AlCl3', 'aq'), sp('H2', 'g')],
    answer: [2, 6, 2, 3],
    note: 'آلومینیم در اسید گاز هیدروژن آزاد می‌کند؛ برای همین غذای ترش را مدت زیادی در ظرف آلومینیمی نگه نمی‌دارند.',
    tip: 'کلر در $\\ce{AlCl3}$ سه‌تایی است و هیدروژن در $\\ce{H2}$ دوتایی؛ ضریب $\\ce{HCl}$ باید مضرب ۲ و ۳ باشد.',
  },
  {
    id: 'octane',
    level: 3,
    name: 'سوختن بنزین',
    left: [sp('C8H18', 'l'), sp('O2', 'g')],
    right: [sp('CO2', 'g'), sp('H2O', 'g')],
    answer: [2, 25, 16, 18],
    note: 'موتور خودرو انرژی‌اش را از سوختن بنزین می‌گیرد و اوکتان یکی از اجزای اصلی بنزین است.',
    tip: 'ضریب $\\ce{O2}$ اول کسری می‌شود ($\\frac{25}{2}$)؛ آن‌وقت همهٔ ضریب‌ها را دو برابر کن.',
  },
];

export const LEVEL_NAMES: Record<1 | 2 | 3, string> = { 1: 'آسان', 2: 'متوسط', 3: 'سخت' };

/** Coefficients the steppers allow. */
export const MIN_COEF = 1;
export const MAX_COEF = 30;

/** Persian names of the elements in the set. */
export const ELEMENT_NAMES: Record<string, string> = {
  H: 'هیدروژن',
  C: 'کربن',
  N: 'نیتروژن',
  O: 'اکسیژن',
  Na: 'سدیم',
  Mg: 'منیزیم',
  Al: 'آلومینیم',
  P: 'فسفر',
  S: 'گوگرد',
  Cl: 'کلر',
  K: 'پتاسیم',
  Ca: 'کلسیم',
  Fe: 'آهن',
  I: 'ید',
  Ba: 'باریم',
  Pb: 'سرب',
};

/** Atoms in one formula unit: «Ca3(PO4)2» → { Ca: 3, P: 2, O: 8 }. */
export function parseFormula(f: string): Record<string, number> {
  let i = 0;
  const num = () => {
    let s = '';
    while (i < f.length && /\d/.test(f[i])) s += f[i++];
    return s ? Number(s) : 1;
  };
  const group = (): Record<string, number> => {
    const out: Record<string, number> = {};
    const add = (e: string, k: number) => (out[e] = (out[e] ?? 0) + k);
    while (i < f.length && f[i] !== ')') {
      if (f[i] === '(') {
        i += 1;
        const inner = group();
        if (f[i] !== ')') throw new Error(`unclosed ( in ${f}`);
        i += 1;
        const k = num();
        for (const [e, c] of Object.entries(inner)) add(e, c * k);
      } else if (/[A-Z]/.test(f[i])) {
        let e = f[i++];
        while (i < f.length && /[a-z]/.test(f[i])) e += f[i++];
        add(e, num());
      } else throw new Error(`bad formula ${f}`);
    }
    return out;
  };
  const out = group();
  if (i !== f.length) throw new Error(`bad formula ${f}`);
  return out;
}

const atomsCache = new Map<string, Record<string, number>>();
const atoms = (f: string) => {
  let a = atomsCache.get(f);
  if (!a) atomsCache.set(f, (a = parseFormula(f)));
  return a;
};

export const allSpecies = (r: Reaction) => [...r.left, ...r.right];

/** The elements of a reaction in order of first appearance. */
export function elementsOf(r: Reaction): string[] {
  const out: string[] = [];
  for (const s of allSpecies(r)) for (const e of Object.keys(atoms(s.f))) if (!out.includes(e)) out.push(e);
  return out;
}

export interface Tally {
  el: string;
  left: number;
  right: number;
  /** [coefficient, atoms per formula] for each formula on that side that holds the element. */
  leftParts: [number, number][];
  rightParts: [number, number][];
}

/** Atoms of every element on each side for the given coefficients (reactants first, then products). */
export function tally(r: Reaction, coefs: number[]): Tally[] {
  const nL = r.left.length;
  return elementsOf(r).map((el) => {
    const parts = (side: Species[], off: number): [number, number][] =>
      side.flatMap((s, i): [number, number][] => (atoms(s.f)[el] ? [[coefs[off + i], atoms(s.f)[el]]] : []));
    const leftParts = parts(r.left, 0);
    const rightParts = parts(r.right, nL);
    const sum = (ps: [number, number][]) => ps.reduce((t, [c, k]) => t + c * k, 0);
    return { el, left: sum(leftParts), right: sum(rightParts), leftParts, rightParts };
  });
}

export const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
export const gcdAll = (xs: number[]) => xs.reduce((g, x) => gcd(g, x), 0);

export type Verdict = { kind: 'unbalanced'; off: string[] } | { kind: 'notSimplest'; by: number } | { kind: 'ok' };

/**
 * «بررسی»: every element must have the same number of atoms on both sides, and the coefficients must be the
 * smallest whole numbers (no common factor). Coefficients below 1 are never balanced.
 */
export function check(r: Reaction, coefs: number[]): Verdict {
  const off = coefs.some((c) => !Number.isInteger(c) || c < 1) ? elementsOf(r) : tally(r, coefs).filter((t) => t.left !== t.right).map((t) => t.el);
  if (off.length) return { kind: 'unbalanced', off };
  const by = gcdAll(coefs);
  return by > 1 ? { kind: 'notSimplest', by } : { kind: 'ok' };
}

/* ───── exact solving, to verify the data (and as a guard for future reactions) ───── */

type Q = [bigint, bigint];
const gcdB = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};
const q = (n: bigint, d = 1n): Q => {
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcdB(n, d) || 1n;
  return [n / g, d / g];
};
const qsub = (a: Q, b: Q) => q(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const qmul = (a: Q, b: Q) => q(a[0] * b[0], a[1] * b[1]);
const qdiv = (a: Q, b: Q) => q(a[0] * b[1], a[1] * b[0]);

/** Integer basis of the null space of an integer matrix, by exact row reduction. */
export function nullSpace(m: number[][]): bigint[][] {
  const rows = m.map((r) => r.map((v) => q(BigInt(v))));
  const n = rows[0]?.length ?? 0;
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < n && r < rows.length; c++) {
    const p = rows.findIndex((row, i) => i >= r && row[c][0] !== 0n);
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    const pv = rows[r][c];
    rows[r] = rows[r].map((x) => qdiv(x, pv));
    for (let i = 0; i < rows.length; i++) {
      if (i === r || rows[i][c][0] === 0n) continue;
      const f = rows[i][c];
      rows[i] = rows[i].map((x, j) => qsub(x, qmul(f, rows[r][j])));
    }
    pivots.push(c);
    r += 1;
  }
  const free = [...Array(n).keys()].filter((c) => !pivots.includes(c));
  return free.map((fc) => {
    const v: Q[] = Array.from({ length: n }, () => q(0n));
    v[fc] = q(1n);
    pivots.forEach((pc, i) => (v[pc] = q(-rows[i][fc][0], rows[i][fc][1])));
    const lcm = v.reduce((l, [, d]) => (l * d) / gcdB(l, d), 1n);
    const ints = v.map(([a, d]) => (a * lcm) / d);
    const g = ints.reduce((t, x) => gcdB(t, x), 0n) || 1n;
    return ints.map((x) => x / g);
  });
}

/**
 * The smallest whole-number coefficients that balance a reaction, or null when there is no such answer or
 * more than one independent answer (a reaction this lab cannot grade with one answer).
 */
export function solve(r: Reaction): number[] | null {
  const nL = r.left.length;
  const m = elementsOf(r).map((el) => allSpecies(r).map((s, i) => (atoms(s.f)[el] ?? 0) * (i < nL ? 1 : -1)));
  const basis = nullSpace(m);
  if (basis.length !== 1) return null;
  let v = basis[0];
  if (v[0] < 0n) v = v.map((x) => -x);
  if (v.some((x) => x <= 0n)) return null;
  return v.map(Number);
}

/* ───── hints by the inspection method ───── */

/**
 * The order to balance elements in: first those found in one formula on each side, then those spread over
 * several formulas, then H and O, and last an element that stands alone (O₂, Fe, H₂…), since changing its
 * coefficient moves nothing else.
 */
export function strategy(r: Reaction): string[] {
  const score = (el: string) => {
    const free = allSpecies(r).some((s) => Object.keys(atoms(s.f)).length === 1 && atoms(s.f)[el]);
    if (free) return 3;
    if (el === 'H' || el === 'O') return 2;
    const inL = r.left.filter((s) => atoms(s.f)[el]).length;
    const inR = r.right.filter((s) => atoms(s.f)[el]).length;
    return inL > 1 || inR > 1 ? 1 : 0;
  };
  const els = elementsOf(r);
  return els.map((el, i) => ({ el, i, s: score(el) })).sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.el);
}

/** Species indices (reactants then products) in the order the strategy reaches them. */
export function speciesOrder(r: Reaction): number[] {
  const out: number[] = [];
  const all = allSpecies(r);
  for (const el of strategy(r)) all.forEach((s, i) => atoms(s.f)[el] && !out.includes(i) && out.push(i));
  return out;
}

const ce = (f: string) => `$\\ce{${f}}$`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join('، ')} و ${xs[xs.length - 1]}`);

/** First hint: where to start and what to leave for last. */
export function strategyHint(r: Reaction): string {
  const order = strategy(r);
  const all = allSpecies(r);
  const isLone = (f: string) => Object.keys(atoms(f)).length === 1;
  const lone = [...new Set(all.filter((s) => isLone(s.f)).map((s) => s.f))];
  const compounds = [...new Set(all.filter((s) => !isLone(s.f)).map((s) => s.f))];
  const inLone = (el: string) => lone.some((f) => atoms(f)[el]);
  const once = (el: string) => r.left.filter((s) => atoms(s.f)[el]).length === 1 && r.right.filter((s) => atoms(s.f)[el]).length === 1;
  const parts: string[] = [];
  const lead = order.filter((el) => !inLone(el) && el !== 'H' && el !== 'O');
  const pl = (n: number, one: string, many: string) => (n > 1 ? many : one);
  if (lead.length) {
    const first = lead.slice(0, 2);
    parts.push(
      first.every(once)
        ? `با ${list(first.map(ce))} شروع کن؛ در هر طرف فقط در یک ماده ${pl(first.length, 'آمده است', 'آمده‌اند')}.`
        : `با ${list(first.map(ce))} شروع کن.`,
    );
    const ho = order.filter((el) => (el === 'H' || el === 'O') && !inLone(el));
    if (ho.length) parts.push(`بعد سراغ ${list(ho.map(ce))} برو.`);
  } else if (!inLone(order[0])) {
    parts.push(`با ${ce(order[0])} شروع کن.`);
  } else {
    parts.push(`اول ضریب ${pl(compounds.length, 'مادهٔ مرکب', 'ماده‌های مرکب')} (${list(compounds.map(ce))}) را حدس بزن.`);
  }
  if (lone.length)
    parts.push(
      `${list(lone.map(ce))} را برای آخر بگذار: ${pl(lone.length, 'فقط یک نوع اتم دارد، پس عوض کردن ضریبش', 'هر کدام فقط یک نوع اتم دارند، پس عوض کردن ضریبشان')} بقیهٔ اتم‌ها را به هم نمی‌زند.`,
    );
  if (r.tip) parts.push(r.tip);
  return parts.join(' ');
}

/** Second hint, live: the first element (in strategy order) that is still off, with its counts. */
export function stateHint(r: Reaction, coefs: number[]): string {
  const v = check(r, coefs);
  if (v.kind === 'ok') return 'همه‌چیز درست است؛ «بررسی» را بزن.';
  if (v.kind === 'notSimplest') return `همهٔ اتم‌ها برابرند، ولی همهٔ ضریب‌ها بر ${v.by} بخش‌پذیرند؛ همه را بر ${v.by} تقسیم کن.`;
  const t = tally(r, coefs);
  const el = strategy(r).find((e) => v.off.includes(e))!;
  const row = t.find((x) => x.el === el)!;
  const all = allSpecies(r);
  const nL = r.left.length;
  const holders = all.flatMap((s, i) => (atoms(s.f)[el] ? [i] : []));
  const isLone = (i: number) => Object.keys(atoms(all[i].f)).length === 1;
  // An element that also stands alone (O₂, Fe…) is best fixed with that formula, since nothing else moves,
  // but only when a whole-number coefficient of it can do the job.
  const fixable = holders.filter((i) => {
    if (!isLone(i)) return false;
    const k = atoms(all[i].f)[el];
    const same = i < nL ? row.left : row.right;
    const other = i < nL ? row.right : row.left;
    const need = (other - (same - coefs[i] * k)) / k;
    return Number.isInteger(need) && need >= 1;
  });
  const lone = holders.filter(isLone);
  const compounds = holders.filter((i) => !isLone(i));
  const names = (is: number[]) => list(is.map((i) => ce(all[i].f)));
  const advice = fixable.length
    ? `ضریب ${names(fixable)} را عوض کن؛ این کار بقیهٔ اتم‌ها را به هم نمی‌زند.`
    : lone.length
      ? `با ضریب ${names(lone)} به عدد درستی نمی‌رسی؛ ${compounds.length ? `ضریب ${names(compounds)} را عوض کن یا ` : ''}همهٔ ضریب‌ها را دو برابر کن.`
      : `ضریب ${names(holders)} را عوض کن.`;
  return `الان ${ce(el)} موازنه نیست: سمت چپ ${row.left} اتم و سمت راست ${row.right} اتم. ${advice}`;
}

/** Later hints: the final coefficient of the next formula the learner has not got right yet. */
export function nextReveal(r: Reaction, coefs: number[], revealed: number[]): number | null {
  const v = check(r, coefs);
  if (v.kind === 'ok') return null;
  const i = speciesOrder(r).find((k) => !revealed.includes(k) && coefs[k] !== r.answer[k]);
  return i ?? null;
}

/** The equation as mhchem, with coefficients (1 is not written) and, if asked, the states. */
export function equationTex(r: Reaction, coefs: number[], states = false): string {
  const side = (ss: Species[], off: number) =>
    ss.map((s, i) => `${coefs[off + i] === 1 ? '' : coefs[off + i]}${s.f}${states ? `(${s.state})` : ''}`).join(' + ');
  return `${side(r.left, 0)} -> ${side(r.right, r.left.length)}`;
}
