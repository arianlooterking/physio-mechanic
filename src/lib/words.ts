/**
 * «کارت واژه»: flip cards of the glossary terms and formula symbols a learner has met in the lessons they started.
 * Each card is one glossary entry; its Leitner box lives in AppState.cards under `w:<term id>`, next to the
 * lesson cards, so «بلدم» moves it up a box and «هنوز نه» sends it back to box 1.
 */
import { LESSONS, subjectById } from '../content';
import { FIELD } from '../content/fields';
import { findTerm, symbolsIn, type Term } from '../content/glossary';
import type { Lesson, SubjectId } from '../content/types';
import { lastActivity } from './learner';
import { markedNames } from './search';
import { isDue, type AppState } from './state';
import { dayKey, diffDays } from './time';

export const WORD_PREFIX = 'w:';
/** New words a day, on top of the ones that are due again. */
export const WORDS_NEW_PER_DAY = 12;
/** The most cards in one sitting. */
export const WORDS_PER_DECK = 30;

export interface WordCard {
  /** Card id in AppState.cards: `w:<term id>`. */
  id: string;
  term: Term;
  /** The book where the learner first meets it (book order). */
  subject: SubjectId;
  lessonId: string;
}

/** Every string inside a value, depth first. */
function strings(v: unknown, out: string[]): void {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
}

const MATH = /\$([^$]+)\$/g;
const cache = new Map<string, Term[]>();

/** The glossary entries one lesson teaches: its ==marked== terms, then the symbols of its formulas. */
export function lessonWords(lesson: Lesson): Term[] {
  const hit = cache.get(lesson.id);
  if (hit) return hit;
  const field = FIELD[lesson.subject];
  const out: Term[] = [];
  const add = (t: Term | undefined) => t && !out.includes(t) && out.push(t);
  for (const name of markedNames(lesson)) add(findTerm(name, field));
  const texts: string[] = [];
  strings([lesson.intro, lesson.concepts], texts);
  const seen = new Set<string>();
  for (const s of texts) {
    // Formula blocks hold bare TeX; prose holds $…$.
    const parts = s.includes('$') ? [...s.matchAll(MATH)].map((m) => m[1]) : /\\[a-zA-Z]|[_^]/.test(s) ? [s] : [];
    for (const tex of parts) {
      if (seen.has(tex)) continue;
      seen.add(tex);
      symbolsIn(tex, field).forEach(add);
    }
  }
  cache.set(lesson.id, out);
  return out;
}

/** Words from the lessons the learner has started, in book order, each once (optionally one book only). */
export function wordsMet(s: AppState, subject?: SubjectId, lessons: Lesson[] = LESSONS): WordCard[] {
  const out: WordCard[] = [];
  const seen = new Set<string>();
  for (const l of lessons) {
    if (subject && l.subject !== subject) continue;
    if (lastActivity(s, l) <= 0) continue;
    for (const term of lessonWords(l)) {
      if (seen.has(term.id)) continue;
      seen.add(term.id);
      out.push({ id: WORD_PREFIX + term.id, term, subject: l.subject, lessonId: l.id });
    }
  }
  return out;
}

/** New words first rated today (they count against the daily allowance). */
function newToday(s: AppState, words: WordCard[], today: string): number {
  return words.filter((w) => {
    const first = s.cards[w.id]?.first;
    return first !== undefined && dayKey(first) === today;
  }).length;
}

/**
 * Today's deck: words seen before that are due again (most overdue first), then new words in book order up to
 * the daily allowance, at most WORDS_PER_DECK in all.
 */
export function wordDeck(s: AppState, subject?: SubjectId, today = dayKey(), lessons: Lesson[] = LESSONS): WordCard[] {
  const met = wordsMet(s, subject, lessons);
  const seen = met.filter((w) => (s.cards[w.id]?.reviews ?? 0) > 0);
  const due = seen.filter((w) => isDue(s.cards[w.id], today)).sort((a, b) => diffDays(s.cards[b.id]!.due, s.cards[a.id]!.due));
  const room = Math.max(0, WORDS_NEW_PER_DAY - newToday(s, met, today));
  const fresh = met.filter((w) => (s.cards[w.id]?.reviews ?? 0) === 0).slice(0, room);
  return [...due, ...fresh].slice(0, WORDS_PER_DECK);
}

export interface WordStats {
  met: number;
  /** Due again plus new ones allowed today. */
  ready: number;
  /** In box 3 or higher. */
  learned: number;
}

export function wordStats(s: AppState, subject?: SubjectId, today = dayKey(), lessons: Lesson[] = LESSONS): WordStats {
  const met = wordsMet(s, subject, lessons);
  return {
    met: met.length,
    ready: wordDeck(s, subject, today, lessons).length,
    learned: met.filter((w) => (s.cards[w.id]?.box ?? 0) >= 3).length,
  };
}

/** A book's name without the major: «فیزیک ۳ (ریاضی)» → «فیزیک ۳». */
export const bookName = (id: SubjectId) => subjectById(id).title.replace(/\s*\([^)]*\)\s*$/, '');

/** Books the learner has met words in, in book order; short names unless two books share one. */
export function wordBooks(s: AppState, lessons: Lesson[] = LESSONS): { id: SubjectId; title: string; count: number }[] {
  const counts = new Map<SubjectId, number>();
  for (const w of wordsMet(s, undefined, lessons)) counts.set(w.subject, (counts.get(w.subject) ?? 0) + 1);
  const shorts = [...counts.keys()].map((id) => subjectById(id).short);
  return [...counts].map(([id, count]) => {
    const short = subjectById(id).short;
    return { id, title: shorts.filter((x) => x === short).length > 1 ? bookName(id) : short, count };
  });
}
