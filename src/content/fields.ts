import type { Field, SubjectId } from './types';

/** Which family each subject belongs to (shared glossary symbols, backdrops and path art). */
export const FIELD: Record<SubjectId, Field> = {
  bm1: 'physics',
  bm2: 'biology',
  bm3: 'physics',
  bm4: 'biology',
};

export const fieldOf = (id?: SubjectId): Field | undefined => (id ? FIELD[id] : undefined);
