/*
 * A small, safe math-expression parser for the free lab («آزمایشگاه آزاد»).
 * No eval: text → tokens → tree → a plain JS function, plus a TeX rendering of what was understood.
 *
 * Accepts what students type: Persian/Arabic digits, «٫» or «/» between digits as a decimal point is NOT
 * guessed (/ is division), × ÷ · − signs, implicit multiplication (2x, 3(x+1), (x+1)(x-1), 2sin x),
 * |…| for absolute value, […] for the floor («جزء صحیح»), π, e, and the variables x, a, b, c.
 */
import { toEn } from './digits';

export type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { k: 'fn'; name: FnName; a: Node };

export const FNS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  cot: (x: number) => 1 / Math.tan(x),
  sqrt: (x: number) => (x < 0 ? NaN : Math.sqrt(x)),
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: (x: number) => (x <= 0 ? NaN : Math.log(x)),
  log: (x: number) => (x <= 0 ? NaN : Math.log10(x)),
  exp: Math.exp,
  floor: Math.floor,
  sign: Math.sign,
};
export type FnName = keyof typeof FNS;

const FN_ALIASES: Record<string, FnName> = { tg: 'tan', ctg: 'cot', cotg: 'cot', radical: 'sqrt', jazr: 'sqrt' };
/** x for graphs, n for sequences (the sequence lab), a, b, c as slider parameters. */
export const VARS = ['x', 'n', 'a', 'b', 'c'] as const;

export class ExprError extends Error {}

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function lex(src: string): Tok[] {
  const s = toEn(src)
    .replace(/٫/g, '.')
    .replace(/[−–—]/g, '-')
    .replace(/[×·∙*]/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, ' pi ')
    .replace(/√/g, ' sqrt ')
    .replace(/\*\*/g, '^')
    .replace(/[{]/g, '(')
    .replace(/[}]/g, ')')
    .toLowerCase();
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9.]/.test(ch)) {
      const m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)/);
      if (!m) throw new ExprError(`عدد «${ch}» را نفهمیدم`);
      out.push({ t: 'num', v: Number(m[1]) });
      i += m[1].length;
    } else if (/[a-z]/.test(ch)) {
      const m = s.slice(i).match(/^[a-z]+/)!;
      out.push(...splitWord(m[0]));
      i += m[0].length;
    } else if ('+-*/^()|[]'.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i++;
    } else {
      throw new ExprError(`نماد «${ch}» را نمی‌شناسم`);
    }
  }
  return out;
}

/** «xsinx» → x, sin, x; «ax» → a, x; known function names win over single letters. */
function splitWord(w: string): Tok[] {
  const names = [...Object.keys(FNS), ...Object.keys(FN_ALIASES), 'pi', 'e', ...VARS].sort((p, q) => q.length - p.length);
  const out: Tok[] = [];
  let rest = w;
  while (rest) {
    const n = names.find((name) => rest.startsWith(name));
    if (!n) throw new ExprError(`«${rest}» را نمی‌شناسم. از x (یا n در دنباله‌ها)، a، b، c و تابع‌هایی مثل sin، sqrt، ln استفاده کن`);
    out.push({ t: 'id', v: FN_ALIASES[n] ?? n });
    rest = rest.slice(n.length);
  }
  return out;
}

/** Parse an expression; throws ExprError with a Persian message when it cannot. */
export function parse(src: string): Node {
  if (!src.trim()) throw new ExprError('یک عبارت بنویس، مثلاً x^2 - 3x + 2');
  const toks = lex(src);
  let pos = 0;
  const peek = () => toks[pos];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;
  const expect = (v: string, msg: string) => {
    if (!isOp(v)) throw new ExprError(msg);
    pos++;
  };

  // A token that can start a factor (for implicit multiplication). '|' only when we are not closing one.
  let absDepth = 0;
  const startsFactor = () => {
    const t = peek();
    if (!t) return false;
    if (t.t === 'num' || t.t === 'id') return true;
    return t.v === '(' || t.v === '[' || (t.v === '|' && absDepth === 0);
  };

  function expr(): Node {
    let n = term();
    while (isOp('+') || isOp('-')) {
      const op = peek()!.v as '+' | '-';
      pos++;
      n = { k: 'bin', op, a: n, b: term() };
    }
    return n;
  }
  function term(): Node {
    let n = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = peek()!.v as '*' | '/';
        pos++;
        n = { k: 'bin', op, a: n, b: unary() };
      } else if (startsFactor()) {
        n = { k: 'bin', op: '*', a: n, b: power() };
      } else return n;
    }
  }
  function unary(): Node {
    if (isOp('-')) {
      pos++;
      return { k: 'neg', a: unary() };
    }
    if (isOp('+')) {
      pos++;
      return unary();
    }
    return power();
  }
  function power(): Node {
    const base = atom();
    if (isOp('^')) {
      pos++;
      return { k: 'bin', op: '^', a: base, b: unary() };
    }
    return base;
  }
  function atom(): Node {
    const t = peek();
    if (!t) throw new ExprError('عبارت نیمه‌کاره مانده است');
    if (t.t === 'num') {
      pos++;
      return { k: 'num', v: t.v };
    }
    if (t.t === 'id') {
      pos++;
      if (t.v === 'pi') return { k: 'num', v: Math.PI };
      if (t.v === 'e') return { k: 'num', v: Math.E };
      if ((VARS as readonly string[]).includes(t.v)) return { k: 'var', name: t.v };
      const name = t.v as FnName;
      // sin^2(x) → (sin x)^2
      let pow: Node | null = null;
      if (isOp('^')) {
        pos++;
        pow = atom();
      }
      // f(x) with brackets, or f x / f 2x without (binds to the next power: sin 2x = sin(2x)).
      let arg: Node;
      if (isOp('(')) arg = atom();
      else {
        if (!startsFactor()) throw new ExprError(`بعد از ${name} باید ورودی تابع بیاید، مثلاً ${name}(x)`);
        arg = power();
        while (peek()?.t === 'id' && (VARS as readonly string[]).includes(peek()!.v as string)) arg = { k: 'bin', op: '*', a: arg, b: power() };
      }
      const call: Node = { k: 'fn', name, a: arg };
      return pow ? { k: 'bin', op: '^', a: call, b: pow } : call;
    }
    if (t.v === '(') {
      pos++;
      const n = expr();
      expect(')', 'یک پرانتز «)» کم است');
      return n;
    }
    if (t.v === '[') {
      pos++;
      const n = expr();
      expect(']', 'یک کروشهٔ «]» کم است');
      return { k: 'fn', name: 'floor', a: n };
    }
    if (t.v === '|') {
      pos++;
      absDepth++;
      const n = expr();
      absDepth--;
      expect('|', 'قدرمطلق بسته نشده است؛ یک «|» کم است');
      return { k: 'fn', name: 'abs', a: n };
    }
    throw new ExprError(`«${t.v}» این‌جا جا ندارد`);
  }

  const n = expr();
  if (pos < toks.length) {
    const t = toks[pos];
    throw new ExprError(t.t === 'op' && t.v === ')' ? 'یک پرانتز «(» کم است' : `از «${t.t === 'num' ? t.v : t.v}» به بعد را نفهمیدم`);
  }
  return n;
}

export type Scope = Partial<Record<(typeof VARS)[number], number>>;

export function evaluate(n: Node, scope: Scope): number {
  switch (n.k) {
    case 'num':
      return n.v;
    case 'var':
      return scope[n.name as keyof Scope] ?? NaN;
    case 'neg':
      return -evaluate(n.a, scope);
    case 'fn':
      return FNS[n.name](evaluate(n.a, scope));
    case 'bin': {
      const a = evaluate(n.a, scope);
      const b = evaluate(n.b, scope);
      switch (n.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return b === 0 ? NaN : a / b;
        case '^':
          // Odd roots of negatives, e.g. x^(1/3) for x < 0.
          if (a < 0 && !Number.isInteger(b)) {
            const inv = 1 / b;
            if (Math.abs(inv - Math.round(inv)) < 1e-9 && Math.round(inv) % 2 !== 0) return -Math.pow(-a, b);
          }
          return Math.pow(a, b);
      }
    }
  }
}

/** Which of x, n, a, b, c an expression uses. */
export function varsOf(n: Node, out = new Set<string>()): Set<string> {
  if (n.k === 'var') out.add(n.name);
  else if (n.k === 'neg' || n.k === 'fn') varsOf(n.a, out);
  else if (n.k === 'bin') {
    varsOf(n.a, out);
    varsOf(n.b, out);
  }
  return out;
}

const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, neg: 3, '^': 4 } as const;
const TEX_FN: Partial<Record<FnName, string>> = { sin: '\\sin', cos: '\\cos', tan: '\\tan', cot: '\\cot', ln: '\\ln', log: '\\log', exp: '\\exp' };

function numTex(v: number): string {
  if (Math.abs(v - Math.PI) < 1e-12) return '\\pi';
  if (Math.abs(v - Math.E) < 1e-12) return 'e';
  return String(Math.round(v * 1e6) / 1e6).replace('.', '{\\dec}');
}

/** TeX for the tree, so the student sees exactly what Biomana understood. */
export function toTex(n: Node, parent = 0): string {
  const wrap = (s: string, p: number) => (p < parent ? `\\left(${s}\\right)` : s);
  switch (n.k) {
    case 'num':
      return numTex(n.v);
    case 'var':
      return n.name;
    case 'neg':
      return wrap(`-${toTex(n.a, PREC.neg)}`, PREC.neg);
    case 'fn':
      if (n.name === 'sqrt') return `\\sqrt{${toTex(n.a)}}`;
      if (n.name === 'cbrt') return `\\sqrt[3]{${toTex(n.a)}}`;
      if (n.name === 'abs') return `\\left|${toTex(n.a)}\\right|`;
      if (n.name === 'floor') return `\\left[${toTex(n.a)}\\right]`;
      if (n.name === 'sign') return `\\operatorname{sign}\\left(${toTex(n.a)}\\right)`;
      return `${TEX_FN[n.name]}\\left(${toTex(n.a)}\\right)`;
    case 'bin': {
      if (n.op === '/') return `\\dfrac{${toTex(n.a)}}{${toTex(n.b)}}`;
      if (n.op === '^') return wrap(`{${toTex(n.a, PREC['^'] + 1)}}^{${toTex(n.b)}}`, PREC['^']);
      if (n.op === '*') {
        const a = toTex(n.a, PREC['*']);
        const b = toTex(n.b, PREC['*'] + 0.5);
        // 2x, 3\sin x stay juxtaposed; two numbers get a times sign.
        const dot = /\d$/.test(a.replace(/\\right\)$/, '')) && /^[\d{]/.test(b) ? ' \\times ' : (n.b.k === 'neg' ? ' \\times ' : ' ');
        return wrap(a + dot + b, PREC['*']);
      }
      return wrap(`${toTex(n.a, PREC[n.op])} ${n.op} ${toTex(n.b, PREC[n.op] + 0.5)}`, PREC[n.op]);
    }
  }
}

export interface Compiled {
  fn: (x: number, scope?: Scope) => number;
  tex: string;
  vars: Set<string>;
}

export function compile(src: string): Compiled {
  const tree = parse(src);
  return { fn: (x, scope = {}) => evaluate(tree, { ...scope, x }), tex: toTex(tree), vars: varsOf(tree) };
}

/* ---------------- numeric questions ---------------- */

const near = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;

/** Snap tiny floating errors: 1.9999999 → 2. */
export function tidy(v: number): number {
  const r = Math.round(v);
  if (near(v, r, 1e-7)) return r === 0 ? 0 : r;
  return Math.round(v * 1e6) / 1e6;
}

/** Roots of f in [x0, x1]: sign changes refined by bisection, plus touching zeros (e.g. (x-1)^2). */
export function roots(f: (x: number) => number, x0: number, x1: number, n = 2400): number[] {
  const out: number[] = [];
  const add = (r: number) => {
    const v = tidy(r);
    if (!out.some((o) => near(o, v, (x1 - x0) / n))) out.push(v);
  };
  const h = (x1 - x0) / n;
  let pa = x0;
  let fa = f(pa);
  for (let i = 1; i <= n; i++) {
    const pb = x0 + i * h;
    const fb = f(pb);
    if (Number.isFinite(fa) && Number.isFinite(fb)) {
      if (fa === 0) add(pa);
      else if (fa * fb < 0) {
        let lo = pa;
        let hi = pb;
        let flo = fa;
        for (let k = 0; k < 60; k++) {
          const mid = (lo + hi) / 2;
          const fm = f(mid);
          if (!Number.isFinite(fm)) break;
          if (flo * fm <= 0) hi = mid;
          else {
            lo = mid;
            flo = fm;
          }
        }
        const r = (lo + hi) / 2;
        // A jump through infinity (1/x at 0) is not a root.
        if (Math.abs(f(r)) < 1e-6) add(r);
      }
    }
    pa = pb;
    fa = fb;
  }
  if (Number.isFinite(fa) && fa === 0) add(pa);
  // Touching zeros: local minima of |f| that are (almost) zero.
  for (const m of extrema((x) => Math.abs(f(x)), x0, x1, n)) if (m.type === 'min' && Math.abs(m.y) < 1e-7) add(m.x);
  return out.sort((a, b) => a - b);
}

export interface Extremum {
  x: number;
  y: number;
  type: 'max' | 'min';
}

/** Local maxima and minima of f inside (x0, x1), refined with a golden-section search. */
export function extrema(f: (x: number) => number, x0: number, x1: number, n = 1200): Extremum[] {
  const h = (x1 - x0) / n;
  const ys = Array.from({ length: n + 1 }, (_, i) => f(x0 + i * h));
  const out: Extremum[] = [];
  for (let i = 1; i < n; i++) {
    const [a, b, c] = [ys[i - 1], ys[i], ys[i + 1]];
    if (![a, b, c].every(Number.isFinite)) continue;
    const type = b >= a && b > c ? 'max' : b <= a && b < c ? 'min' : null;
    if (!type) continue;
    // Golden-section refine on [x_{i-1}, x_{i+1}].
    let lo = x0 + (i - 1) * h;
    let hi = x0 + (i + 1) * h;
    const g = (x: number) => (type === 'max' ? -f(x) : f(x));
    for (let k = 0; k < 60; k++) {
      const m1 = hi - (hi - lo) * 0.618;
      const m2 = lo + (hi - lo) * 0.618;
      if (g(m1) < g(m2)) hi = m2;
      else lo = m1;
    }
    const x = tidy((lo + hi) / 2);
    const y = tidy(f(x));
    // A plateau (e.g. [x]) gives many "extrema"; keep only real turns.
    if (out.some((o) => near(o.x, x, h * 2))) continue;
    out.push({ x, y, type });
  }
  return out;
}

/** Numeric derivative (central difference); NaN where f is not smooth enough. */
export function slope(f: (x: number) => number, x: number): number {
  const h = 1e-5;
  const l = (f(x) - f(x - h)) / h;
  const r = (f(x + h) - f(x)) / h;
  if (!Number.isFinite(l) || !Number.isFinite(r)) return NaN;
  // A corner (|x| at 0): left and right slopes disagree.
  if (Math.abs(l - r) > 1e-3 * Math.max(1, Math.abs(l), Math.abs(r))) return NaN;
  return tidy((f(x + h) - f(x - h)) / (2 * h));
}
