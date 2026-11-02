import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTutorLimits } from '../server/tutor';
import { resetAppleKeys } from '../worker/apple';
import worker, { resetAppSignInLimits } from '../worker/index';
import { signSession, type Env, type KV, type Session } from '../worker/lib';
import { resetReportLimits } from '../worker/reports';

const ORIGIN = 'https://biomana.test';
const CLIENT = '123-abc.apps.googleusercontent.com';
const SECRET = 'test-secret-that-is-long-enough';

type Stored = { value: string; metadata?: unknown; expirationTtl?: number };

/** In-memory KV with the parts of the Workers KV API the Worker uses. `failPuts` makes every put throw. */
function memoryKV(data = new Map<string, Stored>(), opts: { failPuts?: boolean } = {}): KV & { data: Map<string, Stored> } {
  return {
    data,
    get: async <T,>(k: string) => (data.has(k) ? (JSON.parse(data.get(k)!.value) as T) : null),
    put: async (k: string, value: string, o?: { metadata?: unknown; expirationTtl?: number }) => {
      if (opts.failPuts) throw new Error('KV put() limit exceeded for the day.');
      data.set(k, { value, metadata: o?.metadata, expirationTtl: o?.expirationTtl });
    },
    delete: async (k: string) => void data.delete(k),
    list: async <M,>(o: { prefix?: string; limit?: number; cursor?: string } = {}) => {
      const names = [...data.keys()].filter((k) => k.startsWith(o.prefix ?? '')).sort();
      const start = o.cursor ? Number(o.cursor) : 0;
      const end = start + (o.limit ?? 1000);
      return {
        keys: names.slice(start, end).map((name) => ({ name, metadata: data.get(name)!.metadata as M })),
        list_complete: end >= names.length,
        cursor: end >= names.length ? undefined : String(end),
      };
    },
  };
}

function makeEnv(overrides: Partial<Env> = {}): Env & { BIOMANA_KV: ReturnType<typeof memoryKV> } {
  return {
    ASSETS: { fetch: async () => new Response('<!doctype html>app', { headers: { 'content-type': 'text/html' } }) },
    BIOMANA_KV: memoryKV(),
    GOOGLE_CLIENT_ID: CLIENT,
    SESSION_SECRET: SECRET,
    ADMIN_EMAILS: 'boss@biomana.test, Other@Example.com',
    ...overrides,
  } as Env & { BIOMANA_KV: ReturnType<typeof memoryKV> };
}

const req = (path: string, init: RequestInit = {}) => new Request(ORIGIN + path, init);

function mockGoogle(payload: Record<string, unknown> | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => (payload ? new Response(JSON.stringify(payload), { status: 200 }) : new Response('bad', { status: 400 }))),
  );
}

const person = { aud: CLIENT, iss: 'https://accounts.google.com', exp: String(Math.floor(Date.now() / 1000) + 600), email_verified: 'true', sub: '42', email: 'a@b.c', given_name: 'سارا' };

async function signIn(env: Env, who: Record<string, unknown> = person): Promise<string> {
  mockGoogle(who);
  const r = await worker.fetch(req('/api/session', { method: 'POST', body: JSON.stringify({ credential: 'tok' }), headers: { origin: ORIGIN } }), env);
  expect(r.status).toBe(200);
  const cookie = r.headers.get('set-cookie')!;
  expect(cookie).toMatch(/HttpOnly; Secure; SameSite=Lax/);
  return cookie.split(';')[0];
}

/** A cookie signed with the test secret, for sessions the sign-in route would not make (old, future, no epoch). */
async function cookieFor(s: Partial<Session> & { iat: number }, env: Env): Promise<string> {
  const { ep, ...rest } = s;
  const body: Session = { sub: '42', email: 'a@b.c', name: 'سارا', ...rest, ...(ep === undefined ? {} : { ep }) };
  return `fh_s=${await signSession(body, env)}`;
}

const put = (env: Env, cookie: string, body: unknown = { v: 1, xp: 120 }) =>
  worker.fetch(req('/api/progress', { method: 'PUT', body: JSON.stringify(body), headers: { cookie, origin: ORIGIN } }), env);

let now = Date.now();
const realKey = process.env.ANTHROPIC_API_KEY;
beforeEach(() => {
  now = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  delete process.env.ANTHROPIC_API_KEY;
  resetTutorLimits();
  resetReportLimits();
  resetAppSignInLimits();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (realKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = realKey;
});

describe('worker', () => {
  it('serves the site for non-API paths and the client id from /api/config', async () => {
    const env = makeEnv();
    expect(await (await worker.fetch(req('/privacy'), env)).text()).toContain('app');
    expect(await (await worker.fetch(req('/api/config'), env)).json()).toEqual({ googleClientId: CLIENT, apple: false });
    expect(await (await worker.fetch(req('/api/config'), makeEnv({ GOOGLE_CLIENT_ID: 'nope' }))).json()).toEqual({ googleClientId: null, apple: false });
    expect((await worker.fetch(req('/api/unknown'), env)).status).toBe(404);
  });

  it('rejects bad Google tokens, wrong audience and unverified email', async () => {
    const env = makeEnv();
    const post = () => worker.fetch(req('/api/session', { method: 'POST', body: JSON.stringify({ credential: 't' }) }), env);
    mockGoogle(null);
    expect((await post()).status).toBe(401);
    mockGoogle({ ...person, aud: 'other' });
    expect((await post()).status).toBe(401);
    mockGoogle({ ...person, email_verified: 'false' });
    expect((await post()).status).toBe(401);
    mockGoogle({ ...person, exp: '1' });
    expect((await post()).status).toBe(401);
  });

  it('keeps progress per account behind the signed cookie', async () => {
    const env = makeEnv();
    const cookie = await signIn(env);
    expect((await worker.fetch(req('/api/progress'), env)).status).toBe(401);

    const me = await (await worker.fetch(req('/api/session', { headers: { cookie } }), env)).json();
    expect(me.account).toMatchObject({ id: 'google-42', name: 'سارا', email: 'a@b.c' });

    expect((await put(env, cookie)).status).toBe(200);
    const got = await (await worker.fetch(req('/api/progress', { headers: { cookie } }), env)).json();
    expect(got.progress).toEqual({ v: 1, xp: 120 });

    // Signing in again returns the saved copy.
    mockGoogle(person);
    const again = await (await worker.fetch(req('/api/session', { method: 'POST', body: JSON.stringify({ credential: 'tok' }) }), env)).json();
    expect(again.progress).toEqual({ v: 1, xp: 120 });

    expect((await worker.fetch(req('/api/progress', { method: 'DELETE', headers: { cookie } }), env)).status).toBe(200);
    expect((await (await worker.fetch(req('/api/progress', { headers: { cookie } }), env)).json()).progress).toBeNull();
  });

  it('refuses tampered cookies, other origins and malformed progress', async () => {
    const env = makeEnv();
    const cookie = await signIn(env);
    const [name, value] = cookie.split('=');
    const [payload, sig] = value.split('.');
    const forged = `${name}=${payload.slice(0, -2)}xx.${sig}`;
    expect((await worker.fetch(req('/api/progress', { headers: { cookie: forged } }), env)).status).toBe(401);
    expect((await worker.fetch(req('/api/progress', { method: 'PUT', body: '{"v":1}', headers: { cookie, origin: 'https://evil.test' } }), env)).status).toBe(403);
    expect((await worker.fetch(req('/api/progress', { method: 'PUT', body: '{"v":2}', headers: { cookie } }), env)).status).toBe(400);
    expect((await worker.fetch(req('/api/progress', { method: 'PUT', body: 'not json', headers: { cookie } }), env)).status).toBe(400);
    // A session signed with another secret is not accepted.
    expect((await worker.fetch(req('/api/progress', { headers: { cookie } }), makeEnv({ SESSION_SECRET: 'another-secret-long-enough!' }))).status).toBe(401);
  });

  it('signs out by clearing the cookie', async () => {
    const r = await worker.fetch(req('/api/session', { method: 'DELETE' }), makeEnv());
    expect(r.headers.get('set-cookie')).toMatch(/Max-Age=0/);
  });
});

describe('API security headers', () => {
  it('every JSON answer forbids sniffing, framing and referrers', async () => {
    const env = makeEnv();
    const cookie = await signIn(env);
    const responses = [
      await worker.fetch(req('/api/config'), env),
      await worker.fetch(req('/api/session'), env),
      await worker.fetch(req('/api/progress'), env),
      await put(env, cookie),
      await worker.fetch(req('/api/unknown'), env),
      await worker.fetch(req('/api/tutor'), env),
      await worker.fetch(req('/api/tutor', { method: 'POST', body: '{}' }), env),
      await worker.fetch(req('/api/report', { method: 'POST', body: '{}', headers: { origin: ORIGIN } }), env),
      await worker.fetch(req('/api/reports'), env),
    ];
    for (const r of responses) {
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
      expect(r.headers.get('referrer-policy')).toBe('no-referrer');
      expect(r.headers.get('x-frame-options')).toBe('DENY');
      expect(r.headers.get('content-type')).toMatch(/^application\/json/);
    }
  });

  it('the static site has a CSP and other security headers in public/_headers', () => {
    const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
    const csp = headers.match(/^\s+Content-Security-Policy: (.+)$/m)?.[1] ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' https://accounts.google.com/gsi/client;");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
    expect(headers).toMatch(/Strict-Transport-Security: max-age=31536000; includeSubDomains/);
    expect(headers).toMatch(/X-Frame-Options: DENY/);
    expect(headers).toMatch(/Cross-Origin-Opener-Policy: same-origin-allow-popups/);
    expect(headers).toMatch(/\/assets\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
    // Cloudflare joins repeated headers with a comma: the catch-all rule must not set Cache-Control.
    const catchAll = headers.split(/\n(?=\S)/).find((block) => block.startsWith('/*\n'))!;
    expect(catchAll).not.toMatch(/Cache-Control/);
  });

  it('index.html has no inline script (script-src stays without unsafe-inline)', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, attrs, body] of scripts) {
      expect(attrs).toMatch(/\bsrc=/);
      expect(body.trim()).toBe('');
    }
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).toContain('<script src="/theme.js"></script>');
  });
});

describe('progress saves and the KV write budget', () => {
  it('refuses a second save within 15 seconds with 429 and Retry-After', async () => {
    const env = makeEnv();
    const cookie = await signIn(env);
    expect((await put(env, cookie)).status).toBe(200);
    now += 5_000;
    const soon = await put(env, cookie, { v: 1, xp: 130 });
    expect(soon.status).toBe(429);
    expect(soon.headers.get('retry-after')).toBe('10');
    expect((await soon.json()).error).toBe('too-soon');
    // The refused save did not overwrite the stored copy.
    expect((await (await worker.fetch(req('/api/progress', { headers: { cookie } }), env)).json()).progress.xp).toBe(120);
    now += 10_001;
    expect((await put(env, cookie, { v: 1, xp: 130 })).status).toBe(200);
  });

  it('answers 503 storage-busy when KV refuses the write', async () => {
    const env = makeEnv({ BIOMANA_KV: memoryKV(new Map(), { failPuts: true }) });
    const cookie = await signIn(env);
    const r = await put(env, cookie);
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: 'storage-busy' });
    expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('still refuses progress over the size cap', async () => {
    const env = makeEnv();
    const cookie = await signIn(env);
    const r = await put(env, cookie, { v: 1, pad: 'x'.repeat(900_001) });
    expect(r.status).toBe(413);
  });
});

describe('sessions', () => {
  it('«sign out on every device» retires older cookies; a cookie without an epoch works until then', async () => {
    const env = makeEnv();
    const legacy = await cookieFor({ iat: now - 1000 }, env); // made before epochs existed: no `ep`
    const cookie = await signIn(env);
    expect((await worker.fetch(req('/api/progress', { headers: { cookie: legacy } }), env)).status).toBe(200);
    expect((await worker.fetch(req('/api/progress', { headers: { cookie } }), env)).status).toBe(200);

    const out = await worker.fetch(req('/api/session?all=1', { method: 'DELETE', headers: { cookie, origin: ORIGIN } }), env);
    expect(out.status).toBe(200);
    expect(out.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    expect(env.BIOMANA_KV.data.get('sess:42')?.value).toBe('1');

    for (const old of [cookie, legacy]) {
      expect((await worker.fetch(req('/api/progress', { headers: { cookie: old } }), env)).status).toBe(401);
      expect((await (await worker.fetch(req('/api/session', { headers: { cookie: old } }), env)).json()).account).toBeNull();
    }
    // Signing in again gives a cookie with the new epoch, which works.
    const fresh = await signIn(env);
    expect((await worker.fetch(req('/api/progress', { headers: { cookie: fresh } }), env)).status).toBe(200);
    // Another account is not affected.
    const other = await signIn(env, { ...person, sub: '77', email: 'x@y.z' });
    expect((await worker.fetch(req('/api/progress', { headers: { cookie: other } }), env)).status).toBe(200);
  });

  it('«sign out everywhere» needs a valid session and the same origin', async () => {
    const env = makeEnv();
    const cookie = await signIn(env);
    expect((await worker.fetch(req('/api/session?all=1', { method: 'DELETE', headers: { origin: ORIGIN } }), env)).status).toBe(401);
    expect((await worker.fetch(req('/api/session?all=1', { method: 'DELETE', headers: { cookie, origin: 'https://evil.test' } }), env)).status).toBe(403);
    expect(env.BIOMANA_KV.data.has('sess:42')).toBe(false);
  });

  it('answers 503 when the epoch cannot be raised, and keeps the session', async () => {
    const env = makeEnv();
    const cookie = await signIn(env);
    const broken = { ...env, BIOMANA_KV: memoryKV(env.BIOMANA_KV.data, { failPuts: true }) };
    const r = await worker.fetch(req('/api/session?all=1', { method: 'DELETE', headers: { cookie, origin: ORIGIN } }), broken);
    expect(r.status).toBe(503);
    expect(r.headers.get('set-cookie')).toBeNull();
  });

  it('rejects a cookie issued in the future', async () => {
    const env = makeEnv();
    const future = await cookieFor({ iat: now + 3600_000 }, env);
    expect((await worker.fetch(req('/api/progress', { headers: { cookie: future } }), env)).status).toBe(401);
    const skewed = await cookieFor({ iat: now + 5_000 }, env); // small clock differences are tolerated
    expect((await worker.fetch(req('/api/progress', { headers: { cookie: skewed } }), env)).status).toBe(200);
    const expired = await cookieFor({ iat: now - 181 * 864e5 }, env);
    expect((await worker.fetch(req('/api/progress', { headers: { cookie: expired } }), env)).status).toBe(401);
  });

  it('renews a session older than a week on GET /api/session, without writing to KV', async () => {
    const env = makeEnv();
    const recent = await cookieFor({ iat: now - 2 * 864e5, ep: 0 }, env);
    expect((await worker.fetch(req('/api/session', { headers: { cookie: recent } }), env)).headers.get('set-cookie')).toBeNull();

    const old = await cookieFor({ iat: now - 8 * 864e5, ep: 0 }, env);
    const r = await worker.fetch(req('/api/session', { headers: { cookie: old } }), env);
    expect((await r.json()).account).toMatchObject({ id: 'google-42' });
    const renewed = r.headers.get('set-cookie')!;
    expect(renewed).toMatch(/^fh_s=.+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=15552000$/);
    const payload = JSON.parse(Buffer.from(renewed.split('=')[1].split('.')[0], 'base64url').toString('utf8'));
    expect(payload).toMatchObject({ sub: '42', iat: now, ep: 0 });
    expect(env.BIOMANA_KV.data.size).toBe(0);
    // The renewed cookie works, and is retired like any other by «sign out everywhere».
    const cookie = renewed.split(';')[0];
    expect((await worker.fetch(req('/api/progress', { headers: { cookie } }), env)).status).toBe(200);
    await worker.fetch(req('/api/session?all=1', { method: 'DELETE', headers: { cookie, origin: ORIGIN } }), env);
    expect((await worker.fetch(req('/api/progress', { headers: { cookie } }), env)).status).toBe(401);
  });
});

describe('tutor', () => {
  it('GET status stays public; POST needs a signed-in account', async () => {
    const env = makeEnv();
    const status = await worker.fetch(req('/api/tutor'), env);
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({ ok: false, model: null });

    process.env.ANTHROPIC_API_KEY = 'test-key';
    expect((await (await worker.fetch(req('/api/tutor'), env)).json()).ok).toBe(true);
    const guest = await worker.fetch(req('/api/tutor', { method: 'POST', body: '{}', headers: { origin: ORIGIN } }), env);
    expect(guest.status).toBe(401);
    expect(await guest.json()).toEqual({ error: 'sign_in_required' });
    // A forged or retired cookie counts as a guest.
    const future = await cookieFor({ iat: now + 3600_000 }, env);
    expect((await worker.fetch(req('/api/tutor', { method: 'POST', body: '{}', headers: { cookie: future } }), env)).status).toBe(401);
  });

  it('limits questions per account and per IP', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const env = makeEnv();
    const cookie = await signIn(env);
    // Malformed bodies never reach the Claude API but still count against the limits.
    const ask = (c: string, ip: string) => worker.fetch(req('/api/tutor', { method: 'POST', body: 'x', headers: { cookie: c, 'cf-connecting-ip': ip } }), env);
    for (let i = 0; i < 20; i++) expect((await ask(cookie, `10.0.0.${i}`)).status).toBe(400);
    const over = await ask(cookie, '10.0.1.1');
    expect(over.status).toBe(429);
    expect(Number(over.headers.get('retry-after'))).toBeGreaterThan(0);

    // Per IP: 30 in 10 minutes, whichever accounts ask.
    resetTutorLimits();
    const cookies = [cookie, await signIn(env, { ...person, sub: '7' }), await signIn(env, { ...person, sub: '8' })];
    for (let i = 0; i < 30; i++) expect((await ask(cookies[i % 3], '10.9.9.9')).status).toBe(400);
    expect((await ask(cookies[0], '10.9.9.9')).status).toBe(429);
  });

  it('has no caps for an owner (ADMIN_EMAILS)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const env = makeEnv();
    const owner = await signIn(env, { ...person, sub: '1', email: 'boss@biomana.test' });
    const ask = () => worker.fetch(req('/api/tutor', { method: 'POST', body: 'x', headers: { cookie: owner, 'cf-connecting-ip': '10.5.5.5' } }), env);
    for (let i = 0; i < 200; i++) expect((await ask()).status).toBe(400);
  });
});

describe('owner account', () => {
  it('the session marks only ADMIN_EMAILS accounts as owner', async () => {
    const env = makeEnv();
    mockGoogle({ ...person, sub: '1', email: 'Boss@Biomana.test' });
    const r = await worker.fetch(req('/api/session', { method: 'POST', body: JSON.stringify({ credential: 'tok' }), headers: { origin: ORIGIN } }), env);
    expect((await r.json()).account.owner).toBe(true);
    const cookie = r.headers.get('set-cookie')!.split(';')[0];
    expect((await (await worker.fetch(req('/api/session', { headers: { cookie } }), env)).json()).account.owner).toBe(true);

    const learner = await signIn(env);
    expect((await (await worker.fetch(req('/api/session', { headers: { cookie: learner } }), env)).json()).account.owner).toBeUndefined();
    // An unverified Google email never counts.
    mockGoogle({ ...person, sub: '2', email: 'boss@biomana.test', email_verified: 'false' });
    const bad = await worker.fetch(req('/api/session', { method: 'POST', body: JSON.stringify({ credential: 'tok' }), headers: { origin: ORIGIN } }), env);
    expect(bad.status).toBe(401);
  });
});

describe('content reports', () => {
  const report = (env: Env, body: unknown, headers: Record<string, string> = {}) =>
    worker.fetch(req('/api/report', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { origin: ORIGIN, 'user-agent': 'TestBrowser/1.0', ...headers } }), env);
  const good = { lessonId: 'h1', questionId: 'h1.q3', reason: 'wrong-answer', note: 'جواب باید ۴ باشد.' };

  it('stores a guest report for 90 days with one KV write', async () => {
    const env = makeEnv();
    const r = await report(env, good);
    expect(r.status).toBe(200);
    const { id } = await r.json();
    const stored = env.BIOMANA_KV.data.get(`report:${id}`)!;
    expect(stored.expirationTtl).toBe(90 * 86400);
    expect(JSON.parse(stored.value)).toMatchObject({ ...good, email: null, ua: 'TestBrowser/1.0', time: now });
    expect(env.BIOMANA_KV.data.size).toBe(1);
  });

  it('records the account email when signed in', async () => {
    const env = makeEnv();
    const cookie = await signIn(env);
    const { id } = await (await report(env, good, { cookie })).json();
    expect(JSON.parse(env.BIOMANA_KV.data.get(`report:${id}`)!.value).email).toBe('a@b.c');
  });

  it('accepts reports from the phone apps with CORS headers, never with their account', async () => {
    const env = makeEnv();
    const cookie = await signIn(env);
    for (const origin of ['https://app.biomana.com', 'capacitor://app.biomana.com']) {
      const pre = await worker.fetch(req('/api/report', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } }), env);
      expect(pre.status).toBe(204);
      expect(pre.headers.get('access-control-allow-origin')).toBe(origin);
      expect(pre.headers.get('access-control-allow-credentials')).toBeNull();
      const r = await report(env, good, { origin, cookie });
      expect(r.status).toBe(200);
      expect(r.headers.get('access-control-allow-origin')).toBe(origin);
      const { id } = await r.json();
      expect(JSON.parse(env.BIOMANA_KV.data.get(`report:${id}`)!.value).email).toBeNull();
    }
    const bad = await report(env, { ...good, reason: 'spam' }, { origin: 'https://app.biomana.com' });
    expect(bad.status).toBe(400);
    expect(bad.headers.get('access-control-allow-origin')).toBe('https://app.biomana.com');
    const evil = await worker.fetch(req('/api/report', { method: 'OPTIONS', headers: { origin: 'https://evil.test' } }), env);
    expect(evil.status).toBe(405);
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('validates the report and accepts it only from this site', async () => {
    const env = makeEnv();
    expect((await report(env, good, { origin: 'https://evil.test' })).status).toBe(403);
    expect((await worker.fetch(req('/api/report', { method: 'POST', body: JSON.stringify(good) }), env)).status).toBe(403);
    expect((await worker.fetch(req('/api/report', { headers: { origin: ORIGIN } }), env)).status).toBe(405);
    expect((await report(env, 'not json')).status).toBe(400);
    expect((await report(env, { ...good, reason: 'spam' })).status).toBe(400);
    expect((await report(env, { ...good, questionId: '' })).status).toBe(400);
    expect((await report(env, { ...good, questionId: '<script>' })).status).toBe(400);
    expect((await report(env, { ...good, lessonId: 5 })).status).toBe(400);
    expect((await report(env, { ...good, note: 'x'.repeat(501) })).status).toBe(400);
    expect((await report(env, { ...good, note: 7 })).status).toBe(400);
    expect((await report(env, { ...good, pad: 'x'.repeat(5000) })).status).toBe(413);
    expect((await report(env, { ...good, note: 'x'.repeat(500), lessonId: undefined })).status).toBe(200);
    expect(env.BIOMANA_KV.data.size).toBe(1);
  });

  it('limits reports per IP and per account', async () => {
    const env = makeEnv();
    for (let i = 0; i < 10; i++) expect((await report(env, good, { 'cf-connecting-ip': '1.1.1.1' })).status).toBe(200);
    const over = await report(env, good, { 'cf-connecting-ip': '1.1.1.1' });
    expect(over.status).toBe(429);
    expect(Number(over.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await report(env, good, { 'cf-connecting-ip': '2.2.2.2' })).status).toBe(200);

    const cookie = await signIn(env);
    for (let i = 0; i < 10; i++) expect((await report(env, good, { cookie, 'cf-connecting-ip': `3.3.3.${i}` })).status).toBe(200);
    expect((await report(env, good, { cookie, 'cf-connecting-ip': '4.4.4.4' })).status).toBe(429);

    // An owner (ADMIN_EMAILS) is never capped, even from a capped address.
    const owner = await signIn(env, { ...person, sub: '1', email: 'boss@biomana.test' });
    for (let i = 0; i < 15; i++) expect((await report(env, good, { cookie: owner, 'cf-connecting-ip': '1.1.1.1' })).status).toBe(200);
  });

  it('answers 503 when KV refuses the write', async () => {
    const env = makeEnv({ BIOMANA_KV: memoryKV(new Map(), { failPuts: true }) });
    expect((await report(env, good)).status).toBe(503);
  });

  it('shows reports only to ADMIN_EMAILS, who can mark them handled', async () => {
    const env = makeEnv();
    await report(env, good);
    now += 1000;
    await report(env, { ...good, questionId: 'h1.q4', reason: 'display' });

    expect((await worker.fetch(req('/api/reports'), env)).status).toBe(401);
    const learner = await signIn(env);
    expect((await worker.fetch(req('/api/reports', { headers: { cookie: learner } }), env)).status).toBe(403);
    expect((await worker.fetch(req('/api/reports?id=x', { method: 'DELETE', headers: { cookie: learner, origin: ORIGIN } }), env)).status).toBe(403);

    const admin = await signIn(env, { ...person, sub: '1', email: 'other@example.com' }); // case does not matter
    const list = await (await worker.fetch(req('/api/reports', { headers: { cookie: admin } }), env)).json();
    expect(list.reports.map((r: { questionId: string }) => r.questionId)).toEqual(['h1.q4', 'h1.q3']); // newest first
    expect(list.cursor).toBeNull();

    const id = list.reports[0].id;
    expect((await worker.fetch(req(`/api/reports?id=${id}`, { method: 'DELETE', headers: { cookie: admin, origin: 'https://evil.test' } }), env)).status).toBe(403);
    expect((await worker.fetch(req('/api/reports?id=user:42', { method: 'DELETE', headers: { cookie: admin, origin: ORIGIN } }), env)).status).toBe(400);
    expect((await worker.fetch(req(`/api/reports?id=${id}`, { method: 'DELETE', headers: { cookie: admin, origin: ORIGIN } }), env)).status).toBe(200);
    const after = await (await worker.fetch(req('/api/reports', { headers: { cookie: admin } }), env)).json();
    expect(after.reports.map((r: { questionId: string }) => r.questionId)).toEqual(['h1.q3']);
  });
});

describe('phone-app sign-in', () => {
  const APP = 'https://app.biomana.com';
  const b64url = (b: Uint8Array) => Buffer.from(b).toString('base64url');
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challengeFor = async (v: string) => b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))));
  const askCode = (env: Env, body: unknown, headers: Record<string, string> = { origin: ORIGIN }) =>
    worker.fetch(req('/api/app-code', { method: 'POST', body: JSON.stringify(body), headers }), env);
  const swap = (env: Env, body: unknown, origin = APP) => worker.fetch(req('/api/app-token', { method: 'POST', body: JSON.stringify(body), headers: { origin } }), env);
  async function codeFor(env: Env, v = verifier): Promise<string> {
    mockGoogle(person);
    const r = await askCode(env, { credential: 'tok', challenge: await challengeFor(v) });
    expect(r.status).toBe(200);
    return ((await r.json()) as { code: string }).code;
  }
  async function appSignIn(env: Env): Promise<string> {
    const r = await swap(env, { code: await codeFor(env), verifier });
    expect(r.status).toBe(200);
    return ((await r.json()) as { token: string }).token;
  }

  it('swaps a Google sign-in on the site for an app token the APIs accept, with CORS for the app', async () => {
    const env = makeEnv();
    const code = await codeFor(env);
    expect(code).not.toContain('a@b.c');
    expect(Buffer.from(code, 'base64url').toString()).not.toContain('a@b.c');
    const r = await swap(env, { code, verifier });
    expect(r.status).toBe(200);
    expect(r.headers.get('access-control-allow-origin')).toBe(APP);
    expect(r.headers.get('access-control-allow-credentials')).toBeNull();
    expect(r.headers.get('set-cookie')).toBeNull();
    const body = (await r.json()) as { token: string; account: { id: string; email: string }; progress: unknown };
    expect(body.account).toMatchObject({ id: 'google-42', email: 'a@b.c' });
    expect(body.progress).toBeNull();
    const auth = { authorization: `Bearer ${body.token}`, origin: APP };
    const saved = await worker.fetch(req('/api/progress', { method: 'PUT', body: JSON.stringify({ v: 1, xp: 30 }), headers: auth }), env);
    expect(saved.status).toBe(200);
    expect(saved.headers.get('access-control-allow-origin')).toBe(APP);
    const back = await (await worker.fetch(req('/api/progress', { headers: auth }), env)).json();
    expect(back.progress).toEqual({ v: 1, xp: 30 });
    expect(await (await worker.fetch(req('/api/session', { headers: auth }), env)).json()).toEqual({ account: expect.objectContaining({ id: 'google-42' }) });
    // signing in again later brings the saved progress along
    const again = (await (await swap(env, { code: await codeFor(env), verifier })).json()) as { progress: unknown };
    expect(again.progress).toEqual({ v: 1, xp: 30 });
  });

  it('answers the apps\' preflight and nobody else\'s', async () => {
    const env = makeEnv();
    const pre = await worker.fetch(req('/api/progress', { method: 'OPTIONS', headers: { origin: APP, 'access-control-request-method': 'PUT' } }), env);
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe(APP);
    expect(pre.headers.get('access-control-allow-headers')).toContain('authorization');
    const ios = await worker.fetch(req('/api/app-token', { method: 'OPTIONS', headers: { origin: 'capacitor://app.biomana.com' } }), env);
    expect(ios.headers.get('access-control-allow-origin')).toBe('capacitor://app.biomana.com');
    const evil = await worker.fetch(req('/api/progress', { method: 'OPTIONS', headers: { origin: 'https://evil.test' } }), env);
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('gives a code to a learner already signed in on the site, without a new Google sign-in', async () => {
    const env = makeEnv();
    const cookie = await signIn(env);
    const r = await askCode(env, { challenge: await challengeFor(verifier) }, { origin: ORIGIN, cookie });
    expect(r.status).toBe(200);
    expect((await swap(env, { code: ((await r.json()) as { code: string }).code, verifier })).status).toBe(200);
  });

  it('gives codes only to this site\'s sign-in page, for a real Google sign-in and a well-formed challenge', async () => {
    const env = makeEnv();
    const challenge = await challengeFor(verifier);
    mockGoogle(person);
    expect((await askCode(env, { credential: 'tok', challenge }, { origin: 'https://evil.test' })).status).toBe(403);
    expect((await askCode(env, { credential: 'tok', challenge }, { origin: APP })).status).toBe(403);
    expect((await askCode(env, { credential: 'tok', challenge }, {})).status).toBe(403);
    expect((await askCode(env, { credential: 'tok', challenge: 'short' })).status).toBe(400);
    expect((await askCode(env, { challenge })).status).toBe(401);
    expect((await worker.fetch(req('/api/app-code', { headers: { origin: ORIGIN } }), env)).status).toBe(405);
    mockGoogle(null);
    expect((await askCode(env, { credential: 'bad', challenge })).status).toBe(401);
    mockGoogle({ ...person, aud: 'someone-else.apps.googleusercontent.com' });
    expect((await askCode(env, { credential: 'tok', challenge })).status).toBe(401);
  });

  it('swaps a code only from the app, with the right verifier, once it is fresh and untouched', async () => {
    const env = makeEnv();
    const code = await codeFor(env);
    expect((await swap(env, { code, verifier }, ORIGIN)).status).toBe(403);
    expect((await swap(env, { code, verifier: b64url(crypto.getRandomValues(new Uint8Array(32))) })).status).toBe(401);
    expect((await swap(env, { code, verifier: 'too-short' })).status).toBe(400);
    const flipped = code.slice(0, 20) + (code[20] === 'A' ? 'B' : 'A') + code.slice(21);
    expect((await swap(env, { code: flipped, verifier })).status).toBe(401);
    expect((await swap(env, { code: 'x', verifier })).status).toBe(401);
    // a code made with another secret is refused
    expect((await swap(makeEnv({ SESSION_SECRET: 'another-secret-long-enough!' }), { code, verifier })).status).toBe(401);
    now += 5 * 60_000 + 1;
    expect((await swap(env, { code, verifier })).status).toBe(401);
  });

  it('never takes the website cookie from the apps, and the token follows «sign out on every device»', async () => {
    const env = makeEnv();
    const cookie = await signIn(env);
    expect((await worker.fetch(req('/api/progress', { headers: { cookie, origin: APP } }), env)).status).toBe(401);
    const token = await appSignIn(env);
    const auth = { authorization: `Bearer ${token}`, origin: APP };
    expect((await worker.fetch(req('/api/session?all=1', { method: 'DELETE', headers: auth }), env)).status).toBe(200);
    expect((await worker.fetch(req('/api/progress', { headers: auth }), env)).status).toBe(401);
    expect((await worker.fetch(req('/api/progress', { headers: { cookie } }), env)).status).toBe(401);
  });

  it('renews an app token in the answer body (not a cookie) once it is a week old', async () => {
    const env = makeEnv();
    const token = await appSignIn(env);
    now += 8 * 864e5;
    const r = await worker.fetch(req('/api/session', { headers: { authorization: `Bearer ${token}`, origin: APP } }), env);
    expect(r.headers.get('set-cookie')).toBeNull();
    const body = (await r.json()) as { token?: string };
    expect(body.token).toBeTruthy();
    expect(body.token).not.toBe(token);
    expect((await worker.fetch(req('/api/progress', { headers: { authorization: `Bearer ${body.token}`, origin: APP } }), env)).status).toBe(200);
  });

  it('records an app report under the signed-in account', async () => {
    const env = makeEnv();
    const token = await appSignIn(env);
    const r = await worker.fetch(
      req('/api/report', { method: 'POST', body: JSON.stringify({ questionId: 'h1.q3', reason: 'unclear' }), headers: { authorization: `Bearer ${token}`, origin: APP } }),
      env,
    );
    expect(r.status).toBe(200);
    const { id } = (await r.json()) as { id: string };
    expect(JSON.parse(env.BIOMANA_KV.data.get(`report:${id}`)!.value).email).toBe('a@b.c');
  });
});

describe('Sign in with Apple', () => {
  const APP = 'capacitor://app.biomana.com';
  const SERVICES = 'com.biomana.web';
  const b64url = (b: Uint8Array | string) => Buffer.from(b).toString('base64url');
  const sha256hex = async (s: string) => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).toString('hex');
  let keys: CryptoKeyPair;
  let jwk: JsonWebKey;

  beforeEach(async () => {
    resetAppleKeys();
    keys = (await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        String(url) === 'https://appleid.apple.com/auth/keys'
          ? new Response(JSON.stringify({ keys: [{ kty: 'RSA', kid: 'k1', use: 'sig', alg: 'RS256', n: jwk.n, e: jwk.e }] }))
          : new Response('no', { status: 404 }),
      ),
    );
  });

  async function appleToken(claims: Record<string, unknown>, opts: { kid?: string; key?: CryptoKey } = {}): Promise<string> {
    const head = b64url(JSON.stringify({ alg: 'RS256', kid: opts.kid ?? 'k1' }));
    const t = Math.floor(now / 1000);
    const body = b64url(JSON.stringify({ iss: 'https://appleid.apple.com', aud: SERVICES, sub: '001234.abcdef0123.0456', iat: t, exp: t + 600, email: 'x@privaterelay.appleid.com', email_verified: 'true', ...claims }));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', opts.key ?? keys.privateKey, new TextEncoder().encode(`${head}.${body}`));
    return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
  }

  /** GET /api/apple-start, then the state and nonce Apple would get, and the cookie that comes back with its answer. */
  async function start(env: Env, query = '') {
    const r = await worker.fetch(req(`/api/apple-start${query}`), env);
    expect(r.status).toBe(302);
    const to = new URL(r.headers.get('location')!);
    const setCookie = r.headers.get('set-cookie')!;
    return { to, cookie: setCookie.split(';')[0], setCookie, state: to.searchParams.get('state')!, nonce: to.searchParams.get('nonce')! };
  }

  const callback = (env: Env, cookie: string, fields: Record<string, string>) =>
    worker.fetch(req('/api/apple-callback', { method: 'POST', body: new URLSearchParams(fields), headers: { cookie, origin: 'https://appleid.apple.com' } }), env);

  it('is off until APPLE_SERVICES_ID is set', async () => {
    const off = makeEnv();
    expect(((await (await worker.fetch(req('/api/config'), off)).json()) as { apple: boolean }).apple).toBe(false);
    const r = await worker.fetch(req('/api/apple-start'), off);
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('/?signin=failed#/login');
    const app = await worker.fetch(req('/api/apple-token', { method: 'POST', body: JSON.stringify({ idToken: 'x', nonce: 'n'.repeat(43) }), headers: { origin: APP } }), off);
    expect(app.status).toBe(404);
    expect(((await (await worker.fetch(req('/api/config'), makeEnv({ APPLE_SERVICES_ID: SERVICES }))).json()) as { apple: boolean }).apple).toBe(true);
  });

  it('signs in on the website: Apple’s page, its posted answer, then the normal session cookie', async () => {
    const env = makeEnv({ APPLE_SERVICES_ID: SERVICES });
    const s = await start(env);
    expect(s.to.origin + s.to.pathname).toBe('https://appleid.apple.com/auth/authorize');
    expect(s.to.searchParams.get('client_id')).toBe(SERVICES);
    expect(s.to.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/apple-callback`);
    expect(s.to.searchParams.get('response_mode')).toBe('form_post');
    expect(s.to.search).toContain('response_type=code%20id_token');
    expect(s.setCookie).toMatch(/Path=\/api\/apple-callback; HttpOnly; Secure; SameSite=None; Max-Age=600/);
    const r = await callback(env, s.cookie, {
      state: s.state,
      code: 'c',
      id_token: await appleToken({ nonce: s.nonce }),
      user: JSON.stringify({ name: { firstName: 'Sara', lastName: 'K' }, email: 'x@privaterelay.appleid.com' }),
    });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('/?signin=apple#/login');
    const cookies = r.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('fh_as=;') && c.includes('Max-Age=0'))).toBe(true);
    const session = cookies.find((c) => c.startsWith('fh_s='))!.split(';')[0];
    const who = (await (await worker.fetch(req('/api/session', { headers: { cookie: session } }), env)).json()) as { account: { id: string; name: string; email: string } };
    expect(who.account).toMatchObject({ id: 'apple-001234_abcdef0123_0456', name: 'Sara K', email: 'x@privaterelay.appleid.com' });
    expect((await put(env, session)).status).toBe(200);
    expect(env.BIOMANA_KV.data.has('user:apple_001234_abcdef0123_0456')).toBe(true);
  });

  it('refuses a wrong state, nonce, audience, signature, key or an old token, and a cancel goes back quietly', async () => {
    const env = makeEnv({ APPLE_SERVICES_ID: SERVICES });
    const s = await start(env);
    const bad = async (fields: Record<string, string>, cookie = s.cookie) => {
      const r = await callback(env, cookie, { state: s.state, ...fields });
      expect(r.status).toBe(303);
      expect(r.headers.getSetCookie().some((c) => c.startsWith('fh_s='))).toBe(false);
      return r.headers.get('location');
    };
    expect(await bad({ state: 'other', id_token: await appleToken({ nonce: s.nonce }) })).toBe('/?signin=failed#/login');
    expect(await bad({ id_token: await appleToken({ nonce: 'other' }) })).toBe('/?signin=failed#/login');
    expect(await bad({ id_token: await appleToken({ nonce: s.nonce, aud: 'com.someone.else' }) })).toBe('/?signin=failed#/login');
    expect(await bad({ id_token: await appleToken({ nonce: s.nonce, iss: 'https://evil.test' }) })).toBe('/?signin=failed#/login');
    expect(await bad({ id_token: await appleToken({ nonce: s.nonce, exp: Math.floor(now / 1000) - 3600 }) })).toBe('/?signin=failed#/login');
    expect(await bad({ id_token: await appleToken({ nonce: s.nonce }, { kid: 'unknown' }) })).toBe('/?signin=failed#/login');
    const other = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    expect(await bad({ id_token: await appleToken({ nonce: s.nonce }, { key: other.privateKey }) })).toBe('/?signin=failed#/login');
    // no cookie, a forged one, or one past its 10 minutes
    expect(await bad({ id_token: await appleToken({ nonce: s.nonce }) }, '')).toBe('/?signin=failed#/login');
    expect(await bad({ id_token: await appleToken({ nonce: s.nonce }) }, s.cookie.slice(0, -2) + 'xx')).toBe('/?signin=failed#/login');
    expect(await bad({ error: 'user_cancelled_authorize' })).toBe('/#/login');
    now += 10 * 60_000 + 1;
    expect(await bad({ id_token: await appleToken({ nonce: s.nonce }) })).toBe('/?signin=failed#/login');
  });

  it('gives the Android app its one-time code through /app/login.html', async () => {
    const env = makeEnv({ APPLE_SERVICES_ID: SERVICES });
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const ch = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    expect((await worker.fetch(req('/api/apple-start?ch=short'), env)).status).toBe(400);
    const s = await start(env, `?ch=${ch}`);
    const r = await callback(env, s.cookie, { state: s.state, id_token: await appleToken({ nonce: s.nonce }) });
    const to = r.headers.get('location')!;
    expect(to.startsWith(`/app/login.html?ch=${ch}#code=`)).toBe(true);
    expect(r.headers.getSetCookie().some((c) => c.startsWith('fh_s='))).toBe(false);
    const swap = await worker.fetch(
      req('/api/app-token', { method: 'POST', body: JSON.stringify({ code: to.split('#code=')[1], verifier }), headers: { origin: 'https://app.biomana.com' } }),
      env,
    );
    expect(swap.status).toBe(200);
    expect(((await swap.json()) as { account: { id: string } }).account.id).toBe('apple-001234_abcdef0123_0456');
    // a cancel goes back to the page's buttons
    const s2 = await start(env, `?ch=${ch}`);
    expect((await callback(env, s2.cookie, { state: s2.state, error: 'user_cancelled_authorize' })).headers.get('location')).toBe(`/app/login.html?ch=${ch}`);
  });

  it('swaps the iPhone app’s Apple token (audience com.biomana.app, hashed nonce) for an app token', async () => {
    const env = makeEnv({ APPLE_SERVICES_ID: SERVICES });
    const nonce = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const token = await appleToken({ aud: 'com.biomana.app', nonce: await sha256hex(nonce) });
    const ask = (body: unknown, origin = APP) => worker.fetch(req('/api/apple-token', { method: 'POST', body: JSON.stringify(body), headers: { origin } }), env);
    expect((await ask({ idToken: token, nonce }, ORIGIN)).status).toBe(403);
    expect((await ask({ idToken: token, nonce: b64url(crypto.getRandomValues(new Uint8Array(32))) })).status).toBe(401);
    expect((await ask({ idToken: token, nonce: 'short' })).status).toBe(400);
    expect((await ask({ idToken: await appleToken({ nonce: await sha256hex(nonce) }), nonce })).status).toBe(401);
    const r = await ask({ idToken: token, nonce, name: 'Sara' });
    expect(r.status).toBe(200);
    expect(r.headers.get('access-control-allow-origin')).toBe(APP);
    const body = (await r.json()) as { token: string; account: { id: string; name: string } };
    expect(body.account).toMatchObject({ id: 'apple-001234_abcdef0123_0456', name: 'Sara' });
    expect((await worker.fetch(req('/api/progress', { headers: { authorization: `Bearer ${body.token}`, origin: APP } }), env)).status).toBe(200);
  });
});
