import { describe, expect, it } from 'vitest';
import { LESSONS } from '../src/content';
import { buildPath, resumePoint } from '../src/lib/learner';
import { hasProgress, initialState, progressRank } from '../src/lib/state';

// Two lessons of one subject, in order, to walk a learner through.
const subject = LESSONS.find((l, i) => LESSONS.findIndex((m) => m.subject === l.subject) !== i)!.subject;
const [first, second] = LESSONS.filter((l) => l.subject === subject);

function finish(s: ReturnType<typeof initialState>, lesson: typeof first, at: number) {
  for (const c of lesson.concepts) s.concepts[c.id] = { status: 'understood', mastery: 1, seen: [0], rounds: 1, checksWrong: 0, lastSeen: at };
  const done: Record<string, number> = {};
  for (const n of buildPath(lesson)) if (n.kind === 'practice' || n.kind === 'final' || n.kind === 'hard') done[n.id] = at;
  s.lessons[lesson.id] = { practiceRuns: 1, perfectRuns: 0, tests: [{ at, correct: 1, wrong: 0, blank: 0, total: 1, score: 100, seconds: 9 }], done };
  for (const c of lesson.cards) s.cards[c.id] = { box: 2, due: '2099-01-01', reviews: 1, lapses: 0 };
}

describe('where a returning learner continues', () => {
  it('shows nothing before any lesson is started', () => {
    expect(resumePoint(initialState(), LESSONS)).toBeNull();
  });

  it('picks the next step of the lesson worked on last', () => {
    const s = initialState();
    const c0 = second.concepts[0].id;
    s.concepts[first.concepts[0].id] = { status: 'learning', mastery: 0.2, seen: [0], rounds: 1, checksWrong: 0, lastSeen: 100 };
    s.concepts[c0] = { status: 'understood', mastery: 1, seen: [0], rounds: 1, checksWrong: 0, lastSeen: 200 };
    const r = resumePoint(s, LESSONS)!;
    expect(r.lesson.id).toBe(second.id);
    expect(r.index).toBe(1);
    expect(r.node.conceptId).toBe(second.concepts[1].id);
    expect(r.fresh).toBe(false);
  });

  it('moves on to the next lesson of the subject once the last one is finished', () => {
    const s = initialState();
    finish(s, first, 500);
    const r = resumePoint(s, LESSONS)!;
    expect(r.lesson.id).toBe(second.id);
    expect(r.index).toBe(0);
    expect(r.fresh).toBe(true);
  });
});

describe('returning visitors skip the landing page', () => {
  it('counts a guest as returning only after setup and some progress', () => {
    const s = initialState();
    expect(hasProgress(s)).toBe(false);
    s.xp.total = 20;
    expect(hasProgress(s)).toBe(false);
    s.profile.onboarded = true;
    expect(hasProgress(s)).toBe(true);
  });

  it('keeps the copy of the progress that has gone further at sign-in', () => {
    const empty = initialState();
    const set = { ...initialState(), profile: { ...initialState().profile, onboarded: true } };
    const ahead = { ...set, xp: { total: 120, byDay: {} } };
    expect(progressRank(null)).toBe(-1);
    expect(progressRank(empty)).toBeLessThan(progressRank(set));
    expect(progressRank(set)).toBeLessThan(progressRank(ahead));
    expect(progressRank({ v: 1, xp: 'x' })).toBe(0);
  });
});
