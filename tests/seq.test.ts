import { describe, expect, it } from 'vitest';
import { ExprError, parse } from '../src/lib/expr';
import { compileRule, diffsOf, generalTex, indexOf, kindOf, ratiosOf, sumOf, termsOf } from '../src/lib/seq';

const num = (v: number) => String(v);

describe('sequence lab', () => {
  it('evaluates general terms in n, including implicit products and powers', () => {
    expect(termsOf(compileRule('2n - 1').fn, 5)).toEqual([1, 3, 5, 7, 9]);
    expect(termsOf(compileRule('n(n+1)/2').fn, 5)).toEqual([1, 3, 6, 10, 15]);
    expect(termsOf(compileRule('5*3^(n-1)').fn, 4)).toEqual([5, 15, 45, 135]);
    expect(termsOf(compileRule('(-1)^n').fn, 4)).toEqual([-1, 1, -1, 1]);
    expect(termsOf(compileRule('۲n+۱').fn, 3)).toEqual([3, 5, 7]);
    expect(termsOf(compileRule('sin(n pi/2)').fn, 4)).toEqual([1, 0, -1, 0]);
  });

  it('rejects other letters with a Persian message', () => {
    expect(() => compileRule('2x+1')).toThrow(ExprError);
    expect(() => compileRule('2x+1')).toThrow(/فقط از n/);
    expect(() => parse('2q')).toThrow(ExprError);
  });

  it('tells arithmetic, geometric, constant and neither apart', () => {
    expect(kindOf([1, 3, 5, 7])).toEqual({ type: 'arith', d: 2 });
    expect(kindOf([20, 17, 14])).toEqual({ type: 'arith', d: -3 });
    expect(kindOf([5, 15, 45, 135])).toEqual({ type: 'geo', q: 3 });
    expect(kindOf([8, -4, 2, -1])).toEqual({ type: 'geo', q: -0.5 });
    expect(kindOf([4, 4, 4])).toEqual({ type: 'const', value: 4 });
    expect(kindOf([1, 4, 9, 16]).type).toBe('none');
    expect(kindOf([0, 0, 1]).type).toBe('none');
    expect(kindOf([1, 2]).type).toBe('none');
  });

  it('gives differences, ratios, sums and which term equals a number', () => {
    expect(diffsOf([1, 4, 9])).toEqual([3, 5]);
    expect(ratiosOf([2, 6, 0, 5]).map((x) => (Number.isNaN(x) ? 'nan' : x))).toEqual([3, 0, 'nan']);
    expect(sumOf(termsOf(compileRule('2n-1').fn, 10))).toBe(100);
    expect(indexOf(compileRule('3n+2').fn, 50)).toBe(16);
    expect(indexOf(compileRule('3n+2').fn, 51)).toBeNull();
    expect(indexOf(compileRule('2^n').fn, 1024)).toBe(10);
  });

  it('writes the general term in the textbook form', () => {
    expect(generalTex({ type: 'arith', d: 3 }, 2, num)).toBe('a_n = 3n - 1');
    expect(generalTex({ type: 'arith', d: 1 }, 1, num)).toBe('a_n = n');
    expect(generalTex({ type: 'arith', d: -2 }, 10, num)).toBe('a_n = -2n + 12');
    expect(generalTex({ type: 'geo', q: 2 }, 3, num)).toBe('a_n = 3 \\times 2^{\\,n-1}');
    expect(generalTex({ type: 'geo', q: -2 }, 1, num)).toBe('a_n = \\left(-2\\right)^{\\,n-1}');
    expect(generalTex({ type: 'none', why: '' }, 1, num)).toBeNull();
  });
});
