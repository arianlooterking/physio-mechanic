// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LESSONS } from '../src/content';
import { copyText } from '../src/lib/daily';
import { dayKey } from '../src/lib/time';
import { getState, resetState, update } from '../src/lib/store';
import { DailyChallenge } from '../src/screens/DailyChallenge';
import { MockExam } from '../src/screens/MockExam';
import { WordCards } from '../src/screens/WordCards';
import { TestSession } from '../src/screens/TestSession';
import { LessonOverview } from '../src/screens/LessonOverview';
import { lessonWords } from '../src/lib/words';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.scrollTo = () => undefined;

let root: Root | null = null;
function mount(node: React.ReactNode) {
  const el = document.createElement('div');
  document.body.append(el);
  root = createRoot(el);
  act(() => root!.render(node));
  return el;
}
const click = (b: Element | null | undefined) => act(() => (b as HTMLElement).click());
const button = (el: ParentNode, text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;

beforeEach(() => {
  resetState();
  update((s) => {
    s.profile.onboarded = true;
    s.profile.sound = false;
  });
});
afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
});

describe('«آزمون جامع» on screen', () => {
  it('lets every pick be taken back before the exam is handed in, then marks it', () => {
    const el = mount(<MockExam />);
    // Setup: a book is chosen and its first chapter ticked; «از نو» clears the lessons and blocks the start.
    expect(el.querySelector('.mx-books [aria-checked="true"]')).not.toBeNull();
    click(button(el, 'از نو'));
    expect(button(el, 'یک درس انتخاب کن')?.disabled).toBe(true);
    click(button(el, 'کل کتاب'));
    click(button(el, '10 سؤال'));
    const start = button(el, 'شروع آزمون')!;
    expect(start.disabled).toBe(false);
    click(start);

    // Running: pick, change, clear.
    const opts = () => [...el.querySelectorAll<HTMLButtonElement>('.options .opt')];
    expect(opts().length).toBe(4);
    click(opts()[0]);
    expect(opts()[0].className).toContain('sel');
    click(opts()[1]);
    expect(opts()[0].className).not.toContain('sel');
    expect(opts()[1].className).toContain('sel');
    expect(el.querySelector('.mx-grid button.on')).not.toBeNull();
    click(button(el, 'پاک کردن جواب'));
    expect(opts().some((o) => o.className.includes('sel'))).toBe(false);
    expect(el.querySelector('.mx-grid button.on')).toBeNull();

    // Answer the first question, hand in: score, per-lesson rows and the answer sheet appear.
    click(opts()[2]);
    click(button(el, 'تحویل'));
    click(button(document.body, 'تحویل و تصحیح'));
    expect(el.textContent).toContain('درصد تو');
    expect(el.querySelectorAll('.mx-lesson-row').length).toBeGreaterThan(0);
    expect(getState().exams).toHaveLength(1);
    expect(getState().exams![0]).toMatchObject({ total: 10, blank: 9 });
    click(button(el, 'همه ('));
    expect(el.querySelectorAll('.mx-review').length).toBe(10);
    // The lesson with the missed questions offers its practice.
    expect(button(el, 'تمرین این درس')).toBeDefined();
  });

  it('gives nothing for an exam handed in with no answer', () => {
    const el = mount(<MockExam />);
    click(button(el, 'کل کتاب'));
    click(button(el, '10 سؤال'));
    click(button(el, 'شروع آزمون'));
    const before = getState();
    click(button(el, 'تحویل'));
    click(button(document.body, 'تحویل و تصحیح'));
    expect(el.textContent).toContain('به هیچ سؤالی جواب ندادی');
    expect(el.textContent).not.toContain('امتیاز: +');
    const after = getState();
    expect(after.xp.total).toBe(before.xp.total);
    expect(after.streak).toEqual(before.streak);
    expect(after.exams ?? []).toHaveLength(0);
    expect(after.counters.sessions).toBe(before.counters.sessions);
  });
});

describe('«چالش امروز» on screen', () => {
  it('keeps «بررسی» shut until there is an answer; picks can be changed and placed steps reset before it', () => {
    // Pin today's five: an order question first (it has «از نو»), then four multiple-choice ones.
    const practice = LESSONS.flatMap((l) => l.practice);
    const order = practice.find((q) => q.type === 'order')!;
    const mcqs = practice.filter((q) => q.type === 'mcq').slice(0, 4);
    update((s) => void (s.dailyPlan = { day: dayKey(), ids: [order.id, ...mcqs.map((q) => q.id)] }));
    const el = mount(<DailyChallenge />);
    const check = () => button(el, 'بررسی')!;
    expect(check().disabled).toBe(true);

    const pool = () => [...el.querySelectorAll<HTMLButtonElement>('.order-pool .order-item')].filter((b) => !b.disabled);
    while (pool().length) click(pool()[0]);
    expect(check().disabled).toBe(false);
    click(el.querySelector('.order-tools .link-btn'));
    expect(el.querySelectorAll('.order-zone .order-item')).toHaveLength(0);
    expect(check().disabled).toBe(true);
    while (pool().length) click(pool()[0]);
    click(check());
    click(button(el, 'ادامه'));

    for (let k = 0; k < 4; k++) {
      const opts = () => [...el.querySelectorAll<HTMLButtonElement>('.options .opt')];
      expect(check().disabled).toBe(true);
      click(opts()[0]);
      click(opts()[1]);
      expect(opts()[0].className).not.toContain('sel');
      expect(opts()[1].className).toContain('sel');
      click(check());
      click(button(el, k < 3 ? 'ادامه' : 'دیدن نتیجه'));
    }
    expect(el.querySelectorAll('.dc-marks > span')).toHaveLength(5);
    expect(button(el, 'کپی نتیجه')).toBeTruthy();
    const rec = getState().daily![dayKey()];
    expect(rec.marks).toHaveLength(5);
    expect(getState().xp.total).toBe(rec.xp);
  });
});

describe('«کپی نتیجه»', () => {
  it('uses the clipboard when it can', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await copyText('سلام')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('سلام');
  });

  it('falls back to the copy command, and says so when nothing works', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const exec = vi.fn(() => true);
    (document as unknown as { execCommand: unknown }).execCommand = exec;
    expect(await copyText('سلام')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
    (document as unknown as { execCommand: unknown }).execCommand = () => false;
    expect(await copyText('سلام')).toBe(false);
  });
});

describe('«کارت واژه» on screen', () => {
  it('flips, rates, brings «هنوز نه» back later, and takes back the last card', () => {
    const lesson = LESSONS.find((l) => lessonWords(l).length >= 6)!;
    update((s) => {
      s.lessons[lesson.id] = { ...(s.lessons[lesson.id] ?? { tests: [] }), warmed: Date.now() } as (typeof s.lessons)[string];
    });
    const el = mount(<WordCards />);
    const count = () => el.querySelector('.session-top .chip')!.textContent!;
    const total = count();
    const id = () => el.querySelector('.fc-face.front .wc-term')!.textContent;
    const first = id();
    click(button(el, 'نشانم بده'));
    expect(el.querySelector('.fc.flipped')).not.toBeNull();
    click(button(el, 'هنوز نه'));
    // The deck grew by one: the card comes back later.
    expect(count()).not.toBe(total);
    expect(getState().cards[Object.keys(getState().cards)[0]].box).toBe(1);
    // Take it back: same card, turned over, no box.
    click(button(el, 'برگرد به کارت قبل'));
    expect(id()).toBe(first);
    expect(el.querySelector('.fc.flipped')).not.toBeNull();
    expect(Object.keys(getState().cards)).toHaveLength(0);
    expect(count()).toBe(total);
    click(button(el, 'بلدم'));
    expect(Object.values(getState().cards)[0].box).toBe(2);
  });

  it('says what to do when no lesson has been started', () => {
    const el = mount(<WordCards />);
    expect(el.textContent).toContain('هنوز واژه‌ای نداری');
  });
});

describe('«تست کنکوری» on screen', () => {
  it('runs the konkur test apart from the lesson test and lists the tips', () => {
    const lesson = LESSONS[0];
    const had = lesson.konkur;
    const c = lesson.concepts[0].id;
    lesson.konkur = {
      tips: [{ kind: 'trap', concept: c, text: 'یک تلهٔ آزمایشی که فقط برای این آزمون نوشته شده است.' }],
      tests: [0, 1, 2, 3].map((k) => ({
        id: `${lesson.id}-k${k + 1}`,
        concept: c,
        level: 3 as const,
        prompt: `سؤال آزمایشی شمارهٔ ${k + 1}`,
        options: ['الف', 'ب', 'پ', 'ت'] as [string, string, string, string],
        answer: 0 as const,
        explain: 'پاسخ آزمایشی',
        source: k === 0 ? 'الگوی سراسری ریاضی ۱۴۰۲' : undefined,
      })),
    };
    try {
      let el = mount(<LessonOverview lessonId={lesson.id} />);
      expect(el.textContent).toContain('نکته‌های کنکوری');
      expect(el.textContent).toContain('تله');
      expect(button(el, 'تست کنکوری')).toBeDefined();
      act(() => root?.unmount());

      el = mount(<TestSession lessonId={lesson.id} set="konkur" />);
      expect(el.textContent).toContain('تست کنکوری');
      click(button(el, 'شروع آزمون'));
      const opts = () => [...el.querySelectorAll<HTMLButtonElement>('.options .opt')];
      click(opts().find((o) => o.textContent?.includes('الف')));
      for (let k = 0; k < 3; k++) click(button(el, 'بعدی'));
      click(button(el, 'پایان و تصحیح'));
      click(button(document.body, 'تحویل و تصحیح'));
      expect(el.textContent).toContain('الگوی سراسری ریاضی ۱۴۰۲');
      const lp = getState().lessons[lesson.id];
      expect(lp.konkur).toMatchObject({ tries: 1 });
      // The lesson test and its path step are untouched.
      expect(lp.tests).toHaveLength(0);
    } finally {
      lesson.konkur = had;
    }
  });
});
