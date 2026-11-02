import { describe, expect, it } from 'vitest';
import { LESSONS, SUBJECTS, lessonById, testById } from '../src/content';
import { DAILY_SIZE, dailyIds, dailyQuestions, dailySeed, dailyShareText, SITE_URL } from '../src/lib/daily';
import { autoGradable, buildExam, chaptersOf, examPool, examPoolSize, lessonResults } from '../src/lib/exam';
import { buildPath, findQuestion, reviewAvailable, trackFinish } from '../src/lib/learner';
import { weekReport } from '../src/lib/report';
import { normalizeFa, searchLessons } from '../src/lib/search';
import {
  dailyBestRun,
  dailyStreak,
  dailyXp,
  EXAMS_KEPT,
  initialState,
  normalize,
  progressRank,
  recordAnswer,
  recordDaily,
  recordExam,
  testXp,
  type AppState,
} from '../src/lib/state';
import { addDays } from '../src/lib/time';
import { awardBadges } from '../src/lib/badges';
import { personalDataIn } from '../src/lib/problemReport';
import { lessonWords, WORD_PREFIX, wordDeck, WORDS_NEW_PER_DAY, wordsMet } from '../src/lib/words';
import { reviewCard } from '../src/lib/state';
import { readBackup } from '../src/lib/store';

const subject = SUBJECTS.find((s) => s.lessons.length >= 3)!;
const three = subject.lessons.slice(0, 3);

describe('«آزمون جامع»: building the exam', () => {
  it('draws only gradable questions, and only from the chosen lessons', () => {
    const items = buildExam(three, 30, 42);
    const ids = new Set(three.map((l) => l.id));
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(ids.has(it.lessonId)).toBe(true);
      expect(autoGradable(it.q)).toBe(true);
      expect(it.q.type).not.toBe('written');
      expect(it.q.type).not.toBe('match');
      // Every question really belongs to its lesson (lesson test, hard set or «تست کنکوری»).
      const lesson = lessonById(it.lessonId)!;
      expect([...lesson.test, ...(lesson.hard ?? []), ...(lesson.konkur?.tests ?? [])].some((t) => t.id === it.q.id)).toBe(true);
    }
  });

  it('never repeats a question', () => {
    for (const seed of [1, 7, 99, 2026]) {
      const items = buildExam(three, 30, seed);
      expect(new Set(items.map((x) => x.q.id)).size).toBe(items.length);
    }
  });

  it('honours the count, and stops at the size of the pool', () => {
    for (const n of [10, 20, 30]) expect(buildExam(subject.lessons, n, 5)).toHaveLength(Math.min(n, examPoolSize(subject.lessons)));
    const one = [three[0]];
    expect(buildExam(one, 30, 5)).toHaveLength(examPool(one[0]).length);
    expect(buildExam([], 10, 5)).toEqual([]);
    expect(buildExam(three, 0, 5)).toEqual([]);
  });

  it('spreads the questions over the chosen lessons', () => {
    const items = buildExam(three, 9, 3);
    for (const l of three) expect(items.filter((x) => x.lessonId === l.id).length).toBe(3);
  });

  it('is the same for the same seed and shuffled for another', () => {
    const a = buildExam(three, 20, 11).map((x) => x.q.id);
    expect(buildExam(three, 20, 11).map((x) => x.q.id)).toEqual(a);
    expect(buildExam(three, 20, 12).map((x) => x.q.id)).not.toEqual(a);
  });

  it('groups a book by chapter without losing a lesson', () => {
    for (const s of SUBJECTS) expect(chaptersOf(s).flatMap((c) => c.lessons).length).toBe(s.lessons.length);
  });

  it('sends exam mistakes to the notebook: lesson-test questions can be looked up', () => {
    const t = three[0].test[0];
    expect(testById(t.id)).toBeTruthy();
    expect(findQuestion(t.id)?.q).toMatchObject({ id: t.id, type: 'mcq', answer: t.answer });
    const s = initialState();
    recordAnswer(s, t, false, 'test');
    expect(reviewAvailable(s)).toBe(1);
  });

  it('gives XP by the lesson-test rule', () => {
    expect(testXp(100, 10)).toBe(20);
    expect(testXp(-10, 4)).toBe(5);
    expect(testXp(12, 1)).toBe(5);
    // Nothing answered (handed in empty, or the clock ran out): nothing earned.
    expect(testXp(0, 0)).toBe(0);
  });

  it('lists the lessons weakest first, ties by more questions, then book order', () => {
    const q = (id: string) => ({ id }) as never;
    const items = [
      { q: q('1'), lessonId: 'A' },
      { q: q('2'), lessonId: 'A' },
      { q: q('3'), lessonId: 'B' },
      { q: q('4'), lessonId: 'C' },
      { q: q('5'), lessonId: 'C' },
      { q: q('6'), lessonId: 'D' },
    ];
    // A 2/2, B 0/1, C 0/2 (one blank), D 1/1; E has no question in this exam.
    const rows = lessonResults(['A', 'B', 'C', 'D', 'E'], items, [true, true, false, false, null, true]);
    expect(rows.map((r) => r.lessonId)).toEqual(['C', 'B', 'A', 'D']);
    expect(rows[0]).toEqual({ lessonId: 'C', total: 2, right: 0 });
  });
});

describe('«چالش امروز»', () => {
  const day = '2026-10-21';

  it('has a seed that stays the same all day and changes the next day', () => {
    expect(dailySeed(day, 12, 'math')).toBe(dailySeed(day, 12, 'math'));
    expect(dailySeed(addDays(day, 1), 12, 'math')).not.toBe(dailySeed(day, 12, 'math'));
    expect(dailySeed(day, 11, 'math')).not.toBe(dailySeed(day, 12, 'math'));
    expect(dailySeed(day, 12, 'science')).not.toBe(dailySeed(day, 12, 'math'));
  });

  it('picks the same five questions for the same day, and others the next day', () => {
    const s = initialState();
    const today = dailyIds(s, day);
    expect(today).toHaveLength(DAILY_SIZE);
    expect(new Set(today).size).toBe(DAILY_SIZE);
    expect(dailyIds(s, day)).toEqual(today);
    expect(dailyIds(s, addDays(day, 1))).not.toEqual(today);
    expect(dailyQuestions(today).every((q) => q.type !== 'written')).toBe(true);
  });



  it('counts days in a row, kept alive until today is over', () => {
    const s = initialState();
    expect(dailyStreak(s, day)).toBe(0);
    recordDaily(s, addDays(day, -2), [true], 5);
    recordDaily(s, addDays(day, -1), [true], 5);
    expect(dailyStreak(s, day)).toBe(2);
    recordDaily(s, day, [true, false], 7);
    expect(dailyStreak(s, day)).toBe(3);
    expect(dailyStreak(s, addDays(day, 2))).toBe(0);
  });

  it('gives a small bonus', () => {
    expect(dailyXp([false, false, false, false, false])).toBe(5);
    expect(dailyXp([true, true, false, true, true])).toBe(13);
    expect(dailyXp([true, true, true, true, true])).toBe(20);
  });

  it('writes a short result to share', () => {
    const text = dailyShareText(day, [true, true, false, true, true], 3);
    const lines = text.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('چالش امروز');
    expect(lines[0]).toMatch(/[۰-۹]/);
    expect(lines[1]).toBe('🟩🟩🟥🟩🟩 ۴ از ۵');
    expect(lines[2]).toContain('۳');
    expect(lines[3]).toBe(SITE_URL);
  });
});

describe('lesson search', () => {
  it('folds Arabic letters, نیم‌فاصله, diacritics and digits', () => {
    expect(normalizeFa('كيك')).toBe('کیک');
    expect(normalizeFa('مي‌شود')).toBe('میشود');
    expect(normalizeFa('مُشتَقّ')).toBe('مشتق');
    expect(normalizeFa('آب  و   أنرژی')).toBe('اب و انرژی');
    expect(normalizeFa('ة ۀ ؤ ئ')).toBe('ه ه و ی');
    expect(normalizeFa('فصل ۳')).toBe('فصل 3');
    expect(normalizeFa('<<Look It Up>>')).toBe('<<look it up>>');
    expect(normalizeFa('‏حد‎')).toBe('حد');
  });

  it('finds a lesson by its title, typed with Arabic letters or without نیم‌فاصله', () => {
    const l = LESSONS.find((x) => /[یک]/.test(x.title) && x.title.length > 4)!;
    const arabic = l.title.replace(/ی/g, 'ي').replace(/ک/g, 'ك');
    expect(searchLessons(arabic, 50).map((h) => h.lesson.id)).toContain(l.id);
    const zw = LESSONS.find((x) => x.title.includes('‌'));
    if (zw) {
      expect(searchLessons(zw.title.replace(/‌/g, ''), 50).map((h) => h.lesson.id)).toContain(zw.id);
      expect(searchLessons(zw.title.replace(/‌/g, ' '), 50).map((h) => h.lesson.id)).toContain(zw.id);
    }
    expect(searchLessons(l.title)[0].field).toBe('title');
  });


  it('ignores queries that are too short and finds nothing for nonsense', () => {
    expect(searchLessons('')).toEqual([]);
    expect(searchLessons('ا')).toEqual([]);
    expect(searchLessons('ززززژژژ')).toEqual([]);
  });
});

describe('saved progress stays compatible', () => {
  const old = {
    v: 1,
    profile: { name: 'سارا', goal: 30, onboarded: true, sound: true, theme: 'dark', createdAt: 1, focus: 'hesaban', grade: 12, major: 'math' },
    xp: { total: 340, byDay: { '2026-10-01': 40 } },
    streak: { current: 2, best: 5, last: '2026-10-01' },
    lessons: { b1: { practiceRuns: 2, perfectRuns: 1, tests: [] } },
  };

  it('loads a save from before these features without inventing them', () => {
    const s = normalize(JSON.parse(JSON.stringify(old)));
    expect(s.xp.total).toBe(340);
    expect(s.lessons.b1.practiceRuns).toBe(2);
    expect(s.exams).toBeUndefined();
    expect(s.daily).toBeUndefined();
    expect(s.activity).toBeUndefined();
    expect(s.dailyPlan).toBeUndefined();
    expect(dailyStreak(s, '2026-10-21')).toBe(0);
    expect(weekReport(s, '2026-10-21').now.questions).toBe(0);
  });

  it('keeps the new fields through a save, a reload and the sign-in pick', () => {
    const s: AppState = normalize(JSON.parse(JSON.stringify(old)));
    recordExam(s, { at: 9, subject: 'bm1', lessons: ['b1'], total: 10, correct: 7, wrong: 2, blank: 1, score: 63.3, seconds: 500, timed: true });
    recordDaily(s, '2026-10-20', [true, false, true, true, true], 13);
    s.dailyPlan = { day: '2026-10-21', ids: ['a', 'b'] };
    recordAnswer(s, { id: 'q', concept: 'c' }, true, 'practice', new Date(2026, 9, 21, 10).getTime());
    s.lessons.b1.finished = 77;
    const saved = JSON.parse(JSON.stringify(s));
    // account.ts keeps the copy that has gone further, then the store normalises it.
    const pick = [null, initialState(), saved].reduce((a, c) => (progressRank(c) > progressRank(a) ? c : a), null);
    const back = normalize(pick);
    expect(back.exams).toEqual(s.exams);
    expect(back.daily).toEqual(s.daily);
    expect(back.dailyPlan).toEqual(s.dailyPlan);
    expect(back.activity).toEqual({ '2026-10-21': { q: 1, ok: 1 } });
    expect(back.lessons.b1.finished).toBe(77);
  });

  it('drops malformed entries, not the save', () => {
    const s = normalize({
      ...old,
      exams: [{ at: 1, total: 10, score: 50, subject: 'hesaban' }, null, { at: 'x' }, 'junk'],
      daily: { '2026-10-20': { marks: [1, 0], at: 3, xp: 7 }, nope: { marks: [] }, '2026-10-19': 5 },
      dailyPlan: { day: 'today', ids: [] },
      activity: { '2026-10-20': { q: '4', ok: 2 }, bad: { q: 1 } },
    });
    expect(s.xp.total).toBe(340);
    expect(s.exams).toHaveLength(1);
    expect(s.exams![0]).toMatchObject({ correct: 0, wrong: 0, blank: 0, lessons: [], timed: false });
    expect(s.daily).toEqual({ '2026-10-20': { marks: [true, false], at: 3, xp: 7 } });
    expect(s.dailyPlan).toBeUndefined();
    expect(s.activity).toEqual({ '2026-10-20': { q: 4, ok: 2 } });
  });

  it('keeps only a short history', () => {
    const s = initialState();
    for (let i = 0; i < EXAMS_KEPT + 5; i++) recordExam(s, { at: i, subject: 'bm1', lessons: [], total: 10, correct: 1, wrong: 0, blank: 9, score: 10, seconds: 1, timed: false });
    expect(s.exams).toHaveLength(EXAMS_KEPT);
    expect(s.exams![0].at).toBe(5);
    for (let i = 0; i < 100; i++) recordDaily(s, addDays('2026-01-01', i), [true], 5);
    expect(Object.keys(s.daily!).length).toBeLessThanOrEqual(70);
    expect(s.daily![addDays('2026-01-01', 99)]).toBeTruthy();
  });
});

describe('«گزارش هفته»', () => {
  const today = '2026-10-21';
  const at = (d: string, h = 10) => {
    const [y, m, dd] = d.split('-').map(Number);
    return new Date(y, m - 1, dd, h).getTime();
  };

  it('compares the last seven days with the seven before', () => {
    const s = initialState();
    recordAnswer(s, { id: 'a', concept: 'c' }, true, 'practice', at(today));
    recordAnswer(s, { id: 'b', concept: 'c' }, false, 'practice', at(addDays(today, -6)));
    recordAnswer(s, { id: 'c', concept: 'c' }, true, 'practice', at(addDays(today, -7)));
    s.study.msByDay[today] = 20 * 60000;
    s.study.msByDay[addDays(today, -8)] = 10 * 60000;
    s.lessons.x = { practiceRuns: 0, perfectRuns: 0, tests: [], finished: at(addDays(today, -1)) };
    s.lessons.y = { practiceRuns: 0, perfectRuns: 0, tests: [], finished: at(addDays(today, -10)) };
    s.lessons.z = { practiceRuns: 0, perfectRuns: 0, tests: [] };
    const r = weekReport(s, today);
    expect(r.now).toEqual({ lessons: 1, questions: 2, correct: 1, minutes: 20, accuracy: 0.5 });
    expect(r.before).toEqual({ lessons: 1, questions: 1, correct: 1, minutes: 10, accuracy: 1 });
    expect(r.days).toHaveLength(7);
    expect(r.days[6]).toMatchObject({ day: today, q: 1, ok: 1, minutes: 20 });
    expect(r.days[0]).toMatchObject({ day: addDays(today, -6), q: 1, ok: 0 });
  });

  it('notes when a lesson is finished, once, and only when it is what finishes it', () => {
    const lesson = LESSONS[0];
    const s = initialState();
    const nodes = buildPath(lesson);
    for (const c of lesson.concepts) s.concepts[c.id] = { status: 'understood', mastery: 1, seen: [0], rounds: 1, checksWrong: 0 };
    const done: Record<string, number> = {};
    for (const n of nodes) if (n.kind === 'practice' || n.kind === 'final' || n.kind === 'hard') done[n.id] = 1;
    s.lessons[lesson.id] = { practiceRuns: 1, perfectRuns: 0, tests: [], done };
    for (const c of lesson.cards) s.cards[c.id] = { box: 2, due: '2099-01-01', reviews: 1, lapses: 0 };
    trackFinish(s, lesson.id, () => undefined, 100);
    expect(s.lessons[lesson.id].finished).toBeUndefined();
    trackFinish(s, lesson.id, () => s.lessons[lesson.id].tests.push({ at: 200, correct: 1, wrong: 0, blank: 0, total: 1, score: 100, seconds: 5 }), 200);
    expect(s.lessons[lesson.id].finished).toBe(200);
    trackFinish(s, lesson.id, () => undefined, 300);
    expect(s.lessons[lesson.id].finished).toBe(200);
  });
});

describe('«چالش امروز»: a week in a row', () => {
  const finish = (s: AppState, first: string, days: number) => {
    for (let k = 0; k < days; k++) recordDaily(s, addDays(first, k), [true, true, true, true, true], 20);
  };

  it('awards the badge once, for seven days in a row only', () => {
    const s = initialState();
    finish(s, '2026-09-01', 6);
    finish(s, '2026-09-08', 6); // a gap on the 7th: two runs of six
    expect(dailyBestRun(s)).toBe(6);
    expect(awardBadges(s, 1).map((b) => b.id)).not.toContain('daily7');

    recordDaily(s, '2026-09-07', [false], 7); // fills the gap: thirteen days in a row
    expect(dailyBestRun(s)).toBe(13);
    expect(awardBadges(s, 2).map((b) => b.id)).toContain('daily7');
    expect(s.badges.daily7).toBe(2);

    finish(s, '2026-09-20', 7);
    expect(awardBadges(s, 3).map((b) => b.id)).not.toContain('daily7');
    expect(s.badges.daily7).toBe(2);
  });
});

describe('«گزارش اشکال»: no personal details in the note', () => {
  it('spots emails, phone numbers and national IDs', () => {
    expect(personalDataIn('ایمیلم sara.r+1@gmail.com است')).toBe('email');
    expect(personalDataIn('شماره‌ام ۰۹۱۲۳۴۵۶۷۸۹')).toBe('phone');
    expect(personalDataIn('call 0912 345 6789')).toBe('phone');
    expect(personalDataIn('0912-345-6789')).toBe('phone');
    expect(personalDataIn('+98 912 345 6789')).toBe('phone');
    expect(personalDataIn('۰۰۹۸۹۱۲۳۴۵۶۷۸۹')).toBe('phone');
    expect(personalDataIn('کد ملی ۰۰۱۲۳۴۵۶۷۸')).toBe('id');
    expect(personalDataIn('001-234567-8')).toBe('id');
  });

  it('lets ordinary notes through', () => {
    expect(personalDataIn('')).toBeNull();
    expect(personalDataIn('جواب درست باید ۴ باشد، نه ۲.')).toBeNull();
    expect(personalDataIn('عدد پی ۳٫۱۴۱۵۹۲۶۵۳۵ است و 2x+98=100')).toBeNull();
    expect(personalDataIn('۱۲۳۴۵۶۷۸۹ نه رقم دارد و ۱۲۳۴۵۶۷۸۹۰۱ یازده رقم')).toBeNull();
    expect(personalDataIn('شکل ۰۹ صفحهٔ ۱۲')).toBeNull();
  });
});

describe('«بازگردانی از فایل»', () => {
  const saved = (xp: number) => ({ ...initialState(1), xp: { total: xp, byDay: {} } });

  it('reads a backup, a «داده‌های من» file and a bare save', () => {
    const backup = readBackup(JSON.stringify({ app: 'biomana', exportedAt: '2026-10-01T10:00:00.000Z', state: saved(120) }));
    expect(backup.ok && backup.state.xp.total).toBe(120);
    expect(backup.ok && backup.exportedAt).toBe(Date.parse('2026-10-01T10:00:00.000Z'));

    // from «داده‌های من» the copy that has gone further, here the account's
    const mine = readBackup(JSON.stringify({ app: 'biomana', kind: 'my-data', onThisDevice: saved(40), inAccount: { progress: saved(300), savedAt: 1 } }));
    expect(mine.ok && mine.state.xp.total).toBe(300);
    const guest = readBackup(JSON.stringify({ app: 'biomana', kind: 'my-data', onThisDevice: saved(40), inAccount: null }));
    expect(guest.ok && guest.state.xp.total).toBe(40);

    const bare = readBackup(JSON.stringify(saved(7)));
    expect(bare.ok && bare.exportedAt).toBe(null);
  });

  it('turns away anything else, saying why', () => {
    const why = (text: string) => {
      const r = readBackup(text);
      return r.ok ? 'ok' : r.problem;
    };
    expect(why('not json {')).toBe('json');
    expect(why('[1,2]')).toBe('not-biomana');
    expect(why(JSON.stringify({ app: 'yadmana', state: saved(1) }))).toBe('not-biomana');
    expect(why(JSON.stringify({ app: 'biomana', state: { ...saved(1), v: 2 } }))).toBe('newer');
    expect(why(JSON.stringify({ app: 'biomana', state: { ...saved(1), v: '1' } }))).toBe('broken');
    expect(why(JSON.stringify({ app: 'biomana', state: { ...saved(1), xp: { total: 'lots' } } }))).toBe('broken');
    expect(why(JSON.stringify({ app: 'biomana', state: { ...saved(1), lessons: [] } }))).toBe('broken');
    expect(why(JSON.stringify({ app: 'biomana', kind: 'my-data', onThisDevice: null, inAccount: null }))).toBe('broken');
  });
});

describe('«کارت واژه»', () => {
  const day = '2026-10-22';
  const started = (lessons: typeof LESSONS) => {
    const s = initialState();
    for (const l of lessons) s.lessons[l.id] = { ...(s.lessons[l.id] ?? { tests: [] }), warmed: Date.parse(`${day}T08:00:00Z`) } as AppState['lessons'][string];
    return s;
  };

  it('finds glossary words in most lessons, marked terms first', () => {
    const withWords = LESSONS.filter((l) => lessonWords(l).length > 0).length;
    expect(withWords / LESSONS.length).toBeGreaterThan(0.8);
  });

  it('offers only words of started lessons, each once, and nothing before a lesson is started', () => {
    expect(wordsMet(initialState())).toEqual([]);
    const lessons = LESSONS.filter((l) => lessonWords(l).length > 0).slice(0, 3);
    const s = started(lessons);
    const met = wordsMet(s);
    expect(met.length).toBeGreaterThan(0);
    expect(new Set(met.map((w) => w.id)).size).toBe(met.length);
    expect(met.every((w) => w.id === WORD_PREFIX + w.term.id && lessons.some((l) => l.id === w.lessonId))).toBe(true);
    // One book only.
    const one = wordsMet(s, lessons[0].subject);
    expect(one.every((w) => w.subject === lessons[0].subject)).toBe(true);
  });

  it('deals due words first, then new ones up to the daily allowance', () => {
    const lessons = LESSONS.filter((l) => lessonWords(l).length > 0).slice(0, 12);
    const s = started(lessons);
    const met = wordsMet(s);
    expect(met.length).toBeGreaterThan(WORDS_NEW_PER_DAY + 2);
    const first = wordDeck(s, undefined, day);
    expect(first.length).toBe(WORDS_NEW_PER_DAY);
    // Rate two new words today: one known (comes back in two days), one not yet (due again today).
    const now = Date.parse(`${day}T09:00:00Z`);
    reviewCard(s, first[0].id, 'good', day, now);
    reviewCard(s, first[1].id, 'again', day, now);
    const later = wordDeck(s, undefined, day);
    expect(later[0].id).toBe(first[1].id);
    expect(later.some((w) => w.id === first[0].id)).toBe(false);
    // Two of today's new words are used up: one due again plus ten new.
    expect(later.length).toBe(1 + WORDS_NEW_PER_DAY - 2);
    // Two days on, the known word is due again and new words are allowed again.
    expect(wordDeck(s, undefined, '2026-10-24').some((w) => w.id === first[0].id)).toBe(true);
  });
});
