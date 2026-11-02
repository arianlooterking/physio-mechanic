import type { Book, Grade, Major } from './types';

/** The publisher's page for the book (no free PDF exists; learners use their own copy). */
const LWW = 'https://shop.lww.com/p/9781975141981';
const LIST: Record<Grade, string> = { 10: LWW, 11: LWW, 12: LWW };

function book(id: string, title: string, short: string, extra: Partial<Book> = {}): Book {
  return { id, title, short, grade: 12, majors: ['science'], group: 'specialized', pdf: '', page: LWW, available: true, ...extra };
}

/**
 * «بیومکانیک پایه دستگاه اسکلتی‌ـ‌عضلانی» (Nordin & Frankel), split into its four parts. The lessons are
 * written for this app and follow the book's chapter order; nothing is copied from the book.
 */
export const BOOKS: Book[] = [
  book('bm1', 'بخش ۱: مقدمه و مفاهیم پایه', 'مقدمه', { subject: 'bm1' }),
  book('bm2', 'بخش ۲: بیومکانیک بافت‌ها و ساختارها', 'بافت‌ها', { subject: 'bm2' }),
  book('bm3', 'بخش ۳: بیومکانیک مفصل‌ها', 'مفصل‌ها', { subject: 'bm3', available: false }),
  book('bm4', 'بخش ۴: بیومکانیک کاربردی', 'کاربردی', { subject: 'bm4', available: false }),
];

export const GRADES: { id: Grade; title: string }[] = [
  { id: 10, title: 'دهم' },
  { id: 11, title: 'یازدهم' },
  { id: 12, title: 'دوازدهم' },
];

export const MAJOR_INFO: { id: Major; title: string; short: string }[] = [
  { id: 'math', title: 'ریاضی و فیزیک', short: 'ریاضی' },
  { id: 'science', title: 'علوم تجربی', short: 'تجربی' },
  { id: 'humanities', title: 'ادبیات و علوم انسانی', short: 'انسانی' },
];

/** Books of a grade, optionally for one major. */
export function booksFor(grade: Grade, major?: Major): Book[] {
  return BOOKS.filter((b) => b.grade === grade && (!major || b.majors.includes(major)));
}

/** Link to a printed page of a book's PDF (most PDF viewers honour #page=). */
export function pdfLink(book: Book, page?: number): string {
  if (!book.pdf) return encodeURI(book.page ?? LIST[book.grade]);
  const base = encodeURI(book.pdf);
  if (!page || book.pdfOffset === undefined) return base;
  return `${base}#page=${page + book.pdfOffset}`;
}
