/**
 * «پیش از درس»: what a learner sees before the first concept of a lesson.
 * - why: what the lesson is for, in plain words, tied to real life or to what comes next.
 * - uses: three short places this lesson shows up (life, later lessons, exams).
 * - prereqs: two or three quick warm-up questions on what the learner must already know (activating prior
 *   knowledge before new material). Each has a `refresh`: a short reminder shown after answering, right or wrong.
 *   Warm-up answers are not recorded in the learner model or the mistakes notebook.
 * Same text markup as lessons. Keep it short: this screen should take about one minute.
 */
import { BM_WARMUPS } from './bm/warmups';
import type { Question } from './types';

export interface Warmup {
  why: string;
  uses: string[];
  prereqs: { q: Question; refresh: string }[];
}

export const WARMUPS: Record<string, Warmup> = { ...BM_WARMUPS };
