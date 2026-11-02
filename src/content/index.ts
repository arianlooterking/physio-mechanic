import { BOOKS, booksFor, GRADES, MAJOR_INFO, pdfLink } from './books';
import { BM1_LESSONS } from './bm/part1';
import { BM2_LESSONS } from './bm/part2';
import type { Book, Concept, Field, Flashcard, Grade, Lesson, Major, Question, Subject, SubjectId, TestQ } from './types';

const bookOf = (id: string): Book => BOOKS.find((b) => b.id === id)!;

/** A subject with lessons; its PDF and page offset come from the library entry. */
function subject(id: SubjectId, title: string, short: string, grade: Grade, field: Field, book: string, color: string, icon: Subject['icon'], lessons: Lesson[]): Subject {
  const b = bookOf(book);
  return { id, title, short, grade, field, book, color, icon, pdf: b.pdf, pdfOffset: b.pdfOffset ?? 0, lessons };
}

/** The book's parts, in reading order. Parts without lessons yet are listed in the library as "coming soon". */
export const SUBJECTS: Subject[] = [
  subject('bm1', 'مقدمه و مفاهیم پایه', 'مقدمه', 12, 'physics', 'bm1', 'phys', 'lever', BM1_LESSONS),
  subject('bm2', 'بیومکانیک بافت‌ها', 'بافت‌ها', 12, 'biology', 'bm2', 'bio', 'bone', BM2_LESSONS),
];

export const LESSONS: Lesson[] = SUBJECTS.flatMap((s) => s.lessons);

export const subjectById = (id: SubjectId): Subject => SUBJECTS.find((s) => s.id === id)!;

/** Subjects of one grade, in switch order. */
export const subjectsFor = (grade: Grade): Subject[] => SUBJECTS.filter((s) => s.grade === grade);

/** Subjects whose book belongs to a major (a shared book, like شیمی ۳, counts for each of its majors). */
export const subjectsForMajor = (major: Major): Subject[] => SUBJECTS.filter((s) => bookOf(s.book).majors.includes(major));


const lessonMap = new Map(LESSONS.map((l) => [l.id, l]));
export const lessonById = (id: string): Lesson | undefined => lessonMap.get(id);

const conceptMap = new Map<string, { concept: Concept; lesson: Lesson; index: number }>();
const questionMap = new Map<string, { q: Question; lesson: Lesson }>();
const testMap = new Map<string, { q: TestQ; lesson: Lesson }>();
const cardMap = new Map<string, { card: Flashcard; lesson: Lesson }>();

for (const lesson of LESSONS) {
  lesson.concepts.forEach((concept, index) => {
    conceptMap.set(concept.id, { concept, lesson, index });
    for (const q of concept.checks) questionMap.set(q.id, { q, lesson });
  });
  for (const q of lesson.practice) questionMap.set(q.id, { q, lesson });
  for (const q of lesson.written ?? []) questionMap.set(q.id, { q, lesson });
  for (const t of lesson.hard ?? [])
    questionMap.set(t.id, { q: { id: t.id, concept: t.concept, level: t.level, type: 'mcq', prompt: t.prompt, plot: t.plot, options: t.options, answer: t.answer, explain: t.explain }, lesson });
  for (const q of lesson.test) testMap.set(q.id, { q, lesson });
  for (const q of lesson.konkur?.tests ?? []) testMap.set(q.id, { q, lesson });
  for (const c of lesson.cards) cardMap.set(c.id, { card: c, lesson });
}

export const conceptById = (id: string) => conceptMap.get(id);
export const questionById = (id: string) => questionMap.get(id);
export const testById = (id: string) => testMap.get(id);
export const cardById = (id: string) => cardMap.get(id);
export const allCards = (): Flashcard[] => LESSONS.flatMap((l) => l.cards);

/** How lessons cite the reference book: printed page numbers of the 4th edition, shown as plain text (the book is not linked). */
export const BOOK_REF = 'کتاب نوردین و فرانکل، ویرایش چهارم';

export function lessonBookLink(lesson: Lesson) {
  const b = bookOf(subjectById(lesson.subject).book);
  return (page: number) => pdfLink(b, page);
}

export function subjectColor(id: SubjectId): { c: string; d: string; soft: string } {
  const key = subjectById(id).color;
  return { c: `var(--${key})`, d: `var(--${key}-dark)`, soft: `var(--${key}-soft)` };
}

export { BOOKS, booksFor, GRADES, MAJOR_INFO, pdfLink };
