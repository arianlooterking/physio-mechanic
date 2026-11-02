/**
 * Calls to the Worker's /api/*. On the website they go to the same site with its session cookie. The phone apps load
 * their files from app.biomana.com, so they call the site's full address and sign in with their own token
 * (`Authorization: Bearer`), which they get from the in-browser Google sign-in (src/native/signin.ts) and keep here.
 */
import { isApp, SITE } from './platform';

const TOKEN_KEY = 'biomana:app-token';

export function appToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAppToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: this visit still has the token in the request it came with */
  }
}

/** The headers that carry the session in the apps (none on the website, where the cookie does it). */
export function authHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const token = isApp ? appToken() : null;
  if (token) headers.set('authorization', `Bearer ${token}`);
  return headers;
}

/** fetch() for an /api/ path. */
export function api(path: string, init: RequestInit = {}): Promise<Response> {
  if (!isApp) return fetch(path, { credentials: 'same-origin', ...init });
  return fetch(SITE + path, { ...init, headers: authHeaders(init.headers), credentials: 'omit' });
}
