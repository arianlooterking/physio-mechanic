import { describe, expect, it } from 'vitest';
import { compile, extrema, ExprError, parse, roots, slope, toTex } from '../src/lib/expr';
import katex from 'katex';

const renderTex = (tex: string, _d: boolean) => katex.renderToString(tex, { throwOnError: true, macros: { '\\dec': '{\\char"066B}' } });

const v = (src: string, x = 0, scope = {}) => compile(src).fn(x, scope);

describe('expression parser', () => {
  it('evaluates what students type', () => {
    expect(v('x^2 - 3x + 2', 1)).toBe(0);
    expect(v('۲x+۱', 3)).toBe(7);
    expect(v('2(x+1)', 2)).toBe(6);
    expect(v('(x+1)(x-1)', 3)).toBe(8);
    expect(v('-x^2', 3)).toBe(-9);
    expect(v('2^3^2')).toBe(512);
    expect(v('|x-2|+1', -1)).toBe(4);
    expect(v('[x]', -1.5)).toBe(-2);
    expect(v('sqrt(x+4)', 5)).toBe(3);
    expect(v('√x', 9)).toBe(3);
    expect(v('2sin x', Math.PI / 2)).toBeCloseTo(2);
    expect(v('sin 2x', Math.PI / 4)).toBeCloseTo(1);
    expect(v('sin^2(x)+cos^2(x)', 0.7)).toBeCloseTo(1);
    expect(v('xsinx', Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(v('ax^2+bx+c', 2, { a: 1, b: 2, c: 3 })).toBe(11);
    expect(v('2πx', 1)).toBeCloseTo(2 * Math.PI);
    expect(v('x^(1/3)', -8)).toBeCloseTo(-2);
    expect(v('6÷2×3')).toBe(9);
    expect(v('۱٫۵x', 2)).toBe(3);
    expect(Number.isNaN(v('1/x', 0))).toBe(true);
  });
  it('explains mistakes in Persian', () => {
    for (const bad of ['', '(x+1', 'x+', '|x', 'foo(x)', 'x$2', 'sin']) expect(() => parse(bad)).toThrow(ExprError);
  });
  it('renders valid TeX', () => {
    for (const src of ['x^2-3x+2', '(x^2-1)/(x-1)', '2sin(x)', '|x-2|+1', '[x]', 'sqrt(x+4)', '-x^2', '2^x', 'x^(1/3)', 'ln(x)', '2*-3']) {
      const tex = toTex(parse(src));
      expect(() => renderTex(tex, false), `${src} → ${tex}`).not.toThrow();
    }
    expect(toTex(parse('x^2-3x+2'))).toBe('{x}^{2} - 3 x + 2');
  });
});

describe('numeric questions', () => {
  it('finds roots, including touching ones, and skips poles', () => {
    expect(roots(compile('x^2-3x+2').fn, -10, 10)).toEqual([1, 2]);
    expect(roots(compile('(x-1)^2').fn, -10, 10)).toEqual([1]);
    expect(roots(compile('1/x').fn, -10, 10)).toEqual([]);
    expect(roots(compile('x^3-x').fn, -5, 5)).toEqual([-1, 0, 1]);
  });
  it('finds turning points', () => {
    const e = extrema(compile('x^3-3x').fn, -5, 5);
    expect(e).toEqual([
      { x: -1, y: 2, type: 'max' },
      { x: 1, y: -2, type: 'min' },
    ]);
  });
  it('gives slopes and refuses corners', () => {
    expect(slope(compile('x^2').fn, 3)).toBe(6);
    expect(Number.isNaN(slope(compile('|x|').fn, 0))).toBe(true);
  });
});
