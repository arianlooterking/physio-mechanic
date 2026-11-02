import type { ApproachKind, Grade, Major, SubjectId } from '../content/types';
import { addDays, dayKey, diffDays } from './time';

export const MAX_HEARTS = 5;
export const HEART_REFILL_MS = 25 * 60 * 1000;
export const LEITNER_DAYS = [0, 1, 2, 4, 8, 16] as const; // index = box (1..5)
export const APPROACH_KINDS: ApproachKind[] = ['example', 'visual', 'steps', 'analogy', 'formal'];

export type ConceptStatus = 'new' | 'learning' | 'understood';

export interface ConceptProgress {
  status: ConceptStatus;
  mastery: number;
  /** Approach indices already shown, in order. */
  seen: number[];
  rounds: number;
  checksWrong: number;
  understoodWith?: ApproachKind;
  understoodAt?: number;
  lastSeen?: number;
}

export interface QuestionStat {
  seen: number;
  correct: number;
  last?: boolean;
  at?: number;
}

export interface Mistake {
  at: number;
  count: number;
  resolved: boolean;
}

export interface CardState {
  box: number;
  due: string;
  reviews: number;
  lapses: number;
  last?: number;
  /** When the card was first rated (kept from 2026-10-22; «کارت واژه» uses it for the daily allowance of new words). */
  first?: number;
}

export interface TestRecord {
  at: number;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  /** Konkur-style percentage with negative marking (3 wrong cancel 1 right). */
  score: number;
  seconds: number;
}

export interface LessonProgress {
  practiceRuns: number;
  perfectRuns: number;
  tests: TestRecord[];
  best?: number;
  /** Path nodes finished (practice nodes), with the time they were first finished. */
  done?: Record<string, number>;
  /** When the lesson's whole path was first finished (for «گزارش هفته»); missing for lessons finished before it was kept. */
  finished?: number;
  /** When the «پیش از درس» warm-up was finished or skipped. */
  warmed?: number;
  /** «تست کنکوری» of the lesson: best score, last time, how many times. */
  konkur?: { best: number; at: number; tries: number };
}

/** One «آزمون جامع» (mock exam) taken: a short history is kept for the progress screen. */
export interface ExamRecord {
  at: number;
  subject: SubjectId;
  lessons: string[];
  total: number;
  correct: number;
  wrong: number;
  blank: number;
  /** Konkur-style percentage with negative marking, like the lesson tests. */
  score: number;
  seconds: number;
  timed: boolean;
}

/** A finished «چالش امروز» (daily challenge): one mark per question, in order. */
export interface DailyRecord {
  marks: boolean[];
  at: number;
  xp: number;
}

/** What the learner did on one day, for «گزارش هفته»: questions answered and how many were right. */
export interface DayActivity {
  q: number;
  ok: number;
}

/**
 * «برنامهٔ مطالعه»: the learner's goal and study week. The day-by-day schedule is not stored; src/lib/plan.ts works
 * it out again from these settings and the progress, so it always fits what is really done.
 */
export interface StudyPlan {
  /** The exam day (YYYY-MM-DD). Study days run up to the day before. */
  goal: string;
  kind: 'final' | 'konkur' | 'custom';
  /** Books to cover, in the order of the subject list. */
  subjects: SubjectId[];
  /** Study weekdays, as Date.getDay() numbers (6 is Saturday, 5 is Friday). */
  days: number[];
  /** Minutes of study on each study day. */
  minutes: number;
  /** The day the plan was made; the review stretch at the end is measured from it. */
  start: string;
  /**
   * Ahead/behind is measured against this: on `day`, `left` minutes of lessons were left and the plan asked for
   * `perDay` of them on each study day; its books had `steps` path steps in all (new lessons are added all the time,
   * and those must not count as falling behind). Negative numbers mean "not measured yet".
   */
  base: { day: string; left: number; perDay: number; steps: number };
  /** The last quiet re-plan: on `day`, the learner was `by` study days ahead (+) or behind (−). */
  shift?: { day: string; by: number };
  /** When the learner last set the plan up; at sign-in the newest plan is kept. */
  at: number;
}

/** How many mock exams, daily challenges and days of activity are kept. */
export const EXAMS_KEPT = 20;
export const DAYS_KEPT = 70;

export interface StyleStat {
  shown: number;
  worked: number;
}

export interface AppState {
  v: 1;
  profile: {
    name: string;
    goal: number;
    onboarded: boolean;
    sound: boolean;
    theme: 'system' | 'light' | 'dark';
    createdAt: number;
    focus: SubjectId;
    /** The learner's grade and major; the library and the subject list follow them. */
    grade: Grade;
    major: Major;
    /** When the grade and major were last picked (ms); the newest pick wins across devices (src/lib/study.ts). */
    studyAt?: number;
  };
  xp: { total: number; byDay: Record<string, number> };
  streak: { current: number; best: number; last: string | null };
  hearts: { n: number; at: number };
  study: { msByDay: Record<string, number> };
  concepts: Record<string, ConceptProgress>;
  questions: Record<string, QuestionStat>;
  mistakes: Record<string, Mistake>;
  cards: Record<string, CardState>;
  lessons: Record<string, LessonProgress>;
  style: Record<ApproachKind, StyleStat>;
  badges: Record<string, number>;
  counters: {
    sessions: number;
    perfect: number;
    aiAsks: number;
    cardsReviewed: number;
    hardWon: number;
    reviewsDone: number;
  };
  /* Optional: older saves do not have these. */
  /** «آزمون جامع» results, oldest first, at most EXAMS_KEPT. */
  exams?: ExamRecord[];
  /** «چالش امروز» results by day (YYYY-MM-DD). */
  daily?: Record<string, DailyRecord>;
  /** Today's challenge questions, pinned when it is first opened so they stay the same all day. */
  dailyPlan?: { day: string; ids: string[] };
  /** Questions answered per day (YYYY-MM-DD). */
  activity?: Record<string, DayActivity>;
  /** «برنامهٔ مطالعه», once the learner has made one. */
  plan?: StudyPlan;
}

export function initialState(now = Date.now()): AppState {
  return {
    v: 1,
    profile: { name: '', goal: 30, onboarded: false, sound: true, theme: 'system', createdAt: now, focus: 'bm1', grade: 12, major: 'science' },
    xp: { total: 0, byDay: {} },
    streak: { current: 0, best: 0, last: null },
    hearts: { n: MAX_HEARTS, at: now },
    study: { msByDay: {} },
    concepts: {},
    questions: {},
    mistakes: {},
    cards: {},
    lessons: {},
    style: Object.fromEntries(APPROACH_KINDS.map((k) => [k, { shown: 0, worked: 0 }])) as Record<ApproachKind, StyleStat>,
    badges: {},
    counters: { sessions: 0, perfect: 0, aiAsks: 0, cardsReviewed: 0, hardWon: 0, reviewsDone: 0 },
  };
}

/** Fill in fields that older saves may lack, and drop anything malformed. */
export function normalize(raw: unknown, now = Date.now()): AppState {
  const base = initialState(now);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppState>;
  const obj = <T extends object>(v: unknown, d: T): T => (v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : d);
  return {
    v: 1,
    profile: (() => {
      const p = { ...base.profile, ...obj(r.profile, {}) };
      if (![10, 11, 12].includes(p.grade)) p.grade = 12;
      if (!['math', 'science', 'humanities'].includes(p.major)) p.major = 'math';
      if (p.studyAt !== undefined && !isNum(p.studyAt)) delete p.studyAt;
      return p;
    })(),
    xp: { total: Number(r.xp?.total) || 0, byDay: obj(r.xp?.byDay, {}) },
    streak: { ...base.streak, ...obj(r.streak, {}) },
    hearts: { ...base.hearts, ...obj(r.hearts, {}) },
    study: { msByDay: obj(r.study?.msByDay, {}) },
    concepts: obj(r.concepts, {}),
    questions: obj(r.questions, {}),
    mistakes: obj(r.mistakes, {}),
    cards: obj(r.cards, {}),
    lessons: obj(r.lessons, {}),
    style: { ...base.style, ...obj(r.style, {}) },
    badges: obj(r.badges, {}),
    counters: { ...base.counters, ...obj(r.counters, {}) },
    ...extras(r),
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isDay = (k: string) => /^\d{4}-\d{2}-\d{2}$/.test(k);

/** Keep only the newest `n` days of a by-day record. */
function lastDays<T>(rec: Record<string, T>, n = DAYS_KEPT): Record<string, T> {
  const keys = Object.keys(rec).sort();
  if (keys.length <= n) return rec;
  return Object.fromEntries(keys.slice(-n).map((k) => [k, rec[k]]));
}

/**
 * The optional fields added after the first release (mock exams, daily challenges, activity per day). A save
 * without them stays without them; malformed entries are dropped one by one, never the whole save.
 */
function extras(r: Partial<AppState>): Pick<AppState, 'exams' | 'daily' | 'dailyPlan' | 'activity' | 'plan'> {
  const out: Pick<AppState, 'exams' | 'daily' | 'dailyPlan' | 'activity' | 'plan'> = {};
  const plan = readPlan(r.plan);
  if (plan) out.plan = plan;
  if (Array.isArray(r.exams)) {
    out.exams = r.exams
      .filter((e): e is ExamRecord => Boolean(e) && typeof e === 'object' && isNum(e.at) && isNum(e.total) && e.total > 0 && isNum(e.score))
      .map((e) => ({
        ...e,
        lessons: Array.isArray(e.lessons) ? e.lessons.filter((x) => typeof x === 'string') : [],
        correct: Number(e.correct) || 0,
        wrong: Number(e.wrong) || 0,
        blank: Number(e.blank) || 0,
        seconds: Number(e.seconds) || 0,
        timed: Boolean(e.timed),
      }))
      .slice(-EXAMS_KEPT);
  }
  if (r.daily && typeof r.daily === 'object' && !Array.isArray(r.daily)) {
    const d: Record<string, DailyRecord> = {};
    for (const [k, v] of Object.entries(r.daily as Record<string, unknown>)) {
      const rec = v as Partial<DailyRecord> | null;
      if (isDay(k) && rec && Array.isArray(rec.marks)) d[k] = { marks: rec.marks.map(Boolean), at: Number(rec.at) || 0, xp: Number(rec.xp) || 0 };
    }
    out.daily = lastDays(d);
  }
  const pinned = r.dailyPlan as { day?: unknown; ids?: unknown } | undefined;
  if (pinned && typeof pinned.day === 'string' && isDay(pinned.day) && Array.isArray(pinned.ids)) {
    out.dailyPlan = { day: pinned.day, ids: pinned.ids.filter((x): x is string => typeof x === 'string').slice(0, 10) };
  }
  if (r.activity && typeof r.activity === 'object' && !Array.isArray(r.activity)) {
    const a: Record<string, DayActivity> = {};
    for (const [k, v] of Object.entries(r.activity as Record<string, unknown>)) {
      const rec = v as Partial<DayActivity> | null;
      if (isDay(k) && rec && typeof rec === 'object') a[k] = { q: Math.max(0, Number(rec.q) || 0), ok: Math.max(0, Number(rec.ok) || 0) };
    }
    out.activity = lastDays(a);
  }
  return out;
}

/** A saved «برنامهٔ مطالعه», checked field by field; undefined when it is missing or unusable. */
export function readPlan(v: unknown): StudyPlan | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const p = v as Partial<Record<keyof StudyPlan, unknown>>;
  if (typeof p.goal !== 'string' || !isDay(p.goal) || typeof p.start !== 'string' || !isDay(p.start)) return undefined;
  const subjects = Array.isArray(p.subjects) ? [...new Set(p.subjects.filter((x): x is SubjectId => typeof x === 'string'))].slice(0, 40) : [];
  const days = Array.isArray(p.days) ? [...new Set(p.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b) : [];
  if (!subjects.length || !days.length) return undefined;
  const base = p.base as { day?: unknown; left?: unknown; perDay?: unknown; steps?: unknown } | undefined;
  const shift = p.shift as { day?: unknown; by?: unknown } | undefined;
  return {
    goal: p.goal,
    kind: p.kind === 'final' || p.kind === 'konkur' ? p.kind : 'custom',
    subjects,
    days,
    minutes: isNum(p.minutes) ? Math.min(600, Math.max(10, Math.round(p.minutes))) : 60,
    start: p.start,
    base:
      base && typeof base.day === 'string' && isDay(base.day) && isNum(base.left) && isNum(base.perDay) && isNum(base.steps)
        ? { day: base.day, left: base.left, perDay: base.perDay, steps: base.steps }
        : { day: p.start, left: -1, perDay: -1, steps: -1 },
    ...(shift && typeof shift.day === 'string' && isDay(shift.day) && isNum(shift.by) ? { shift: { day: shift.day, by: Math.round(shift.by) } } : {}),
    at: isNum(p.at) ? p.at : 0,
  };
}

/**
 * Sign-in keeps the copy of the progress that has gone furthest, whole. The study plan is a setting, not progress:
 * `best` gets the newest plan of all the copies, so a plan made on this device survives a server copy that is ahead.
 */
export function carryPlan<T extends Partial<AppState> | null>(best: T, copies: unknown[]): T {
  if (!best) return best;
  let plan = readPlan(best.plan);
  let newer = false;
  for (const c of copies) {
    const p = c && typeof c === 'object' ? readPlan((c as { plan?: unknown }).plan) : undefined;
    if (p && (!plan || p.at > plan.at)) [plan, newer] = [p, true];
  }
  return newer ? { ...best, plan } : best;
}

/* ---------------- XP, streak, study time ---------------- */

export function touchStreak(s: AppState, today: string): void {
  const last = s.streak.last;
  if (last === today) return;
  if (last && diffDays(last, today) === 1) s.streak.current += 1;
  else s.streak.current = 1;
  s.streak.last = today;
  s.streak.best = Math.max(s.streak.best, s.streak.current);
}

/** Streak as it should be displayed today (0 when it has lapsed). */
export function liveStreak(s: AppState, today = dayKey()): number {
  const last = s.streak.last;
  if (!last) return 0;
  const gap = diffDays(last, today);
  return gap <= 1 ? s.streak.current : 0;
}

export function studiedToday(s: AppState, today = dayKey()): boolean {
  return s.streak.last === today;
}

export function awardXp(s: AppState, amount: number, now = Date.now()): void {
  if (amount <= 0) return;
  const day = dayKey(now);
  s.xp.total += amount;
  s.xp.byDay[day] = (s.xp.byDay[day] ?? 0) + amount;
  touchStreak(s, day);
}

export function addStudyTime(s: AppState, ms: number, now = Date.now()): void {
  if (!(ms > 0)) return;
  const day = dayKey(now);
  s.study.msByDay[day] = (s.study.msByDay[day] ?? 0) + Math.min(ms, 3 * 60 * 60 * 1000);
}

export function xpToday(s: AppState, today = dayKey()): number {
  return s.xp.byDay[today] ?? 0;
}

/** Levels grow by 60 XP more each time: 0, 60, 180, 360, 600, … */
export function levelInfo(total: number): { level: number; into: number; need: number } {
  let level = 1;
  let floor = 0;
  let step = 60;
  while (total >= floor + step) {
    floor += step;
    level += 1;
    step = 60 * level;
  }
  return { level, into: total - floor, need: step };
}

/* ---------------- Hearts ---------------- */

export function heartsNow(s: AppState, now = Date.now()): { n: number; nextIn: number } {
  const { n, at } = s.hearts;
  if (n >= MAX_HEARTS) return { n: MAX_HEARTS, nextIn: 0 };
  const gained = Math.floor((now - at) / HEART_REFILL_MS);
  const total = Math.min(MAX_HEARTS, n + Math.max(0, gained));
  if (total >= MAX_HEARTS) return { n: MAX_HEARTS, nextIn: 0 };
  const nextIn = HEART_REFILL_MS - ((now - at) % HEART_REFILL_MS);
  return { n: total, nextIn };
}

function settleHearts(s: AppState, now: number): void {
  const { n } = heartsNow(s, now);
  if (n >= MAX_HEARTS) {
    s.hearts = { n: MAX_HEARTS, at: now };
    return;
  }
  const gained = n - s.hearts.n;
  s.hearts = { n, at: s.hearts.at + gained * HEART_REFILL_MS };
}

export function loseHeart(s: AppState, now = Date.now()): void {
  settleHearts(s, now);
  if (s.hearts.n >= MAX_HEARTS) s.hearts.at = now;
  s.hearts.n = Math.max(0, s.hearts.n - 1);
}

export function gainHearts(s: AppState, k: number, now = Date.now()): void {
  settleHearts(s, now);
  s.hearts.n = Math.min(MAX_HEARTS, s.hearts.n + k);
  if (s.hearts.n >= MAX_HEARTS) s.hearts.at = now;
}

/* ---------------- Concepts and the learner model ---------------- */

export function conceptOf(s: AppState, id: string): ConceptProgress {
  return s.concepts[id] ?? { status: 'new', mastery: 0, seen: [], rounds: 0, checksWrong: 0 };
}

export function ensureConcept(s: AppState, id: string): ConceptProgress {
  if (!s.concepts[id]) s.concepts[id] = { status: 'new', mastery: 0, seen: [], rounds: 0, checksWrong: 0 };
  return s.concepts[id];
}

export function markApproachSeen(s: AppState, conceptId: string, index: number, now = Date.now()): void {
  const c = ensureConcept(s, conceptId);
  if (!c.seen.includes(index)) c.seen.push(index);
  c.rounds += 1;
  c.lastSeen = now;
  if (c.status === 'new') c.status = 'learning';
}

/**
 * Called once a concept is confirmed (student said they understood and passed the check).
 * `shownKinds` are the explanation styles shown in this learning round; the last one is credited.
 */
export function markUnderstood(s: AppState, conceptId: string, shownKinds: ApproachKind[], now = Date.now()): void {
  const c = ensureConcept(s, conceptId);
  const winner = shownKinds[shownKinds.length - 1];
  const unique = Array.from(new Set(shownKinds));
  for (const k of unique) s.style[k].shown += 1;
  if (winner) s.style[winner].worked += 1;
  const first = c.status !== 'understood';
  c.status = 'understood';
  c.understoodWith = winner;
  c.understoodAt = c.understoodAt ?? now;
  c.mastery = Math.max(c.mastery, 0.6);
  c.lastSeen = now;
  if (first && unique.length >= 3) s.counters.hardWon += 1;
}

/** Smoothed success rate of each explanation style for this student. */
export function styleScore(stat: StyleStat): number {
  return (stat.worked + 1) / (stat.shown + 2);
}

export type Confusion = 'examples' | 'formula' | 'figure' | 'lost';

const CONFUSION_PREFS: Record<Confusion, Partial<Record<ApproachKind, number>>> = {
  examples: { steps: 0.5, example: 0.4, analogy: 0.1 },
  formula: { visual: 0.5, analogy: 0.4, example: 0.2 },
  figure: { steps: 0.5, formal: 0.3, example: 0.2 },
  lost: { analogy: 0.5, example: 0.4, visual: 0.2 },
};

/**
 * Pick the next explanation to show.
 * The first explanation is always the authored first one (simple, with an example).
 * After that, unseen explanations are ranked by what the student said was confusing,
 * then by how well each style has worked for this student so far.
 * Returns null when every explanation has been shown.
 */
export function nextApproach(
  kinds: ApproachKind[],
  seen: number[],
  style: Record<ApproachKind, StyleStat>,
  confusion?: Confusion,
): number | null {
  const unseen = kinds.map((k, i) => ({ k, i })).filter(({ i }) => !seen.includes(i));
  if (unseen.length === 0) return null;
  if (seen.length === 0) return 0;
  const prefs = confusion ? CONFUSION_PREFS[confusion] : {};
  const ranked = unseen
    .map(({ k, i }) => ({ i, score: (prefs[k] ?? 0) + styleScore(style[k]) * 0.6 - i * 0.02 }))
    .sort((a, b) => b.score - a.score);
  return ranked[0].i;
}

/** The style that has worked best so far, if there is enough evidence. */
export function bestStyle(style: Record<ApproachKind, StyleStat>): ApproachKind | null {
  const enough = APPROACH_KINDS.filter((k) => style[k].shown >= 2);
  if (enough.length === 0) return null;
  const totalWorked = APPROACH_KINDS.reduce((a, k) => a + style[k].worked, 0);
  if (totalWorked < 3) return null;
  return enough.sort((a, b) => styleScore(style[b]) - styleScore(style[a]))[0];
}

/* ---------------- Questions, mastery and mistakes ---------------- */

export type AnswerSource = 'check' | 'practice' | 'test' | 'review';

export function recordAnswer(
  s: AppState,
  q: { id: string; concept: string },
  correct: boolean,
  source: AnswerSource,
  now = Date.now(),
): void {
  const stat = s.questions[q.id] ?? { seen: 0, correct: 0 };
  stat.seen += 1;
  if (correct) stat.correct += 1;
  stat.last = correct;
  stat.at = now;
  s.questions[q.id] = stat;
  noteActivity(s, correct, now);

  const c = ensureConcept(s, q.concept);
  const rate = source === 'test' ? 0.2 : 0.25;
  c.mastery = correct ? c.mastery + (1 - c.mastery) * rate : c.mastery * (source === 'check' ? 0.85 : 0.72);
  c.mastery = Math.max(0, Math.min(1, c.mastery));
  if (source === 'check' && !correct) c.checksWrong += 1;

  const m = s.mistakes[q.id];
  if (!correct) {
    s.mistakes[q.id] = { at: now, count: (m?.count ?? 0) + 1, resolved: false };
  } else if (m && !m.resolved && (source === 'review' || source === 'practice')) {
    m.resolved = true;
    m.at = now;
  }
}

/** Count one answered question towards today's activity (for «گزارش هفته»). */
export function noteActivity(s: AppState, correct: boolean, now = Date.now()): void {
  const day = dayKey(now);
  const log = (s.activity ??= {});
  const d = (log[day] ??= { q: 0, ok: 0 });
  d.q += 1;
  if (correct) d.ok += 1;
  if (Object.keys(log).length > DAYS_KEPT) s.activity = lastDays(log);
}

export function openMistakes(s: AppState): string[] {
  return Object.entries(s.mistakes)
    .filter(([, m]) => !m.resolved)
    .sort((a, b) => b[1].at - a[1].at)
    .map(([id]) => id);
}

/* ---------------- Flashcards (Leitner boxes) ---------------- */

export type CardRating = 'again' | 'hard' | 'good';

export function cardOf(s: AppState, id: string, today = dayKey()): CardState {
  return s.cards[id] ?? { box: 0, due: today, reviews: 0, lapses: 0 };
}

export function isDue(card: CardState | undefined, today = dayKey()): boolean {
  if (!card) return true;
  return diffDays(card.due, today) >= 0;
}

export function reviewCard(s: AppState, id: string, rating: CardRating, today = dayKey(), now = Date.now()): CardState {
  const prev = cardOf(s, id, today);
  const next: CardState = { ...prev, reviews: prev.reviews + 1, last: now };
  if (prev.reviews === 0) next.first = now;
  if (rating === 'again') {
    next.box = 1;
    next.due = today;
    if (prev.box > 1) next.lapses += 1;
  } else if (rating === 'hard') {
    next.box = Math.max(1, prev.box);
    next.due = addDays(today, 1);
  } else {
    // A new card the student already knows skips straight to box 2.
    next.box = prev.box === 0 ? 2 : Math.min(5, prev.box + 1);
    next.due = addDays(today, LEITNER_DAYS[next.box]);
  }
  s.cards[id] = next;
  s.counters.cardsReviewed += 1;
  return next;
}

/* ---------------- Lessons ---------------- */

/** True once the learner has done something worth coming back to: they then skip the landing page. */
export function hasProgress(s: AppState): boolean {
  return s.profile.onboarded && (s.xp.total > 0 || Object.keys(s.lessons).length > 0 || Object.keys(s.concepts).length > 0);
}

/**
 * How far a saved copy of the progress has gone (XP first, then whether setup was finished), to keep the
 * further copy at sign-in and on start-up. −1 for no copy at all.
 */
export function progressRank(raw: unknown): number {
  if (!raw || typeof raw !== 'object') return -1;
  const r = raw as { xp?: { total?: unknown }; profile?: { onboarded?: unknown } };
  const xp = typeof r.xp?.total === 'number' && Number.isFinite(r.xp.total) ? Math.max(0, r.xp.total) : 0;
  return xp * 2 + (r.profile?.onboarded === true ? 1 : 0);
}

export function lessonOf(s: AppState, id: string): LessonProgress {
  return s.lessons[id] ?? { practiceRuns: 0, perfectRuns: 0, tests: [] };
}

export function ensureLesson(s: AppState, id: string): LessonProgress {
  if (!s.lessons[id]) s.lessons[id] = { practiceRuns: 0, perfectRuns: 0, tests: [] };
  return s.lessons[id];
}

/** Konkur scoring: each wrong answer cancels a third of a right one. */
export function konkurScore(correct: number, wrong: number, total: number): number {
  if (total <= 0) return 0;
  return ((3 * correct - wrong) / (3 * total)) * 100;
}

/** A «تست کنکوری» handed in with at least one answer. */
export function recordKonkur(s: AppState, lessonId: string, score: number, now = Date.now()): void {
  const l = ensureLesson(s, lessonId);
  const prev = l.konkur;
  l.konkur = { best: Math.max(prev?.best ?? -Infinity, score), at: now, tries: (prev?.tries ?? 0) + 1 };
}

export function recordTest(s: AppState, lessonId: string, rec: TestRecord): void {
  const l = ensureLesson(s, lessonId);
  l.tests.push(rec);
  if (l.tests.length > 30) l.tests.splice(0, l.tests.length - 30);
  l.best = Math.max(l.best ?? -Infinity, rec.score);
}

/* ---------------- «آزمون جامع» and «چالش امروز» ---------------- */

/**
 * XP for a konkur-style test, lesson or mock exam: a fifth of the score, at least 5. A test handed in (or timed
 * out) with no question answered earns nothing, so letting the clock run out is no way to collect XP or a streak day.
 */
export function testXp(score: number, answered: number): number {
  if (!(answered > 0)) return 0;
  return Math.max(5, Math.round(Math.max(0, score) / 5));
}

export function recordExam(s: AppState, rec: ExamRecord): void {
  const list = (s.exams ??= []);
  list.push(rec);
  if (list.length > EXAMS_KEPT) list.splice(0, list.length - EXAMS_KEPT);
}

/** A small bonus for the daily challenge: 5, plus 2 per right answer, plus 5 when all are right. */
export function dailyXp(marks: boolean[]): number {
  const right = marks.filter(Boolean).length;
  return 5 + 2 * right + (marks.length > 0 && right === marks.length ? 5 : 0);
}

export function dailyOf(s: AppState, day = dayKey()): DailyRecord | undefined {
  return s.daily?.[day];
}

export function recordDaily(s: AppState, day: string, marks: boolean[], xp: number, now = Date.now()): void {
  const d = (s.daily ??= {});
  d[day] = { marks: marks.slice(), at: now, xp };
  if (Object.keys(d).length > DAYS_KEPT) s.daily = lastDays(d);
}

/**
 * Days in a row the daily challenge was finished, ending today, or yesterday when today's is still open
 * (so the count does not drop to zero in the morning).
 */
export function dailyStreak(s: AppState, today = dayKey()): number {
  const done = s.daily ?? {};
  let day = done[today] ? today : addDays(today, -1);
  let n = 0;
  while (done[day]) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

/** The longest run of days in a row with a finished daily challenge, at any time (for the «هفت چالش پیاپی» badge). */
export function dailyBestRun(s: AppState): number {
  const done = s.daily ?? {};
  let best = 0;
  for (const day of Object.keys(done)) {
    if (done[addDays(day, -1)]) continue; // not the first day of a run
    let n = 0;
    for (let d = day; done[d]; d = addDays(d, 1)) n += 1;
    best = Math.max(best, n);
  }
  return best;
}
