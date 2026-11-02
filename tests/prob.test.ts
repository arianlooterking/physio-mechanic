import { describe, expect, it } from 'vitest';
import { eventsFor, exact, playable, sampleSpace, seeded, trial, type Exp } from '../src/lib/prob';

const ev = (e: Exp, id: string) => eventsFor(e).find((x) => x.id === id)!;
const P = (e: Exp, id: string) => {
  const r = exact(e, ev(e, id));
  return [r.num, r.den];
};

describe('probability lab', () => {
  it('counts the book answers', () => {
    expect(P({ kind: 'die', count: 2 }, 'sum7')).toEqual([1, 6]);
    expect(P({ kind: 'die', count: 2 }, 'double')).toEqual([1, 6]);
    expect(P({ kind: 'die', count: 2 }, 'sum10')).toEqual([1, 6]);
    expect(P({ kind: 'die', count: 2 }, 'six')).toEqual([11, 36]);
    expect(P({ kind: 'die', count: 1 }, 'prime')).toEqual([1, 2]);
    expect(P({ kind: 'die', count: 1 }, 'gt4')).toEqual([1, 3]);
    expect(P({ kind: 'coin', count: 3 }, 'some')).toEqual([7, 8]);
    expect(P({ kind: 'coin', count: 3 }, 'one')).toEqual([3, 8]);
    expect(P({ kind: 'coin', count: 2 }, 'all')).toEqual([1, 4]);
  });

  it('draws marbles with and without putting them back', () => {
    const without: Exp = { kind: 'urn', red: 3, blue: 5, draws: 2, replace: false };
    const withBack: Exp = { kind: 'urn', red: 3, blue: 5, draws: 2, replace: true };
    expect(sampleSpace(without)).toHaveLength(28); // C(8, 2)
    expect(P(without, 'both')).toEqual([3, 28]); // C(3, 2) / C(8, 2)
    expect(P(without, 'mixed')).toEqual([15, 28]); // 3 × 5 / 28
    expect(P(withBack, 'both')).toEqual([9, 64]);
    expect(P(withBack, 'mixed')).toEqual([30, 64].map((x) => x / 2));
    expect(P({ kind: 'urn', red: 3, blue: 5, draws: 1, replace: false }, 'red')).toEqual([3, 8]);
    expect(playable({ kind: 'urn', red: 1, blue: 0, draws: 2, replace: false })).toBe(false);
    expect(playable({ kind: 'urn', red: 1, blue: 0, draws: 2, replace: true })).toBe(true);
  });

  it('lets the relative frequency settle near the probability', () => {
    const rnd = seeded(7);
    const cases: [Exp, string][] = [
      [{ kind: 'die', count: 2 }, 'sum7'],
      [{ kind: 'coin', count: 3 }, 'some'],
      [{ kind: 'urn', red: 3, blue: 5, draws: 2, replace: false }, 'both'],
      [{ kind: 'urn', red: 3, blue: 5, draws: 2, replace: true }, 'mixed'],
    ];
    for (const [e, id] of cases) {
      const A = ev(e, id);
      let hits = 0;
      const N = 20000;
      for (let i = 0; i < N; i++) if (A.test(trial(e, rnd))) hits++;
      expect(Math.abs(hits / N - exact(e, A).p), `${e.kind} ${id}`).toBeLessThan(0.015);
    }
  });

  it('never draws the same marble twice without putting it back', () => {
    const rnd = seeded(3);
    const e: Exp = { kind: 'urn', red: 1, blue: 1, draws: 2, replace: false };
    for (let i = 0; i < 200; i++) expect(trial(e, rnd).sort()).toEqual([0, 1]);
  });
});
