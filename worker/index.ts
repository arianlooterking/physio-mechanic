/*
 * Cloudflare Worker for بیومانا.
 * Static files come from the assets binding (with the headers in public/_headers); this script only answers /api/*:
 *   GET    /api/config          public runtime settings (Google client id, whether Sign in with Apple is on)
 *   POST   /api/session         Google ID token → signed session cookie + saved progress
 *   GET    /api/session         who is signed in (renews a cookie older than a week)
 *   DELETE /api/session         sign out; ?all=1 signs the account out on every device
 *   GET    /api/progress        saved progress of the signed-in learner
 *   PUT    /api/progress        save progress of the signed-in learner (at most every 15 s)
 *   DELETE /api/progress        delete the copy kept in the account
 *   *      /api/tutor           AI tutor (needs the ANTHROPIC_API_KEY secret; POST needs a signed-in account; no caps for ADMIN_EMAILS)
 *   POST   /api/report          report a problem with a question («گزارش اشکال»)
 *   GET    /api/reports         reports, for ADMIN_EMAILS only; DELETE ?id= marks one handled
 *   POST   /api/app-code        /app/login.html, after Google sign-in: a one-time code for the phone app (PKCE challenge)
 *   POST   /api/app-token       the phone app swaps that code (+ its verifier) for a session token it sends as Bearer
 *   GET    /api/apple-start     Sign in with Apple on the site (and for the Android app through the browser)
 *   POST   /api/apple-callback  Apple's answer → session cookie, or the Android app's one-time code
 *   POST   /api/apple-token     the iPhone app's Apple sign-in → session token (worker/apple.ts; off until APPLE_SERVICES_ID is set)
 *
 * The phone apps call from https://app.biomana.com (Android) or capacitor://app.biomana.com (iOS): their requests get
 * CORS headers, and they sign in with a token instead of the cookie (a cross-site cookie wouldn't reach the Worker).
 *
 * KV budget: the free plan allows about 1,000 writes a day for the whole account, so writes happen
 * only on a progress save, a report, «sign out on every device» and nothing else.
 */
import { windowLimiter } from '../server/limit';
import { appleAppPerson, appleCallback, appleServicesId, appleStart } from './apple';
import { handleTutorHttp } from '../server/tutor';
import {
  APP_CODE_MS,
  appOrigin,
  bearer,
  CHALLENGE_RE,
  challengeOf,
  cleanSub,
  clearCookie,
  fromThisSite,
  isAdmin,
  json,
  MIN_SAVE_GAP_MS,
  openAppCode,
  readSession,
  RENEW_AFTER_MS,
  revokeSessions,
  sealAppCode,
  sessionCookie,
  sessionEpoch,
  signSession,
  trustedWrite,
  VERIFIER_RE,
  verifyGoogle,
  withApiHeaders,
  type Env,
  type Session,
} from './lib';
import { reports } from './reports';

type Saved = { progress: unknown; savedAt: number; xp: number };

const userKey = (sub: string) => `user:${cleanSub(sub)}`;
const MAX_PROGRESS = 900_000;

/** google-<Google's id>, or apple-<Apple's id> for an Apple account (its session sub is apple_…). */
const accountId = (sub: string) => (sub.startsWith('apple_') ? `apple-${sub.slice(6)}` : `google-${sub}`);

/** `owner`: an ADMIN_EMAILS account; the app opens every lesson for it with no order or daily limits. */
const accountOf = (s: { sub: string; name: string; email: string; picture?: string }, env: Env) => ({
  id: accountId(s.sub),
  name: s.name,
  email: s.email,
  picture: s.picture,
  ...(isAdmin(s, env) ? { owner: true } : {}),
});

async function session(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') {
    const s = await readSession(request, env);
    const headers: Record<string, string> = {};
    let token: string | undefined;
    // Sliding expiry: a learner who keeps coming back stays signed in. No KV write. The apps get the new token in the body.
    if (s && Date.now() - s.iat > RENEW_AFTER_MS) {
      const fresh = await signSession({ ...s, iat: Date.now() }, env);
      if (bearer(request)) token = fresh;
      else headers['set-cookie'] = sessionCookie(fresh);
    }
    return json({ account: s ? accountOf(s, env) : null, ...(token ? { token } : {}) }, { headers });
  }
  if (!trustedWrite(request)) return json({ error: 'forbidden' }, { status: 403 });
  if (request.method === 'DELETE') {
    if (new URL(request.url).searchParams.get('all') === '1') {
      const s = await readSession(request, env);
      if (!s) return json({ error: 'signed-out' }, { status: 401, headers: { 'set-cookie': clearCookie() } });
      try {
        await revokeSessions(env, s.sub);
      } catch (err) {
        console.error('session revoke failed', err);
        return json({ error: 'storage-busy' }, { status: 503, headers: { 'retry-after': '300' } });
      }
    }
    return json({ ok: true }, { headers: { 'set-cookie': clearCookie() } });
  }
  if (request.method !== 'POST') return json({ error: 'method' }, { status: 405 });

  let credential = '';
  try {
    credential = String(((await request.json()) as { credential?: unknown }).credential ?? '');
  } catch {
    return json({ error: 'bad-request' }, { status: 400 });
  }
  const person = await verifyGoogle(credential, env);
  if (!person) return json({ error: 'invalid-credential' }, { status: 401 });
  const [saved, ep] = await Promise.all([env.BIOMANA_KV.get<Saved>(userKey(person.sub), 'json'), sessionEpoch(env, person.sub)]);
  const cookie = await signSession({ ...person, iat: Date.now(), ep }, env);
  return json(
    { account: accountOf(person, env), progress: saved?.progress ?? null, savedAt: saved?.savedAt ?? 0 },
    { headers: { 'set-cookie': sessionCookie(cookie) } },
  );
}

async function progress(request: Request, env: Env): Promise<Response> {
  const s = await readSession(request, env);
  if (!s) return json({ error: 'signed-out' }, { status: 401 });
  const key = userKey(s.sub);
  if (request.method === 'GET') {
    const saved = await env.BIOMANA_KV.get<Saved>(key, 'json');
    return json({ progress: saved?.progress ?? null, savedAt: saved?.savedAt ?? 0 });
  }
  if (!trustedWrite(request)) return json({ error: 'forbidden' }, { status: 403 });
  if (request.method === 'DELETE') {
    await env.BIOMANA_KV.delete(key);
    return json({ ok: true });
  }
  if (request.method !== 'PUT' && request.method !== 'POST') return json({ error: 'method' }, { status: 405 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_PROGRESS) return json({ error: 'too-large' }, { status: 413 });
  const text = await request.text();
  if (text.length > MAX_PROGRESS) return json({ error: 'too-large' }, { status: 413 });
  let data: { v?: number; xp?: number | { total?: number } } | null = null;
  try {
    data = JSON.parse(text);
  } catch {
    return json({ error: 'bad-request' }, { status: 400 });
  }
  if (!data || typeof data !== 'object' || data.v !== 1) return json({ error: 'bad-request' }, { status: 400 });

  // Guard the daily KV write budget: one save per account every MIN_SAVE_GAP_MS at most.
  const prev = await env.BIOMANA_KV.get<Saved>(key, 'json');
  const now = Date.now();
  const since = now - (Number(prev?.savedAt) || 0);
  if (prev && since >= 0 && since < MIN_SAVE_GAP_MS) {
    const retry = Math.max(1, Math.ceil((MIN_SAVE_GAP_MS - since) / 1000));
    return json({ error: 'too-soon', retryAfter: retry }, { status: 429, headers: { 'retry-after': String(retry) } });
  }

  const xp = typeof data.xp === 'object' && data.xp ? data.xp.total : data.xp;
  const record: Saved = { progress: data, savedAt: now, xp: Number(xp) || 0 };
  try {
    await env.BIOMANA_KV.put(key, JSON.stringify(record), { metadata: { email: s.email, xp: record.xp, savedAt: now } });
  } catch (err) {
    // For example the daily write limit of the KV free plan. The app keeps its copy and tries later.
    console.error('progress put failed', err);
    return json({ error: 'storage-busy' }, { status: 503, headers: { 'retry-after': '300' } });
  }
  return json({ ok: true, savedAt: now });
}

/* ───────────── phone-app sign-in ─────────────
 * The app can't run Google's web sign-in itself, so it opens /app/login.html in the phone's browser with a PKCE
 * challenge. That page signs in with Google as the website does and asks for a code (POST /api/app-code), then
 * hands the code back to the app (com.biomana.app://signin?code=…). The app swaps code + verifier for a session
 * token (POST /api/app-token). The code is sealed (no KV write), lasts 5 minutes and is useless without the verifier.
 */
const codeLimit = windowLimiter(20, 10 * 60_000);
const tokenLimit = windowLimiter(20, 10 * 60_000);

/** Forget the sign-in rate-limit counts (tests). */
export function resetAppSignInLimits(): void {
  codeLimit.reset();
  tokenLimit.reset();
}

async function readJson(request: Request, max = 8_000): Promise<Record<string, unknown> | null> {
  if (Number(request.headers.get('content-length') ?? 0) > max) return null;
  const text = await request.text();
  if (text.length > max) return null;
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function appCode(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method' }, { status: 405 });
  // only the sign-in page on this site asks for a code
  if (!fromThisSite(request)) return json({ error: 'forbidden' }, { status: 403 });
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (codeLimit.hit(ip)) return json({ error: 'rate-limited' }, { status: 429, headers: { 'retry-after': String(codeLimit.retryAfter(ip)) } });
  const body = await readJson(request);
  const challenge = typeof body?.challenge === 'string' ? body.challenge : '';
  if (!CHALLENGE_RE.test(challenge)) return json({ error: 'bad-request' }, { status: 400 });
  // a fresh Google sign-in on the page, or the site's own session when the learner is already signed in there
  const credential = typeof body?.credential === 'string' ? body.credential : '';
  const person = credential ? await verifyGoogle(credential, env) : await readSession(request, env);
  if (!person) return json({ error: credential ? 'invalid-credential' : 'signed-out' }, { status: 401 });
  const code = await sealAppCode({ sub: person.sub, email: person.email, name: person.name, picture: person.picture, ch: challenge, exp: Date.now() + APP_CODE_MS }, env);
  return json({ code });
}

async function appToken(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method' }, { status: 405 });
  if (!appOrigin(request)) return json({ error: 'forbidden' }, { status: 403 });
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (tokenLimit.hit(ip)) return json({ error: 'rate-limited' }, { status: 429, headers: { 'retry-after': String(tokenLimit.retryAfter(ip)) } });
  const body = await readJson(request);
  const verifier = typeof body?.verifier === 'string' ? body.verifier : '';
  if (!VERIFIER_RE.test(verifier)) return json({ error: 'bad-request' }, { status: 400 });
  const c = await openAppCode(typeof body?.code === 'string' ? body.code : '', env);
  if (!c || c.exp < Date.now() || c.ch !== (await challengeOf(verifier))) return json({ error: 'invalid-code' }, { status: 401 });
  return appSession({ sub: c.sub, email: c.email, name: c.name, picture: c.picture }, env);
}

/** The iPhone app's Sign in with Apple (Apple's own sheet): its token for the app's session token. */
async function appleToken(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method' }, { status: 405 });
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (tokenLimit.hit(ip)) return json({ error: 'rate-limited' }, { status: 429, headers: { 'retry-after': String(tokenLimit.retryAfter(ip)) } });
  const person = await appleAppPerson(request, env, await readJson(request));
  return person instanceof Response ? person : appSession(person, env);
}

/** The app's session token for a person, with the progress saved in the account. */
async function appSession(person: Omit<Session, 'iat' | 'ep'>, env: Env): Promise<Response> {
  const [saved, ep] = await Promise.all([env.BIOMANA_KV.get<Saved>(userKey(person.sub), 'json'), sessionEpoch(env, person.sub)]);
  const token = await signSession({ ...person, iat: Date.now(), ep }, env);
  return json({ token, account: accountOf(person, env), progress: saved?.progress ?? null, savedAt: saved?.savedAt ?? 0 });
}

/** CORS for the phone apps: the preflight, and the answer's headers (no cookies are involved, so no credentials). */
function appCors(origin: string, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  headers.append('vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function tutor(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  // Only a signed-in account may spend tutor credits; the status check (GET) stays public.
  const s = request.method === 'POST' ? await readSession(request, env) : null;
  const result = await handleTutorHttp({
    method: request.method,
    origin: request.headers.get('origin'),
    host: request.headers.get('host') ?? url.host,
    ip: request.headers.get('cf-connecting-ip') ?? 'unknown',
    body: request.method === 'POST' ? (await request.text()).slice(0, 64_000) : '',
    account: s ? accountId(s.sub) : null,
    owner: isAdmin(s, env),
  });
  return new Response(result.status === 204 ? null : JSON.stringify(result.json), { status: result.status, headers: withApiHeaders(result.headers) });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const app = pathname.startsWith('/api/') ? appOrigin(request) : null;
    if (app && request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: withApiHeaders({
          'access-control-allow-origin': app,
          'access-control-allow-methods': 'GET, POST, PUT, DELETE',
          'access-control-allow-headers': 'authorization, content-type',
          'access-control-max-age': '86400',
          vary: 'Origin',
        }),
      });
    }
    const res = await api(request, env, pathname);
    return app ? appCors(app, res) : res;
  },
};

async function api(request: Request, env: Env, pathname: string): Promise<Response> {
  try {
    if (pathname === '/api/config') {
      const id = env.GOOGLE_CLIENT_ID?.trim();
      return json(
        { googleClientId: id && id.endsWith('.apps.googleusercontent.com') ? id : null, apple: appleServicesId(env) !== null },
        { headers: { 'cache-control': 'public, max-age=60' } },
      );
    }
    if (pathname === '/api/session') return await session(request, env);
    if (pathname === '/api/progress') return await progress(request, env);
    if (pathname === '/api/tutor') return await tutor(request, env);
    if (pathname === '/api/report' || pathname === '/api/reports') return await reports(request, env, pathname);
    if (pathname === '/api/app-code') return await appCode(request, env);
    if (pathname === '/api/app-token') return await appToken(request, env);
    if (pathname === '/api/apple-start') return await appleStart(request, env);
    if (pathname === '/api/apple-callback') return await appleCallback(request, env);
    if (pathname === '/api/apple-token') return await appleToken(request, env);
    if (pathname.startsWith('/api/')) return json({ error: 'not-found' }, { status: 404 });
  } catch (err) {
    console.error('api error', pathname, err);
    return json({ error: 'server-error' }, { status: 500 });
  }
  return env.ASSETS.fetch(request);
}
