import { BM_SYMBOLS, BM_TERMS } from './bm/glossary';
import type { Field } from './types';

/**
 * «واژه‌نامه»: plain-language meanings for terms (==term== in content) and for symbols inside formulas.
 * Tapping a term or a formula opens a small card with `short`; «بیشتر بدان» expands to `long` and the examples.
 * Text uses the same markup as lessons ($…$ for math, **bold**).
 */
export interface Term {
  id: string;
  title: string;
  /** Other spellings that should open the same card. */
  aliases?: string[];
  subject?: Field;
  /** TeX of the symbol, shown in formula cards. */
  tex?: string;
  short: string;
  long: string;
  examples?: string[];
}

export const TERMS: Term[] = BM_TERMS;

/** Formula symbols: which term explains a piece of TeX, per subject. Order = order shown in the card. */
const SYMBOLS: { re: RegExp; term: string; subject?: Field }[] = BM_SYMBOLS;

const byId = new Map(TERMS.map((t) => [t.id, t]));
const norm = (s: string) => s.replace(/\u200c/g, '').replace(/[ًٌٍَُِّْ]/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();
const byName = new Map<string, Term[]>();
for (const t of TERMS) for (const n of [t.title, ...(t.aliases ?? [])]) byName.set(norm(n), [...(byName.get(norm(n)) ?? []), t]);

export const termById = (id: string) => byId.get(id);

/** The glossary entry for a marked term (==…==), if there is one; a word two subjects share (سرعت متوسط, لگاریتم) opens the current subject's entry. */
export function findTerm(text: string, subject?: Field): Term | undefined {
  const n = norm(text.replace(/\$[^$]*\$/g, ''));
  const hits = byName.get(n) ?? byName.get(n.replace(/(‌?ها|‌?های|ی)$/, ''));
  return hits && (hits.find((t) => t.subject === subject) ?? hits[hits.length - 1]);
}

/** Terms that explain the symbols of a formula (empty when there is nothing worth explaining). */
export function symbolsIn(tex: string, subject?: Field): Term[] {
  const out: Term[] = [];
  for (const s of SYMBOLS) {
    if (s.subject && subject && s.subject !== subject) continue;
    if (s.subject && !subject) continue;
    if (s.re.test(tex)) {
      const t = byId.get(s.term);
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out;
}
