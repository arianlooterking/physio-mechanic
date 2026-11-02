import { describe, expect, it } from 'vitest';
import { answerMatches, fmt, parseAnswer, pct, texOf, toEn, toFa } from '../src/lib/digits';
import { grade } from '../src/lib/grade';
import { polyDivide, polyEval } from '../src/lib/fns';
import {
  awardXp,
  gainHearts,
  heartsNow,
  HEART_REFILL_MS,
  initialState,
  konkurScore,
  levelInfo,
  liveStreak,
  loseHeart,
  markUnderstood,
  MAX_HEARTS,
  nextApproach,
  normalize,
  recordAnswer,
  reviewCard,
} from '../src/lib/state';
import { addDays, dayKey, diffDays } from '../src/lib/time';
import { parseTeachbackScore, sanitizeRequest } from '../src/lib/tutorPrompt';
import type { ApproachKind } from '../src/content/types';

describe('digits', () => {
  it('converts digits both ways', () => {
    expect(toFa('x=12')).toBe('x=۱۲');
    expect(toEn('۱۲٫۵ و ٣')).toBe('12٫5 و 3');
  });
  it('formats numbers the Persian way', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(10, 0)).toBe('10');
    expect(fmt(100)).toBe('100');
    expect(fmt(1.5)).toBe('1٫5');
    expect(fmt(-2.25)).toBe('⁦−2٫25⁩');
    expect(texOf(-2.25)).toBe('-2{\\dec}25');
    expect(texOf(1234.5)).toBe('1234{\\dec}5');
    expect(fmt(12345)).toBe('12٬345');
    expect(fmt(-0.001)).toBe('0');
    expect(pct(0.5)).toBe('⁦٪50⁩');
  });
  it('reads answers written with Persian digits and separators', () => {
    expect(parseAnswer('۲')).toEqual([2]);
    expect(parseAnswer('−۴')).toEqual([-4]);
    expect(parseAnswer('0/5')).toContain(0.5);
    expect(parseAnswer('۱/۲')).toEqual(expect.arrayContaining([1.2, 0.5]));
    expect(parseAnswer('2٫1')).toEqual([2.1]);
    expect(parseAnswer('3,5')).toEqual([3.5]);
    expect(parseAnswer('')).toEqual([]);
    expect(parseAnswer('abc')).toEqual([]);
  });
  it('matches answers within tolerance', () => {
    expect(answerMatches('4.02', 4.02, 0.005)).toBe(true);
    expect(answerMatches('4', 4.02, 0.005)).toBe(false);
    expect(answerMatches('۰٫۹۵', 0.95, 0.03)).toBe(true);
    expect(answerMatches('-2', -2)).toBe(true);
    expect(answerMatches('2', -2)).toBe(false);
    expect(answerMatches('0/02', 0.02)).toBe(true);
  });
});

describe('time', () => {
  it('adds and diffs days across month ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(diffDays('2026-02-27', '2026-03-02')).toBe(3);
    expect(dayKey(new Date(2026, 9, 14, 23, 59))).toBe('2026-10-14');
  });
});

describe('streak and xp', () => {
  it('extends on consecutive days and resets after a gap', () => {
    const s = initialState();
    const d1 = new Date(2026, 9, 10, 10).getTime();
    awardXp(s, 10, d1);
    expect(s.streak.current).toBe(1);
    awardXp(s, 5, d1 + 3600_000);
    expect(s.streak.current).toBe(1);
    awardXp(s, 5, d1 + 86_400_000);
    expect(s.streak.current).toBe(2);
    expect(liveStreak(s, '2026-10-12')).toBe(2);
    expect(liveStreak(s, '2026-10-13')).toBe(0);
    awardXp(s, 5, d1 + 3 * 86_400_000);
    expect(s.streak.current).toBe(1);
    expect(s.streak.best).toBe(2);
    expect(s.xp.total).toBe(25);
  });
  it('computes levels', () => {
    expect(levelInfo(0)).toEqual({ level: 1, into: 0, need: 60 });
    expect(levelInfo(60).level).toBe(2);
    expect(levelInfo(179).level).toBe(2);
    expect(levelInfo(180).level).toBe(3);
  });
});

describe('hearts', () => {
  it('lose and refill over time', () => {
    const s = initialState(0);
    const t0 = 1_000_000;
    loseHeart(s, t0);
    loseHeart(s, t0);
    expect(heartsNow(s, t0).n).toBe(MAX_HEARTS - 2);
    expect(heartsNow(s, t0 + HEART_REFILL_MS).n).toBe(MAX_HEARTS - 1);
    expect(heartsNow(s, t0 + 10 * HEART_REFILL_MS).n).toBe(MAX_HEARTS);
    gainHearts(s, 1, t0 + 1);
    expect(heartsNow(s, t0 + 1).n).toBe(MAX_HEARTS - 1);
  });
  it('never goes below zero', () => {
    const s = initialState(0);
    for (let i = 0; i < 9; i++) loseHeart(s, 5);
    expect(heartsNow(s, 5).n).toBe(0);
  });
});

describe('learner model', () => {
  const kinds: ApproachKind[] = ['example', 'visual', 'analogy', 'steps'];
  it('always starts with the first (simple) explanation', () => {
    const s = initialState();
    expect(nextApproach(kinds, [], s.style)).toBe(0);
  });
  it('follows what the student found confusing', () => {
    const s = initialState();
    expect(nextApproach(kinds, [0], s.style, 'formula')).toBe(1); // visual
    expect(nextApproach(kinds, [0], s.style, 'lost')).toBe(2); // analogy
    expect(nextApproach(kinds, [0], s.style, 'figure')).toBe(3); // steps
  });
  it('prefers styles that worked before', () => {
    const s = initialState();
    s.style.steps = { shown: 5, worked: 5 };
    s.style.visual = { shown: 5, worked: 0 };
    expect(nextApproach(kinds, [0], s.style)).toBe(3);
  });
  it('returns null when everything has been shown', () => {
    expect(nextApproach(kinds, [0, 1, 2, 3], initialState().style)).toBeNull();
  });
  it('credits the explanation that made it click', () => {
    const s = initialState();
    markUnderstood(s, 'x', ['example', 'visual', 'analogy']);
    expect(s.style.analogy.worked).toBe(1);
    expect(s.style.example.shown).toBe(1);
    expect(s.counters.hardWon).toBe(1);
    expect(s.concepts.x.status).toBe('understood');
    expect(s.concepts.x.mastery).toBeGreaterThanOrEqual(0.6);
  });
  it('tracks mastery and mistakes', () => {
    const s = initialState();
    recordAnswer(s, { id: 'q1', concept: 'c' }, false, 'practice', 1);
    expect(s.mistakes.q1.resolved).toBe(false);
    recordAnswer(s, { id: 'q1', concept: 'c' }, true, 'review', 2);
    expect(s.mistakes.q1.resolved).toBe(true);
    const before = s.concepts.c.mastery;
    recordAnswer(s, { id: 'q2', concept: 'c' }, true, 'practice', 3);
    expect(s.concepts.c.mastery).toBeGreaterThan(before);
  });
});

describe('flashcards (Leitner)', () => {
  it('moves boxes and schedules reviews', () => {
    const s = initialState();
    const today = '2026-10-14';
    let c = reviewCard(s, 'k', 'good', today);
    expect(c.box).toBe(2);
    expect(c.due).toBe('2026-10-16');
    c = reviewCard(s, 'k', 'good', '2026-10-16');
    expect(c.box).toBe(3);
    expect(c.due).toBe('2026-10-20');
    c = reviewCard(s, 'k', 'again', '2026-10-20');
    expect(c.box).toBe(1);
    expect(c.due).toBe('2026-10-20');
    expect(c.lapses).toBe(1);
    c = reviewCard(s, 'k', 'hard', '2026-10-20');
    expect(c.box).toBe(1);
    expect(c.due).toBe('2026-10-21');
  });
});

describe('scoring and grading', () => {
  it('uses konkur negative marking', () => {
    expect(konkurScore(10, 0, 10)).toBe(100);
    expect(konkurScore(9, 3, 12)).toBeCloseTo(((27 - 3) / 36) * 100);
    expect(konkurScore(0, 3, 3)).toBeCloseTo(-33.333, 2);
  });
  it('grades each question type', () => {
    expect(grade({ type: 'mcq', id: 'a', concept: 'c', level: 1, prompt: '', explain: '', options: ['x', 'y'], answer: 1 }, { t: 'mcq', choice: 1 })).toBe(true);
    expect(grade({ type: 'num', id: 'a', concept: 'c', level: 1, prompt: '', explain: '', answer: -2 }, { t: 'num', raw: '−۲' })).toBe(true);
    expect(grade({ type: 'order', id: 'a', concept: 'c', level: 1, prompt: '', explain: '', items: ['1', '2', '3'] }, { t: 'order', seq: [0, 2, 1] })).toBe(false);
    expect(grade({ type: 'match', id: 'a', concept: 'c', level: 1, prompt: '', explain: '', pairs: [['a', 'b']] }, { t: 'match', mistakes: 1, done: true })).toBe(false);
  });
});

describe('state loading', () => {
  it('repairs partial or broken saves', () => {
    expect(normalize(null).v).toBe(1);
    const s = normalize({ profile: { name: 'سارا' }, xp: { total: '12' }, style: { visual: { shown: 2, worked: 1 } } });
    expect(s.profile.name).toBe('سارا');
    expect(s.profile.goal).toBe(30);
    expect(s.xp.total).toBe(12);
    expect(s.style.visual.worked).toBe(1);
    expect(s.style.example).toEqual({ shown: 0, worked: 0 });
  });
});

describe('math helpers', () => {
  it('divides polynomials (remainder theorem)', () => {
    const f = [1, -2, 0, 4]; // x³ − 2x² + 4
    const { q, r } = polyDivide(f, [1, -1]);
    expect(q).toEqual([1, -1, -1]);
    expect(r[0]).toBeCloseTo(3);
    expect(polyEval(f, 1)).toBe(3);
    const g = [1, 0, 1, -2]; // x³ + x − 2 ÷ (2x + 1)
    expect(polyDivide(g, [2, 1]).r[0]).toBeCloseTo(polyEval(g, -0.5));
  });
});

describe('tutor request', () => {
  it('rejects bad input and clips long fields', () => {
    expect(sanitizeRequest(null)).toBeNull();
    expect(sanitizeRequest({ mode: 'hack' })).toBeNull();
    expect(sanitizeRequest({ mode: 'chat', turns: [] })).toBeNull();
    const ok = sanitizeRequest({ mode: 'chat', concept: 'x'.repeat(1000), turns: [{ role: 'user', content: 'سلام' }] });
    expect(ok?.concept.length).toBe(300);
    expect(ok?.turns?.[0].role).toBe('user');
  });
  it('reads the teach-back score', () => {
    expect(parseTeachbackScore('خیلی خوب بود.\nنمره: ۳ از ۳')).toBe(3);
    expect(parseTeachbackScore('نمره: 1 از 3')).toBe(1);
    expect(parseTeachbackScore('بدون نمره')).toBeNull();
  });
});
