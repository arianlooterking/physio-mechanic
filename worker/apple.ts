/**
 * Sign in with Apple, next to Google. Off until APPLE_SERVICES_ID is set (see Env in lib.ts).
 *
 * Website, and the Android app through the phone's browser:
 *   GET  /api/apple-start      → Apple's page. A short-lived signed cookie keeps the state and nonce (and, for the
 *                                Android app, its PKCE challenge ?ch=…).
 *   POST /api/apple-callback   ← Apple posts the ID token back (response_mode=form_post). The website gets its normal
 *                                session cookie; the Android app gets the same one-time code as /api/app-code, through
 *                                /app/login.html, which hands it back to the app.
 * iPhone app (Apple's own sheet, AppleSignIn plugin):
 *   POST /api/apple-token      {idToken, nonce, name} → the app's session token, like /api/app-token. The app passed
 *                                SHA-256(nonce) to the sheet, so a token is only good with the nonce that only it knows.
 *
 * Tokens are checked with Apple's public keys (RS256). Apple sends the person's name only on their first sign-in, and
 * its email may be a private relay address. Accounts are `apple_<Apple's id>`, apart from Google accounts.
 */
import {
  APP_CODE_MS,
  appOrigin,
  b64url,
  CHALLENGE_RE,
  fromB64url,
  json,
  openValue,
  sealAppCode,
  sessionCookie,
  sessionEpoch,
  signSession,
  signValue,
  withApiHeaders,
  type Env,
  type Session,
} from './lib';

export const APPLE_ISSUER = 'https://appleid.apple.com';
/** the iPhone app: its tokens carry the app id as their audience */
export const APPLE_APP_ID = 'com.biomana.app';
const KEYS_URL = 'https://appleid.apple.com/auth/keys';
const STATE_COOKIE = 'fh_as';
const STATE_PATH = '/api/apple-callback';
const STATE_MS = 10 * 60_000;
const CLOCK_SKEW_MS = 5 * 60_000;

export const appleServicesId = (env: Env): string | null => env.APPLE_SERVICES_ID?.trim() || null;

/* ───────────── Apple's ID token ───────────── */

type Jwk = { kty: string; kid: string; alg?: string; n: string; e: string };
let keyCache: { at: number; keys: Jwk[] } | null = null;

/** Forget Apple's cached keys (tests). */
export function resetAppleKeys(): void {
  keyCache = null;
}

async function appleKeys(fresh: boolean): Promise<Jwk[]> {
  if (!fresh && keyCache && Date.now() - keyCache.at < 3600_000) return keyCache.keys;
  const r = await fetch(KEYS_URL);
  if (!r.ok) return keyCache?.keys ?? [];
  const { keys } = (await r.json()) as { keys?: Jwk[] };
  keyCache = { at: Date.now(), keys: Array.isArray(keys) ? keys : [] };
  return keyCache.keys;
}

export type AppleClaims = {
  iss: string;
  aud: string | string[];
  sub: string;
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
};

const enc = new TextEncoder();

/** Check an Apple ID token's signature, issuer, audience and time, and return its claims, or null. */
export async function verifyAppleToken(token: string, audience: string): Promise<AppleClaims | null> {
  if (!token || token.length > 8000) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header: { alg?: string; kid?: string };
  let claims: AppleClaims;
  try {
    header = JSON.parse(new TextDecoder().decode(fromB64url(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(fromB64url(parts[1])));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;
  // a key Apple added since the last fetch: fetch once more
  let jwk = (await appleKeys(false)).find((k) => k.kid === header.kid);
  jwk ??= (await appleKeys(true)).find((k) => k.kid === header.kid);
  if (!jwk || jwk.kty !== 'RSA') return null;
  try {
    const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromB64url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
  } catch {
    return null;
  }
  const now = Date.now();
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== APPLE_ISSUER || !aud.includes(audience)) return null;
  if (typeof claims.sub !== 'string' || !claims.sub) return null;
  if (!(Number(claims.exp) * 1000 > now - CLOCK_SKEW_MS) || !(Number(claims.iat) * 1000 < now + CLOCK_SKEW_MS)) return null;
  return claims;
}

/** The person for the session. Apple's id looks like 000123.abc….0456; KV keys keep letters, digits, _ and -. */
export function applePerson(c: AppleClaims, name = ''): Omit<Session, 'iat' | 'ep'> {
  const verified = c.email_verified === true || c.email_verified === 'true';
  return {
    sub: `apple_${c.sub.replace(/\./g, '_').replace(/[^0-9A-Za-z_-]/g, '')}`,
    email: verified && typeof c.email === 'string' ? c.email : '',
    name: name.trim().slice(0, 60),
  };
}

const sha256hex = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

/* ───────────── website (and the Android app through the browser) ───────────── */

type State = { state: string; nonce: string; ch?: string; exp: number };

function redirect(location: string, cookies: string[] = []): Response {
  const headers = withApiHeaders({ location, 'cache-control': 'no-store' });
  for (const c of cookies) headers.append('set-cookie', c);
  return new Response(null, { status: 303, headers });
}

const stateCookie = (value: string, maxAge: number) => `${STATE_COOKIE}=${value}; Path=${STATE_PATH}; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`;

/** Where to go when sign-in didn't finish: back to the button it started from. */
const startOver = (ch?: string, failed = true) =>
  ch ? `/app/login.html?ch=${ch}${failed ? '&apple=failed' : ''}` : `/${failed ? '?signin=failed' : ''}#/login`;

export async function appleStart(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const ch = url.searchParams.get('ch') ?? '';
  if (ch && !CHALLENGE_RE.test(ch)) return json({ error: 'bad-request' }, { status: 400 });
  const clientId = appleServicesId(env);
  if (!clientId) return redirect(startOver(ch || undefined));
  const random = () => b64url(crypto.getRandomValues(new Uint8Array(18)));
  const st: State = { state: random(), nonce: random(), ...(ch ? { ch } : {}), exp: Date.now() + STATE_MS };
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${url.origin}${STATE_PATH}`,
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
    state: st.state,
    nonce: st.nonce,
  });
  // Apple's answer is a POST from appleid.apple.com, so this cookie must be SameSite=None to come back with it
  return new Response(null, {
    status: 302,
    headers: withApiHeaders({
      location: `${APPLE_ISSUER}/auth/authorize?${params.toString().replace(/\+/g, '%20')}`,
      'set-cookie': stateCookie(await signValue(st, env, 'apple-state:'), STATE_MS / 1000),
      'cache-control': 'no-store',
    }),
  });
}

function cookieValue(request: Request, name: string): string | undefined {
  return (request.headers.get('cookie') ?? '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/** Apple's `user` field (first sign-in only): {"name":{"firstName":…,"lastName":…},"email":…} */
function nameFrom(user: FormDataEntryValue | null): string {
  if (typeof user !== 'string' || user.length > 2000) return '';
  try {
    const n = (JSON.parse(user) as { name?: { firstName?: unknown; lastName?: unknown } }).name;
    return [n?.firstName, n?.lastName].filter((x): x is string => typeof x === 'string').join(' ');
  } catch {
    return '';
  }
}

export async function appleCallback(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method' }, { status: 405 });
  const clear = stateCookie('', 0);
  const raw = cookieValue(request, STATE_COOKIE);
  const st = raw ? await openValue<State>(raw, env, 'apple-state:') : null;
  const ch = st?.ch && CHALLENGE_RE.test(st.ch) ? st.ch : undefined;
  if (Number(request.headers.get('content-length') ?? 0) > 20_000) return redirect(startOver(ch), [clear]);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect(startOver(ch), [clear]);
  }
  if (!st || typeof st.exp !== 'number' || st.exp < Date.now() || form.get('state') !== st.state) return redirect(startOver(ch), [clear]);
  // closed Apple's page without signing in: back to the buttons, without an error
  if (form.get('error')) return redirect(startOver(ch, form.get('error') !== 'user_cancelled_authorize'), [clear]);
  const clientId = appleServicesId(env);
  const claims = clientId ? await verifyAppleToken(String(form.get('id_token') ?? ''), clientId) : null;
  if (!claims || claims.nonce !== st.nonce) return redirect(startOver(ch), [clear]);
  const person = applePerson(claims, nameFrom(form.get('user')));
  if (ch) {
    // the Android app: the sign-in page hands this code back to the app (the fragment never reaches a server)
    const code = await sealAppCode({ ...person, ch, exp: Date.now() + APP_CODE_MS }, env);
    return redirect(`/app/login.html?ch=${ch}#code=${code}`, [clear]);
  }
  const ep = await sessionEpoch(env, person.sub);
  const cookie = await signSession({ ...person, iat: Date.now(), ep }, env);
  // the app reads ?signin=apple, takes the account in from /api/session and continues
  return redirect('/?signin=apple#/login', [clear, sessionCookie(cookie)]);
}

/* ───────────── iPhone app ───────────── */

/** Checks Apple's token from the iPhone app's sheet. Returns the person, or an error answer. */
export async function appleAppPerson(request: Request, env: Env, body: Record<string, unknown> | null): Promise<Omit<Session, 'iat' | 'ep'> | Response> {
  if (!appOrigin(request)) return json({ error: 'forbidden' }, { status: 403 });
  if (!appleServicesId(env)) return json({ error: 'apple-off' }, { status: 404 });
  const idToken = typeof body?.idToken === 'string' ? body.idToken : '';
  const nonce = typeof body?.nonce === 'string' ? body.nonce : '';
  if (!idToken || !/^[A-Za-z0-9_-]{32,128}$/.test(nonce)) return json({ error: 'bad-request' }, { status: 400 });
  const claims = await verifyAppleToken(idToken, APPLE_APP_ID);
  if (!claims || claims.nonce !== (await sha256hex(nonce))) return json({ error: 'invalid-credential' }, { status: 401 });
  return applePerson(claims, typeof body?.name === 'string' ? body.name : '');
}
