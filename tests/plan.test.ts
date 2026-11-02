import { describe, expect, it } from 'vitest';
import { SUBJECTS, subjectById } from '../src/content';
import type { Lesson } from '../src/content/types';
import {
  dawnOf,
  goalPreset,
  interleave,
  lessonSteps,
  makePlan,
  replan,
  reviewDays,
  schedule,
  spread,
  STEP_MINUTES,
  type PlanSettings,
  type Schedule,
} from '../src/lib/plan';
import { buildSheet, NOTES_PER_CONCEPT } from '../src/lib/sheet';
import { carryPlan, ensureLesson, initialState, normalize, readPlan, type AppState } from '../src/lib/state';
import { addDays, diffDays, fromKey, fromPersian, persianMonthDays, persianOf } from '../src/lib/time';

const SAT = '2026-10-24'; // a Saturday, 30 Mehr 1405 is the Thursday before
const books = SUBJECTS.filter((s) => s.lessons.length >= 5).slice(0, 2);
const settings = (over: Partial<PlanSettings> = {}): PlanSettings => ({
  goal: addDays(SAT, 70),
  kind: 'custom',
  subjects: books.map((b) => b.id),
  days: [6, 0, 1, 2, 3, 4],
  minutes: 60,
  ...over,
});
const fresh = (): AppState => {
  const s = initialState(fromKey(SAT).getTime());
  s.profile.onboarded = true;
  return s;
};

/** Mark every step of a lesson finished at `at`. */
function finish(s: AppState, lesson: Lesson, at: number) {
  for (const c of lesson.concepts) s.concepts[c.id] = { status: 'understood', mastery: 0.8, seen: [0], rounds: 1, checksWrong: 0, understoodAt: at };
  const lp = ensureLesson(s, lesson.id);
  for (const st of lessonSteps(s, lesson)) if (['practice', 'final', 'hard'].includes(st.node.kind)) (lp.done ??= {})[st.node.id] = at;
  for (const c of lesson.cards) s.cards[c.id] = { box: 2, due: addDays(SAT, 2), reviews: 1, lapses: 0, last: at };
  lp.tests.push({ at, correct: 5, wrong: 0, blank: 0, total: 5, score: 100, seconds: 60 });
}

const lessonMinutes = (sc: Schedule) => sc.days.map((d) => d.items.reduce((a, it) => a + (it.kind === 'lesson' ? it.minutes : 0), 0));
const learnDays = (sc: Schedule) => sc.days.filter((d) => d.items.some((it) => it.kind === 'lesson'));

describe('«برنامهٔ مطالعه»: spreading the lessons', () => {
  it('lays every unfinished step once, in book order, about the same minutes each day', () => {
    const s = fresh();
    const plan = makePlan(settings(), s, SAT);
    const sc = schedule(plan, s, SAT);
    expect(sc.state).toBe('active');
    const laid = sc.days.flatMap((d) => d.items.flatMap((it) => (it.kind === 'lesson' ? it.steps : [])));
    const all = books.flatMap((b) => b.lessons.flatMap((l) => lessonSteps(s, l)));
    expect(laid.length).toBe(all.length);
    expect(new Set(laid.map((st) => st.node.id)).size).toBe(all.length);
    // Each book keeps its own order.
    for (const b of books) {
      const mine = laid.filter((st) => st.lesson.subject === b.id).map((st) => st.node.id);
      expect(mine).toEqual(b.lessons.flatMap((l) => lessonSteps(s, l).map((st) => st.node.id)));
    }
    // Both books move forward together: each shows up in the first week.
    const firstWeek = sc.days.slice(0, 6).flatMap((d) => d.items.map((it) => (it.kind === 'lesson' ? it.lesson.subject : '')));
    for (const b of books) expect(firstWeek).toContain(b.id);
    // Even: every learning day is within one step of the average.
    const used = lessonMinutes(sc).filter((m) => m > 0);
    const avg = used.reduce((a, b) => a + b, 0) / used.length;
    const big = Math.max(...Object.values(STEP_MINUTES));
    for (const m of used) expect(Math.abs(m - avg)).toBeLessThanOrEqual(big);
    // Lessons end before the review stretch, which holds mock exams of the plan's books.
    const review = sc.days.filter((d) => d.phase === 'review');
    expect(review.length).toBeGreaterThan(0);
    for (const d of review) expect(d.items.some((it) => it.kind === 'mock')).toBe(true);
    expect(learnDays(sc).every((d) => diffDays(d.day, sc.reviewStart) > 0)).toBe(true);
  });

  it('spread and interleave share the load evenly and keep each list in order', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ i, minutes: [12, 10, 5, 15][i % 4] }));
    const days = spread(items, 9);
    expect(days.flat().map((x) => x.i)).toEqual(items.map((x) => x.i));
    const loads = days.map((d) => d.reduce((a, x) => a + x.minutes, 0));
    const avg = 420 / 9;
    for (const l of loads) expect(Math.abs(l - avg)).toBeLessThanOrEqual(15);
    const a = [1, 2, 3, 4].map((n) => ({ n: `a${n}`, minutes: 10 }));
    const b = [1, 2].map((n) => ({ n: `b${n}`, minutes: 10 }));
    expect(interleave([a, b]).map((x) => x.n)).toEqual(['a1', 'b1', 'a2', 'a3', 'b2', 'a4']);
    expect(spread(items, 0)).toEqual([]);
  });



  it('does not stretch a little work thin: half the daily time at least, then light review', () => {
    const s = fresh();
    const one = SUBJECTS.find((x) => x.lessons.length >= 2)!;
    for (const l of one.lessons.slice(1)) finish(s, l, dawnOf(SAT) - 3600_000);
    const plan = makePlan(settings({ subjects: [one.id], goal: addDays(SAT, 200), minutes: 120 }), s, SAT);
    const sc = schedule(plan, s, SAT);
    expect(sc.perDay).toBeGreaterThanOrEqual(Math.min(sc.left, 60));
    expect(sc.days.some((d) => d.phase === 'free')).toBe(true);
    expect(sc.overloaded).toBe(false);
  });

});

describe('«برنامهٔ مطالعه»: ahead, behind and the quiet re-plan', () => {

  it('does not count lessons added to a book later as falling behind', () => {
    const s = fresh();
    const made = makePlan(settings(), s, SAT);
    // As if the books had fewer lessons when the plan was made.
    const plan = { ...made, base: { ...made.base, left: made.base.left - 120, steps: made.base.steps - 10 } };
    const later = addDays(SAT, 1);
    expect(schedule(plan, s, later).status.kind).toBe('on-track');
    const next = replan(plan, s, later)!;
    expect(next.base.steps).toBe(made.base.steps);
    expect(next.shift).toBeUndefined();
  });


  it('keeps steps finished today on today\'s list, marked done', () => {
    const s = fresh();
    const plan = makePlan(settings(), s, SAT);
    const first = schedule(plan, s, SAT).todayPlan!.items[0];
    expect(first.kind).toBe('lesson');
    if (first.kind !== 'lesson') return;
    const c = first.lesson.concepts[0];
    s.concepts[c.id] = { status: 'understood', mastery: 0.7, seen: [0], rounds: 1, checksWrong: 0, understoodAt: dawnOf(SAT) + 5 * 3600_000 };
    const again = schedule(plan, s, SAT).todayPlan!.items[0];
    expect(again.kind === 'lesson' && again.steps[0].doneAt).toBeGreaterThan(0);
    expect(again.kind === 'lesson' && again.steps.length).toBe(first.steps.length);
  });

  it('handles an exam day that has come or gone', () => {
    const s = fresh();
    const plan = makePlan(settings({ goal: addDays(SAT, 10) }), s, SAT);
    const past = schedule(plan, s, addDays(SAT, 12));
    expect(past.state).toBe('expired');
    expect(past.days).toEqual([]);
    expect(past.todayPlan).toBeNull();
    expect(replan(plan, s, addDays(SAT, 12))).toBeNull();
    expect(schedule(plan, s, addDays(SAT, 10)).state).toBe('exam-day');
    // A plan made with a goal already gone (an old save, a wrong clock) does not break.
    const odd = makePlan(settings({ goal: addDays(SAT, -3) }), s, SAT);
    expect(schedule(odd, s, SAT).state).toBe('expired');
    // A goal tomorrow: only today is left, and it carries everything.
    const rush = makePlan(settings({ goal: addDays(SAT, 1) }), s, SAT);
    const r = schedule(rush, s, SAT);
    expect(r.days.map((d) => d.day)).toEqual([SAT]);
    expect(r.overloaded).toBe(true);
  });

  it('keeps the review stretch about a sixth of the plan, at most three weeks', () => {
    expect(reviewDays(SAT, addDays(SAT, 220))).toBe(21);
    expect(reviewDays(SAT, addDays(SAT, 40))).toBe(6);
    expect(reviewDays(SAT, addDays(SAT, 2))).toBe(0);
  });
});

describe('«برنامهٔ مطالعه»: saving, old saves and sign-in', () => {
  it('loads old saves without a plan, and drops a broken one without losing the rest', () => {
    const old = normalize({ v: 1, profile: { onboarded: true }, xp: { total: 40, byDay: {} } });
    expect(old.plan).toBeUndefined();
    expect('plan' in old).toBe(false);
    const broken = normalize({ v: 1, profile: { onboarded: true }, xp: { total: 40 }, plan: { goal: 'soon', subjects: 'x' } });
    expect(broken.plan).toBeUndefined();
    expect(broken.xp.total).toBe(40);
    const plan = makePlan(settings(), fresh(), SAT, 123);
    const back = normalize(JSON.parse(JSON.stringify({ ...fresh(), plan })));
    expect(back.plan).toEqual(plan);
    // An unmeasured yardstick is filled in on the next re-plan.
    const bare = readPlan({ ...plan, base: undefined })!;
    expect(bare.base.left).toBe(-1);
    expect(replan(bare, fresh(), addDays(SAT, 1))?.base.left).toBeGreaterThan(0);
  });

  it('survives the sign-in merge: the newest plan comes along with the copy that went furthest', () => {
    const here = { ...fresh(), plan: makePlan(settings({ minutes: 90 }), fresh(), SAT, 2000) };
    const server = { ...fresh(), xp: { total: 900, byDay: {} } };
    const best = carryPlan(server, [here, server]);
    expect(best.xp.total).toBe(900);
    expect(best.plan?.minutes).toBe(90);
    const older = { ...server, plan: makePlan(settings({ minutes: 30 }), fresh(), SAT, 1000) };
    expect(carryPlan(older, [here]).plan?.minutes).toBe(90);
    expect(carryPlan(here, [older]).plan?.minutes).toBe(90);
    expect(carryPlan(null, [here])).toBeNull();
  });
});

describe('the Persian calendar', () => {
  it('turns Persian dates into days and back', () => {
    expect(fromPersian(1406, 3, 1)).toBe('2027-05-22');
    expect(persianOf('2026-10-22')).toEqual({ y: 1405, m: 7, d: 30 });
    for (let y = 1403; y <= 1407; y++)
      for (let m = 1; m <= 12; m++) for (const d of [1, persianMonthDays(y, m)]) expect(persianOf(fromPersian(y, m, d))).toEqual({ y, m, d });
    expect([29, 30]).toContain(persianMonthDays(1405, 12));
  });

  it('offers the next خرداد finals and konkur after today', () => {
    expect(goalPreset('final', '2026-10-22')).toBe(fromPersian(1406, 3, 1));
    expect(goalPreset('final', fromPersian(1406, 3, 1))).toBe(fromPersian(1407, 3, 1));
    expect(diffDays('2026-10-22', goalPreset('konkur', '2026-10-22'))).toBeGreaterThan(0);
  });
});

describe('«برگهٔ خلاصه»', () => {
  it('covers every lesson, concept and card of a book once, in book order', () => {
    for (const subject of SUBJECTS.filter((s) => s.lessons.length)) {
      const sheet = buildSheet(subject);
      const lessons = sheet.chapters.flatMap((c) => c.lessons);
      expect(lessons.map((l) => l.id).sort()).toEqual(subject.lessons.map((l) => l.id).sort());
      // Chapters in the order they first appear in the book.
      expect(sheet.chapters.map((c) => c.chapter)).toEqual([...new Set(subject.lessons.map((l) => l.chapter))]);
      for (const l of lessons) {
        const src = subject.lessons.find((x) => x.id === l.id)!;
        expect(l.concepts.map((c) => c.id)).toEqual(src.concepts.map((c) => c.id));
        const cards = [...l.concepts.flatMap((c) => c.cards), ...l.cards].map((c) => c.id);
        expect(cards.sort()).toEqual(src.cards.map((c) => c.id).sort());
        for (const c of l.concepts) {
          expect(c.summary.length).toBeGreaterThan(0);
          expect(c.notes.length).toBeLessThanOrEqual(NOTES_PER_CONCEPT);
          expect(new Set(c.notes.map((n) => n.text)).size).toBe(c.notes.length);
          for (const n of c.notes) expect(['key', 'exam']).toContain(n.tone);
        }
      }
      expect(sheet.counts.lessons).toBe(subject.lessons.length);
      expect(sheet.counts.cards).toBe(subject.lessons.reduce((a, l) => a + l.cards.length, 0));
    }
  });

  it('takes a concept\'s summary as written and its key notes before its exam notes', () => {
    const subject = subjectById('bm1');
    const sheet = buildSheet(subject);
    const lesson = subject.lessons[0];
    const c = sheet.chapters.flatMap((x) => x.lessons).find((l) => l.id === lesson.id)!.concepts[0];
    expect(c.summary).toEqual(lesson.concepts[0].summary);
    const tones = sheet.chapters.flatMap((x) => x.lessons.flatMap((l) => l.concepts.flatMap((k) => k.notes.map((n) => n.tone))));
    expect(tones).toContain('key');
    for (const k of sheet.chapters.flatMap((x) => x.lessons.flatMap((l) => l.concepts))) {
      const first = k.notes.findIndex((n) => n.tone === 'exam');
      if (first >= 0) expect(k.notes.slice(first).every((n) => n.tone === 'exam')).toBe(true);
    }
  });
});
