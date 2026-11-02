import katex from 'katex';
import 'katex/contrib/mhchem';
import { describe, expect, it } from 'vitest';
import { LESSONS } from '../src/content';
import { WARMUPS } from '../src/content/warmups';

const tex = (s: string) => {
  for (const m of s.matchAll(/\$([^$]+)\$/g)) expect(() => katex.renderToString(m[1], { throwOnError: true, macros: { '\\dec': '{\\char"066B}' } }), m[1]).not.toThrow();
};

describe('«پیش از درس» warm-ups', () => {
  it('every lesson has one, with valid questions', () => {
    const ids = new Set<string>();
    for (const l of LESSONS) {
      const w = WARMUPS[l.id];
      expect(w, l.id).toBeDefined();
      expect(w.uses.length, l.id).toBeGreaterThanOrEqual(2);
      expect(w.prereqs.length, l.id).toBeGreaterThanOrEqual(2);
      expect(w.prereqs.length, l.id).toBeLessThanOrEqual(3);
      tex(w.why);
      for (const { q, refresh } of w.prereqs) {
        expect(ids.has(q.id), q.id).toBe(false);
        ids.add(q.id);
        expect(q.id.startsWith(`w.${l.id}.`), q.id).toBe(true);
        expect(l.concepts.some((c) => c.id === q.concept), q.id).toBe(true);
        expect(refresh.length, q.id).toBeGreaterThan(20);
        tex(q.prompt);
        tex(q.explain);
        tex(refresh);
        if (q.type === 'mcq') {
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.options.length);
          expect(new Set(q.options).size).toBe(q.options.length);
          q.options.forEach(tex);
        }
      }
    }
    expect(Object.keys(WARMUPS).every((id) => LESSONS.some((l) => l.id === id))).toBe(true);
  });
});
