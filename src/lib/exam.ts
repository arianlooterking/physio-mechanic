/**
 * «آزمون جامع»: a mock exam over several lessons of one book, built from the lessons' test questions and their
 * hard konkur questions. Pure functions, so the builder can be tested without the UI.
 */
import type { Lesson, Question, Subject } from '../content/types';
import { hashString, shuffled, testToQuestion } from './grade';
import { lastActivity } from './learner';
import type { AppState } from './state';

export const EXAM_LENGTHS = [10, 20, 30] as const;
export type ExamLength = (typeof EXAM_LENGTHS)[number];

/** Konkur pace: about a minute for each question. */
export const EXAM_SEC_PER_Q = 60;

export interface ExamItem {
  q: Question;
  lessonId: string;
}

/**
 * Question types the app marks by itself with nothing given away while answering. A match question reacts to
 * every pair as it is made and a written one is marked by the learner, so neither belongs in an exam.
 */
const GRADABLE = new Set<Question['type']>(['mcq', 'tf', 'num', 'cloze', 'graph', 'order']);
export const autoGradable = (q: Question): boolean => GRADABLE.has(q.type);

/** A lesson's exam questions: its lesson-test, hard and «تست کنکوری» questions, gradable ones only. */
export function examPool(lesson: Lesson): Question[] {
  return [...lesson.test, ...(lesson.hard ?? []), ...(lesson.konkur?.tests ?? [])].map(testToQuestion).filter(autoGradable);
}

/**
 * Deal `count` items from several piles: the piles take turns (in an order set by `seed`) so every lesson gets
 * its share, then the dealt items are shuffled. Items with an id already dealt are skipped, so nothing repeats.
 */
export function deal<T extends { q: { id: string } }>(piles: T[][], count: number, seed: number): T[] {
  const seen = new Set<string>();
  const decks = shuffled(piles.length, seed).map((i) => piles[i].filter((x) => !seen.has(x.q.id) && Boolean(seen.add(x.q.id))));
  const out: T[] = [];
  for (let round = 0; out.length < count && decks.some((d) => d.length > round); round++) {
    for (const d of decks) if (round < d.length && out.length < count) out.push(d[round]);
  }
  return shuffled(out.length, seed ^ 0x5bd1e995).map((i) => out[i]);
}

/** Build a mock exam: at most `count` questions from `lessons`, without repeats, in an order set by `seed`. */
export function buildExam(lessons: Lesson[], count: number, seed: number): ExamItem[] {
  const piles = lessons.map((l) => {
    const pool = examPool(l);
    return shuffled(pool.length, seed + hashString(l.id)).map((i) => ({ q: pool[i], lessonId: l.id }));
  });
  return deal(piles, Math.max(0, Math.floor(count)), seed);
}

/** How many different exam questions some lessons have. */
export function examPoolSize(lessons: Lesson[]): number {
  return new Set(lessons.flatMap((l) => examPool(l).map((q) => q.id))).size;
}

/** Lessons of a book the learner has started; the default choice for a mock exam. */
export function startedLessons(s: AppState, subject: Subject): Lesson[] {
  return subject.lessons.filter((l) => lastActivity(s, l) > 0);
}

/** A book's lessons grouped by chapter, in book order. */
export function chaptersOf(subject: Subject): { chapter: string; lessons: Lesson[] }[] {
  const out = new Map<string, Lesson[]>();
  for (const l of subject.lessons) out.set(l.chapter, [...(out.get(l.chapter) ?? []), l]);
  return [...out].map(([chapter, lessons]) => ({ chapter, lessons }));
}

export interface LessonResult {
  lessonId: string;
  total: number;
  right: number;
}

/**
 * How each lesson of a handed-in exam went, weakest first: the lowest share of right answers leads, then (on a
 * tie) the lesson with more questions, then book order.
 */
export function lessonResults(lessonIds: string[], items: ExamItem[], marks: (boolean | null)[]): LessonResult[] {
  return lessonIds
    .map((lessonId) => {
      const ks = items.map((it, k) => (it.lessonId === lessonId ? k : -1)).filter((k) => k >= 0);
      return { lessonId, total: ks.length, right: ks.filter((k) => marks[k] === true).length };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => a.right / a.total - b.right / b.total || b.total - a.total);
}
