// @vitest-environment jsdom
/**
 * Progress sync of a signed-in learner (src/lib/account.ts) against the KV write budget:
 * at most one upload a minute while active (trailing, so the last change always goes up),
 * at once when the page is hidden or the device comes back online, and a quiet retry on 429/503.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type Reply = { status: number; headers?: Record<string, string> };
let reply: Reply = { status: 200 };
const puts: { at: number; body: { xp: { total: number } } }[] = [];

let account: typeof import('../src/lib/account');
let store: typeof import('../src/lib/store');

const bump = () => store.update((s) => void (s.xp.total += 1));
const xpNow = () => store.getState().xp.total;

beforeAll(async () => {
  vi.useFakeTimers({ now: new Date('2026-10-21T08:00:00Z') });
  localStorage.setItem('biomana:account', JSON.stringify({ id: 'google-42', kind: 'google', name: 'سارا' }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/progress' && init?.method === 'PUT') puts.push({ at: Date.now(), body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify(reply.status === 200 ? { ok: true } : { error: 'x' }), { status: reply.status, headers: reply.headers });
    }),
  );
  store = await import('../src/lib/store');
  account = await import('../src/lib/account');
  expect(account.getAccount()?.id).toBe('google-42');
});

beforeEach(async () => {
  // Let any planned save from the previous test go out, then start from a quiet state.
  reply = { status: 200 };
  await vi.advanceTimersByTimeAsync(10 * 60_000);
  puts.length = 0;
});

describe('progress sync throttle', () => {
  it('uploads a few seconds after the first change, then at most once a minute while active', async () => {
    const start = Date.now();
    bump();
    await vi.advanceTimersByTimeAsync(account.FIRST_SAVE_DELAY_MS - 100);
    expect(puts).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(puts).toHaveLength(1);

    // A change every second for two and a half minutes: a debounce would never fire; this saves once a minute.
    for (let i = 0; i < 150; i++) {
      bump();
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(puts.length).toBeGreaterThanOrEqual(3);
    expect(puts.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < puts.length; i++) expect(puts[i].at - puts[i - 1].at).toBeGreaterThanOrEqual(account.SAVE_EVERY_MS);

    // Trailing: once the learner stops, the latest change still goes up.
    await vi.advanceTimersByTimeAsync(account.SAVE_EVERY_MS + 1000);
    expect(puts.at(-1)!.body.xp.total).toBe(xpNow());
    expect(account.getSync()).toBe('saved');
    expect(Date.now() - start).toBeGreaterThan(150_000);
  });

  it('uploads at once when the page is hidden or the device comes back online', async () => {
    bump();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(puts).toHaveLength(1);
    expect(puts[0].body.xp.total).toBe(xpNow());
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    bump();
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(puts).toHaveLength(2);
    // Nothing new: leaving the page again sends nothing.
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    expect(puts).toHaveLength(2);
  });

  it('treats 429 as «try again later»: no error state, the copy stays here, and it retries', async () => {
    reply = { status: 429, headers: { 'retry-after': '9' } };
    bump();
    await vi.advanceTimersByTimeAsync(account.FIRST_SAVE_DELAY_MS + 10);
    expect(puts).toHaveLength(1);
    expect(['saved', 'idle']).toContain(account.getSync());
    reply = { status: 200 };
    await vi.advanceTimersByTimeAsync(account.SAVE_EVERY_MS - 1000);
    expect(puts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(puts).toHaveLength(2);
    expect(puts[1].body.xp.total).toBe(xpNow());
    expect(account.getSync()).toBe('saved');
  });

  it('treats 503 (storage busy) as «try again later» after the server’s Retry-After', async () => {
    reply = { status: 503, headers: { 'retry-after': '300' } };
    bump();
    await vi.advanceTimersByTimeAsync(account.FIRST_SAVE_DELAY_MS + 10);
    expect(puts).toHaveLength(1);
    expect(account.getSync()).toBe('later');
    reply = { status: 200 };
    bump(); // more changes do not hurry the retry
    await vi.advanceTimersByTimeAsync(290_000);
    expect(puts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(puts).toHaveLength(2);
    expect(account.getSync()).toBe('saved');
  });

  it('stops uploading when the server says the session ended (401)', async () => {
    reply = { status: 401 };
    bump();
    await vi.advanceTimersByTimeAsync(account.FIRST_SAVE_DELAY_MS + 10);
    expect(puts).toHaveLength(1);
    expect(account.getSync()).toBe('expired');
    reply = { status: 200 };
    bump();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(puts).toHaveLength(1);
  });
});
