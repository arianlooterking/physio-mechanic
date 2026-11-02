/**
 * «برنامهٔ مطالعه»: the learner says when their exam is, which books, which weekdays and how long; the planner
 * spreads the steps of the lessons they have not finished over the study days in book order, and keeps the last
 * stretch before the exam for mock exams and the mistakes notebook.
 *
 * Nothing of the day-by-day schedule is stored. Every day it is worked out again from what was left that morning
 * (steps finished today still count as today's), so it re-plans by itself when the learner falls behind or moves
 * ahead; `replan` only moves the yardstick for "ahead/behind" and leaves a one-line note for that day.
 * Pure functions, so they can be tested without the UI.
 */
import { SUBJECTS, subjectsForMajor } from '../content';
import type { Grade, Lesson, Major, Subject, SubjectId } from '../content/types';
import { buildPath, dueCards, reviewAvailable, type NodeKind, type PathNode } from './learner';
import { conceptOf, lessonOf, type AppState, type StudyPlan } from './state';
import { addDays, dayKey, diffDays, fromKey, fromPersian, persianOf } from './time';

/** About how long each kind of step takes, in minutes. */
export const STEP_MINUTES: Record<NodeKind, number> = { concept: 12, practice: 10, final: 15, cards: 5, test: 12, hard: 10 };
export const MOCK_MINUTES = 30;
export const MISTAKES_MINUTES = 15;
export const CARDS_MINUTES = 10;
export const MINUTE_CHOICES = [30, 45, 60, 90, 120, 180] as const;
/** The Iranian week, Saturday first, as Date.getDay() numbers. */
export const WEEK = [6, 0, 1, 2, 3, 4, 5] as const;
export const WEEKDAY_NAMES: Record<number, string> = { 6: 'شنبه', 0: 'یکشنبه', 1: 'دوشنبه', 2: 'سه‌شنبه', 3: 'چهارشنبه', 4: 'پنجشنبه', 5: 'جمعه' };
/** Every day but Friday. */
export const DEFAULT_DAYS = [6, 0, 1, 2, 3, 4];

/** The usual exam days, as Persian month and day; the next one after today is offered. */
export const GOALS = {
  final: { title: 'امتحان نهایی خرداد', m: 3, d: 1 },
  konkur: { title: 'کنکور', m: 2, d: 10 },
} as const;

/** The next `m/d` of the Persian calendar after today. */
export function nextPersianDate(m: number, d: number, today = dayKey()): string {
  const { y } = persianOf(today);
  const key = fromPersian(y, m, d);
  return diffDays(today, key) > 0 ? key : fromPersian(y + 1, m, d);
}

export const goalPreset = (kind: keyof typeof GOALS, today = dayKey()) => nextPersianDate(GOALS[kind].m, GOALS[kind].d, today);

/** The learner's own books with lessons: their grade's, else any grade of their major. */
export function defaultSubjects(major: Major, grade: Grade): SubjectId[] {
  const mine = subjectsForMajor(major).filter((s) => s.lessons.length);
  const own = mine.filter((s) => s.grade === grade);
  return (own.length ? own : mine).map((s) => s.id);
}

/** The plan's books in the order of the subject list (unknown ids from an older app are skipped). */
export const planSubjects = (plan: Pick<StudyPlan, 'subjects'>): Subject[] => SUBJECTS.filter((s) => plan.subjects.includes(s.id) && s.lessons.length);

/* ───────────── steps and when they were done ───────────── */

export interface Step {
  lesson: Lesson;
  node: PathNode;
  minutes: number;
  /** When it was finished; 0 when finished at an unknown time, null when not finished. */
  doneAt: number | null;
}

/** When a path step was finished, by the same rules as nodeDone. */
export function stepDoneAt(s: AppState, lesson: Lesson, node: PathNode): number | null {
  switch (node.kind) {
    case 'concept': {
      const c = conceptOf(s, node.conceptId!);
      return c.status === 'understood' ? (c.understoodAt ?? 0) : null;
    }
    case 'practice':
    case 'final':
    case 'hard':
      return lessonOf(s, lesson.id).done?.[node.id] ?? null;
    case 'cards': {
      let t = 0;
      for (const c of lesson.cards) {
        const st = s.cards[c.id];
        if (!st || st.reviews <= 0) return null;
        t = Math.max(t, st.last ?? 0);
      }
      return t;
    }
    case 'test': {
      const tests = lessonOf(s, lesson.id).tests;
      return tests.length ? Math.min(...tests.map((t) => t.at || 0)) : null;
    }
  }
}

export function lessonSteps(s: AppState, lesson: Lesson): Step[] {
  return buildPath(lesson).map((node) => ({ lesson, node, minutes: STEP_MINUTES[node.kind], doneAt: stepDoneAt(s, lesson, node) }));
}

/** Midnight at the start of a day. */
export function dawnOf(day: string): number {
  const d = fromKey(day);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const sum = (xs: { minutes: number }[]) => xs.reduce((a, x) => a + x.minutes, 0);

/**
 * Lay `items` over `n` days in order, so every day gets about the same minutes: an item goes to the day its middle
 * falls in. Each day ends up within one item of the average.
 */
export function spread<T extends { minutes: number }>(items: T[], n: number): T[][] {
  const out: T[][] = Array.from({ length: Math.max(0, n) }, () => []);
  const total = sum(items);
  if (!n || !total) return out;
  let at = 0;
  for (const it of items) {
    out[Math.min(n - 1, Math.floor(((at + it.minutes / 2) / total) * n))].push(it);
    at += it.minutes;
  }
  return out;
}

/**
 * The books' lessons in one line: each book keeps its own order, and the books move forward side by side at the
 * same pace (a lesson goes where its middle falls in its own book), so they all finish about together.
 */
export function interleave<T extends { minutes: number }>(books: T[][]): T[] {
  const keyed: { it: T; key: number; book: number }[] = [];
  books.forEach((items, book) => {
    const total = sum(items) || 1;
    let at = 0;
    for (const it of items) {
      keyed.push({ it, key: (at + it.minutes / 2) / total, book });
      at += it.minutes;
    }
  });
  return keyed.sort((a, b) => a.key - b.key || a.book - b.book).map((k) => k.it);
}

/* ───────────── the schedule ───────────── */

export type PlanItem =
  | { kind: 'lesson'; lesson: Lesson; steps: Step[]; minutes: number }
  | { kind: 'mock'; subject: Subject; minutes: number }
  | { kind: 'mistakes'; minutes: number }
  | { kind: 'cards'; minutes: number };

export interface PlanDay {
  day: string;
  /** learn: lessons; free: lessons are already done, light review; review: the last stretch before the exam. */
  phase: 'learn' | 'free' | 'review';
  items: PlanItem[];
  minutes: number;
}

export type PlanStatus = { kind: 'on-track' | 'ahead' | 'behind' | 'done'; days: number };

export interface Schedule {
  /** expired: the exam day has passed; exam-day: it is today. */
  state: 'active' | 'exam-day' | 'expired';
  today: string;
  goal: string;
  /** The first day of the review stretch. */
  reviewStart: string;
  /** Study days from today to the day before the exam. */
  days: PlanDay[];
  /** Today's tasks; null on a day off. */
  todayPlan: PlanDay | null;
  /** Minutes of lessons left this morning, and now. */
  left: number;
  leftNow: number;
  /** Lesson minutes asked for on each study day from today. */
  perDay: number;
  /** The lessons need clearly more than the learner's daily minutes. */
  overloaded: boolean;
  lessons: { total: number; done: number };
  /** Path steps in the plan's books, done or not. */
  size: number;
  books: { subject: Subject; total: number; done: number; ends: string | null }[];
  status: PlanStatus;
}

/** Days kept for review before the exam: about a sixth of the plan, at most three weeks. */
export function reviewDays(start: string, goal: string): number {
  const total = diffDays(start, goal);
  if (total < 7) return Math.max(0, Math.floor(total / 4));
  return Math.min(21, Math.round(total * 0.15));
}

export const isStudyDay = (plan: Pick<StudyPlan, 'days'>, day: string) => plan.days.includes(fromKey(day).getDay());

/** Study days from `a` up to the day before `b`. */
export function studyDaysBetween(plan: Pick<StudyPlan, 'days'>, a: string, b: string): string[] {
  const out: string[] = [];
  for (let d = a; diffDays(d, b) > 0; d = addDays(d, 1)) if (isStudyDay(plan, d)) out.push(d);
  return out;
}

/** How far the learner is from where the plan expected them this morning, in minutes (+ ahead, − behind). */
function drift(plan: StudyPlan, left: number, steps: number, today: string): { expected: number; unit: number } {
  const { base } = plan;
  if (unmeasured(plan, steps)) return { expected: left, unit: 0 };
  const passed = studyDaysBetween(plan, base.day, today).length;
  return { expected: Math.max(0, base.left - base.perDay * passed), unit: base.perDay };
}

/** The yardstick was never set, or the books have gained lessons since: it is set again, without a word. */
const unmeasured = (plan: StudyPlan, steps: number) => plan.base.left < 0 || plan.base.perDay < 0 || plan.base.steps !== steps;

/** Lesson minutes per study day: the lessons over the days, but not thinner than half the learner's daily time. */
function paceOf(left: number, days: number, minutes: number): number {
  if (!left || !days) return 0;
  return Math.max(left / days, Math.min(left, minutes / 2));
}

export function schedule(plan: StudyPlan, s: AppState, today = dayKey()): Schedule {
  const subjects = planSubjects(plan);
  const dawn = dawnOf(today);
  const perBook = subjects.map((subject) => subject.lessons.map((l) => lessonSteps(s, l)));
  const all = perBook.flat(2);
  const pending = (st: Step) => st.doneAt === null || st.doneAt >= dawn;
  const left = sum(all.filter(pending));
  const leftNow = sum(all.filter((st) => st.doneAt === null));
  const lessonsDone = perBook.flat().filter((steps) => steps.every((st) => st.doneAt !== null)).length;
  const reviewStart = addDays(plan.goal, -reviewDays(plan.start, plan.goal));
  const gap = diffDays(today, plan.goal);
  const base: Schedule = {
    state: gap > 0 ? 'active' : gap === 0 ? 'exam-day' : 'expired',
    today,
    goal: plan.goal,
    reviewStart,
    days: [],
    todayPlan: null,
    left,
    leftNow,
    perDay: 0,
    overloaded: false,
    lessons: { total: perBook.flat().length, done: lessonsDone },
    size: all.length,
    books: subjects.map((subject, k) => ({
      subject,
      total: subject.lessons.length,
      done: perBook[k].filter((steps) => steps.every((st) => st.doneAt !== null)).length,
      ends: null,
    })),
    status: { kind: leftNow ? 'on-track' : 'done', days: 0 },
  };
  if (gap <= 0) return base;

  // What was left this morning, lesson by lesson, the books side by side; a lesson already under way comes first.
  const units = interleave(
    perBook.map((lessons) =>
      lessons
        .map((steps) => ({ steps: steps.filter(pending), started: steps.some((st) => !pending(st)) }))
        .filter((u) => u.steps.length)
        .map((u) => ({ ...u, minutes: sum(u.steps) })),
    ),
  ).sort((a, b) => Number(b.started) - Number(a.started));
  const steps = units.flatMap((u) => u.steps);

  const studyDays = studyDaysBetween(plan, today, plan.goal);
  let learnDays = studyDays.filter((d) => diffDays(d, reviewStart) > 0);
  // Behind into the review stretch: its days carry the lessons too.
  if (!learnDays.length && left) learnDays = studyDays;
  const perDay = paceOf(left, learnDays.length, plan.minutes);
  const used = perDay ? Math.min(learnDays.length, Math.ceil(left / perDay - 1e-9)) : 0;
  const laid = spread(steps, used);

  const books = subjects.filter((b) => b.lessons.some((l) => l.test.length || l.hard?.length));
  let reviewN = 0;
  const days: PlanDay[] = studyDays.map((day, k) => {
    const items: PlanItem[] = [];
    // Consecutive steps of one lesson become one task.
    for (const st of laid[k] ?? []) {
      const last = items[items.length - 1];
      if (last?.kind === 'lesson' && last.lesson === st.lesson) {
        last.steps.push(st);
        last.minutes += st.minutes;
      } else items.push({ kind: 'lesson', lesson: st.lesson, steps: [st], minutes: st.minutes });
    }
    const inReview = diffDays(day, reviewStart) <= 0;
    let phase: PlanDay['phase'] = 'learn';
    if (inReview) {
      phase = 'review';
      const n = reviewN++;
      if (books.length) items.push({ kind: 'mock', subject: books[n % books.length], minutes: MOCK_MINUTES });
      if (!books.length || plan.minutes >= 45 || n % 2 === 1) items.push({ kind: 'mistakes', minutes: MISTAKES_MINUTES });
    } else if (k >= used) {
      phase = 'free';
      items.push({ kind: 'mistakes', minutes: MISTAKES_MINUTES }, { kind: 'cards', minutes: CARDS_MINUTES });
    }
    return { day, phase, items, minutes: sum(items) };
  });

  for (const b of base.books) {
    const last = [...days].reverse().find((d) => d.items.some((it) => it.kind === 'lesson' && it.lesson.subject === b.subject.id));
    b.ends = last?.day ?? null;
  }

  // Ahead or behind the yardstick: what was owed from earlier days this morning, or done beyond today's share.
  const { expected, unit } = drift(plan, left, all.length, today);
  let status: PlanStatus = base.status;
  if (leftNow && unit > 0) {
    const lag = left - expected;
    const lead = Math.max(0, expected - (isStudyDay(plan, today) ? unit : 0)) - leftNow;
    if (lag >= 0.75 * unit) status = { kind: 'behind', days: Math.max(1, Math.round(lag / unit)) };
    else if (lead >= 0.75 * unit) status = { kind: 'ahead', days: Math.max(1, Math.round(lead / unit)) };
  }

  const todayPlan = days[0]?.day === today ? days[0] : null;
  return { ...base, days, todayPlan, perDay, overloaded: perDay > plan.minutes * 1.15, status };
}

/**
 * The quiet re-plan: when this morning the learner is a day or more off the yardstick (or it was never set), move
 * it to today and note by how much. Returns the new plan, or null when nothing needs to change.
 */
export function replan(plan: StudyPlan, s: AppState, today = dayKey()): StudyPlan | null {
  if (diffDays(today, plan.goal) <= 0 || plan.base.day === today) return null;
  const sc = schedule(plan, s, today);
  const fresh = unmeasured(plan, sc.size);
  const { expected, unit } = drift(plan, sc.left, sc.size, today);
  const off = expected - sc.left;
  if (!fresh && Math.abs(off) < 0.75 * unit) return null;
  return {
    ...plan,
    base: { day: today, left: sc.left, perDay: sc.perDay, steps: sc.size },
    ...(fresh || !unit ? {} : { shift: { day: today, by: Math.round(off / unit) || Math.sign(off) } }),
  };
}

export interface PlanSettings {
  goal: string;
  kind: StudyPlan['kind'];
  subjects: SubjectId[];
  days: number[];
  minutes: number;
}

/** A new plan from the setup screen, measured from today. */
export function makePlan(set: PlanSettings, s: AppState, today = dayKey(), now = Date.now()): StudyPlan {
  const plan: StudyPlan = {
    goal: set.goal,
    kind: set.kind,
    subjects: SUBJECTS.filter((x) => set.subjects.includes(x.id)).map((x) => x.id),
    days: [...new Set(set.days)].sort((a, b) => a - b),
    minutes: set.minutes,
    start: today,
    base: { day: today, left: -1, perDay: -1, steps: -1 },
    at: now,
  };
  const sc = schedule(plan, s, today);
  return { ...plan, base: { day: today, left: sc.left, perDay: sc.perDay, steps: sc.size } };
}

/** Plan steps finished on each day (YYYY-MM-DD), for the days already gone in the week view. */
export function stepsDoneByDay(plan: StudyPlan, s: AppState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const subject of planSubjects(plan))
    for (const lesson of subject.lessons)
      for (const st of lessonSteps(s, lesson)) {
        if (!st.doneAt) continue;
        const day = dayKey(st.doneAt);
        out[day] = (out[day] ?? 0) + 1;
      }
  return out;
}

/** Whether a task of today's plan is done: its steps finished, a mock exam of that book taken today, nothing left to review. */
export function itemDone(it: PlanItem, s: AppState, today = dayKey()): boolean {
  switch (it.kind) {
    case 'lesson':
      return it.steps.every((st) => stepDoneAt(s, st.lesson, st.node) !== null);
    case 'mock':
      return (s.exams ?? []).some((e) => e.subject === it.subject.id && dayKey(e.at) === today);
    case 'mistakes':
      return reviewAvailable(s) === 0;
    case 'cards':
      return dueCards(s).length === 0;
  }
}

/** The lesson a book's mock exam opens with: the last one started, so the exam covers what was studied. */
export function mockLesson(s: AppState, subject: Subject): Lesson {
  return [...subject.lessons].reverse().find((l) => lessonSteps(s, l).some((st) => st.doneAt !== null)) ?? subject.lessons[0];
}

/** Saturday of the week a day is in. */
export function weekStart(day: string): string {
  let d = day;
  while (fromKey(d).getDay() !== 6) d = addDays(d, -1);
  return d;
}
