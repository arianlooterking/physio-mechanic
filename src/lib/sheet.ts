/**
 * «برگهٔ خلاصه»: one page per book, made from what its lessons already hold: each concept's golden summary, its key
 * and exam notes, and its review cards, grouped by chapter and lesson in book order. Pure, so it can be tested.
 */
import type { Block, Flashcard, KonkurTip, Subject, Tone } from '../content/types';
import { chaptersOf } from './exam';

export interface SheetNote {
  tone: Extract<Tone, 'key' | 'exam'>;
  title?: string;
  text: string;
}

export interface SheetConcept {
  id: string;
  title: string;
  summary: string[];
  notes: SheetNote[];
  cards: Flashcard[];
}

export interface SheetLesson {
  id: string;
  label: string;
  title: string;
  pages: [number, number];
  concepts: SheetConcept[];
  /** Cards of the lesson whose concept is not one of its own. */
  cards: Flashcard[];
  /** «نکته‌های کنکوری» of the lesson. */
  tips: KonkurTip[];
}

export interface Sheet {
  subject: Subject;
  chapters: { chapter: string; lessons: SheetLesson[] }[];
  counts: { lessons: number; concepts: number; notes: number; cards: number };
}

/** At most this many notes per concept: a sheet, not the lesson again. */
export const NOTES_PER_CONCEPT = 2;

/** The concept's key and exam notes, from the top level of its explanations, without repeats; key notes first. */
function notesOf(blocks: Block[]): SheetNote[] {
  const seen = new Set<string>();
  const out: SheetNote[] = [];
  for (const tone of ['key', 'exam'] as const)
    for (const b of blocks) {
      if (b.t !== 'note' || b.tone !== tone) continue;
      const k = b.text.replace(/\s+/g, ' ').trim();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ tone, ...(b.title ? { title: b.title } : {}), text: b.text });
    }
  return out.slice(0, NOTES_PER_CONCEPT);
}

export function buildSheet(subject: Subject): Sheet {
  const counts = { lessons: 0, concepts: 0, notes: 0, cards: 0 };
  const chapters = chaptersOf(subject).map(({ chapter, lessons }) => ({
    chapter,
    lessons: lessons.map((lesson): SheetLesson => {
      const own = new Set(lesson.concepts.map((c) => c.id));
      const concepts = lesson.concepts.map((c) => ({
        id: c.id,
        title: c.title,
        summary: c.summary.filter((x) => x.trim()),
        notes: notesOf(c.approaches.flatMap((a) => a.blocks)),
        cards: lesson.cards.filter((card) => card.concept === c.id),
      }));
      const cards = lesson.cards.filter((card) => !own.has(card.concept));
      counts.lessons += 1;
      counts.concepts += concepts.length;
      counts.notes += concepts.reduce((a, c) => a + c.notes.length, 0);
      counts.cards += lesson.cards.length;
      return { id: lesson.id, label: lesson.label, title: lesson.title, pages: lesson.pages, concepts, cards, tips: lesson.konkur?.tips ?? [] };
    }),
  }));
  return { subject, chapters, counts };
}
