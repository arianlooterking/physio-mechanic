import { useEffect, useMemo, useRef, useState } from 'react';
import { LESSONS } from '../content';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { Confirm } from '../components/ui';
import { detectTutor, type TutorProvider } from '../lib/ai';
import { fmt } from '../lib/digits';
import { deleteCloudCopy, myDataJson, signOut, useAccount } from '../lib/account';
import { lessonProgress } from '../lib/learner';
import { go, toast } from '../lib/nav';
import { isApp, native } from '../lib/platform';
import { AppCard } from '../native/AppCards';
import { levelInfo, type AppState } from '../lib/state';
import {
  BACKUP_MAX_BYTES,
  exportJson,
  getState,
  readBackup,
  replaceState,
  resetState,
  storageWorks,
  update,
  useAppState,
  type BackupProblem,
} from '../lib/store';
import { fullDate } from '../lib/time';

export const GOALS = [
  { xp: 15, label: 'آرام', sub: 'حدود ۵ دقیقه در روز' },
  { xp: 30, label: 'منظم', sub: 'حدود ۱۰ دقیقه در روز' },
  { xp: 60, label: 'جدی', sub: 'حدود ۲۰ دقیقه در روز' },
  { xp: 100, label: 'کنکوری', sub: 'حدود ۳۰ دقیقه در روز' },
];

const RESTORE_PROBLEM: Record<BackupProblem | 'big' | 'read', string> = {
  json: 'این فایل خوانده نشد. فایلی را انتخاب کن که با «گرفتن پشتیبان» یا «دریافت داده‌های من» گرفته‌ای.',
  'not-biomana': 'این فایل پشتیبان بیومانا نیست. فایلی را انتخاب کن که با «گرفتن پشتیبان» یا «دریافت داده‌های من» گرفته‌ای.',
  newer: 'این فایل را نسخهٔ تازه‌تری از بیومانا ساخته. اول بیومانا را به‌روز کن، بعد دوباره امتحان کن.',
  broken: 'این فایل ناقص یا خراب است و نمی‌شود پیشرفت را از آن برگرداند.',
  big: 'این فایل برای پشتیبان بیومانا زیادی بزرگ است. فایلی را انتخاب کن که با «گرفتن پشتیبان» گرفته‌ای.',
  read: 'فایل باز نشد؛ دوباره امتحان کن.',
};

function saveFile(text: string, name: string) {
  // in the apps a download link does nothing: the file goes to the phone's share sheet (Files, Drive, a chat)
  if (native.saveFile) {
    void native.saveFile(name, text).catch(() => {});
    return;
  }
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function Profile() {
  const s = useAppState();
  const { account } = useAccount();
  const [name, setName] = useState(s.profile.name);
  const [confirmReset, setConfirmReset] = useState(false);
  const [provider, setProvider] = useState<TutorProvider | null>(null);
  const [exporting, setExporting] = useState(false);
  const [restore, setRestore] = useState<{ state: AppState; exportedAt: number | null } | null>(null);
  const [restoreError, setRestoreError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const lv = levelInfo(s.xp.total);

  useEffect(() => {
    void detectTutor().then(setProvider);
  }, []);

  const save = () => {
    const n = name.trim().slice(0, 30);
    update((st) => {
      st.profile.name = n;
    });
    toast('ذخیره شد');
  };

  const today = () => new Date().toISOString().slice(0, 10);
  const download = () => saveFile(exportJson(), `biomana-backup-${today()}.json`);
  const downloadMyData = async () => {
    setExporting(true);
    const text = await myDataJson();
    setExporting(false);
    saveFile(text, `biomana-my-data-${today()}.json`);
  };
  // In the apps too: the WebView opens the phone's file picker (Files, Drive) for a file input.
  const pickRestore = async (f: File) => {
    setRestoreError('');
    if (f.size > BACKUP_MAX_BYTES) return setRestoreError(RESTORE_PROBLEM.big);
    let text: string;
    try {
      text = await f.text();
    } catch {
      return setRestoreError(RESTORE_PROBLEM.read);
    }
    const r = readBackup(text);
    if (r.ok) setRestore({ state: r.state, exportedAt: r.exportedAt });
    else setRestoreError(RESTORE_PROBLEM[r.problem]);
  };

  return (
    <div className="stack">
      <div className="card row" style={{ gap: 16 }}>
        <Mascot mood="wink" size={74} />
        <div className="grow">
          <h1 style={{ fontSize: '1.35rem' }}>{s.profile.name || 'دانشجوی بیومانا'}</h1>
          <div className="small muted">
            سطح {fmt(lv.level)} · {fmt(s.xp.total)} امتیاز · عضو از {fullDate(s.profile.createdAt)}
          </div>
        </div>
      </div>

      <AccountCard />

      <h2 className="section-title">تنظیمات</h2>
      <div className="card">
        <div className="setting" style={{ flexWrap: 'wrap' }}>
          <div className="s-txt">
            <b>نام</b>
            <span>برای اینکه بیو صدایت کند</span>
          </div>
          <div className="row" style={{ width: '100%' }}>
            <input className="text-input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="اسمت را بنویس" aria-label="نام" />
            <button className="btn sm" onClick={save} disabled={name.trim() === s.profile.name}>
              ذخیره
            </button>
          </div>
        </div>
        <div className="setting" style={{ flexWrap: 'wrap' }}>
          <div className="s-txt">
            <b>هدف روزانه</b>
            <span>هر روز چقدر بخوانی؟</span>
          </div>
          <div className="seg" style={{ width: '100%' }}>
            {GOALS.map((g) => (
              <button key={g.xp} aria-pressed={s.profile.goal === g.xp} onClick={() => update((st) => void (st.profile.goal = g.xp))}>
                {g.label} · {fmt(g.xp)}
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <div className="s-txt">
            <b>صداها</b>
            <span>صدای جواب درست، غلط و پایان جلسه</span>
          </div>
          <button
            className="switch"
            role="switch"
            aria-checked={s.profile.sound}
            aria-label="صداها"
            onClick={() => update((st) => void (st.profile.sound = !st.profile.sound))}
          />
        </div>
        <div className="setting" style={{ flexWrap: 'wrap' }}>
          <div className="s-txt">
            <b>ظاهر</b>
            <span>روشن، تیره یا مطابق دستگاه</span>
          </div>
          <div className="seg">
            {(
              [
                ['system', 'خودکار'],
                ['light', 'روشن'],
                ['dark', 'تیره'],
              ] as const
            ).map(([v, label]) => (
              <button key={v} aria-pressed={s.profile.theme === v} onClick={() => update((st) => void (st.profile.theme = v))}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AppCard />

      <h2 className="section-title">معلم هوش مصنوعی (بیو)</h2>
      <div className="card row" style={{ alignItems: 'flex-start' }}>
        <span className={`chip ${provider === 'offline' ? '' : provider ? 'ok' : ''}`}>
          {provider === null ? 'در حال بررسی' : provider === 'offline' ? 'آفلاین' : 'آنلاین'}
        </span>
        <p className="small grow" style={{ color: 'var(--ink-2)' }}>
          {provider === 'artifact'
            ? 'بیو از طریق حساب Claude خودت پاسخ می‌دهد. اولین بار از تو اجازه گرفته می‌شود.'
            : provider === 'server'
              ? account
                ? 'بیو به سرور هوش مصنوعی بیومانا وصل است.'
                : 'بیو به سرور هوش مصنوعی بیومانا وصل است. برای گفت‌وگو با فهمی، با حساب گوگل وارد شو.'
              : 'بیو الان به هوش مصنوعی وصل نیست. همهٔ توضیح‌های چندگانه، تمرین‌ها و آزمون‌ها بدون اینترنتِ هوش مصنوعی کار می‌کنند. وقتی سرور بیو راه‌اندازی شود، دکمه‌های «از بیو بپرس» هم فعال می‌شوند.'}
        </p>
      </div>

      <h2 className="section-title">داده‌های تو</h2>
      <div className="card">
        {!storageWorks() && (
          <div className="note warn" style={{ marginBottom: 10 }}>
            <Icon name="info" className="n-ic" size={20} />
            <div>مرورگر اجازهٔ ذخیره نمی‌دهد (مثلاً حالت ناشناس). پیشرفتت بعد از بستن صفحه از بین می‌رود؛ از «پشتیبان» استفاده کن.</div>
          </div>
        )}
        <p className="small muted" style={{ marginBottom: 10 }}>
          {account
            ? 'پیشرفتت روی همین دستگاه و در حسابت ذخیره می‌شود. «پشتیبان» فایلی برای بازگردانی است؛ «داده‌های من» همهٔ چیزهایی را که بیومانا از تو نگه می‌دارد (روی این دستگاه و در حساب) در یک فایل می‌دهد.'
            : 'پیشرفت تو فقط روی همین دستگاه ذخیره می‌شود. برای انتقال به دستگاه دیگر، فایل پشتیبان بگیر و آنجا بازگردانی کن. «داده‌های من» همهٔ چیزهایی را که بیومانا از تو نگه می‌دارد در یک فایل می‌دهد.'}
        </p>
        <div className="row wrap">
          <button className="btn sm ghost" onClick={download}>
            <Icon name="download" size={18} /> گرفتن پشتیبان
          </button>
          <button className="btn sm ghost" onClick={() => void downloadMyData()} disabled={exporting}>
            <Icon name="download" size={18} /> {exporting ? 'در حال آماده کردن…' : 'دریافت داده‌های من'}
          </button>
          <button className="btn sm ghost" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} /> بازگردانی از فایل
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void pickRestore(f);
            }}
          />
          <button className="btn sm bad" onClick={() => setConfirmReset(true)}>
            <Icon name="trash" size={18} /> شروع از صفر
          </button>
        </div>
        {restoreError && (
          <div className="note warn" role="alert" style={{ marginTop: 10 }}>
            <Icon name="info" className="n-ic" size={20} />
            <div className="small">{restoreError}</div>
          </div>
        )}
      </div>

      {restore && (
        <RestoreConfirm
          file={restore.state}
          exportedAt={restore.exportedAt}
          current={s}
          signedIn={Boolean(account)}
          onYes={() => {
            replaceState(restore.state);
            setRestore(null);
            // signed in: the store change starts the usual upload, so the account gets this copy too
            toast(account ? 'پیشرفتت از فایل برگشت و در حسابت هم ذخیره می‌شود.' : 'پیشرفتت از فایل برگشت.', 3500);
          }}
          onNo={() => setRestore(null)}
        />
      )}


      {confirmReset && (
        <Confirm
          title="همه‌چیز پاک شود؟"
          text="امتیاز، زنجیره، پیشرفت درس‌ها، کارت‌ها و دفتر اشتباه‌ها همه پاک می‌شوند. این کار برگشت‌پذیر نیست؛ اگر لازم داری اول پشتیبان بگیر."
          yes="بله، از صفر شروع کن"
          no="نه"
          danger
          onYes={() => {
            resetState();
            setConfirmReset(false);
            location.hash = '#/';
          }}
          onNo={() => setConfirmReset(false)}
        />
      )}
      <h2 className="section-title">دربارهٔ بیومانا</h2>
      <div className="card row about-links" style={{ flexWrap: 'wrap', gap: 8 }}>
        <a className="btn sm ghost" href="#/welcome">
          صفحهٔ معرفی
        </a>
        <a className="btn sm ghost" href="#/privacy">
          حریم خصوصی
        </a>
        <a className="btn sm ghost" href="#/terms">
          شرایط استفاده
        </a>
      </div>
    </div>
  );
}

const lessonsDone = (st: AppState) => LESSONS.filter((l) => lessonProgress(st, l) >= 1).length;

/** «بازگردانی از فایل»: what the file holds next to what is here now, before the progress is replaced. */
function RestoreConfirm({
  file,
  exportedAt,
  current,
  signedIn,
  onYes,
  onNo,
}: {
  file: AppState;
  exportedAt: number | null;
  current: AppState;
  signedIn: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  const doneHere = useMemo(() => lessonsDone(current), [current]);
  const doneFile = useMemo(() => lessonsDone(file), [file]);
  const behind = file.xp.total < current.xp.total;
  return (
    <Confirm
      title="پیشرفت از این فایل برگردد؟"
      text={
        <div className="stack" style={{ gap: 10 }}>
          <table className="restore-cmp">
            <thead>
              <tr>
                <td />
                <th scope="col">الان</th>
                <th scope="col">در فایل</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">امتیاز</th>
                <td>{fmt(current.xp.total)}</td>
                <td className={behind ? 'down' : ''}>{fmt(file.xp.total)}</td>
              </tr>
              <tr>
                <th scope="row">درس تمام‌شده</th>
                <td>{fmt(doneHere)}</td>
                <td className={doneFile < doneHere ? 'down' : ''}>{fmt(doneFile)}</td>
              </tr>
            </tbody>
          </table>
          {exportedAt !== null && <p className="small muted" style={{ margin: 0 }}>این فایل را {fullDate(exportedAt)} گرفته‌ای.</p>}
          <p className="small" style={{ margin: 0 }}>
            {behind && <b>امتیاز این فایل از امتیاز الانت کمتر است. </b>}
            پیشرفت این دستگاه با پیشرفت فایل عوض می‌شود و این کار برگشت ندارد.
            {signedIn ? ' نسخهٔ حسابت هم با همین فایل به‌روز می‌شود.' : ''}
          </p>
        </div>
      }
      yes="بله، برگردان"
      no="انصراف"
      danger={behind}
      onYes={onYes}
      onNo={onNo}
    />
  );
}

function AccountCard() {
  const { account, sync } = useAccount();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [confirmOutAll, setConfirmOutAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const away = sync === 'offline' || sync === 'later' || sync === 'expired';
  return (
    <div className="card account-card">
      {account ? (
        <>
          <div className="row" style={{ gap: 12 }}>
            {account.picture ? (
              <img className="account-pic" src={account.picture} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="account-pic">{account.name.slice(0, 1)}</span>
            )}
            <div className="grow" style={{ minWidth: 0 }}>
              <b>{account.name || (account.kind === 'apple' ? 'حساب اپل' : 'حساب گوگل')}</b>
              <div className="small muted account-mail" dir="ltr">
                {account.email}
              </div>
            </div>
            <span className={`chip ${away ? '' : 'ok'}`}>
              {sync === 'saving' ? 'در حال ذخیره…' : away ? 'ذخیره روی دستگاه' : 'همگام با حساب'}
            </span>
          </div>
          <p className="small muted" style={{ margin: '10px 0 12px' }}>
            {sync === 'expired'
              ? 'نشست حسابت روی این دستگاه تمام شده است (مثلاً بعد از «خروج از همهٔ دستگاه‌ها»). پیشرفتت روی همین دستگاه می‌ماند؛ دوباره وارد شو تا با حساب همگام شود.'
              : sync === 'later'
                ? 'سرور الان شلوغ است. پیشرفتت روی همین دستگاه ذخیره شده و کمی بعد خودش در حسابت هم ذخیره می‌شود.'
                : sync === 'offline'
                  ? 'الان به حسابت وصل نیستیم؛ پیشرفت روی این دستگاه ذخیره می‌شود. اگر این وضع ماند، یک بار خارج و دوباره وارد شو.'
                  : 'پیشرفتت در حسابت هم ذخیره می‌شود و روی هر دستگاهی که وارد شوی، ادامه پیدا می‌کند.'}
          </p>
          {account.owner && (
            <div className="owner-note small">
              <b>حساب مدیر:</b> همهٔ درس‌ها و بخش‌ها بدون ترتیب باز است، توضیح‌ها قفل نیستند، چالش امروز را هر چند بار بخواهی می‌زنی و
              برای سؤال از بیو و گزارش اشکال سقفی نیست.{' '}
              <button className="link-btn" onClick={() => go({ name: 'admin' })}>
                گزارش‌های اشکال
              </button>
            </div>
          )}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {sync === 'expired' && (
              <button
                className="btn sm"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void signOut().then(() => {
                    setBusy(false);
                    go({ name: 'login' });
                  });
                }}
              >
                ورود دوباره
              </button>
            )}
            <button className="btn sm ghost" disabled={busy} onClick={() => setConfirmOut(true)}>
              خروج از حساب
            </button>
            {account.kind === 'google' && (
              <button className="btn sm ghost" disabled={busy} onClick={() => setConfirmOutAll(true)}>
                خروج از همهٔ دستگاه‌ها
              </button>
            )}
            <button className="btn sm ghost" disabled={busy} onClick={() => setConfirmDelete(true)}>
              پاک کردن نسخهٔ حساب
            </button>
          </div>
        </>
      ) : (
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="grow" style={{ minWidth: 200 }}>
            <b>بدون حساب</b>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              {isApp
                ? 'پیشرفتت فقط روی همین گوشی است. با حساب گوگل وارد شو تا در حسابت هم ذخیره شود و روی سایت و گوشی‌های دیگر ادامه پیدا کند.'
                : 'پیشرفتت فقط روی همین دستگاه است. با حساب گوگل وارد شو تا روی گوشی و رایانه با هم باشد.'}
            </p>
          </div>
          <button className="btn sm" onClick={() => go({ name: 'login' })}>
            ورود با گوگل
          </button>
        </div>
      )}
      {confirmOut && (
        <Confirm
          title="از حساب خارج می‌شوی؟"
          text="پیشرفتت در حساب می‌ماند و هر وقت دوباره وارد شوی برمی‌گردد. روی این دستگاه به حالت بدون حساب می‌روی."
          yes="خروج"
          no="انصراف"
          onYes={() => {
            setConfirmOut(false);
            setBusy(true);
            void signOut().then(() => {
              setBusy(false);
              toast('از حساب خارج شدی');
            });
          }}
          onNo={() => setConfirmOut(false)}
        />
      )}
      {confirmOutAll && (
        <Confirm
          title="از همهٔ دستگاه‌ها خارج می‌شوی؟"
          text="روی همهٔ گوشی‌ها و رایانه‌هایی که با این حساب وارد شده‌ای، از حساب خارج می‌شوی؛ این کار تا یک دقیقه طول می‌کشد. پیشرفتت در حساب می‌ماند و با ورود دوباره برمی‌گردد. اگر فکر می‌کنی کس دیگری به حسابت دسترسی داشته، این کار را بکن."
          yes="خروج از همه"
          no="انصراف"
          danger
          onYes={() => {
            setConfirmOutAll(false);
            setBusy(true);
            void signOut({ everywhere: true }).then((r) => {
              setBusy(false);
              toast(
                r === 'ok'
                  ? 'از همهٔ دستگاه‌ها خارج شدی'
                  : r === 'session-ended'
                    ? 'نشست این دستگاه پیش‌تر تمام شده بود. دوباره وارد شو و این کار را تکرار کن.'
                    : 'انجام نشد؛ اینترنت را بررسی کن و دوباره امتحان کن',
                4000,
              );
            });
          }}
          onNo={() => setConfirmOutAll(false)}
        />
      )}
      {confirmDelete && (
        <Confirm
          title="نسخهٔ حساب از سرور پاک شود؟"
          text="پیشرفتی که بیومانا برای این حساب روی سرور نگه داشته برای همیشه پاک می‌شود و از حساب خارج می‌شوی. پیشرفت روی همین دستگاه می‌ماند و خود حساب گوگل یا اپلت دست نمی‌خورد. اگر بعداً دوباره وارد شوی، پیشرفت همین دستگاه دوباره در حساب ذخیره می‌شود."
          yes="پاک کن"
          no="انصراف"
          danger
          onYes={() => {
            setConfirmDelete(false);
            setBusy(true);
            void deleteCloudCopy().then((ok) => {
              if (!ok) {
                setBusy(false);
                toast('پاک کردن انجام نشد؛ اینترنت را بررسی کن');
                return;
              }
              const local = structuredClone(getState());
              // No last upload here: it would put back the copy that was just deleted.
              void signOut({ save: false }).then(() => {
                setBusy(false);
                replaceState(local);
                toast('نسخهٔ حساب از سرور پاک شد');
              });
            });
          }}
          onNo={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
