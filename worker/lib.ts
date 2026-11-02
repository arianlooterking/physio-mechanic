/** Shared helpers for the Worker: environment, JSON responses, signed session cookies, Google token check. */

export interface KV {
  get<T>(key: string, type: 'json'): Promise<T | null>;
  put(key: string, value: string, options?: { metadata?: unknown; expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list<M = unknown>(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string; expiration?: number; metadata?: M }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  BIOMANA_KV: KV;
  GOOGLE_CLIENT_ID?: string;
  SESSION_SECRET?: string;
  ANTHROPIC_API_KEY?: string;
  TUTOR_ALLOWED_ORIGINS?: string;
  /** Comma-separated Google account emails that may read content reports (/api/reports). */
  ADMIN_EMAILS?: string;
  /**
   * Sign in with Apple (worker/apple.ts) stays off until this is the Services ID made in the Apple Developer account
   * (com.biomana.web). The iPhone app's own sheet checks its tokens against the app id, com.biomana.app.
   */
  APPLE_SERVICES_ID?: string;
}

/**
 * The signed session cookie. `ep` is the account's session epoch when the cookie was made:
 * «sign out on every device» raises the epoch in KV, which retires every older cookie.
 * Cookies from before epochs existed have no `ep` and count as epoch 0.
 */
export type Session = { sub: string; email: string; name: string; picture?: string; iat: number; ep?: number };

const COOKIE = 'fh_s';
const SESSION_DAYS = 180;
/** GET /api/session gives a valid session a fresh cookie once it is this old (sliding expiry). */
export const RENEW_AFTER_MS = 7 * 864e5;
/** The server refuses a progress save sooner than this after the account's last one (the app saves about once a minute). */
export const MIN_SAVE_GAP_MS = 15_000;
/** Tolerance for clock differences between Cloudflare machines when checking `iat`. */
const CLOCK_SKEW_MS = 60_000;

/** Headers on every API response: no MIME sniffing, no referrer, never framed, nothing executable. */
export const API_HEADERS: Readonly<Record<string, string>> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
};

export function withApiHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  for (const [k, v] of Object.entries(API_HEADERS)) headers.set(k, v);
  return headers;
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = withApiHeaders(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
}

/** Only letters, digits, _ and - from a Google subject id, for use inside KV keys. */
export const cleanSub = (sub: string) => sub.replace(/[^0-9A-Za-z_-]/g, '');

const enc = new TextEncoder();

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const p = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(p.padEnd(p.length + ((4 - (p.length % 4)) % 4), '='));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(env: Env, payload: string): Promise<string> {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error('SESSION_SECRET is not set');
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload))));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * A small tamper-proof value, base64url(JSON).signature: the session cookie, and with a `purpose` other short-lived
 * values (a value signed for one purpose never passes as another, or as a session).
 */
export async function signValue(v: unknown, env: Env, purpose = ''): Promise<string> {
  const p = b64url(enc.encode(JSON.stringify(v)));
  return `${p}.${await hmac(env, purpose + p)}`;
}

export async function openValue<T>(raw: string, env: Env, purpose = ''): Promise<T | null> {
  const [p, sig, extra] = raw.split('.');
  if (!p || !sig || extra !== undefined || !safeEqual(sig, await hmac(env, purpose + p))) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromB64url(p))) as T;
  } catch {
    return null;
  }
}

export const signSession = (s: Session, env: Env): Promise<string> => signValue(s, env);

/* ───────────── session epoch («sign out on every device») ───────────── */

const epochKey = (sub: string) => `sess:${cleanSub(sub)}`;

/** The account's current session epoch; 0 until it is first raised. */
export async function sessionEpoch(env: Env, sub: string): Promise<number> {
  const v = await env.BIOMANA_KV.get<unknown>(epochKey(sub), 'json');
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** Retire every session cookie of the account made so far. Returns the new epoch. */
export async function revokeSessions(env: Env, sub: string): Promise<number> {
  const next = (await sessionEpoch(env, sub)) + 1;
  await env.BIOMANA_KV.put(epochKey(sub), String(next));
  return next;
}

/** The phone apps' session token (`Authorization: Bearer …`), or undefined. A browser never adds it by itself. */
export function bearer(request: Request): string | undefined {
  const auth = request.headers.get('authorization') ?? '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() || undefined : undefined;
}

/** The session: the website's cookie, or the token the phone apps keep and send themselves (same signed format; the apps never use the cookie). */
export async function readSession(request: Request, env: Env): Promise<Session | null> {
  const raw =
    bearer(request) ??
    (appOrigin(request) ? '' : (request.headers.get('cookie') ?? ''))
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const s = await openValue<Session>(raw, env);
  if (!s || typeof s.sub !== 'string' || !s.sub || typeof s.iat !== 'number' || !Number.isFinite(s.iat)) return null;
  const now = Date.now();
  // A cookie "issued" in the future was not made by this Worker's clock: refuse it.
  if (s.iat > now + CLOCK_SKEW_MS) return null;
  if (now - s.iat > SESSION_DAYS * 864e5) return null;
  const ep = typeof s.ep === 'number' && Number.isFinite(s.ep) ? s.ep : 0;
  if (ep < (await sessionEpoch(env, s.sub))) return null;
  return s;
}

export const sessionCookie = (value: string) =>
  `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

/** True when the request comes from this site (or carries no Origin, as same-origin GETs may not). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

/** Stricter than sameOrigin: the browser must say it is this site (every fetch POST carries Origin). */
export function fromThisSite(request: Request): boolean {
  return request.headers.get('origin') === new URL(request.url).origin;
}

/* ───────────── phone-app sign-in ───────────── */

// the Android app (https) and the iOS app (capacitor) load their files from app.biomana.com
export const APP_ORIGINS = ['https://app.biomana.com', 'capacitor://app.biomana.com'];

/** The request's Origin when it is one of the phone apps, else null. */
export function appOrigin(request: Request): string | null {
  const origin = request.headers.get('origin');
  return origin && APP_ORIGINS.includes(origin) ? origin : null;
}

/**
 * A change the server may act on: from this site (its cookie), or carrying the apps' token. A page on another site
 * can't send that header without a CORS preflight, which only the apps pass, so neither can be forged cross-site.
 */
export function trustedWrite(request: Request): boolean {
  return sameOrigin(request) || bearer(request) !== undefined;
}

/** How long the code from /app/login.html can be swapped for an app session. */
export const APP_CODE_MS = 5 * 60_000;
/** PKCE (RFC 7636, S256): a challenge is base64url(SHA-256(verifier)); the verifier never leaves the app until the swap. */
export const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;
export const VERIFIER_RE = /^[A-Za-z0-9_-]{43,128}$/;

export type AppCode = Omit<Session, 'iat' | 'ep'> & { ch: string; exp: number };

async function codeKey(env: Env): Promise<CryptoKey> {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error('SESSION_SECRET is not set');
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`app-code:${secret}`));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** The person and the app's challenge sealed into one short-lived code (AES-GCM: unreadable and tamper-proof outside the Worker; no KV write). */
export async function sealAppCode(c: AppCode, env: Env): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const box = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await codeKey(env), enc.encode(JSON.stringify(c))));
  const out = new Uint8Array(iv.length + box.length);
  out.set(iv);
  out.set(box, iv.length);
  return b64url(out);
}

export async function openAppCode(code: string, env: Env): Promise<AppCode | null> {
  if (!code || code.length > 2000 || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const bytes = fromB64url(code);
    if (bytes.length < 29) return null;
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await codeKey(env), bytes.slice(12));
    const c = JSON.parse(new TextDecoder().decode(plain)) as AppCode;
    return c && typeof c.sub === 'string' && c.sub && typeof c.ch === 'string' && typeof c.exp === 'number' ? c : null;
  } catch {
    return null;
  }
}

export async function challengeOf(verifier: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(verifier))));
}

/** Check a Google Identity Services ID token with Google and return the person, or null. */
export async function verifyGoogle(credential: string, env: Env): Promise<Omit<Session, 'iat' | 'ep'> | null> {
  const aud = env.GOOGLE_CLIENT_ID?.trim();
  if (!aud || !credential || credential.length > 4096) return null;
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!r.ok) return null;
  const p = (await r.json()) as Record<string, string | boolean | undefined>;
  if (p.aud !== aud) return null;
  if (p.iss !== 'accounts.google.com' && p.iss !== 'https://accounts.google.com') return null;
  if (Number(p.exp) * 1000 < Date.now()) return null;
  if (p.email_verified !== true && p.email_verified !== 'true') return null;
  return {
    sub: String(p.sub),
    email: String(p.email ?? ''),
    name: String(p.given_name || p.name || ''),
    picture: typeof p.picture === 'string' ? p.picture : undefined,
  };
}

/**
 * Whether the signed-in person is an owner (verified email listed in ADMIN_EMAILS): reads content reports, has every
 * lesson open with no order or daily limits, and no tutor or report caps.
 */
export function isAdmin(s: Pick<Session, 'email'> | null, env: Env): boolean {
  if (!s?.email) return false;
  const list = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(s.email.trim().toLowerCase());
}
