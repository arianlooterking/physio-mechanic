/**
 * «چالش امروز»: five questions a day, the same five all day, from the lessons the learner has started (or the
 * first lessons of their grade). The pick is seeded by the date and the learner's grade and major, and pinned in
 * the state the first time the challenge is opened, so starting a new lesson later that day changes nothing.
 */
import { SUBJECTS, subjectsForMajor } from '../content';
import type { Grade, Lesson, Major, Question } from '../content/types';
import { toFa } from './digits';
import { deal } from './exam';
import { hashString, shuffled } from './grade';
import { findQuestion, lastActivity } from './learner';
import type { AppState } from './state';
import { fullDate, fromKey } from './time';

export const DAILY_SIZE = 5;
export const SITE_URL = 'https://biomana.don-aasd.workers.dev';

export function dailySeed(day: string, grade: Grade, major: Major): number {
  return hashString(`daily|${day}|${grade}|${major}`);
}

/** Lessons today's challenge draws from: those the learner has started, else the first lesson of each book of their grade. */
export function dailyLessons(s: AppState): Lesson[] {
  const mine = subjectsForMajor(s.profile.major);
  const started = mine.flatMap((x) => x.lessons).filter((l) => lastActivity(s, l) > 0);
  if (started.length) return started;
  const inGrade = mine.filter((x) => x.grade === s.profile.grade);
  const books = inGrade.length ? inGrade : mine.length ? mine : SUBJECTS;
  return books.map((x) => x.lessons[0]).filter((l): l is Lesson => Boolean(l));
}

/** Practice questions fit for a quick round: everything the app marks itself (no written, self-marked ones). */
export function dailyPool(lesson: Lesson): Question[] {
  const qs = lesson.practice.filter((q) => q.type !== 'written');
  return qs.length ? qs : lesson.concepts.flatMap((c) => c.checks).filter((q) => q.type !== 'written');
}

/** The day's questions for these lessons: spread over the lessons, no repeats, the same for the same seed. */
export function pickDaily(lessons: Lesson[], seed: number, n = DAILY_SIZE): Question[] {
  const piles = lessons.map((l) => {
    const pool = dailyPool(l);
    return shuffled(pool.length, seed + hashString(l.id)).map((i) => ({ q: pool[i] }));
  });
  // Easier questions first, as in practice.
  return deal(piles, n, seed)
    .map((x) => x.q)
    .sort((a, b) => a.level - b.level);
}

/** Today's question ids: the ones pinned for today if there are any, else a fresh seeded pick. */
export function dailyIds(s: AppState, day: string): string[] {
  if (s.dailyPlan?.day === day && s.dailyPlan.ids.length) return s.dailyPlan.ids;
  return pickDaily(dailyLessons(s), dailySeed(day, s.profile.grade, s.profile.major)).map((q) => q.id);
}

export function dailyQuestions(ids: string[]): Question[] {
  return ids.map((id) => findQuestion(id)?.q).filter((q): q is Question => Boolean(q));
}

/** The result as a few lines of text to paste anywhere: the day, one 🟩/🟥 per question, the streak and the site. */
export function dailyShareText(day: string, marks: boolean[], streak: number): string {
  const right = marks.filter(Boolean).length;
  return [
    `چالش امروز بیومانا · ${toFa(fullDate(fromKey(day).getTime()))}`,
    `${marks.map((m) => (m ? '🟩' : '🟥')).join('')} ${toFa(right)} از ${toFa(marks.length)}`,
    `🔥 زنجیرهٔ چالش: ${toFa(streak)} روز`,
    SITE_URL,
  ].join('\n');
}

/** Copy text to the clipboard; falls back to the old copy command, and says whether either worked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* not allowed here: try the old way */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    const ok = typeof document.execCommand === 'function' && document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
