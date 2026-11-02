/** «گزارش هفته»: the last seven days against the seven before, from what the state already keeps. */
import type { AppState } from './state';
import { addDays, dayKey } from './time';

export interface DayStats {
  day: string;
  /** Questions answered and answered right. */
  q: number;
  ok: number;
  minutes: number;
}

export interface WeekStats {
  lessons: number;
  questions: number;
  correct: number;
  minutes: number;
  /** Right answers out of all answers, or null with no answers. */
  accuracy: number | null;
}

/** The seven days ending on `end` (oldest first). */
export function weekDays(end: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(end, i - 6));
}

export function dayStats(s: AppState, day: string): DayStats {
  const a = s.activity?.[day];
  return { day, q: a?.q ?? 0, ok: a?.ok ?? 0, minutes: Math.round((s.study.msByDay[day] ?? 0) / 60000) };
}

export function weekStats(s: AppState, end: string): WeekStats {
  const days = weekDays(end);
  const inWeek = new Set(days);
  const per = days.map((d) => dayStats(s, d));
  const questions = per.reduce((a, d) => a + d.q, 0);
  const correct = per.reduce((a, d) => a + d.ok, 0);
  const lessons = Object.values(s.lessons).filter((l) => l.finished && inWeek.has(dayKey(l.finished))).length;
  return { lessons, questions, correct, minutes: per.reduce((a, d) => a + d.minutes, 0), accuracy: questions ? correct / questions : null };
}

export function weekReport(s: AppState, today = dayKey()): { now: WeekStats; before: WeekStats; days: DayStats[] } {
  return { now: weekStats(s, today), before: weekStats(s, addDays(today, -7)), days: weekDays(today).map((d) => dayStats(s, d)) };
}
