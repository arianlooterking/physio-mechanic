import { useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { fmt } from '../lib/digits';
import { isApp, native, SITE } from '../lib/platform';
import { sfx } from '../lib/sound';
import { useAppState } from '../lib/store';
import { fullDate } from '../lib/time';
import { nativeStore, STORES, useNative } from './state';

const HOURS = [8, 10, 12, 14, 16, 17, 18, 19, 20, 21, 22];
const clock = (h: number, m: number) => `${fmt(h)}:${fmt(m).padStart(2, '۰')}`;
const faVersion = (v: string) => v.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

/**
 * «بیومانا را به دوستت معرفی کن»: the phone's share sheet in the app, the browser's one (or a copied link) on the site.
 * A store install shares the app's page in its store.
 */
export async function shareApp() {
  const url = STORES[nativeStore.getState().channel]?.url ?? SITE;
  const p = { title: 'بیومانا', text: 'بیومانا: درس‌های دبیرستان را قدم‌به‌قدم و بازی‌وار بفهم، با توضیح چندباره تا وقتی واقعاً جا بیفتد.', url };
  try {
    if (native.share) await native.share(p);
    else if (navigator.share) await navigator.share(p);
    else await navigator.clipboard?.writeText(`${p.text}\n${p.url}`);
  } catch {
    /* closed the share sheet */
  }
}

/**
 * One banner on the home screen, inside the apps only: a downloaded update ready to open, a newer APK, or (once,
 * after the first points) the offer of a daily reminder.
 */
export function AppBanner() {
  const n = useNative();
  const xp = useAppState().xp.total;
  const [hidden, setHidden] = useState<string | null>(null);
  if (!isApp) return null;
  let id: string, title: string, line: string, action: string, go: () => void, icon: IconName = 'sparkles';
  if (n.apk) {
    id = 'apk';
    const apk = n.apk;
    title = apk.required ? 'برای درس‌های تازه، اپ را به‌روز کن' : 'نسخهٔ تازهٔ اپ بیومانا آمده';
    line = apk.store
      ? `نسخهٔ تازهٔ اپ را از ${apk.store} بگیر؛ پیشرفتت سر جایش می‌ماند.`
      : `نسخهٔ ${faVersion(apk.versionName)} را از سایت بگیر و روی همین اپ نصبش کن؛ پیشرفتت سر جایش می‌ماند.`;
    action = apk.store ? 'به‌روزرسانی' : 'دانلود';
    go = () => n.openUrl(apk.store ? apk.url : `${SITE}/app/`);
    icon = 'download';
  } else if (n.update.status === 'ready') {
    id = 'ready';
    title = 'بیومانا تازه شد';
    line = 'درس‌ها و بخش‌های تازه آماده است؛ دفعهٔ بعد که اپ را باز کنی می‌آید، یا همین الان.';
    action = 'الان';
    go = () => void n.applyNow();
  } else if (!n.reminder.asked && !n.reminder.on && xp >= 10) {
    id = 'remind';
    title = 'یادت بیندازم؟';
    line = `هر روز ساعت ${clock(n.reminder.hour, n.reminder.minute)}، اگر هنوز درس نخوانده باشی، یک یادآوری کوچک می‌فرستم.`;
    action = 'آره';
    go = () => void n.setReminder({ on: true });
    icon = 'clock';
  } else return null;
  if (hidden === id) return null;
  const close = () => {
    setHidden(id);
    if (id === 'remind') void n.setReminder({ on: false });
  };
  return (
    <div className="card save-nudge app-banner">
      <span className="save-nudge-g" style={{ background: 'var(--surface)', color: 'var(--primary)' }}>
        <Icon name={icon} size={22} />
      </span>
      <div className="grow">
        <b>{title}</b>
        <div className="small muted">{line}</div>
      </div>
      <div className="save-nudge-actions">
        <button
          className="btn sm"
          onClick={() => {
            sfx.tap();
            go();
          }}
        >
          {action}
        </button>
        <button className="icon-btn" onClick={close} aria-label="بستن">
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  );
}

const STATUS: Record<string, string> = {
  idle: '',
  checking: 'در حال بررسی…',
  downloading: 'نسخهٔ تازه دارد دانلود می‌شود…',
  ready: 'نسخهٔ تازه آماده است.',
  latest: 'تازه‌ترین نسخه را داری.',
  offline: 'اینترنت وصل نیست؛ اپ بدون اینترنت هم کار می‌کند.',
  error: 'الان نشد بررسی کنم؛ بعداً خودش دوباره امتحان می‌کند.',
};

/** Profile's «اپ بیومانا» card in the apps: version and updates, the daily reminder, sharing */
export function AppCard() {
  const n = useNative();
  const [denied, setDenied] = useState(false);
  if (!isApp) return null;
  const r = n.reminder;
  const busy = n.update.status === 'checking' || n.update.status === 'downloading';
  const toggle = async () => {
    sfx.tap();
    const ok = await n.setReminder({ on: !r.on });
    setDenied(!ok && !r.on);
  };
  return (
    <>
      <h2 className="section-title">اپ بیومانا</h2>
      <div className="card">
        <div className="setting" style={{ flexWrap: 'wrap' }}>
          <div className="s-txt">
            <b>یادآوری روزانه</b>
            <span>اگر هدف امروزت را زده باشی، آن روز چیزی نمی‌فرستم.</span>
          </div>
          <button className="switch" role="switch" aria-checked={r.on} aria-label="یادآوری روزانه" onClick={() => void toggle()} />
          {r.on && (
            <div className="row" style={{ width: '100%', gap: 8 }}>
              <span className="small muted">ساعت</span>
              <select className="text-input" style={{ maxWidth: 140 }} value={r.hour} onChange={(e) => void n.setReminder({ hour: Number(e.target.value), minute: 0 })} aria-label="ساعت یادآوری">
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {clock(h, 0)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {denied && <p className="small muted" style={{ width: '100%' }}>اجازهٔ اعلان داده نشد. از تنظیمات گوشی، اعلان‌های بیومانا را روشن کن و دوباره امتحان کن.</p>}
        </div>

        <div className="setting" style={{ flexWrap: 'wrap' }}>
          <div className="s-txt">
            <b>نسخه</b>
            <span>
              اپ {faVersion(n.appVersion || '1')}
              {n.bundle ? ` · درس‌ها ${fullDate(Date.parse(n.bundle.builtAt))}` : ''}
            </span>
          </div>
          <p className="small muted" style={{ width: '100%' }}>
            درس‌ها و بخش‌های تازهٔ سایت خودبه‌خود به اپ هم می‌رسند؛ لازم نیست هر بار اپ را دوباره نصب کنی.
          </p>
          {STATUS[n.update.status] && <p className="small" style={{ width: '100%' }}>{STATUS[n.update.status]}</p>}
          <div className="row wrap" style={{ width: '100%' }}>
            {n.update.status === 'ready' ? (
              <button className="btn sm" onClick={() => void n.applyNow()}>
                <Icon name="sparkles" size={18} /> باز کردن نسخهٔ تازه
              </button>
            ) : (
              <button
                className="btn sm ghost"
                disabled={busy}
                onClick={() => {
                  sfx.tap();
                  void n.checkNow();
                }}
              >
                <Icon name="refresh" size={18} /> بررسی به‌روزرسانی
              </button>
            )}
            {n.apk && (
              <button className="btn sm ghost" onClick={() => n.openUrl(n.apk?.store ? n.apk.url : `${SITE}/app/`)}>
                <Icon name="download" size={18} /> {n.apk.store ? `به‌روزرسانی در ${n.apk.store}` : `اپ ${faVersion(n.apk.versionName)}`}
              </button>
            )}
          </div>
        </div>

        <div className="setting">
          <div className="s-txt">
            <b>بیومانا را به دوستانت معرفی کن</b>
          </div>
          <button
            className="btn sm ghost"
            onClick={() => {
              sfx.tap();
              void shareApp();
            }}
          >
            <Icon name="send" size={18} /> اشتراک
          </button>
        </div>
      </div>
    </>
  );
}
