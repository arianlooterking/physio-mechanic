import { describe, expect, it } from 'vitest';
import {
  analyse,
  COUNT_PROBLEMS,
  countSig,
  dec,
  decimalsWritten,
  div,
  leadExp,
  mul,
  rawDigits,
  rawResult,
  roundedAt,
  ROUND_PROBLEMS,
  roundTo,
  show,
  showRaw,
  target,
  writtenTex,
} from '../src/lib/sigfig';

describe('counting significant figures', () => {
  it('follows the textbook rules', () => {
    expect(countSig('4.56')).toBe(3);
    expect(countSig('205')).toBe(3); // zero between non-zero digits
    expect(countSig('0.0045')).toBe(2); // leading zeros only place the point
    expect(countSig('2.50')).toBe(3); // trailing zero after the point
    expect(countSig('100.0')).toBe(4);
    expect(countSig('0.070')).toBe(2);
    expect(countSig('1200')).toBe(2); // trailing zeros of a whole number: not counted
    expect(countSig('1.20e3')).toBe(3); // scientific notation makes them clear
    expect(countSig('3.0080')).toBe(5);
    expect(countSig('0.000300')).toBe(3);
    expect(countSig('6.02e23')).toBe(3);
    expect(countSig('5.0e-4')).toBe(2);
  });

  it('gives each digit its reason', () => {
    expect(analyse('0.070').digits.map((d) => d.rule)).toEqual(['leading', 'leading', 'nonzero', 'trailingPoint']);
    expect(analyse('1200').digits.map((d) => d.rule)).toEqual(['nonzero', 'nonzero', 'trailingWhole', 'trailingWhole']);
    expect(analyse('3.0080').digits.map((d) => d.rule)).toEqual(['nonzero', 'between', 'between', 'nonzero', 'trailingPoint']);
    expect(analyse('1.20e3')).toMatchObject({ point: 1, exp: 3 });
    expect(analyse('205').point).toBeNull();
  });

  it('counts decimal places as written', () => {
    expect(decimalsWritten('12.52')).toBe(2);
    expect(decimalsWritten('83')).toBe(0);
    expect(decimalsWritten('1.20e3')).toBe(-1);
  });

  it('writes numbers with the Persian decimal sign and keeps trailing zeros', () => {
    expect(writtenTex('0.070')).toBe('0{\\dec}070');
    expect(writtenTex('1.20e3')).toBe('1{\\dec}20\\times10^{3}');
    expect(writtenTex('205')).toBe('205');
  });

  it('has a varied set of numbers to practise on', () => {
    const counts = COUNT_PROBLEMS.map((p) => countSig(p.n));
    expect(new Set(counts).size).toBeGreaterThanOrEqual(3);
    const rules = new Set(COUNT_PROBLEMS.flatMap((p) => analyse(p.n).digits.map((d) => d.rule)));
    expect(rules.size).toBe(5);
    expect(COUNT_PROBLEMS.some((p) => p.n.includes('e'))).toBe(true);
  });
});

describe('exact decimals', () => {
  it('multiplies, divides and rounds without float noise', () => {
    expect(show(mul(dec('2.50'), dec('3.141')))).toBe('7.85250');
    expect(showRaw(mul(dec('2.50'), dec('3.141')))).toBe('7.8525');
    expect(show(div(dec('8.3'), dec('2.75'), 7))).toBe('3.0181818');
    expect(show(roundTo(dec('7.8525'), 2))).toBe('7.85');
    expect(show(roundTo(dec('2.75'), 1))).toBe('2.8'); // a 5 rounds up
    expect(show(roundTo(dec('3.0181818'), 1))).toBe('3.0'); // the zero stays
    expect(show(roundTo(dec('104.722'), 0))).toBe('105');
    expect(show(roundTo(dec('1234'), -2))).toBe('1200');
    expect(dec('1.20e3')).toEqual({ n: 1200n, s: 0 });
    expect(dec('5.0e-4')).toEqual({ n: 50n, s: 5 });
    expect(leadExp(dec('0.9175'))).toBe(-1);
    expect(leadExp(dec('102.62'))).toBe(2);
  });
});

describe('rounding results', () => {
  const get = (id: string) => ROUND_PROBLEMS.find((p) => p.id === id)!;

  it('× and ÷ keep the fewest significant figures', () => {
    expect(target(get('area'))).toMatchObject({ per: [3, 2], need: 2, limiting: [1], answer: '6.4' });
    expect(target(get('circle'))).toMatchObject({ need: 3, limiting: [0], answer: '7.85' });
    expect(target(get('rho'))).toMatchObject({ need: 2, answer: '2.8' });
    expect(target(get('speed'))).toMatchObject({ need: 2, limiting: [0], answer: '3.0' });
    expect(target(get('sheet'))).toMatchObject({ per: [2, 4], answer: '0.62' });
  });

  it('+ and − keep the fewest decimal places', () => {
    expect(target(get('rope'))).toMatchObject({ per: [2, 1], limiting: [1], places: 1, answer: '15.6' });
    expect(target(get('cut'))).toMatchObject({ answer: '102.6' });
    expect(target(get('mix'))).toMatchObject({ limiting: [1], answer: '13.2' });
    expect(target(get('diff'))).toMatchObject({ answer: '0.2' });
    expect(target(get('walk'))).toMatchObject({ limiting: [2], places: 0, answer: '105' });
  });

  it('every problem can be answered by tapping one of the calculator digits, and only one term limits it', () => {
    for (const p of ROUND_PROBLEMS) {
      const t = target(p);
      const ds = rawDigits(p);
      const at = ds.filter((d) => d.place === t.places);
      expect(at, p.id).toHaveLength(1);
      expect(roundedAt(p, t.places)).toBe(t.answer);
      expect(t.limiting, p.id).toHaveLength(1);
      // The calculator shows more digits than the answer keeps.
      expect(ds.length, p.id).toBeGreaterThan(t.answer.replace('.', '').replace(/^0+/, '').length);
      expect(showRaw(rawResult(p)).replace('.', '')).toBe(ds.map((d) => d.ch).join(''));
      expect((p.context.match(/\$/g) ?? []).length % 2).toBe(0);
    }
  });

  it('marks the digit before the decimal point', () => {
    expect(rawDigits(get('rope')).map((d) => [d.ch, d.place, d.point])).toEqual([
      ['1', -1, false],
      ['5', 0, true],
      ['6', 1, false],
      ['2', 2, false],
    ]);
  });
});
