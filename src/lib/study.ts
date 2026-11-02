/**
 * The learner's grade and major («پایه و رشته»). Home, the library, the daily challenge and the plan follow them.
 * Every place that changes them (onboarding, Home's switch, Profile, opening a book in the library) goes through
 * setStudy, so the lessons on Home always match what was picked, and the newest pick wins across devices
 * (carryStudy, like the study plan).
 */
import { subjectsForMajor } from '../content';
import type { Grade, Major, Subject } from '../content/types';
import type { AppState } from './state';

/** Subjects with lessons for one grade and major, in switch order. */
export const studySubjects = (grade: Grade, major: Major): Subject[] => subjectsForMajor(major).filter((x) => x.grade === grade && x.lessons.length > 0);

/** Pick a grade and major: Home moves to a book of that grade and major when it has one. */
export function setStudy(s: AppState, grade: Grade, major: Major, now = Date.now()): void {
  s.profile.grade = grade;
  s.profile.major = major;
  s.profile.studyAt = now;
  const subs = studySubjects(grade, major);
  if (subs.length && !subs.some((x) => x.id === s.profile.focus)) s.profile.focus = subs[0].id;
}

/**
 * The grade Home shows. A save from before setStudy (no studyAt) may have moved between grades with Home's old
 * grade tabs, which changed only the book in view: it keeps that book's grade until the learner picks again.
 */
export function viewGrade(s: AppState): Grade {
  if (s.profile.studyAt) return s.profile.grade;
  const own = subjectsForMajor(s.profile.major).find((x) => x.id === s.profile.focus);
  return own ? own.grade : s.profile.grade;
}

const GRADE_IDS: readonly number[] = [10, 11, 12];
const MAJOR_IDS: readonly string[] = ['math', 'science', 'humanities'];

type StudyPick = Pick<AppState['profile'], 'grade' | 'major' | 'focus' | 'studyAt'>;

function readPick(raw: unknown): StudyPick | null {
  const p = raw && typeof raw === 'object' ? (raw as { profile?: Partial<StudyPick> }).profile : undefined;
  if (!p || typeof p.studyAt !== 'number' || !Number.isFinite(p.studyAt)) return null;
  if (!GRADE_IDS.includes(p.grade as number) || !MAJOR_IDS.includes(p.major as string) || typeof p.focus !== 'string') return null;
  return p as StudyPick;
}

/** The copy that wins on progress keeps its lessons, but the newest grade-and-major pick among all copies comes along. */
export function carryStudy<T extends Partial<AppState> | null>(best: T, copies: unknown[]): T {
  if (!best?.profile) return best;
  let pick = readPick(best);
  let newer = false;
  for (const c of copies) {
    const p = readPick(c);
    if (p && (!pick || p.studyAt! > pick.studyAt!)) [pick, newer] = [p, true];
  }
  if (!newer || !pick) return best;
  return { ...best, profile: { ...best.profile, grade: pick.grade, major: pick.major, focus: pick.focus, studyAt: pick.studyAt } };
}
