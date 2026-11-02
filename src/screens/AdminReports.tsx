import { useEffect, useState } from 'react';
import { lessonById, questionById } from '../content';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { Rich } from '../components/Rich';
import { useAccount } from '../lib/account';
import { fmt } from '../lib/digits';
import { go, toast } from '../lib/nav';
import { listReports, REPORT_REASONS, resolveReport, type ReportRecord } from '../lib/problemReport';
import { fullDate } from '../lib/time';

const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.id, r.label])) as Record<string, string>;
/** Ids, emails and browser names in Latin digits (the app font draws digits in Persian). */
const LATIN = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.8rem' } as const;

type View = { state: 'loading' } | { state: 'signed-out' } | { state: 'forbidden' } | { state: 'error' } | { state: 'ready'; reports: ReportRecord[]; cursor: string | null };

/** /admin/reports: content reports («گزارش اشکال»), for the accounts listed in ADMIN_EMAILS on the server. */
export function AdminReports() {
  const { account } = useAccount();
  const [view, setView] = useState<View>({ state: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);

  const load = async (cursor?: string | null) => {
    const page = await listReports(cursor);
    if (page.ok) {
      setView((v) => ({ state: 'ready', reports: cursor && v.state === 'ready' ? [...v.reports, ...page.reports] : page.reports, cursor: page.cursor }));
    } else setView({ state: page.status === 401 ? 'signed-out' : page.status === 403 ? 'forbidden' : 'error' });
  };

  useEffect(() => {
    void load();
  }, [account?.id]);

  const handled = async (id: string) => {
    setBusy(id);
    const ok = await resolveReport(id);
    setBusy(null);
    if (!ok) return toast('انجام نشد؛ دوباره امتحان کن');
    setView((v) => (v.state === 'ready' ? { ...v, reports: v.reports.filter((r) => r.id !== id) } : v));
  };

  return (
    <div className="stack">
      <div className="row" style={{ gap: 12 }}>
        <h1 className="grow" style={{ fontSize: '1.35rem' }}>
          گزارش‌های اشکال
        </h1>
        <button className="btn sm ghost" onClick={() => void load()}>
          <Icon name="refresh" size={18} /> تازه کن
        </button>
      </div>

      {view.state === 'loading' && <p className="muted">در حال خواندن…</p>}
      {view.state === 'error' && (
        <div className="card">
          <p>گزارش‌ها خوانده نشد. اینترنت را بررسی کن و «تازه کن» را بزن.</p>
        </div>
      )}
      {(view.state === 'signed-out' || view.state === 'forbidden') && (
        <div className="card row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <Mascot mood="calm" size={56} glow={false} />
          <div className="grow">
            <p style={{ margin: '0 0 10px' }}>
              {view.state === 'signed-out'
                ? 'این صفحه فقط برای مدیران بیوماناست. با حساب گوگل مدیر وارد شو.'
                : 'این صفحه فقط برای مدیران بیوماناست و این حساب اجازهٔ دیدنش را ندارد.'}
            </p>
            <button className="btn sm" onClick={() => go(view.state === 'signed-out' && !account ? { name: 'login' } : { name: 'home' })}>
              {view.state === 'signed-out' && !account ? 'ورود با گوگل' : 'بازگشت'}
            </button>
          </div>
        </div>
      )}
      {view.state === 'ready' && view.reports.length === 0 && (
        <div className="card row" style={{ gap: 12 }}>
          <Mascot mood="happy" size={56} glow={false} />
          <p className="grow" style={{ margin: 0 }}>
            گزارش تازه‌ای نیست.
          </p>
        </div>
      )}
      {view.state === 'ready' &&
        view.reports.map((r) => {
          const hit = questionById(r.questionId);
          const lesson = r.lessonId ? lessonById(r.lessonId) : hit?.lesson;
          return (
            <div key={r.id} className="card stack" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span className="chip bad">{REASON_LABEL[r.reason] ?? r.reason}</span>
                <span className="small muted grow">{fullDate(r.time)}</span>
                <span className="muted" dir="ltr" style={LATIN}>
                  {r.questionId}
                </span>
              </div>
              <div className="small">
                <b>{lesson?.title ?? r.lessonId ?? 'درس نامشخص'}</b>
              </div>
              {hit && (
                <div className="small" style={{ color: 'var(--ink-2)' }}>
                  <Rich text={hit.q.prompt} />
                </div>
              )}
              {r.note && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>«{r.note}»</p>}
              <div className="small muted" style={{ overflowWrap: 'anywhere' }}>
                {r.email ? (
                  <span dir="ltr" style={LATIN}>
                    {r.email}
                  </span>
                ) : (
                  'مهمان'
                )}{' '}
                ·{' '}
                <span dir="ltr" style={LATIN}>
                  {r.ua.slice(0, 120)}
                </span>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {lesson && (
                  <a className="btn sm ghost" href={`#/lesson/${encodeURIComponent(lesson.id)}`}>
                    باز کردن درس
                  </a>
                )}
                <button className="btn sm" disabled={busy === r.id} onClick={() => void handled(r.id)}>
                  <Icon name="check" size={18} /> رسیدگی شد
                </button>
              </div>
            </div>
          );
        })}
      {view.state === 'ready' && view.cursor && (
        <button className="btn ghost" onClick={() => void load(view.cursor)}>
          گزارش‌های بیشتر
        </button>
      )}
      {view.state === 'ready' && view.reports.length > 0 && <p className="small muted">{fmt(view.reports.length)} گزارش · هر گزارش ۹۰ روز نگه داشته می‌شود.</p>}
    </div>
  );
}
