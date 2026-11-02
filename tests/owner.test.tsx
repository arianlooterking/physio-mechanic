// @vitest-environment jsdom
/**
 * The owner's account (ADMIN_EMAILS on the server): every step of the path is open, and today's challenge can be
 * played again without being recorded. The flag comes from the server's session answer, never from this device.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
  observe() {}
  disconnect() {}
};

let owner = false;
let account: typeof import('../src/lib/account');
let store: typeof import('../src/lib/store');
let time: typeof import('../src/lib/time');
let content: typeof import('../src/content');
let Home: typeof import('../src/screens/Home').Home;
let DailyChallenge: typeof import('../src/screens/DailyChallenge').DailyChallenge;

beforeAll(async () => {
  // Signed in before the owner flag existed: the stored account has none.
  localStorage.setItem('biomana:account', JSON.stringify({ id: 'google-1', kind: 'google', name: 'آرین' }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/session') return Response.json({ account: { id: 'google-1', ...(owner ? { owner: true } : {}) } });
      if (url === '/api/progress') return Response.json({ progress: null, savedAt: 0 });
      return Response.json({ ok: true });
    }),
  );
  store = await import('../src/lib/store');
  account = await import('../src/lib/account');
  time = await import('../src/lib/time');
  content = await import('../src/content');
  Home = (await import('../src/screens/Home')).Home;
  DailyChallenge = (await import('../src/screens/DailyChallenge')).DailyChallenge;
  store.update((s) => {
    s.profile.onboarded = true;
    s.profile.sound = false;
  });
}, 120_000); // the lessons are a large import

let root: Root | null = null;
function mount(node: React.ReactNode) {
  const el = document.createElement('div');
  document.body.append(el);
  root = createRoot(el);
  act(() => root!.render(node));
  return el;
}
const button = (el: ParentNode, text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;
const click = (b: Element | null | undefined) => act(() => (b as HTMLElement).click());

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
});

describe('owner account', () => {
  it('a learner sees locked steps; once the server says owner, every step is open', async () => {
    await account.pullFromServer();
    expect(account.getAccount()?.owner).toBeUndefined();
    const el = mount(<Home />);
    expect(el.querySelectorAll('.node.locked').length).toBeGreaterThan(0);

    owner = true;
    await act(() => account.pullFromServer());
    expect(account.getAccount()?.owner).toBe(true);
    expect(JSON.parse(localStorage.getItem('biomana:account')!).owner).toBe(true);
    expect(el.querySelectorAll('.node').length).toBeGreaterThan(0);
    expect(el.querySelectorAll('.node.locked')).toHaveLength(0);

    // Taken off the list on the server: the locks come back.
    owner = false;
    await act(() => account.pullFromServer());
    expect(account.getAccount()?.owner).toBeUndefined();
    expect(el.querySelectorAll('.node.locked').length).toBeGreaterThan(0);
  });

  it('the owner can play today’s challenge again; the extra round is not recorded', async () => {
    owner = true;
    await account.pullFromServer();
    const mcqs = content.LESSONS.flatMap((l) => l.practice).filter((q) => q.type === 'mcq').slice(0, 5);
    const day = time.dayKey();
    store.update((s) => void (s.dailyPlan = { day, ids: mcqs.map((q) => q.id) }));
    const el = mount(<DailyChallenge />);
    const play = () => {
      for (let k = 0; k < 5; k++) {
        click(el.querySelector('.options .opt'));
        click(button(el, 'بررسی'));
        click(button(el, k < 4 ? 'ادامه' : 'دیدن نتیجه'));
      }
    };
    play();
    const rec = store.getState().daily![day];
    const xp = store.getState().xp.total;
    click(button(el, 'یک دور دیگر'));
    play();
    expect(store.getState().daily![day]).toEqual(rec);
    expect(store.getState().xp.total).toBe(xp);
    expect(button(el, 'کپی نتیجه')).toBeTruthy();
  });
});
