/*
 * Atom lab maths (شیمی ۱ widgets): the first twenty elements, isotope notation, the book's stability rule,
 * the average atomic mass of a mix of isotopes, moles and electron shells. Pure functions, no AI.
 */

export interface Element {
  z: number;
  sym: string;
  name: string;
}

/** Elements 1–20, the ones شیمی ۱ chapter 1 works with. */
export const ELEMENTS: Element[] = [
  { z: 1, sym: 'H', name: 'هیدروژن' },
  { z: 2, sym: 'He', name: 'هلیم' },
  { z: 3, sym: 'Li', name: 'لیتیم' },
  { z: 4, sym: 'Be', name: 'بریلیم' },
  { z: 5, sym: 'B', name: 'بور' },
  { z: 6, sym: 'C', name: 'کربن' },
  { z: 7, sym: 'N', name: 'نیتروژن' },
  { z: 8, sym: 'O', name: 'اکسیژن' },
  { z: 9, sym: 'F', name: 'فلوئور' },
  { z: 10, sym: 'Ne', name: 'نئون' },
  { z: 11, sym: 'Na', name: 'سدیم' },
  { z: 12, sym: 'Mg', name: 'منیزیم' },
  { z: 13, sym: 'Al', name: 'آلومینیم' },
  { z: 14, sym: 'Si', name: 'سیلیسیم' },
  { z: 15, sym: 'P', name: 'فسفر' },
  { z: 16, sym: 'S', name: 'گوگرد' },
  { z: 17, sym: 'Cl', name: 'کلر' },
  { z: 18, sym: 'Ar', name: 'آرگون' },
  { z: 19, sym: 'K', name: 'پتاسیم' },
  { z: 20, sym: 'Ca', name: 'کلسیم' },
];

export const elementOf = (z: number): Element | undefined => ELEMENTS.find((e) => e.z === z);

/** TeX of the isotope notation ^A_Z X. */
export function isotopeTex(z: number, n: number): string {
  const e = elementOf(z);
  return `{}^{${z + n}}_{${z}}\\mathrm{${e ? e.sym : 'X'}}`;
}

/**
 * The book's rule of thumb: a nucleus whose neutron-to-proton ratio is 1.5 or more is unstable (radioactive).
 * Hydrogen-3 (tritium) is the classroom exception, radioactive with N/Z = 2 — the rule catches it too.
 */
export function isUnstable(z: number, n: number): boolean {
  return n / z >= 1.5;
}

/** Average atomic mass of isotopes given as [mass in amu, abundance in percent]. */
export function averageMass(isotopes: [number, number][]): number {
  const total = isotopes.reduce((s, [, p]) => s + p, 0);
  const m = isotopes.reduce((s, [mass, p]) => s + mass * p, 0) / total;
  return Number(m.toPrecision(10));
}

/** Avogadro's number as the book rounds it. */
export const NA = 6.02e23;

/** Moles ↔ grams ↔ particles. */
export const molesFromGrams = (g: number, molarMass: number) => Number((g / molarMass).toPrecision(12));
export const particlesFromMoles = (mol: number) => Number((mol * NA).toPrecision(12));

/**
 * Electron arrangement by the n + l rule (the book's «قاعدهٔ آفبا»), up to Z = 36, as subshell labels and
 * counts, e.g. 11 → [['1s', 2], ['2s', 2], ['2p', 6], ['3s', 1]].
 */
const ORDER: [string, number][] = [
  ['1s', 2],
  ['2s', 2],
  ['2p', 6],
  ['3s', 2],
  ['3p', 6],
  ['4s', 2],
  ['3d', 10],
  ['4p', 6],
];

export function configuration(z: number): [string, number][] {
  const out: [string, number][] = [];
  let left = z;
  for (const [label, cap] of ORDER) {
    if (left <= 0) break;
    const k = Math.min(cap, left);
    out.push([label, k]);
    left -= k;
  }
  // The two classroom exceptions in the first row of d elements.
  if (z === 24 || z === 29) {
    const s = out.find(([l]) => l === '4s')!;
    const d = out.find(([l]) => l === '3d')!;
    s[1] -= 1;
    d[1] += 1;
  }
  return out;
}

export const configurationTex = (z: number) => configuration(z).map(([l, k]) => `${l}^{${k}}`).join('\\,');

/** Electrons in the outermost shell (largest n), the valence electrons for main-group atoms. */
export function valenceElectrons(z: number): number {
  const conf = configuration(z);
  const maxN = Math.max(...conf.map(([l]) => Number(l[0])));
  return conf.filter(([l]) => Number(l[0]) === maxN).reduce((s, [, k]) => s + k, 0);
}

/** Period (row) of the table = the largest shell number used. */
export const periodOf = (z: number) => Math.max(...configuration(z).map(([l]) => Number(l[0])));
