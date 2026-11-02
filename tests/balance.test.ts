import { describe, expect, it } from 'vitest';
import {
  allSpecies,
  check,
  ELEMENT_NAMES,
  elementsOf,
  equationTex,
  gcdAll,
  MAX_COEF,
  nextReveal,
  parseFormula,
  REACTIONS,
  solve,
  speciesOrder,
  stateHint,
  strategy,
  strategyHint,
  tally,
  type Reaction,
} from '../src/lib/balance';

/** Count atoms independently of the lab's own tally: expand every formula by hand-rolled parsing. */
function countAtoms(formulas: string[], coefs: number[]): Map<string, number> {
  const out = new Map<string, number>();
  formulas.forEach((f, i) => {
    for (const [el, n] of Object.entries(parseFormula(f))) out.set(el, (out.get(el) ?? 0) + n * coefs[i]);
  });
  return out;
}

describe('formula parsing', () => {
  it('reads subscripts and brackets', () => {
    expect(parseFormula('H2O')).toEqual({ H: 2, O: 1 });
    expect(parseFormula('C6H12O6')).toEqual({ C: 6, H: 12, O: 6 });
    expect(parseFormula('Ca3(PO4)2')).toEqual({ Ca: 3, P: 2, O: 8 });
    expect(parseFormula('Pb(NO3)2')).toEqual({ Pb: 1, N: 2, O: 6 });
    expect(parseFormula('Mg(OH)2')).toEqual({ Mg: 1, O: 2, H: 2 });
    expect(parseFormula('NaN3')).toEqual({ Na: 1, N: 3 });
    expect(() => parseFormula('Ca(OH')).toThrow();
    expect(() => parseFormula('h2o')).toThrow();
  });
});

describe('the reaction set', () => {
  it('has 15 to 20 reactions in three levels, ordered easy to hard, with unique ids', () => {
    expect(REACTIONS.length).toBeGreaterThanOrEqual(15);
    expect(REACTIONS.length).toBeLessThanOrEqual(20);
    expect(new Set(REACTIONS.map((r) => r.id)).size).toBe(REACTIONS.length);
    const levels = REACTIONS.map((r) => r.level);
    expect(levels).toEqual([...levels].sort());
    for (const L of [1, 2, 3]) expect(levels.filter((l) => l === L).length).toBeGreaterThanOrEqual(5);
  });

  it.each(REACTIONS.map((r) => [r.id, r] as [string, Reaction]))('%s: the stored coefficients balance every element and are the smallest', (_, r) => {
    const all = allSpecies(r);
    expect(r.answer).toHaveLength(all.length);
    const left = countAtoms(
      r.left.map((s) => s.f),
      r.answer.slice(0, r.left.length),
    );
    const right = countAtoms(
      r.right.map((s) => s.f),
      r.answer.slice(r.left.length),
    );
    expect([...left.keys()].sort()).toEqual([...right.keys()].sort());
    for (const [el, n] of left) expect(right.get(el), `${r.id}: ${el}`).toBe(n);
    expect(gcdAll(r.answer)).toBe(1);
    expect(Math.max(...r.answer)).toBeLessThanOrEqual(MAX_COEF);
    // Exact row reduction finds exactly one answer up to a factor, and it is the stored one.
    expect(solve(r)).toEqual(r.answer);
    expect(check(r, r.answer)).toEqual({ kind: 'ok' });
  });

  it('starts every reaction unbalanced (all coefficients 1), so there is something to do', () => {
    for (const r of REACTIONS) {
      const ones = allSpecies(r).map(() => 1);
      if (r.answer.every((c) => c === 1)) continue;
      expect(check(r, ones).kind, r.id).toBe('unbalanced');
    }
  });

  it('names every element in Persian and has a one-line note', () => {
    for (const r of REACTIONS) {
      for (const el of elementsOf(r)) expect(ELEMENT_NAMES[el], `${r.id} ${el}`).toBeTruthy();
      expect(r.note.length).toBeGreaterThan(20);
      expect(r.note).not.toMatch(/\n/);
      expect(r.name.length).toBeGreaterThan(2);
    }
  });
});

describe('checking an answer', () => {
  const methane = REACTIONS.find((r) => r.id === 'methane')!;
  const propane = REACTIONS.find((r) => r.id === 'propane')!;

  it('says which elements are off', () => {
    expect(check(methane, [1, 1, 1, 1])).toEqual({ kind: 'unbalanced', off: ['H', 'O'] });
    expect(check(methane, [1, 1, 1, 2])).toEqual({ kind: 'unbalanced', off: ['O'] });
  });

  it('accepts a balanced equation only with the smallest whole numbers', () => {
    expect(check(methane, [1, 2, 1, 2])).toEqual({ kind: 'ok' });
    expect(check(methane, [2, 4, 2, 4])).toEqual({ kind: 'notSimplest', by: 2 });
    expect(check(propane, [3, 15, 9, 12])).toEqual({ kind: 'notSimplest', by: 3 });
    expect(check(methane, [0, 2, 1, 2]).kind).toBe('unbalanced');
  });

  it('tallies the atoms on each side with their sources', () => {
    const t = tally(methane, [1, 2, 1, 2]);
    expect(t.find((x) => x.el === 'O')).toEqual({ el: 'O', left: 4, right: 4, leftParts: [[2, 2]], rightParts: [[1, 2], [2, 1]] });
    expect(t.find((x) => x.el === 'H')).toMatchObject({ left: 4, right: 4 });
  });
});

describe('hints', () => {
  const get = (id: string) => REACTIONS.find((r) => r.id === id)!;

  it('starts with the element in one compound on each side and leaves H, O and lone elements for last', () => {
    expect(strategy(get('propane'))).toEqual(['C', 'H', 'O']);
    expect(strategy(get('ostwald'))).toEqual(['N', 'H', 'O']);
    expect(strategy(get('furnace'))).toEqual(['C', 'O', 'Fe']);
    expect(strategy(get('thermite'))).toEqual(['O', 'Al', 'Fe']);
    expect(strategyHint(get('propane'))).toContain('\\ce{C}');
    expect(strategyHint(get('propane'))).toContain('برای آخر');
    expect(strategyHint(get('water'))).toContain('\\ce{H2O}');
  });

  it('points at the first element still off, then reveals final coefficients one by one', () => {
    const r = get('propane');
    expect(stateHint(r, [1, 1, 1, 1])).toContain('\\ce{C}');
    expect(stateHint(r, [1, 1, 3, 4])).toContain('\\ce{O}');
    expect(stateHint(r, [2, 10, 6, 8])).toContain('بر 2 بخش‌پذیرند');
    expect(stateHint(r, [1, 5, 3, 4])).toContain('بررسی');
    // C3H8 and CO2 (carbon), then H2O (hydrogen), and O2 last.
    expect(speciesOrder(r)).toEqual([0, 2, 3, 1]);
    // C3H8 already has its final coefficient 1, so the first reveal is CO2, then H2O.
    expect(nextReveal(r, [1, 1, 1, 1], [])).toBe(2);
    expect(nextReveal(r, [1, 1, 1, 1], [2])).toBe(3);
    expect(nextReveal(r, [1, 5, 3, 4], [])).toBeNull();
  });

  it('sends the learner to the lone element only when a whole number can fix it', () => {
    // CH4 + O2 -> CO2 + 2H2O: O is 2 against 4, and 2 O2 fixes it without touching anything else.
    expect(stateHint(get('methane'), [1, 1, 1, 2])).toMatch(/ضریب \$\\ce\{O2\}\$ را عوض کن؛ این کار/);
    // H2 + O2 -> H2O: one O on the right cannot come from whole O2 molecules.
    const w = stateHint(get('water'), [1, 1, 1]);
    expect(w).toContain('به عدد درستی نمی‌رسی');
    expect(w).toContain('\\ce{H2O}');
    // C8H18 + O2 -> 8CO2 + 9H2O: 25 O atoms means 12½ O2, so double everything.
    expect(stateHint(get('octane'), [1, 1, 8, 9])).toContain('دو برابر');
  });

  it('every hint is well-formed markup for every reaction and every state', () => {
    for (const r of REACTIONS) {
      const ones = allSpecies(r).map(() => 1);
      for (const s of [strategyHint(r), stateHint(r, ones), stateHint(r, r.answer)]) {
        expect((s.match(/\$/g) ?? []).length % 2, `${r.id}: ${s}`).toBe(0);
        // (NaN3, sodium azide, is a real formula here.)
        expect(s).not.toMatch(/undefined|NaN(?!3)/);
      }
    }
  });

  it('writes the equation for mhchem, leaving out coefficients of 1', () => {
    const r = get('water');
    expect(equationTex(r, [2, 1, 2])).toBe('2H2 + O2 -> 2H2O');
    expect(equationTex(r, [2, 1, 2], true)).toBe('2H2(g) + O2(g) -> 2H2O(l)');
  });
});
