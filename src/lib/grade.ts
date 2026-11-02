import type { OrderQ, Question, TestQ } from '../content/types';
import { answerMatches } from './digits';

export type Answer =
  | { t: 'mcq'; choice: number }
  | { t: 'tf'; value: boolean }
  | { t: 'num'; raw: string }
  | { t: 'order'; seq: number[] }
  | { t: 'match'; mistakes: number; done: boolean }
  | { t: 'cloze'; choice: number }
  | { t: 'graph'; choice: number }
  /** Self-marked written answer: 1 = all correct, 0.5 = partly, 0 = could not. */
  | { t: 'written'; score: number };

export function isComplete(q: Question, a: Answer | null): boolean {
  if (!a) return false;
  switch (q.type) {
    case 'mcq':
    case 'cloze':
    case 'graph':
      return (a.t === 'mcq' || a.t === 'cloze' || a.t === 'graph') && a.choice >= 0;
    case 'tf':
      return a.t === 'tf';
    case 'num':
      return a.t === 'num' && a.raw.trim().length > 0;
    case 'order':
      return a.t === 'order' && a.seq.length === q.items.length;
    case 'match':
      return a.t === 'match' && a.done;
    case 'written':
      return a.t === 'written';
  }
}

export function grade(q: Question, a: Answer): boolean {
  switch (q.type) {
    case 'mcq':
      return a.t === 'mcq' && a.choice === q.answer;
    case 'cloze':
      return a.t === 'cloze' && a.choice === q.answer;
    case 'graph':
      return a.t === 'graph' && a.choice === q.answer;
    case 'tf':
      return a.t === 'tf' && a.value === q.answer;
    case 'num':
      return a.t === 'num' && answerMatches(a.raw, q.answer, q.tol);
    case 'order':
      return a.t === 'order' && orderTarget(q, a.seq) !== null;
    case 'match':
      return a.t === 'match' && a.done && a.mistakes === 0;
    case 'written':
      // Honest self-marking: a partly right answer is not punished; the learner model still sees it.
      return a.t === 'written' && a.score >= 0.5;
  }
}

/** The accepted order (the items' own order or one of `alts`) that a learner's sequence matches, or null. */
export function orderTarget(q: OrderQ, seq: number[]): number[] | null {
  const same = (o: number[]) => o.length === seq.length && o.every((v, i) => v === seq[i]);
  const own = q.items.map((_, i) => i);
  return [own, ...(q.alts ?? [])].find(same) ?? null;
}

/** Plain description of the right answer, for the feedback panel. */
export function rightAnswerText(q: Question): string {
  switch (q.type) {
    case 'mcq':
      return q.options[q.answer];
    case 'cloze':
      return q.options[q.answer];
    case 'tf':
      return q.answer ? 'درست' : 'نادرست';
    case 'num':
      return `$${String(q.answer).replace('.', '{\\dec}').replace('-', '-')}$${q.unit ? ` ${q.unit}` : ''}`;
    case 'order':
      return q.items.map((s, i) => `${i + 1}) ${s}`).join('\n');
    case 'graph':
      return `نمودار ${'الف ب پ ت ث'.split(' ')[q.answer]}`;
    case 'match':
    case 'written':
      return '';
  }
}

export function testToQuestion(t: TestQ): Question {
  return {
    id: t.id,
    concept: t.concept,
    level: t.level,
    type: 'mcq',
    prompt: t.prompt,
    plot: t.plot,
    options: t.options,
    answer: t.answer,
    explain: t.explain,
  };
}

/** Deterministic shuffle of indices 0..n-1. */
export function shuffled(n: number, seed: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  let s = (seed >>> 0) || 1;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
