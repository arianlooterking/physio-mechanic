import { useState } from 'react';
import { createPortal } from 'react-dom';
import { questionById } from '../content';
import { fmt } from '../lib/digits';
import { toast } from '../lib/nav';
import { personalDataIn, REPORT_NOTE_MAX, REPORT_REASONS, sendReport, type PersonalData, type ReportReason } from '../lib/problemReport';
import { Icon } from './Icon';
import { Sheet } from './ui';

const OUTCOME: Record<string, string> = {
  'rate-limited': 'گزارش‌های زیادی فرستادی؛ کمی بعد دوباره امتحان کن.',
  offline: 'گزارش فرستاده نشد. اینترنت را بررسی کن و دوباره امتحان کن.',
  error: 'گزارش فرستاده نشد. کمی بعد دوباره امتحان کن.',
};

const PERSONAL: Record<PersonalData, string> = {
  email: 'انگار در توضیح ایمیل نوشته‌ای.',
  phone: 'انگار در توضیح شمارهٔ تلفن نوشته‌ای.',
  id: 'انگار در توضیح کد ملی یا یک شمارهٔ ده‌رقمی نوشته‌ای.',
};

/** Small «گزارش اشکال» link under a checked question's answer, and the sheet it opens. */
export function ReportButton({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="link-btn report-link" onClick={() => setOpen(true)}>
        <Icon name="flag" size={14} /> گزارش اشکال
      </button>
      {/* In a portal: the session footer is a fixed layer of its own and must not clip the sheet. */}
      {open && createPortal(<ReportSheet questionId={questionId} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function ReportSheet({ questionId, onClose }: { questionId: string; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const personal = personalDataIn(note);

  const send = async () => {
    if (!reason || busy || personal) return;
    setBusy(true);
    setError('');
    const outcome = await sendReport({ lessonId: questionById(questionId)?.lesson.id, questionId, reason, note });
    setBusy(false);
    if (outcome === 'ok') {
      onClose();
      toast('ممنون! گزارشت رسید و بررسی می‌شود.');
    } else setError(OUTCOME[outcome]);
  };

  return (
    <Sheet
      title="گزارش اشکال"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            انصراف
          </button>
          <button className="btn" onClick={() => void send()} disabled={!reason || busy || Boolean(personal)}>
            {busy ? 'در حال فرستادن…' : 'فرستادن'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <p className="small muted" style={{ margin: 0 }}>
          چه مشکلی در این سؤال دیدی؟ گزارشت به نویسندگان بیومانا می‌رسد تا درستش کنند.
        </p>
        <div className="seg" role="group" aria-label="نوع اشکال">
          {REPORT_REASONS.map((r) => (
            <button key={r.id} aria-pressed={reason === r.id} onClick={() => setReason(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <label className="small" style={{ display: 'grid', gap: 6 }}>
          <span>
            توضیح (اختیاری) <span className="muted">· {fmt(note.length)} از {fmt(REPORT_NOTE_MAX)}</span>
          </span>
          <textarea
            className="report-note"
            value={note}
            rows={3}
            maxLength={REPORT_NOTE_MAX}
            onChange={(e) => setNote(e.target.value.slice(0, REPORT_NOTE_MAX))}
            placeholder="مثلاً: جواب درست باید ۴ باشد، نه ۲."
            aria-invalid={personal ? true : undefined}
            aria-describedby={personal ? 'report-personal' : undefined}
          />
        </label>
        {personal && (
          <div className="note warn" id="report-personal" role="alert">
            <Icon name="info" className="n-ic" size={20} />
            <div className="small">
              {PERSONAL[personal]} اطلاعات شخصی را این‌جا ننویس؛ پاکش کن تا گزارش فرستاده شود.
            </div>
          </div>
        )}
        {error && (
          <p className="small" role="alert" style={{ color: 'var(--bad-ink)', margin: 0 }}>
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
