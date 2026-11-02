// @vitest-environment jsdom
/**
 * A grade-and-major pick made on one device reaches the others (src/lib/account.ts with src/lib/study.ts):
 * the copy with more progress keeps its lessons, but the newest pick comes along either way.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../src/lib/state';

let server: AppState | null = null;
let account: typeof import('../src/lib/account');
let store: typeof import('../src/lib/store');
let study: typeof import('../src/lib/study');
let state: typeof import('../src/lib/state');

beforeAll(async () => {
  localStorage.setItem('biomana:account', JSON.stringify({ id: 'google-42', kind: 'google', name: 'سارا' }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/session') return Response.json({ account: { id: 'google-42' } });
      if (url === '/api/progress' && (!init?.method || init.method === 'GET')) return Response.json({ progress: server, savedAt: 1 });
      return Response.json({ ok: true });
    }),
  );
  store = await import('../src/lib/store');
  account = await import('../src/lib/account');
  study = await import('../src/lib/study');
  state = await import('../src/lib/state');
});

const copy = (xp: number, grade: 10 | 11 | 12, major: 'math' | 'science' | 'humanities', at: number) => {
  const s = state.initialState();
  s.profile.onboarded = true;
  s.xp.total = xp;
  study.setStudy(s, grade, major, at);
  return s;
};

beforeEach(() => {
  store.update((s) => Object.assign(s, copy(0, 12, 'math', 1)));
});

describe('grade and major across devices', () => {
  it('this device is ahead, but the pick made later on another device comes along', async () => {
    store.update((s) => Object.assign(s, copy(500, 12, 'math', 100)));
    server = copy(20, 11, 'science', 200);
    await account.pullFromServer();
    const p = store.getState().profile;
    expect([p.grade, p.major, p.studyAt]).toEqual([11, 'science', 200]);
    expect(store.getState().xp.total).toBe(500);
  });

  it('the account copy is ahead, but this device picked later: the progress comes in, the pick stays', async () => {
    store.update((s) => Object.assign(s, copy(20, 10, 'humanities', 300)));
    server = copy(900, 12, 'math', 100);
    await account.pullFromServer();
    const p = store.getState().profile;
    expect(store.getState().xp.total).toBe(900);
    expect([p.grade, p.major, p.studyAt]).toEqual([10, 'humanities', 300]);
  });
});
