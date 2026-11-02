import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { BrandMark, Mascot } from '../components/Mascot';
import {
  APPLE_START,
  appleOn,
  appSignInVia,
  promptOneTap,
  renderGoogleButton,
  signInRedirectFailed,
  startAppSignIn,
  useAccount,
  useAppSignIn,
} from '../lib/account';
import { go } from '../lib/nav';
import { appPlatform, isApp, SITE } from '../lib/platform';
import { useAppState } from '../lib/store';
import { nativeStore, useNative } from '../native/state';
import { AppleLogo } from './AppleLogo';
import { GoogleG } from './GoogleG';
import './landing.css';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Sign in with Google (or Apple, once it is switched on), or continue as a guest. */
export function Login() {
  const s = useAppState();
  const { account } = useAccount();
  const slot = useRef<HTMLDivElement>(null);
  const [google, setGoogle] = useState<'loading' | 'ready' | 'off' | 'error'>('loading');
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);
  // also: back from Apple's page without signing in
  const [failed, setFailed] = useState(signInRedirectFailed);

  useEffect(() => {
    let live = true;
    void appleOn().then((on) => live && setApple(on));
    return () => {
      live = false;
    };
  }, []);

  // Already signed in (or just finished): continue into the app.
  useEffect(() => {
    if (account) go(s.profile.onboarded ? { name: 'home' } : { name: 'start' }, true);
  }, [account, s.profile.onboarded]);

  useEffect(() => {
    let live = true;
    const el = slot.current;
    if (!el || isApp) return;
    const width = Math.min(320, Math.max(220, el.clientWidth || 300));
    renderGoogleButton(
      el,
      (ok) => {
        setBusy(false);
        setFailed(!ok);
      },
      width,
    )
      .then((on) => {
        if (!live) return;
        setGoogle(on ? 'ready' : 'off');
        if (on) promptOneTap();
      })
      .catch(() => live && setGoogle('error'));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="fl-login">
      <div className="fl-dark-bg" aria-hidden="true">
        <div className="fl-aurora a" />
        <div className="fl-aurora b" />
        <div className="fl-aurora c" />
        <div className="fl-grid" />
      </div>
      <button type="button" className="fl-login-back" onClick={() => go({ name: 'welcome' })} aria-label="بازگشت به صفحهٔ معرفی">
        <Icon name="back" size={20} />
        <span>صفحهٔ معرفی</span>
      </button>
      <motion.div className="fl-login-card" initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: EASE }}>
        <div className="fl-login-mascot" aria-hidden="true">
          <Mascot mood="cheer" size={120} />
        </div>
        <div className="fl-login-brand">
          <BrandMark size={30} />
          <b>بیومانا</b>
        </div>
        <h1>خوش آمدی!</h1>
        <p className="fl-login-sub">
          با حساب {apple ? 'گوگل یا اپل' : 'گوگل'} وارد شو تا پیشرفتت روی گوشی و رایانه با هم باشد، یا بدون حساب شروع کن.
        </p>

        <div className="fl-login-google">
          {isApp && <AppButtons apple={apple} />}
          <div ref={slot} className="fl-gsi" aria-busy={busy} onClick={() => setBusy(true)} hidden={isApp} />
          {google === 'loading' && !isApp && <div className="fl-gsi-skeleton" aria-hidden="true" />}
          {apple && !isApp && (
            <a className="fl-abtn" href={APPLE_START}>
              <AppleLogo size={18} />
              <span>ادامه با اپل</span>
            </a>
          )}
          {google === 'off' && (
            <p className="fl-login-note">
              <Icon name="info" size={16} /> ورود با گوگل هنوز روی این نشانی فعال نشده است. فعلاً بدون حساب شروع کن؛ بعداً از صفحهٔ «من» وارد می‌شوی و پیشرفتت منتقل می‌شود.
            </p>
          )}
          {google === 'error' && (
            <p className="fl-login-note">
              <Icon name="info" size={16} /> دکمهٔ گوگل بار نشد. اینترنت را بررسی کن یا بدون حساب ادامه بده.
            </p>
          )}
          {failed && (
            <p className="fl-login-note bad" role="alert">
              <Icon name="info" size={16} /> ورود انجام نشد. دوباره امتحان کن.
            </p>
          )}
        </div>

        <div className="fl-or">
          <span>یا</span>
        </div>

        <button type="button" className="fl-btn ink lg block" onClick={() => go(s.profile.onboarded ? { name: 'home' } : { name: 'start' })}>
          {s.profile.onboarded ? 'ادامه بدون حساب' : 'شروع بدون حساب'} <Icon name="next" size={18} />
        </button>

        <ul className="fl-login-points">
          <li>
            <Icon name="shield" size={16} /> فقط نام، ایمیل و تصویر حساب برای شناختنت خوانده می‌شود.
          </li>
          <li>
            <Icon name="cards" size={16} /> بدون حساب هم همه‌چیز کار می‌کند و روی همین دستگاه می‌ماند.
          </li>
        </ul>
        <p className="fl-login-legal">
          با ورود، <a href="#/terms">شرایط استفاده</a> و <a href="#/privacy">حریم خصوصی</a> بیومانا را می‌پذیری.
        </p>
      </motion.div>
    </div>
  );
}

/**
 * In the apps Google's web button can't run, so this one opens Google sign-in on the website in the phone's browser;
 * the browser sends the learner back to the app signed in (src/native/signin.ts). Apple: its own sheet on iPhone,
 * the browser on Android.
 */
function AppButtons({ apple }: { apple: boolean }) {
  const st = useAppSignIn();
  const via = appSignInVia();
  const { appleSignIn } = useNative();
  const canApple = apple && Boolean(appleSignIn);
  if (st === 'update') {
    return (
      <p className="fl-login-note">
        <Icon name="info" size={16} />
        <span>
          برای ورود با گوگل، نسخهٔ تازهٔ اپ بیومانا لازم است.{' '}
          <button type="button" className="fl-link" onClick={() => nativeStore.getState().openUrl(`${SITE}/app/`)}>
            دریافت نسخهٔ تازه
          </button>
        </span>
      </p>
    );
  }
  return (
    <>
      <button type="button" className="fl-gbtn" disabled={st === 'working'} aria-busy={st === 'working' && via === 'google'} onClick={() => void startAppSignIn('google')}>
        <GoogleG size={20} />
        <span>{st === 'working' && via === 'google' ? 'در حال ورود…' : 'ادامه با حساب گوگل'}</span>
      </button>
      {canApple && (
        <button type="button" className="fl-abtn" disabled={st === 'working'} aria-busy={st === 'working' && via === 'apple'} onClick={() => void startAppSignIn('apple')}>
          <AppleLogo size={18} />
          <span>{st === 'working' && via === 'apple' ? 'در حال ورود…' : 'ادامه با اپل'}</span>
        </button>
      )}
      {st === 'waiting' && (via === 'google' || appPlatform !== 'ios') && (
        <p className="fl-login-note">
          <Icon name="info" size={16} /> در مرورگر با حساب {via === 'apple' ? 'اپلت' : 'گوگلت'} وارد شو؛ بعد خودش به اپ برمی‌گردی.
        </p>
      )}
      {st === 'failed' && (
        <p className="fl-login-note bad" role="alert">
          <Icon name="info" size={16} /> ورود انجام نشد. دوباره امتحان کن.
        </p>
      )}
    </>
  );
}
