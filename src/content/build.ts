/* Small builders that keep the lesson files readable. */
import type {
  Block,
  ClozeQ,
  Flashcard,
  GraphQ,
  MatchQ,
  MCQ,
  NumericQ,
  OrderQ,
  PlotSpec,
  TestQ,
  TrueFalse,
  WrittenQ,
} from './types';

/** Use r`...` for any text with TeX so backslashes stay single. Never start inline math with `{`. */
export const r = String.raw;

type Lvl = 1 | 2 | 3;
interface Extra {
  hint?: string;
  plot?: PlotSpec;
}

export const mcq = (id: string, concept: string, level: Lvl, prompt: string, options: string[], answer: number, explain: string, x: Extra & { why?: Record<number, string> } = {}): MCQ => ({
  type: 'mcq',
  id,
  concept,
  level,
  prompt,
  options,
  answer,
  explain,
  ...x,
});

export const tf = (id: string, concept: string, level: Lvl, prompt: string, answer: boolean, explain: string, x: Extra = {}): TrueFalse => ({
  type: 'tf',
  id,
  concept,
  level,
  prompt,
  answer,
  explain,
  ...x,
});

export const num = (id: string, concept: string, level: Lvl, prompt: string, answer: number, explain: string, x: Extra & { unit?: string; tol?: number } = {}): NumericQ => ({
  type: 'num',
  id,
  concept,
  level,
  prompt,
  answer,
  explain,
  ...x,
});

export const order = (id: string, concept: string, level: Lvl, prompt: string, items: string[], explain: string, x: Extra & { alts?: number[][] } = {}): OrderQ => ({
  type: 'order',
  id,
  concept,
  level,
  prompt,
  items,
  explain,
  ...x,
});

export const match = (id: string, concept: string, level: Lvl, prompt: string, pairs: [string, string][], explain: string, x: Extra = {}): MatchQ => ({
  type: 'match',
  id,
  concept,
  level,
  prompt,
  pairs,
  explain,
  ...x,
});

export const cloze = (id: string, concept: string, level: Lvl, prompt: string, text: string, options: string[], answer: number, explain: string, x: Extra = {}): ClozeQ => ({
  type: 'cloze',
  id,
  concept,
  level,
  prompt,
  text,
  options,
  answer,
  explain,
  ...x,
});

export const graph = (id: string, concept: string, level: Lvl, prompt: string, graphs: PlotSpec[], answer: number, explain: string, x: Extra = {}): GraphQ => ({
  type: 'graph',
  id,
  concept,
  level,
  prompt,
  graphs,
  answer,
  explain,
  ...x,
});

export const test = (id: string, concept: string, level: Lvl, prompt: string, options: [string, string, string, string], answer: 0 | 1 | 2 | 3, explain: string, plot?: PlotSpec): TestQ => ({
  id,
  concept,
  level,
  prompt,
  options,
  answer,
  explain,
  plot,
});

/** One step of a written solution: its text (and optional display formula) and its marks («بارم»). */
export const st = (text: string, pts: number, tex?: string) => ({ text, pts, tex });

/** A final-exam style written question; the total marks are the sum of the step marks. */
export const written = (id: string, concept: string, level: Lvl, prompt: string, steps: { text: string; pts: number; tex?: string }[], explain: string, x: Extra = {}): WrittenQ => ({
  type: 'written',
  id,
  concept,
  level,
  prompt,
  steps,
  points: steps.reduce((a, s) => a + s.pts, 0),
  explain,
  ...x,
});

export const card = (id: string, concept: string, front: string, back: string, tex?: string): Flashcard => ({ id, concept, front, back, tex });

/* Block shorthands */
export const p = (text: string): Block => ({ t: 'p', text });
export const h = (text: string): Block => ({ t: 'h', text });
export const math = (tex: string, caption?: string): Block => ({ t: 'math', tex, caption });
export const note = (tone: 'tip' | 'key' | 'warn' | 'exam' | 'info', text: string, title?: string): Block => ({ t: 'note', tone, text, title });
export const list = (items: string[], ordered = false): Block => ({ t: 'list', items, ordered });
export const steps = (...items: (string | [string, string])[]): Block => ({
  t: 'steps',
  items: items.map((it) => (typeof it === 'string' ? { text: it } : { text: it[0], tex: it[1] })),
});
export const example = (problem: string, solution: Block[], title?: string): Block => ({ t: 'example', problem, solution, title });
export const table = (head: string[], rows: string[][], caption?: string): Block => ({ t: 'table', head, rows, caption });
export const plot = (spec: PlotSpec, caption?: string): Block => ({ t: 'plot', plot: spec, caption });
export const widget = (name: Extract<Block, { t: 'widget' }>['name'], props?: Record<string, unknown>, caption?: string): Block => ({ t: 'widget', name, props, caption });
export const book = (page: number, text?: string): Block => ({ t: 'book', page, text });
/** A worked konkur-level question inside an explanation: pick an option first, then open the solution. */
export const konkur = (problem: string, options: [string, string, string, string], answer: 0 | 1 | 2 | 3, solution: Block[], tag = 'تست چالشی'): Block => ({
  t: 'konkur',
  tag,
  problem,
  options,
  answer,
  solution,
});
export const compare = (...items: { title: string; points: string[] }[]): Block => ({ t: 'compare', items });

/* Common plot helpers */
export const sq = (x: number) => x * x;
export const cube = (x: number) => x * x * x;
export const sqrt = (x: number) => (x < 0 ? NaN : Math.sqrt(x));
export const abs = Math.abs;
