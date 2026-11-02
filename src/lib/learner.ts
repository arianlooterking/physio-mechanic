import { LESSONS, lessonById, questionById, testById } from '../content';
import type { Lesson, Question } from '../content/types';
import { testToQuestion } from './grade';
import { conceptOf, ensureLesson, isDue, lessonOf, openMistakes, type AppState } from './state';
import { dayKey } from './time';

/**
 * Any question by id, with its lesson: practice, checks, written and hard ones, and the lesson-test questions
 * too (as four-option questions), so mistakes made in a test or a mock exam reach the mistakes notebook.
 */
export function findQuestion(id: string): { q: Question; lesson: Lesson } | undefined {
  const hit = questionById(id);
  if (hit) return hit;
  const t = testById(id);
  return t ? { q: testToQuestion(t.q), lesson: t.lesson } : undefined;
}

/* ---------------- Lesson path ---------------- */

export type NodeKind = 'concept' | 'practice' | 'final' | 'cards' | 'test' | 'hard';

export interface PathNode {
  id: string;
  kind: NodeKind;
  title: string;
  /** For concept nodes. */
  conceptId?: string;
  /** For practice nodes: which concepts it covers. */
  concepts?: string[];
}

/** Concepts in groups of three, a practice node after each group, then flashcards and the lesson test. */
export function buildPath(lesson: Lesson): PathNode[] {
  const nodes: PathNode[] = [];
  const ids = lesson.concepts.map((c) => c.id);
  let group: string[] = [];
  let practiceN = 0;
  lesson.concepts.forEach((c, i) => {
    nodes.push({ id: `${lesson.id}:c:${c.id}`, kind: 'concept', title: c.title, conceptId: c.id });
    group.push(c.id);
    const last = i === lesson.concepts.length - 1;
    if (group.length === 3 || last) {
      practiceN += 1;
      nodes.push({
        id: `${lesson.id}:p${practiceN}`,
        kind: 'practice',
        title: last && practiceN > 1 ? 'تمرین جامع' : 'تمرین',
        concepts: last && practiceN > 1 ? ids.slice() : group.slice(),
      });
      group = [];
    }
  });
  if ((lesson.written?.length ?? 0) >= 3) nodes.push({ id: `${lesson.id}:final`, kind: 'final', title: 'امتحان نهایی', concepts: ids.slice() });
  nodes.push({ id: `${lesson.id}:cards`, kind: 'cards', title: 'کارت‌های مرور' });
  nodes.push({ id: `${lesson.id}:test`, kind: 'test', title: 'آزمون درس' });
  if ((lesson.hard?.length ?? 0) >= 4) nodes.push({ id: `${lesson.id}:hard`, kind: 'hard', title: 'تست‌های سخت', concepts: ids.slice() });
  return nodes;
}

export function nodeDone(s: AppState, lesson: Lesson, node: PathNode): boolean {
  const lp = lessonOf(s, lesson.id);
  switch (node.kind) {
    case 'concept':
      return conceptOf(s, node.conceptId!).status === 'understood';
    case 'practice':
    case 'final':
    case 'hard':
      return Boolean(lp.done?.[node.id]);
    case 'cards':
      return lesson.cards.every((c) => (s.cards[c.id]?.reviews ?? 0) > 0);
    case 'test':
      return lp.tests.length > 0;
  }
}

/** Index of the first node not yet done (the "current" one), or nodes.length when all are done. */
export function currentIndex(s: AppState, lesson: Lesson, nodes = buildPath(lesson)): number {
  const i = nodes.findIndex((n) => !nodeDone(s, lesson, n));
  return i === -1 ? nodes.length : i;
}

/* ---------------- Where to pick up ---------------- */

/** When the learner last did something in this lesson (0 when never). */
export function lastActivity(s: AppState, lesson: Lesson): number {
  const lp = s.lessons[lesson.id];
  let t = Math.max(0, lp?.warmed ?? 0, ...Object.values(lp?.done ?? {}), ...(lp?.tests ?? []).map((r) => r.at ?? 0));
  for (const c of lesson.concepts) t = Math.max(t, s.concepts[c.id]?.lastSeen ?? 0);
  return Number.isFinite(t) ? t : 0;
}

export interface Resume {
  lesson: Lesson;
  node: PathNode;
  /** Index of `node` in the lesson path, and the path length. */
  index: number;
  total: number;
  progress: number;
  /** True when this is the next lesson after a finished one, not yet started. */
  fresh: boolean;
}

/**
 * Where a returning learner continues: the next step of the lesson they worked on last; when that lesson
 * is finished, the first step of the next unfinished lesson of the same subject. Null for a learner who
 * has not started any of `lessons` (or has finished the subject).
 */
export function resumePoint(s: AppState, lessons: Lesson[]): Resume | null {
  let last: Lesson | null = null;
  let at = 0;
  for (const l of lessons) {
    const t = lastActivity(s, l);
    if (t > at) [last, at] = [l, t];
  }
  if (!last) return null;
  const from = last;
  const lesson =
    lessonProgress(s, from) < 1
      ? from
      : lessons.slice(lessons.indexOf(from) + 1).find((l) => l.subject === from.subject && lessonProgress(s, l) < 1);
  if (!lesson) return null;
  const nodes = buildPath(lesson);
  const index = currentIndex(s, lesson, nodes);
  if (index >= nodes.length) return null;
  return { lesson, node: nodes[index], index, total: nodes.length, progress: lessonProgress(s, lesson), fresh: lesson !== from && lastActivity(s, lesson) === 0 };
}

/* ---------------- Mastery ---------------- */

export function lessonMastery(s: AppState, lesson: Lesson): number {
  if (!lesson.concepts.length) return 0;
  return lesson.concepts.reduce((a, c) => a + conceptOf(s, c.id).mastery, 0) / lesson.concepts.length;
}

export function lessonProgress(s: AppState, lesson: Lesson): number {
  const nodes = buildPath(lesson);
  return nodes.filter((n) => nodeDone(s, lesson, n)).length / nodes.length;
}

/**
 * Apply `change` and, when it is what completes the lesson's path, note the moment (for «گزارش هفته»).
 * Lessons finished before this was kept never get a date, so they do not show up as finished this week.
 */
export function trackFinish(s: AppState, lessonId: string | undefined, change: () => void, now = Date.now()): void {
  const lesson = lessonId ? lessonById(lessonId) : undefined;
  const before = lesson ? lessonProgress(s, lesson) : 1;
  change();
  if (lesson && before < 1 && lessonProgress(s, lesson) >= 1) {
    const lp = ensureLesson(s, lesson.id);
    lp.finished ??= now;
  }
}

export function understoodCount(s: AppState, lessons: Lesson[] = LESSONS): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const l of lessons) {
    for (const c of l.concepts) {
      total += 1;
      if (conceptOf(s, c.id).status === 'understood') done += 1;
    }
  }
  return { done, total };
}

/* ---------------- Picking practice questions ---------------- */

function seededRandom(seed: number) {
  let x = seed % 2147483647;
  if (x <= 0) x += 2147483646;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

/**
 * Adaptive selection: questions about weaker concepts, open mistakes and unseen questions are more likely;
 * questions answered in the last few minutes are less likely. Easier questions come first.
 */
export function pickPractice(s: AppState, lesson: Lesson, conceptIds: string[], n = 10, now = Date.now(), seed = now): Question[] {
  const set = new Set(conceptIds);
  let pool = lesson.practice.filter((q) => set.has(q.concept));
  const checks = lesson.concepts.filter((c) => set.has(c.id)).flatMap((c) => c.checks);
  if (pool.length < n) pool = pool.concat(checks);
  const rnd = seededRandom(Math.floor(seed));
  const mistakes = new Set(openMistakes(s));
  const weighted = pool.map((q) => {
    const m = conceptOf(s, q.concept).mastery;
    const st = s.questions[q.id];
    let w = 1.25 - m;
    if (mistakes.has(q.id)) w *= 2.2;
    if (!st) w *= 1.4;
    if (st?.at && now - st.at < 10 * 60 * 1000) w *= 0.25;
    if (st && st.correct >= 2 && st.last) w *= 0.6;
    const levelFit = m < 0.4 ? [1.3, 1, 0.5] : m < 0.75 ? [0.9, 1.2, 1] : [0.6, 1, 1.4];
    w *= levelFit[q.level - 1];
    return { q, key: Math.pow(rnd(), 1 / Math.max(w, 0.01)) };
  });
  weighted.sort((a, b) => b.key - a.key);
  const chosen = weighted.slice(0, Math.min(n, weighted.length)).map((x) => x.q);
  // Avoid two of the same type in a row where possible, then ease in by level.
  chosen.sort((a, b) => a.level - b.level);
  for (let i = 1; i < chosen.length; i++) {
    if (chosen[i].type === chosen[i - 1].type) {
      const j = chosen.findIndex((q, k) => k > i && q.type !== chosen[i - 1].type);
      if (j > -1) [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
    }
  }
  return chosen;
}

/** Written final-exam questions of a lesson: unseen and wrongly marked ones first, easiest first, at most `n`. */
export function pickWritten(s: AppState, lesson: Lesson, n = 5): Question[] {
  const qs = (lesson.written ?? []).slice();
  const rank = (q: Question) => (s.questions[q.id]?.last ? 1 : 0);
  qs.sort((a, b) => rank(a) - rank(b) || a.level - b.level);
  return qs.slice(0, n).sort((a, b) => a.level - b.level);
}

/** Cross-lesson review: open mistakes first, then questions from the weakest understood concepts. */
export function pickReview(s: AppState, n = 10, now = Date.now()): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  for (const id of openMistakes(s)) {
    const hit = findQuestion(id);
    if (hit && !seen.has(id)) {
      out.push(hit.q);
      seen.add(id);
    }
    if (out.length >= n) return out;
  }
  const concepts = LESSONS.flatMap((l) => l.concepts.map((c) => ({ c, l })))
    .filter(({ c }) => conceptOf(s, c.id).status !== 'new')
    .sort((a, b) => conceptOf(s, a.c.id).mastery - conceptOf(s, b.c.id).mastery);
  for (const { c, l } of concepts) {
    const qs = pickPractice(s, l, [c.id], 2, now, now + c.id.length);
    for (const q of qs) {
      if (!seen.has(q.id)) {
        out.push(q);
        seen.add(q.id);
      }
      if (out.length >= n) return out;
    }
  }
  return out;
}

export function reviewAvailable(s: AppState): number {
  return openMistakes(s).filter((id) => findQuestion(id)).length;
}

/* ---------------- Flashcards ---------------- */

export function dueCards(s: AppState, lessons: Lesson[] = LESSONS, today = dayKey()) {
  const cards = lessons.flatMap((l) => l.cards.filter((c) => conceptOf(s, c.concept).status !== 'new' || (s.cards[c.id]?.reviews ?? 0) > 0));
  return cards.filter((c) => isDue(s.cards[c.id], today));
}

export function boxCounts(s: AppState, lessons: Lesson[] = LESSONS): number[] {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const l of lessons) for (const c of l.cards) counts[s.cards[c.id]?.box ?? 0] += 1;
  return counts;
}
