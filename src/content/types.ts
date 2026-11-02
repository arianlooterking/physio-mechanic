/*
 * Content model.
 *
 * Text fields use a small inline markup, rendered by <Rich>:
 *   $...$      inline math (KaTeX; \ce{...} for chemistry)
 *   **...**    bold
 *   ==...==    highlighted term
 *   <<...>>    an English (left-to-right) run, e.g. <<I have been reading.>>
 * Display formulas use a `math` block instead of inline `$`.
 */

/** One part of the biomechanics book: bm1 مقدمه، bm2 بافت‌ها، bm3 مفصل‌ها، bm4 بیومکانیک کاربردی. */
export type SubjectId = 'bm1' | 'bm2' | 'bm3' | 'bm4';

/** The family a subject belongs to; glossary symbols, backdrops and path art are shared per field. */
export type Field = 'math' | 'physics' | 'chemistry' | 'language' | 'biology';

/** The different ways a concept can be taught. The learner model tracks which ones work for each student. */
export type ApproachKind =
  | 'example' // ساده، با مثال روزمره
  | 'visual' // تصویری / آزمایشگاه تعاملی
  | 'steps' // قدم‌به‌قدم، حل‌شده
  | 'analogy' // تشبیه و داستان
  | 'formal'; // دقیق و فرمولی، با نکته‌های امتحانی

export type Tone = 'tip' | 'key' | 'warn' | 'exam' | 'info';

export type Block =
  | { t: 'p'; text: string }
  | { t: 'h'; text: string }
  | { t: 'math'; tex: string; caption?: string }
  | { t: 'note'; tone: Tone; title?: string; text: string }
  | { t: 'list'; items: string[]; ordered?: boolean }
  | { t: 'steps'; items: { text: string; tex?: string }[] }
  | { t: 'example'; title?: string; problem: string; solution: Block[] }
  | { t: 'table'; head: string[]; rows: string[][]; caption?: string }
  | { t: 'compare'; items: { title: string; tone?: 'a' | 'b' | 'c'; points: string[] }[] }
  | { t: 'plot'; plot: PlotSpec; caption?: string }
  | { t: 'widget'; name: WidgetName; props?: Record<string, unknown>; caption?: string }
  | { t: 'book'; page: number; text?: string }
  /** A worked konkur-level question: the student picks an option, then sees the full solution. */
  | { t: 'konkur'; tag?: string; problem: string; options: string[]; answer: number; solution: Block[] };

export type WidgetName =
  | 'transform'
  | 'monotone'
  | 'cubeCompare'
  | 'division'
  | 'motion'
  | 'slope'
  | 'constantVelocity'
  | 'soap'
  | 'mixtures'
  | 'hardWater'
  | 'ions'
  | 'oxides'
  | 'accel'
  | 'freeFall'
  | 'tangent'
  | 'ph'
  | 'series'
  | 'inscribed'
  | 'truth'
  | 'coulomb'
  | 'trends'
  | 'matrix'
  | 'system'
  | 'trig'
  | 'interval'
  | 'numline'
  | 'venn'
  | 'pattern'
  | 'grow'
  | 'intdiv'
  | 'gcd'
  | 'congruence'
  | 'diophantine'
  | 'graph'
  | 'domination'
  | 'starsbars'
  | 'latin'
  | 'inclusion'
  | 'pigeon'
  | 'units'
  | 'precision'
  | 'density'
  | 'magnitude'
  | 'isotope'
  | 'avgMass'
  | 'shells'
  | 'rightTri'
  | 'unitCircle';

export interface Approach {
  kind: ApproachKind;
  title: string;
  blocks: Block[];
}

export interface Concept {
  id: string;
  title: string;
  /** One line: what the student can do after this concept. */
  goal: string;
  approaches: Approach[];
  /** Short "golden summary" shown when the student has understood. */
  summary: string[];
  /** 1–3 quick questions used to confirm understanding. Different ones are used on each retry. */
  checks: Question[];
  /** Book pages (printed page numbers) this concept covers. */
  pages?: [number, number];
}

/* ---------- Plots (shared by blocks, widgets and graph questions) ---------- */

export type Fn = (x: number) => number;

export interface PlotCurve {
  fn?: Fn;
  /** Polyline points, for piecewise-linear textbook-style functions. */
  pts?: [number, number][];
  domain?: [number, number];
  color?: 'base' | 'main' | 'alt' | 'ok' | 'bad' | 'muted';
  dashed?: boolean;
  label?: string;
  /** x position for the label; by default labels alternate between the right and left ends. */
  labelX?: number;
  /** Mark points (filled dots). */
  marks?: [number, number][];
  /** Open (hollow) dots, e.g. excluded endpoints. */
  open?: [number, number][];
  width?: number;
  /** Shade the area between the curve and the horizontal axis over its domain (e.g. displacement under a v-t graph). */
  fill?: boolean;
}

export interface PlotSpec {
  x: [number, number];
  y: [number, number];
  curves: PlotCurve[];
  /** Grid step; defaults to 1. */
  step?: number;
  /** Separate grid steps for each axis (override `step`). */
  xStep?: number;
  yStep?: number;
  /** Extra point labels: [x, y, text]. */
  labels?: [number, number, string][];
  /** Arrows from → to, used to show how a point moves. */
  arrows?: { from: [number, number]; to: [number, number] }[];
  /** Custom tick labels for the x axis (e.g. π/2). */
  xTicks?: { at: number; label: string }[];
  yTicks?: { at: number; label: string }[];
  axisNames?: [string, string];
  height?: number;
}

/* ---------- Questions ---------- */

interface QBase {
  id: string;
  /** Concept this question checks; drives the learner model. */
  concept: string;
  /** 1 = easy, 2 = medium, 3 = hard. */
  level: 1 | 2 | 3;
  prompt: string;
  /** Optional figure shown above the options. */
  plot?: PlotSpec;
  /** Why the correct answer is correct, shown after answering. */
  explain: string;
  /** Optional hint the student can open before answering. */
  hint?: string;
}

export interface MCQ extends QBase {
  type: 'mcq';
  options: string[];
  answer: number;
  /** Optional per-option feedback for common wrong answers. */
  why?: Record<number, string>;
}

export interface TrueFalse extends QBase {
  type: 'tf';
  answer: boolean;
}

export interface NumericQ extends QBase {
  type: 'num';
  answer: number;
  /** Absolute tolerance; defaults to 1e-6 (or 1% when the answer is not an integer). */
  tol?: number;
  unit?: string;
}

export interface OrderQ extends QBase {
  type: 'order';
  /** Items in the correct order. They are shuffled for display. */
  items: string[];
  /** Other orders that are just as right, as lists of item indexes (e.g. two natural Persian word orders of a translation). */
  alts?: number[][];
}

export interface MatchQ extends QBase {
  type: 'match';
  pairs: [string, string][];
}

export interface ClozeQ extends QBase {
  type: 'cloze';
  /** Text with one `___` blank. */
  text: string;
  options: string[];
  answer: number;
}

/**
 * «تشریحی»: a final-exam style written question. The student solves it on paper, then sees the model
 * solution with the mark scheme (بارم) per step and marks their own answer.
 */
export interface WrittenQ extends QBase {
  type: 'written';
  /** Total marks, as on the exam paper (e.g. 1.5). Equals the sum of the step marks. */
  points: number;
  steps: { text: string; tex?: string; pts: number }[];
}

export interface GraphQ extends QBase {
  type: 'graph';
  /** Each option is a plot; the student picks the right one. */
  graphs: PlotSpec[];
  answer: number;
}

export type Question = MCQ | TrueFalse | NumericQ | OrderQ | MatchQ | ClozeQ | GraphQ | WrittenQ;

/** Konkur-style 4-option question used in lesson tests. */
export interface TestQ {
  id: string;
  concept: string;
  level: 1 | 2 | 3;
  prompt: string;
  plot?: PlotSpec;
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  explain: string;
}

/** A «نکتهٔ کنکوری»: a trap the konkur sets, a shortcut, or a point it asks again and again. */
export interface KonkurTip {
  kind: 'trap' | 'shortcut' | 'frequent';
  text: string;
  /** The concept it belongs to, when it belongs to one. */
  concept?: string;
}

/** A konkur-style test question. */
export interface KonkurQ extends TestQ {
  /** The past konkur it is modelled on, e.g. «الگوی سراسری ریاضی ۱۴۰۲»; rewritten, never copied word for word. */
  source?: string;
}

/** A lesson's konkur tips and konkur-style test (kept in src/content/konkur/, apart from the lesson files). */
export interface KonkurPack {
  tips: KonkurTip[];
  tests: KonkurQ[];
}

export interface Flashcard {
  id: string;
  concept: string;
  front: string;
  back: string;
  /** Optional formula shown on the back in display style. */
  tex?: string;
}

export interface Lesson {
  id: string;
  subject: SubjectId;
  /** e.g. «فصل ۱ — درس ۱» */
  label: string;
  title: string;
  chapter: string;
  /** Printed page range in the textbook. */
  pages: [number, number];
  intro: string;
  concepts: Concept[];
  /** Practice pool (in addition to concept checks). */
  practice: Question[];
  test: TestQ[];
  cards: Flashcard[];
  /** Final-exam style written questions; with three or more, the path gets a «امتحان نهایی» step. */
  written?: WrittenQ[];
  /** Hard konkur-level questions with step-by-step explanations; with four or more, the path ends with a «تست‌های سخت» challenge. */
  hard?: TestQ[];
  /** «نکته‌های کنکوری» and «تست کنکوری», attached from src/content/konkur/. */
  konkur?: KonkurPack;
}

/** Majors of the theoretical high-school branch: ریاضی و فیزیک، علوم تجربی، ادبیات و علوم انسانی. */
export type Major = 'math' | 'science' | 'humanities';
export type Grade = 10 | 11 | 12;

export interface Book {
  id: string;
  title: string;
  short: string;
  /** The textbook PDF; when empty, `page` (the publisher's list for that grade) is linked instead. */
  pdf: string;
  page?: string;
  /** PDF page = printed page + offset. */
  pdfOffset?: number;
  subject?: SubjectId;
  /** Has lessons in Biomana; the rest are listed as "coming soon". */
  available: boolean;
  /** Common to several majors (general) or a major's own book (specialized). */
  group: 'specialized' | 'general';
  grade: Grade;
  majors: Major[];
}

export interface Subject {
  id: SubjectId;
  title: string;
  /** Short name for tight places (the subject switch). */
  short: string;
  grade: Grade;
  field: Field;
  book: string;
  color: string;
  icon: 'calc' | 'atom' | 'flask' | 'geo' | 'dice' | 'nodes' | 'abc' | 'ayn' | 'leaf';
  pdf: string;
  pdfOffset: number;
  lessons: Lesson[];
}
