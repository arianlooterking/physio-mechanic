import katex from 'katex';
import 'katex/contrib/mhchem';
import { describe, expect, it } from 'vitest';
import { BOOKS, LESSONS, SUBJECTS } from '../src/content';
import { findTerm, symbolsIn, TERMS } from '../src/content/glossary';
import { INTROS, introTerms } from '../src/content/intros';
import { WARMUPS } from '../src/content/warmups';
import type { Block, Lesson, PlotSpec, Question } from '../src/content/types';
import { buildPath, pickPractice } from '../src/lib/learner';
import { initialState } from '../src/lib/state';

/* ---------- helpers ---------- */

function mathIn(text: string): string[] {
  const out: string[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
  let m: RegExpExecArray | null;
  const cleaned = text.replace(/\\\$/g, '');
  while ((m = re.exec(cleaned))) out.push(m[1] ?? m[2]);
  return out;
}

function renders(tex: string): string | null {
  try {
    katex.renderToString(tex, {
      throwOnError: true,
      strict: 'ignore',
      macros: { '\\dec': '{\\char"066B}', '\\R': '\\mathbb{R}' },
    });
    return null;
  } catch (e) {
    return String((e as Error).message);
  }
}

/** How long an option reads on screen: TeX commands count as one letter, spaces and braces not at all. */
function shownLength(text: string): number {
  return text
    .replace(/\$([^$]*)\$/g, (_, m: string) => m.replace(/\\[a-zA-Z]+/g, 'x').replace(/[{}\s]/g, ''))
    .replace(/\s+/g, ' ')
    .trim().length;
}

/** Share of questions whose right option is the single longest one (so a learner could guess by length). */
function longestRightShare(qs: { options: readonly string[]; answer: number }[]): number {
  const hits = qs.filter((q) => {
    const lens = q.options.map(shownLength);
    const max = Math.max(...lens);
    return lens[q.answer] === max && lens.filter((x) => x === max).length === 1;
  }).length;
  return qs.length ? hits / qs.length : 0;
}

/** All rich-text strings and display TeX of a lesson, with a label for error messages. */
function collect(lesson: Lesson): { where: string; text?: string; tex?: string }[] {
  const out: { where: string; text?: string; tex?: string }[] = [];
  const blocks = (bs: Block[], where: string) => {
    bs.forEach((b, i) => {
      const w = `${where}/b${i}:${b.t}`;
      switch (b.t) {
        case 'p':
        case 'h':
          out.push({ where: w, text: b.text });
          break;
        case 'math':
          out.push({ where: w, tex: b.tex });
          if (b.caption) out.push({ where: w, text: b.caption });
          break;
        case 'note':
          out.push({ where: w, text: b.text });
          if (b.title) out.push({ where: w, text: b.title });
          break;
        case 'list':
          b.items.forEach((t) => out.push({ where: w, text: t }));
          break;
        case 'steps':
          b.items.forEach((s) => {
            out.push({ where: w, text: s.text });
            if (s.tex) out.push({ where: w, tex: s.tex });
          });
          break;
        case 'example':
          out.push({ where: w, text: b.problem });
          blocks(b.solution, w);
          break;
        case 'table':
          b.head.forEach((t) => out.push({ where: w, text: t }));
          b.rows.flat().forEach((t) => out.push({ where: w, text: t }));
          if (b.caption) out.push({ where: w, text: b.caption });
          break;
        case 'compare':
          b.items.forEach((it) => {
            out.push({ where: w, text: it.title });
            it.points.forEach((t) => out.push({ where: w, text: t }));
          });
          break;
        case 'plot':
        case 'widget':
          if ('caption' in b && b.caption) out.push({ where: w, text: b.caption });
          break;
        case 'book':
          if (b.text) out.push({ where: w, text: b.text });
          break;
        case 'konkur':
          out.push({ where: w, text: b.problem });
          b.options.forEach((o) => out.push({ where: w, text: o }));
          blocks(b.solution, w);
          break;
      }
    });
  };
  out.push({ where: `${lesson.id}/intro`, text: lesson.intro });
  for (const c of lesson.concepts) {
    out.push({ where: `${c.id}/title`, text: c.title }, { where: `${c.id}/goal`, text: c.goal });
    c.summary.forEach((t) => out.push({ where: `${c.id}/summary`, text: t }));
    c.approaches.forEach((a, i) => {
      out.push({ where: `${c.id}/a${i}/title`, text: a.title });
      blocks(a.blocks, `${c.id}/a${i}`);
    });
  }
  const qs: Question[] = [...lesson.concepts.flatMap((c) => c.checks), ...lesson.practice];
  for (const q of qs) {
    out.push({ where: `${q.id}/prompt`, text: q.prompt }, { where: `${q.id}/explain`, text: q.explain });
    if (q.hint) out.push({ where: `${q.id}/hint`, text: q.hint });
    if (q.type === 'mcq' || q.type === 'cloze') q.options.forEach((o) => out.push({ where: `${q.id}/opt`, text: o }));
    if (q.type === 'mcq' && q.why) Object.values(q.why).forEach((t) => out.push({ where: `${q.id}/why`, text: t }));
    if (q.type === 'cloze') out.push({ where: `${q.id}/text`, text: q.text });
    if (q.type === 'order') q.items.forEach((t) => out.push({ where: `${q.id}/item`, text: t }));
    if (q.type === 'match') q.pairs.flat().forEach((t) => out.push({ where: `${q.id}/pair`, text: t }));
  }
  for (const t of [...lesson.test, ...(lesson.hard ?? []), ...(lesson.konkur?.tests ?? [])]) {
    out.push({ where: `${t.id}/prompt`, text: t.prompt }, { where: `${t.id}/explain`, text: t.explain });
    t.options.forEach((o) => out.push({ where: `${t.id}/opt`, text: o }));
  }
  (lesson.konkur?.tips ?? []).forEach((t, i) => out.push({ where: `${lesson.id}/konkur-tip${i}`, text: t.text }));
  for (const c of lesson.cards) {
    out.push({ where: `${c.id}/front`, text: c.front }, { where: `${c.id}/back`, text: c.back });
    if (c.tex) out.push({ where: `${c.id}/tex`, tex: c.tex });
  }
  for (const w of lesson.written ?? []) {
    out.push({ where: `${w.id}/prompt`, text: w.prompt }, { where: `${w.id}/explain`, text: w.explain });
    w.steps.forEach((st, i) => {
      out.push({ where: `${w.id}/step${i}`, text: st.text });
      if (st.tex) out.push({ where: `${w.id}/step${i}/tex`, tex: st.tex });
    });
  }
  return out;
}

function checkPlot(spec: PlotSpec, where: string) {
  expect(spec.x[1], `${where}: x range`).toBeGreaterThan(spec.x[0]);
  expect(spec.y[1], `${where}: y range`).toBeGreaterThan(spec.y[0]);
  expect(spec.curves.length, `${where}: curves`).toBeGreaterThan(0);
}

/* ---------- tests ---------- */

describe('catalog', () => {
  it('has grade 10–12 subjects, each with lessons and a library book', () => {
    expect(SUBJECTS.map((s) => s.id)).toEqual(expect.arrayContaining(['bm1', 'bm2']));
    for (const s of SUBJECTS) {
      expect(s.lessons.length, s.id).toBeGreaterThanOrEqual(1);
      const b = BOOKS.find((x) => x.id === s.book);
      expect(b?.subject, s.id).toBe(s.id);
      expect(b?.grade, s.id).toBe(s.grade);
      for (const l of s.lessons) expect(l.subject, l.id).toBe(s.id);
    }
  });

  it('uses unique ids everywhere', () => {
    const ids: string[] = [];
    for (const l of LESSONS) {
      ids.push(l.id);
      for (const c of l.concepts) {
        ids.push(c.id);
        c.checks.forEach((q) => ids.push(q.id));
      }
      l.practice.forEach((q) => ids.push(q.id));
      l.test.forEach((q) => ids.push(q.id));
      l.cards.forEach((c) => ids.push(c.id));
      (l.written ?? []).forEach((q) => ids.push(q.id));
      (l.hard ?? []).forEach((q) => ids.push(q.id));
      (l.konkur?.tests ?? []).forEach((q) => ids.push(q.id));
    }
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });
});

describe('intros and glossary', () => {
  const texOk = (s: string) => {
    for (const m of s.matchAll(/\$([^$]+)\$/g)) expect(() => katex.renderToString(m[1], { throwOnError: true, macros: { '\\dec': '{\\char"066B}' } }), m[1]).not.toThrow();
  };
  it('gives every concept a plain-language intro whose key words are in the glossary', () => {
    for (const l of LESSONS)
      for (const c of l.concepts) {
        const intro = INTROS[c.id];
        expect(intro, c.id).toBeTruthy();
        expect((intro.match(/\$/g) ?? []).length % 2, c.id).toBe(0);
        texOk(intro);
        for (const w of introTerms(intro)) expect(findTerm(w), `${c.id}: ${w}`).toBeTruthy();
      }
  });
  it('keeps the backslash of every TeX command', () => {
    // In a plain '…' string \frac loses its backslash and shows as «frac»; such text belongs in r`…`.
    const bad: string[] = [];
    const walk = (v: unknown, where: string) => {
      if (typeof v === 'string') {
        if (/(^|[^\\a-zA-Z])(dec|frac|dfrac|tfrac|sqrt|times|cdot|text|mathrm|ce|left|right|approx|alpha|beta|theta|pi|Delta|log|sin|cos)\{/.test(v)) bad.push(where);
        // Inside math a bare command name (100^circ, a cdot b) is the same loss.
        for (const m of v.matchAll(/\$([^$]+)\$/g))
          if (/(^|[^\\a-zA-Z])(circ|cdot|times|approx|infty|Rightarrow|Leftrightarrow|forall|exists|alpha|beta|theta|lambda|omega|Delta|le|ge|leq|geq|neq|notin|subseteq|cup|cap|to|lim|sqrt|frac|tfrac|dfrac|div|perp|vec|overline|ldots|cdots|sin|cos|tan|cot|log|ln)(?![a-zA-Z])/.test(m[1])) bad.push(`${where}: ${m[1]}`);
      } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
    };
    for (const l of LESSONS) walk(l, l.id);
    walk(TERMS, 'glossary');
    walk(INTROS, 'intros');
    walk(WARMUPS, 'warmups');
    expect(bad).toEqual([]);
  });
  it('writes decimals with {\\dec}, keeping {,} for thousands only', () => {
    const text = JSON.stringify([LESSONS, TERMS, INTROS, WARMUPS]);
    expect(text.match(/.{0,20}\{,\}\d{1,2}(?!\d).{0,10}/g) ?? []).toEqual([]);
  });
  it('has unique, renderable glossary entries', () => {
    expect(new Set(TERMS.map((t) => t.id)).size).toBe(TERMS.length);
    for (const t of TERMS) {
      for (const s of [t.short, t.long, ...(t.examples ?? [])]) texOk(s);
      // A Latin formula outside $…$ (x = 2, a > 1, √x, aˣ, f(x)) comes out scrambled in right-to-left text.
      for (const s of [t.short, t.long]) {
        const plain = (s ?? '').replace(/\$[^$]*\$/g, ' ');
        expect(plain, `${t.id}: put the formula inside $…$`).not.toMatch(/[A-Za-z0-9)]\s*[=<>≤≥≠→]|[=<>≤≥≠→]\s*[A-Za-z0-9−-]|√|[A-Za-z][²³ˣʸⁿᵗ⁻]|\b[a-z]\(/);
      }
      if (t.tex) expect(() => katex.renderToString(t.tex!, { throwOnError: true })).not.toThrow();
    }
  });
  it('gives each glossary word one meaning per subject', () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const t of TERMS)
      for (const n of [t.title, ...(t.aliases ?? [])]) {
        const key = `${t.subject}:${n.replace(/\u200c/g, '').trim()}`;
        const prev = owner.get(key);
        if (prev && prev !== t.id) clashes.push(`${n}: ${prev} / ${t.id}`);
        owner.set(key, t.id);
      }
    expect(clashes).toEqual([]);
  });
  it('explains the symbols students ask about', () => {
    expect(symbolsIn(String.raw`\sigma=\dfrac{F}{A}`, 'physics').map((t) => t.id)).toContain('tanesh');
    expect(symbolsIn(String.raw`\dfrac{a}{b}`, 'physics')).toEqual([]);
  });
});

describe('library', () => {
  it('lists each part of the book once, with a link', () => {
    expect(new Set(BOOKS.map((b) => b.id)).size).toBe(BOOKS.length);
    for (const b of BOOKS) expect(b.pdf || b.page).toMatch(/^https:\/\//);
  });
  it('marks exactly the parts that have lessons as ready', () => {
    const ready = BOOKS.filter((b) => b.available);
    expect(ready.map((b) => b.subject).sort()).toEqual(SUBJECTS.map((s) => s.id).sort());
  });
});

describe.each(LESSONS.map((l) => [l.id, l] as const))('lesson %s', (_id, lesson) => {
  const conceptIds = new Set(lesson.concepts.map((c) => c.id));

  it('has well-formed concepts with several distinct ways of explaining', () => {
    expect(lesson.concepts.length).toBeGreaterThanOrEqual(3);
    for (const c of lesson.concepts) {
      expect(c.approaches.length, `${c.id} approaches`).toBeGreaterThanOrEqual(3);
      const kinds = c.approaches.map((a) => a.kind);
      expect(new Set(kinds).size, `${c.id} distinct approach kinds`).toBe(kinds.length);
      expect(c.checks.length, `${c.id} checks`).toBeGreaterThanOrEqual(2);
      expect(c.summary.length, `${c.id} summary`).toBeGreaterThanOrEqual(2);
      for (const q of c.checks) expect(q.concept, `${q.id} concept`).toBe(c.id);
      for (const a of c.approaches) expect(a.blocks.length, `${c.id} ${a.kind} blocks`).toBeGreaterThan(0);
    }
  });

  it('has valid questions', () => {
    const qs: Question[] = [...lesson.concepts.flatMap((c) => c.checks), ...lesson.practice];
    for (const q of qs) {
      expect(conceptIds.has(q.concept), `${q.id}: concept ${q.concept} belongs to lesson`).toBe(true);
      expect(q.explain.length, `${q.id} explain`).toBeGreaterThan(3);
      switch (q.type) {
        case 'mcq':
          expect(q.options.length, q.id).toBeGreaterThanOrEqual(3);
          expect(new Set(q.options).size, `${q.id} unique options`).toBe(q.options.length);
          expect(q.answer, q.id).toBeGreaterThanOrEqual(0);
          expect(q.answer, q.id).toBeLessThan(q.options.length);
          break;
        case 'cloze':
          expect(q.text.split('___').length, `${q.id} one blank`).toBe(2);
          expect(new Set(q.options).size, `${q.id} unique options`).toBe(q.options.length);
          expect(q.answer).toBeLessThan(q.options.length);
          break;
        case 'tf':
          expect(typeof q.answer).toBe('boolean');
          break;
        case 'num':
          expect(Number.isFinite(q.answer), q.id).toBe(true);
          break;
        case 'order':
          expect(q.items.length, q.id).toBeGreaterThanOrEqual(3);
          expect(new Set(q.items).size, `${q.id} unique items`).toBe(q.items.length);
          break;
        case 'match': {
          expect(q.pairs.length, q.id).toBeGreaterThanOrEqual(3);
          const left = q.pairs.map((p) => p[0].trim());
          const right = q.pairs.map((p) => p[1].trim());
          expect(new Set(left).size, `${q.id} unique left`).toBe(left.length);
          expect(new Set(right).size, `${q.id} unique right`).toBe(right.length);
          break;
        }
        case 'graph':
          expect(q.graphs.length, q.id).toBeGreaterThanOrEqual(2);
          expect(q.answer).toBeLessThan(q.graphs.length);
          q.graphs.forEach((g, i) => checkPlot(g, `${q.id}#${i}`));
          break;
      }
      if (q.plot) checkPlot(q.plot, q.id);
    }
  });

  it('has a konkur-style test with four distinct options', () => {
    expect(lesson.test.length).toBeGreaterThanOrEqual(10);
    for (const t of lesson.test) {
      expect(conceptIds.has(t.concept), `${t.id} concept`).toBe(true);
      expect(new Set(t.options).size, `${t.id} unique options`).toBe(4);
      expect([0, 1, 2, 3]).toContain(t.answer);
      if (t.plot) checkPlot(t.plot, t.id);
    }
  });

  it('never points at another question, since questions are shuffled', () => {
    const all = [...lesson.concepts.flatMap((c) => c.checks), ...lesson.practice, ...lesson.test, ...(lesson.hard ?? []), ...(lesson.written ?? [])];
    for (const q of all) expect(q.prompt, `${q.id} refers to a previous question`).not.toMatch(/(سؤال|سوال|پرسش|تست|مسئلهٔ?) قبل/);
  });

  it('keeps test and hard questions out of practice, so the test is not seen beforehand', () => {
    const norm = (t: string) => t.replace(/\s+/g, '').replace(/[.:؟?،,]/g, '');
    // Same prompt with different options (e.g. «کدام گزاره درست است؟») is a different question.
    const right = (q: { options?: string[]; answer?: unknown }) => (q.options && typeof q.answer === 'number' ? norm(q.options[q.answer]) : undefined);
    const practice = new Map([...lesson.concepts.flatMap((c) => c.checks), ...lesson.practice].map((q) => [norm(q.prompt), q]));
    const repeats = [...lesson.test, ...(lesson.hard ?? [])].filter((t) => {
      const p = practice.get(norm(t.prompt));
      return p && (right(p as never) === undefined || right(p as never) === right(t));
    }).map((t) => `${t.id} = ${practice.get(norm(t.prompt))!.id}`);
    expect(repeats).toEqual([]);
  });

  it('has no repeated items in match and order questions, since they are graded by position', () => {
    const all = [...lesson.concepts.flatMap((c) => c.checks), ...lesson.practice, ...lesson.test, ...(lesson.hard ?? [])];
    for (const q of all) {
      const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
      if ('items' in q) expect(new Set(q.items.map(norm)).size, `${q.id} repeats an item`).toBe(q.items.length);
      if ('items' in q)
        for (const alt of q.alts ?? []) {
          // Each other accepted order uses every item once and differs from the items' own order.
          expect([...alt].sort((a, b) => a - b), `${q.id} alt ${alt}`).toEqual(q.items.map((_, i) => i));
          expect(alt.some((v, i) => v !== i), `${q.id} alt repeats the main order`).toBe(true);
        }
      if (!('pairs' in q)) continue;
      expect(new Set(q.pairs.map(([l]) => norm(l))).size, `${q.id} repeats a left item`).toBe(q.pairs.length);
      expect(new Set(q.pairs.map(([, r]) => norm(r))).size, `${q.id} repeats a right item`).toBe(q.pairs.length);
    }
  });

  it('does not give the right option away by its length', () => {
    // Options are shuffled on screen, but a right answer that is usually the longest is still a giveaway.
    const mcqs = [...lesson.concepts.flatMap((c) => c.checks), ...lesson.practice].filter((q): q is Extract<Question, { type: 'mcq' }> => q.type === 'mcq');
    const tests = [...lesson.test, ...(lesson.hard ?? [])];
    for (const [name, group] of [['checks and practice', mcqs], ['test', tests]] as const) {
      if (group.length < 6) continue;
      expect(longestRightShare(group), `${lesson.id} ${name}: right option is the longest too often`).toBeLessThanOrEqual(0.45);
    }
  });

  it('has well-formed hard (konkur-level) questions and worked konkur examples', () => {
    for (const t of lesson.hard ?? []) {
      expect(conceptIds.has(t.concept), `${t.id} concept`).toBe(true);
      expect(new Set(t.options).size, `${t.id} unique options`).toBe(4);
      expect(t.explain.length, `${t.id}: a hard question needs a real explanation`).toBeGreaterThan(40);
    }
    const walk = (bs: Block[]): void =>
      bs.forEach((b) => {
        if (b.t === 'konkur') {
          expect(b.options.length, b.problem).toBe(4);
          expect(new Set(b.options).size, b.problem).toBe(4);
          expect(b.answer).toBeLessThan(4);
          expect(b.solution.length, b.problem).toBeGreaterThan(0);
        }
        if (b.t === 'example') walk(b.solution);
      });
    for (const c of lesson.concepts) for (const a of c.approaches) walk(a.blocks);
  });

  it('has a well-formed «تست کنکوری» and «نکته‌های کنکوری» when it has any', () => {
    const k = lesson.konkur;
    if (!k) return;
    expect(k.tips.length + k.tests.length, `${lesson.id}: empty konkur pack`).toBeGreaterThan(0);
    if (k.tests.length) expect(k.tests.length, `${lesson.id}: a konkur test needs at least four questions`).toBeGreaterThanOrEqual(4);
    const seen = new Set([...lesson.test, ...(lesson.hard ?? [])].map((t) => t.prompt.replace(/\s+/g, '')));
    for (const t of k.tests) {
      expect(t.id.startsWith(`${lesson.id}-k`), `${t.id}: konkur ids are <lesson>-k<n>`).toBe(true);
      expect(conceptIds.has(t.concept), `${t.id} concept`).toBe(true);
      expect(new Set(t.options).size, `${t.id} unique options`).toBe(4);
      expect([0, 1, 2, 3]).toContain(t.answer);
      expect(t.explain.length, `${t.id}: a konkur question needs a worked solution`).toBeGreaterThan(60);
      expect(seen.has(t.prompt.replace(/\s+/g, '')), `${t.id} repeats a lesson-test or hard question`).toBe(false);
      expect(t.prompt, `${t.id} refers to a previous question`).not.toMatch(/(سؤال|سوال|پرسش|تست|مسئلهٔ?) قبل/);
      if (t.source) expect(t.source, `${t.id} source`).toMatch(/^الگوی (سراسری|کنکور)/);
      if (t.plot) checkPlot(t.plot, t.id);
    }
    if (k.tests.length >= 6) expect(longestRightShare(k.tests), `${lesson.id} konkur: right option is the longest too often`).toBeLessThanOrEqual(0.45);
    for (const tip of k.tips) {
      expect(['trap', 'shortcut', 'frequent']).toContain(tip.kind);
      expect(tip.text.length, `${lesson.id}: tip too short`).toBeGreaterThan(20);
      if (tip.concept) expect(conceptIds.has(tip.concept), `${lesson.id} tip concept ${tip.concept}`).toBe(true);
    }
  });

  it('has well-formed written (final-exam) questions', () => {
    for (const w of lesson.written ?? []) {
      expect(conceptIds.has(w.concept), `${w.id} concept`).toBe(true);
      expect(w.type).toBe('written');
      expect(w.steps.length, `${w.id} steps`).toBeGreaterThanOrEqual(2);
      const sum = w.steps.reduce((a, st) => a + st.pts, 0);
      expect(Math.abs(sum - w.points), `${w.id}: step marks add up to the total`).toBeLessThan(1e-9);
      expect(w.points * 4, `${w.id}: marks in quarter points`).toBe(Math.round(w.points * 4));
    }
  });

  it('has flashcards for its concepts', () => {
    expect(lesson.cards.length).toBeGreaterThanOrEqual(8);
    for (const c of lesson.cards) expect(conceptIds.has(c.concept), `${c.id} concept`).toBe(true);
  });

  it('covers every concept in practice and in the test', () => {
    for (const c of lesson.concepts) {
      expect(lesson.practice.some((q) => q.concept === c.id), `${c.id} in practice`).toBe(true);
      expect(lesson.test.some((q) => q.concept === c.id) || lesson.practice.filter((q) => q.concept === c.id).length >= 2, `${c.id} tested`).toBe(true);
    }
  });

  it('gives every practice node enough questions', () => {
    const s = initialState();
    for (const node of buildPath(lesson).filter((n) => n.kind === 'practice')) {
      const qs = pickPractice(s, lesson, node.concepts!, 10, 0, 42);
      expect(qs.length, node.id).toBeGreaterThanOrEqual(6);
      expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
    }
  });

  it('has text that renders: balanced markup and valid TeX', () => {
    const problems: string[] = [];
    for (const item of collect(lesson)) {
      if (item.text !== undefined) {
        const t = item.text;
        if (/\t/.test(t)) problems.push(`${item.where}: tab character`);
        const dollars = (t.replace(/\\\$/g, '').match(/\$/g) ?? []).length;
        if (dollars % 2) problems.push(`${item.where}: odd number of $ in «${t}»`);
        if ((t.match(/\*\*/g) ?? []).length % 2) problems.push(`${item.where}: unbalanced ** in «${t}»`);
        if ((t.match(/<</g) ?? []).length !== (t.match(/>>/g) ?? []).length) problems.push(`${item.where}: unbalanced <<…>> in «${t}»`);
        const bare = t.replace(/\$[^$]*\$/g, '');
        if (/[A-Za-z0-9)][⁺⁻]|[√∛][A-Za-z(]/.test(bare)) problems.push(`${item.where}: ion charge or root outside $…$ flips in RTL: «${t}»`);
        for (const m of mathIn(t)) {
          const err = renders(m);
          if (err) problems.push(`${item.where}: ${err} in $${m}$`);
        }
      }
      if (item.tex !== undefined) {
        const err = renders(item.tex);
        if (err) problems.push(`${item.where}: ${err} in ${item.tex}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
