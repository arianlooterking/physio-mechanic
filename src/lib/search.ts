/**
 * Lesson search: by title, chapter, book and the terms a lesson teaches (its ==marked== terms and their
 * glossary names), with Persian-friendly matching.
 */
import { BOOKS, LESSONS, subjectById } from '../content';
import { findTerm } from '../content/glossary';
import { FIELD } from '../content/fields';
import type { Block, Lesson } from '../content/types';
import { toEn } from './digits';

/**
 * Fold text for matching: Arabic ي/ى and ك become Persian ی and ک, hamza and madda forms become their base
 * letter, ة and ۀ become ه, diacritics, tatweel, نیم‌فاصله and direction marks go, digits become Latin, and
 * letters lower-case. Spaces are squeezed to one.
 */
export function normalizeFa(text: string): string {
  return toEn(text)
    .toLowerCase()
    .replace(/[ً-ٰٟۖ-ۭـ]/g, '')
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ی')
    .replace(/[ةۀ]/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lesson markup and math out, words in: «$f(x)$ و **مشتق**» → «و مشتق». */
function plain(text: string): string {
  return text
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/<<|>>|\*\*|==/g, ' ')
    .replace(/[«»"'()[\]{}،؛:.!?؟]/g, ' ');
}

const MARKED = /==([^=]+)==/g;

/** The ==marked== terms in some blocks, recursively. */
function markedTerms(blocks: Block[], out: Set<string>): void {
  const scan = (t: string | undefined) => {
    if (!t) return;
    for (const m of t.matchAll(MARKED)) out.add(plain(m[1]).trim());
  };
  for (const b of blocks) {
    switch (b.t) {
      case 'p':
      case 'h':
        scan(b.text);
        break;
      case 'note':
        scan(b.title);
        scan(b.text);
        break;
      case 'list':
        b.items.forEach(scan);
        break;
      case 'steps':
        b.items.forEach((i) => scan(i.text));
        break;
      case 'example':
        scan(b.problem);
        markedTerms(b.solution, out);
        break;
      case 'konkur':
        scan(b.problem);
        markedTerms(b.solution, out);
        break;
      case 'table':
        b.head.forEach(scan);
        b.rows.forEach((r) => r.forEach(scan));
        break;
      case 'compare':
        b.items.forEach((i) => i.points.forEach(scan));
        break;
      default:
        break;
    }
  }
}

/** What one lesson can be found by. */
interface Entry {
  lesson: Lesson;
  title: string;
  chapter: string;
  book: string;
  concepts: { name: string; key: string }[];
  /** Display names of the lesson's terms, and each one folded with its glossary title and aliases. */
  terms: { name: string; key: string }[];
}

/** The ==marked== terms a lesson teaches, as written (markup out), in the order they first appear. */
export function markedNames(lesson: Lesson): string[] {
  const found = new Set<string>();
  scanText(lesson.intro, found);
  for (const c of lesson.concepts) {
    scanText(c.title, found);
    scanText(c.goal, found);
    c.summary.forEach((x) => scanText(x, found));
    for (const a of c.approaches) markedTerms(a.blocks, found);
  }
  return [...found].filter((t) => t.length > 1);
}

function entryOf(lesson: Lesson): Entry {
  const subject = subjectById(lesson.subject);
  const book = BOOKS.find((b) => b.id === subject.book);
  const terms = markedNames(lesson)
    .map((name) => {
      const g = findTerm(name, FIELD[lesson.subject]);
      return { name, key: normalizeFa([name, g?.title ?? '', ...(g?.aliases ?? [])].join(' | ')) };
    });
  return {
    lesson,
    title: normalizeFa(plain(lesson.title)),
    chapter: normalizeFa(`${plain(lesson.chapter)} ${plain(lesson.label)}`),
    book: normalizeFa(`${subject.title} ${subject.short} ${book?.title ?? ''}`),
    concepts: lesson.concepts.map((c) => ({ name: c.title, key: normalizeFa(plain(c.title)) })),
    terms,
  };
}

function scanText(t: string, out: Set<string>) {
  for (const m of t.matchAll(MARKED)) out.add(plain(m[1]).trim());
}

let index: Entry[] | null = null;
const entries = () => (index ??= LESSONS.map(entryOf));

/** Every query word appears in the text; words may run together or be split («می شود» finds «می‌شود»). */
function hasAll(words: string[], text: string): boolean {
  const tight = text.replace(/ /g, '');
  return words.every((w) => text.includes(w) || tight.includes(w));
}

export interface SearchHit {
  lesson: Lesson;
  /** Which part matched best. */
  field: 'title' | 'chapter' | 'book' | 'concept' | 'term';
  /** For a concept or term match, its name as the lesson writes it (concept titles may hold $…$). */
  term?: string;
  score: number;
}

/** Lessons matching a query, best first: title, then concept, chapter, term and book matches. */
export function searchLessons(query: string, limit = 12): SearchHit[] {
  const q = normalizeFa(plain(query));
  if (q.replace(/ /g, '').length < 2) return [];
  const words = q.split(' ');
  const hits: SearchHit[] = [];
  for (const e of entries()) {
    let hit: SearchHit | null = null;
    const concept = e.concepts.find((x) => hasAll(words, x.key));
    if (hasAll(words, e.title)) hit = { lesson: e.lesson, field: 'title', score: e.title.startsWith(q) ? 100 : 90 };
    else if (concept) hit = { lesson: e.lesson, field: 'concept', term: concept.name, score: 70 };
    else if (hasAll(words, e.chapter)) hit = { lesson: e.lesson, field: 'chapter', score: 60 };
    else {
      const t = e.terms.find((x) => hasAll(words, x.key));
      if (t) hit = { lesson: e.lesson, field: 'term', term: t.name, score: 50 };
      else if (hasAll(words, `${e.book} ${e.chapter}`)) hit = { lesson: e.lesson, field: 'book', score: 30 };
    }
    if (hit) hits.push(hit);
  }
  // Stable: equal scores keep book order.
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
