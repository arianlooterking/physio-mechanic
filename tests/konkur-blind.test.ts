/**
 * Blind check of «تست کنکوری» answers (see docs/konkur.md). Skipped in normal runs.
 *
 *   KONKUR_EXPORT=hesaban KONKUR_OUT=/path/blind.json npx vitest run tests/konkur-blind.test.ts
 *     writes the questions of one book (or of comma-separated lesson ids) with the answers left out;
 *   KONKUR_EXPORT=hesaban KONKUR_CHECK=/path/answers.json npx vitest run tests/konkur-blind.test.ts
 *     compares a solver's answers ({ "<id>": <option index 0–3>, … }) with the keys and fails on any difference.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LESSONS } from '../src/content';

const scope = process.env.KONKUR_EXPORT ?? '';
const lessons = LESSONS.filter((l) => l.konkur && (l.subject === scope || scope.split(',').includes(l.id)));
const items = lessons.flatMap((l) => (l.konkur?.tests ?? []).map((q) => ({ q, l })));

describe.skipIf(!scope)('konkur blind check', () => {
  it('finds questions to check', () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it.runIf(Boolean(process.env.KONKUR_OUT))('exports the questions without their answers', () => {
    const out = items.map(({ q, l }) => ({
      id: q.id,
      lesson: `${l.title} (${l.label})`,
      concept: l.concepts.find((c) => c.id === q.concept)?.title ?? '',
      prompt: q.prompt,
      plot: q.plot ?? null,
      options: q.options,
    }));
    writeFileSync(process.env.KONKUR_OUT!, JSON.stringify(out, null, 1));
  });

  it.runIf(Boolean(process.env.KONKUR_CHECK))('matches the solver on every question', () => {
    const solved = JSON.parse(readFileSync(process.env.KONKUR_CHECK!, 'utf8')) as Record<string, number | { answer: number }>;
    const diff: string[] = [];
    for (const { q } of items) {
      const v = solved[q.id];
      const a = typeof v === 'object' && v ? v.answer : v;
      if (a === undefined) diff.push(`${q.id}: not solved`);
      else if (a !== q.answer) diff.push(`${q.id}: key ${q.answer}, solver ${a}`);
    }
    expect(diff).toEqual([]);
  });
});
