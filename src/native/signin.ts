/**
 * Google sign-in inside the app. Google's web sign-in doesn't run in an app's WebView, so the app opens the website's
 * /app/login.html in the phone's browser (a Custom Tab on Android, Safari's sheet on iOS) with a PKCE challenge. The
 * page signs in with Google and sends the learner back to com.biomana.app://signin?code=…; the app then swaps the code
 * and the verifier, which never left the phone, for its session token (POST /api/app-token, worker/index.ts).
 * Sign in with Apple: on Android the same way through the site's /api/apple-start; on iPhone Apple's own sheet (the
 * app's AppleSignIn plugin, ios/App/App/AppleSignIn.swift) and POST /api/apple-token (worker/apple.ts).
 */
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { acceptAppSignIn, getAppSignIn, setAppSignIn } from '../lib/account';
import { SITE } from '../lib/platform';

const RETURN = /^com\.biomana\.app:\/\/signin\/?\?(.*)$/;
const PENDING_KEY = 'biomana:signin-pending';
/** a sign-in left open longer than this starts over (the server's code lasts 5 minutes) */
const PENDING_MS = 15 * 60_000;

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const sha256 = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

async function open(via: 'google' | 'apple'): Promise<void> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(await sha256(verifier));
  // kept on disk: Android may close the app while the browser is open, and the answer then starts it afresh
  localStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, at: Date.now() }));
  await Browser.open({ url: via === 'apple' ? `${SITE}/api/apple-start?ch=${challenge}` : `${SITE}/app/login.html?ch=${challenge}` });
}

const AppleSignIn = registerPlugin<{ authorize(o: { nonce: string }): Promise<{ identityToken: string; name?: string }> }>('AppleSignIn');

/** iPhone: Apple's own sheet. Its token carries SHA-256 of a nonce that only this app knows; the site checks both. */
async function appleSheet(): Promise<void> {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const hashed = [...(await sha256(nonce))].map((b) => b.toString(16).padStart(2, '0')).join('');
  let res: { identityToken: string; name?: string };
  try {
    res = await AppleSignIn.authorize({ nonce: hashed });
  } catch (err) {
    return setAppSignIn((err as { code?: string }).code === 'canceled' ? 'idle' : 'failed');
  }
  setAppSignIn('working');
  try {
    const r = await fetch(`${SITE}/api/apple-token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: res.identityToken, nonce, name: res.name ?? '' }),
      credentials: 'omit',
    });
    if (!r.ok) throw new Error(`apple-token ${r.status}`);
    acceptAppSignIn(await r.json());
  } catch {
    setAppSignIn('failed');
  }
}

async function finish(url: string): Promise<void> {
  const m = RETURN.exec(url);
  if (!m) return;
  // iOS: close Safari's sheet (on Android the app is already in front of the Custom Tab)
  void Browser.close().catch(() => {});
  const code = new URLSearchParams(m[1]).get('code');
  type Pending = { verifier?: string; at?: number };
  const pending = ((): Pending | null => {
    try {
      return JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as Pending | null;
    } catch {
      return null; // unreadable: start over
    }
  })();
  localStorage.removeItem(PENDING_KEY);
  if (!code || !pending?.verifier || Date.now() - (pending.at ?? 0) > PENDING_MS) return setAppSignIn('failed');
  setAppSignIn('working');
  try {
    const r = await fetch(`${SITE}/api/app-token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, verifier: pending.verifier }),
      credentials: 'omit',
    });
    if (!r.ok) throw new Error(`app-token ${r.status}`);
    acceptAppSignIn(await r.json());
  } catch {
    setAppSignIn('failed');
  }
}

/** Listens for the browser's answer (also one that started the app) and gives back what starts each sign-in. */
export async function startSignIn(): Promise<{ google: () => Promise<void>; apple: () => Promise<void> }> {
  void App.addListener('appUrlOpen', ({ url }) => void finish(url));
  // the browser closed without signing in: back to the button (an answer on its way arrives well within the wait)
  void Browser.addListener('browserFinished', () => {
    setTimeout(() => {
      if (getAppSignIn() === 'waiting') setAppSignIn('idle');
    }, 1500);
  });
  const launch = await App.getLaunchUrl().catch(() => undefined);
  if (launch?.url) void finish(launch.url);
  const sheet = Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('AppleSignIn');
  return { google: () => open('google'), apple: sheet ? appleSheet : () => open('apple') };
}
