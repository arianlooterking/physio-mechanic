/** Base functions used by the graph labs and graph questions. */
export type BaseName = 'sq' | 'abs' | 'sqrt' | 'cube' | 'sin' | 'cos' | 'tri';

/** A textbook-style piecewise-linear function through (−3,0), (−1,2), (1,2), (3,−1). */
const TRI_PTS: [number, number][] = [
  [-3, 0],
  [-1, 2],
  [1, 2],
  [3, -1],
];

export function piecewise(pts: [number, number][]) {
  return (x: number) => {
    if (x < pts[0][0] || x > pts[pts.length - 1][0]) return NaN;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      if (x >= ax && x <= bx) return ay + ((by - ay) * (x - ax)) / (bx - ax);
    }
    return NaN;
  };
}

export const BASES: Record<BaseName, { fn: (x: number) => number; tex: (arg: string) => string; name: string; key: number }> = {
  sq: { fn: (x) => x * x, tex: (a) => (a === 'x' ? 'x^2' : `(${a})^2`), name: 'x²', key: 1 },
  abs: { fn: Math.abs, tex: (a) => `|${a}|`, name: '|x|', key: 2 },
  sqrt: { fn: (x) => (x < 0 ? NaN : Math.sqrt(x)), tex: (a) => `\\sqrt{${a}}`, name: '√x', key: 4 },
  cube: { fn: (x) => x * x * x, tex: (a) => (a === 'x' ? 'x^3' : `(${a})^3`), name: 'x³', key: 1 },
  sin: { fn: Math.sin, tex: (a) => `\\sin ${a === 'x' ? 'x' : `(${a})`}`, name: 'sin x', key: Math.PI / 2 },
  cos: { fn: Math.cos, tex: (a) => `\\cos ${a === 'x' ? 'x' : `(${a})`}`, name: 'cos x', key: 0 },
  tri: { fn: piecewise(TRI_PTS), tex: (a) => `f(${a})`, name: 'f', key: 1 },
};

export const TRI_POINTS = TRI_PTS;

/** Pretty number for TeX: integers stay, halves/quarters as decimals with the Persian separator. */
export function texNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  const s = String(Math.abs(r)).replace('.', '{\\dec}');
  return r < 0 ? `-${s}` : s;
}

/** TeX for the inside argument b·x + c. */
export function argTex(b: number, c: number): string {
  let s = '';
  if (b === 1) s = 'x';
  else if (b === -1) s = '-x';
  else s = `${texNum(b)}x`;
  if (c > 0) s += `+${texNum(c)}`;
  else if (c < 0) s += `-${texNum(-c)}`;
  return s;
}

/** TeX for a·g + d where g is already TeX. */
export function outerTex(a: number, inner: string, d: number): string {
  let s = '';
  if (a === 1) s = inner;
  else if (a === -1) s = `-${inner}`;
  else s = `${texNum(a)}${inner}`;
  if (d > 0) s += `+${texNum(d)}`;
  else if (d < 0) s += `-${texNum(-d)}`;
  return s;
}

/** Polynomial long division. Coefficients are highest degree first. */
export function polyDivide(num: number[], den: number[]): { q: number[]; r: number[] } {
  const out = num.slice();
  const q: number[] = [];
  const dn = den.length - 1;
  for (let i = 0; i <= num.length - den.length; i++) {
    const coef = out[i] / den[0];
    q.push(coef);
    for (let j = 0; j <= dn; j++) out[i + j] -= coef * den[j];
  }
  const r = out.slice(num.length - dn);
  return { q: q.length ? q : [0], r: r.length ? r : [0] };
}

export function polyEval(c: number[], x: number): number {
  return c.reduce((acc, k) => acc * x + k, 0);
}

/** TeX for a polynomial given highest-degree-first coefficients. */
export function polyTex(c: number[], v = 'x'): string {
  const n = c.length - 1;
  let s = '';
  c.forEach((k, i) => {
    const p = n - i;
    const kk = Math.round(k * 1000) / 1000;
    if (kk === 0) return;
    const abs = Math.abs(kk);
    const sign = kk < 0 ? '-' : s ? '+' : '';
    const coef = abs === 1 && p > 0 ? '' : texNum(abs);
    const pow = p === 0 ? '' : p === 1 ? v : `${v}^{${p}}`;
    s += `${sign}${coef}${pow}`;
  });
  return s || '0';
}
