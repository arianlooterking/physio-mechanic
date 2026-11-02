/**
 * «پیش از شروع»: a short, plain-language context for each concept, shown before its first explanation.
 * It says what the idea is about and why it matters, without formulas to memorise. ==term== words open the
 * glossary card. Same markup as lessons; keep it to two or three short sentences.
 */
import { BM_INTROS } from './bm/intros';

export const INTROS: Record<string, string> = { ...BM_INTROS };

/** Terms marked in an intro, in order, without repeats (for the «کلمه‌های کلیدی» chips). */
export function introTerms(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/==([^=]+)==/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}
