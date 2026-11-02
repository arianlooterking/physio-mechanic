import { BOOK_REF, lessonById, subjectById } from '../content';
import { WARMUPS } from '../content/warmups';
import { KonkurTips } from '../components/KonkurTips';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { Rich } from '../components/Rich';
import { KIND_META } from '../components/session';
import { Bar } from '../components/ui';
import { fmt, pct } from '../lib/digits';
import { buildPath, lessonMastery } from '../lib/learner';
import { go } from '../lib/nav';
import { conceptOf } from '../lib/state';
import { useAppState } from '../lib/store';
import { fullDate } from '../lib/time';

export function LessonOverview({ lessonId }: { lessonId: string }) {
  const s = useAppState();
  const lesson = lessonById(lessonId);
  if (!lesson) {
    return (
      <div className="center stack" style={{ paddingTop: 40, alignItems: 'center' }}>
        <Mascot mood="oops" />
        <b>این درس پیدا نشد.</b>
        <button className="btn" onClick={() => go({ name: 'home' })}>
          خانه
        </button>
      </div>
    );
  }
  const subj = subjectById(lesson.subject);
  const lp = s.lessons[lesson.id];
  const practiceNodes = buildPath(lesson).filter((n) => n.kind === 'practice');
  const finalNode = buildPath(lesson).find((n) => n.kind === 'final');
  const hardNode = buildPath(lesson).find((n) => n.kind === 'hard');
  const m = lessonMastery(s, lesson);

  return (
    <div className="stack">
      <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => go({ name: 'home' })}>
        <Icon name="back" size={18} /> مسیر یادگیری
      </button>
      <div>
        <div className="small bold" style={{ color: `var(--${subj.color})` }}>
          {subj.title} · {lesson.label}
        </div>
        <h1 className="page-title">{lesson.title}</h1>
        <p className="page-sub">
          <Rich text={lesson.intro} />
        </p>
      </div>
      <div className="card row">
        <div className="grow">
          <b>تسلط تو بر این درس</b>
          <div style={{ marginTop: 8 }}>
            <Bar value={m} color={`var(--${subj.color})`} />
          </div>
        </div>
        <b style={{ fontSize: '1.4rem' }}>{pct(m)}</b>
      </div>
      {lesson.pages[0] > 0 && (
        <div className="book-ref">
          <Icon name="book" size={20} />
          <span className="grow">
            {BOOK_REF}، صفحهٔ {fmt(lesson.pages[0])} تا {fmt(lesson.pages[1])}
          </span>
        </div>
      )}

      <button className="card row" style={{ textAlign: 'start' }} onClick={() => go({ name: 'sheet', subject: lesson.subject, lessonId: lesson.id })}>
        <Icon name="doc" size={26} style={{ color: `var(--${subj.color})` }} />
        <div className="grow">
          <b>برگهٔ خلاصهٔ {subj.title}</b>
          <div className="small muted">خلاصه، نکته‌ها و کارت‌های همهٔ درس‌های کتاب در یک برگه؛ برای مرور شب امتحان یا چاپ</div>
        </div>
        <Icon name="next" size={18} />
      </button>

      {WARMUPS[lesson.id] && (
        <button className="card row" style={{ textAlign: 'start' }} onClick={() => go({ name: 'warmup', lessonId: lesson.id })}>
          <Icon name="target" size={26} style={{ color: `var(--${subj.color})` }} />
          <div className="grow">
            <b>پیش از درس</b>
            <div className="small muted">این درس به چه دردت می‌خورد، و یک گرم کردن یک‌دقیقه‌ای با پیش‌نیازها</div>
          </div>
          <Icon name="next" size={18} />
        </button>
      )}

      <h2 className="section-title">مفهوم‌ها</h2>
      <div className="stack" style={{ gap: 10 }}>
        {lesson.concepts.map((c, i) => {
          const cp = conceptOf(s, c.id);
          const status = cp.status === 'understood' ? 'فهمیده‌ای' : cp.status === 'learning' ? 'در حال یادگیری' : 'شروع نشده';
          return (
            <div key={c.id} className="card row" style={{ alignItems: 'flex-start' }}>
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  flex: 'none',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 900,
                  background: cp.status === 'understood' ? 'var(--ok-soft)' : 'var(--surface-2)',
                  color: cp.status === 'understood' ? 'var(--ok-ink)' : 'var(--ink-2)',
                }}
              >
                {cp.status === 'understood' ? <Icon name="check" size={20} /> : fmt(i + 1)}
              </span>
              <div className="grow">
                <b>
                  <Rich text={c.title} />
                </b>
                <div className="small muted">
                  <Rich text={c.goal} />
                </div>
                <div className="row wrap small" style={{ marginTop: 6, gap: 6 }}>
                  <span className={`chip ${cp.status === 'understood' ? 'ok' : cp.status === 'learning' ? 'accent' : ''}`}>{status}</span>
                  <span className="chip">تسلط {pct(cp.mastery)}</span>
                  {cp.understoodWith && (
                    <span className="chip primary">
                      <Icon name={KIND_META[cp.understoodWith].icon} size={14} /> فهمیدی با: {KIND_META[cp.understoodWith].label}
                    </span>
                  )}
                  <span className="chip">{fmt(c.approaches.length)} نوع توضیح</span>
                </div>
              </div>
              <button className="btn sm soft" onClick={() => go({ name: 'learn', lessonId: lesson.id, conceptId: c.id })}>
                {cp.status === 'understood' ? 'مرور' : 'یادگیری'}
              </button>
            </div>
          );
        })}
      </div>

      <h2 className="section-title">تمرین و آزمون</h2>
      <div className="stack" style={{ gap: 10 }}>
        {practiceNodes.map((n) => (
          <button key={n.id} className="card row" style={{ textAlign: 'start' }} onClick={() => go({ name: 'practice', lessonId: lesson.id, nodeId: n.id })}>
            <Icon name="dumbbell" size={26} style={{ color: `var(--${subj.color})` }} />
            <div className="grow">
              <b>{n.title}</b>
              <div className="small muted">{fmt(n.concepts?.length ?? 0)} مفهوم · سؤال‌های تطبیقی بر اساس نقاط ضعف تو</div>
            </div>
            {lp?.done?.[n.id] ? <span className="chip ok">انجام شده</span> : <Icon name="next" />}
          </button>
        ))}
        {finalNode && (
          <button className="card row" style={{ textAlign: 'start' }} onClick={() => go({ name: 'practice', lessonId: lesson.id, nodeId: finalNode.id })}>
            <Icon name="edit" size={26} style={{ color: `var(--${subj.color})` }} />
            <div className="grow">
              <b>امتحان نهایی (تشریحی)</b>
              <div className="small muted">روی کاغذ حل کن، پاسخ تشریحی و بارم را ببین و به خودت نمره بده</div>
            </div>
            {lp?.done?.[finalNode.id] ? <span className="chip ok">انجام شده</span> : <Icon name="next" />}
          </button>
        )}
        <button className="card row" style={{ textAlign: 'start' }} onClick={() => go({ name: 'cards', scope: lesson.id })}>
          <Icon name="cards" size={26} style={{ color: 'var(--accent-dark)' }} />
          <div className="grow">
            <b>کارت‌های مرور</b>
            <div className="small muted">{fmt(lesson.cards.length)} کارت با جعبهٔ لایتنر</div>
          </div>
          <Icon name="next" />
        </button>
        <button className="card row" style={{ textAlign: 'start' }} onClick={() => go({ name: 'test', lessonId: lesson.id })}>
          <Icon name="trophy" size={26} style={{ color: 'var(--accent-dark)' }} />
          <div className="grow">
            <b>آزمون درس (چهارگزینه‌ای)</b>
            <div className="small muted">
              {fmt(lesson.test.length)} سؤال · {lp?.best !== undefined ? `بهترین نمره: ${fmt(lp.best, 1)}٪` : 'هنوز شرکت نکرده‌ای'}
            </div>
          </div>
          <Icon name="next" />
        </button>
        <button className="card row" style={{ textAlign: 'start' }} onClick={() => go({ name: 'mock', lessonId: lesson.id })}>
          <Icon name="grid" size={26} style={{ color: `var(--${subj.color})` }} />
          <div className="grow">
            <b>آزمون جامع {subj.title}</b>
            <div className="small muted">این درس را با درس‌های دیگر کتاب قاطی کن؛ ۱۰، ۲۰ یا ۳۰ تست</div>
          </div>
          <Icon name="next" />
        </button>
      </div>

      {hardNode && (
        <button className="card row" style={{ textAlign: 'start', marginTop: 10, width: '100%' }} onClick={() => go({ name: 'practice', lessonId: lesson.id, nodeId: hardNode.id })}>
          <Icon name="crown" size={26} style={{ color: 'var(--accent-dark)' }} />
          <div className="grow">
            <b>تست‌های سخت</b>
            <div className="small muted">تست‌های چالشی سطح کنکور با حل کامل؛ بدون از دست دادن قلب</div>
          </div>
          {lp?.done?.[hardNode.id] ? <span className="chip ok">انجام شده</span> : <Icon name="next" />}
        </button>
      )}

      {lesson.konkur && (
        <>
          <h2 className="section-title">کنکور</h2>
          {lesson.konkur.tests.length > 0 && (
            <button className="card row" style={{ textAlign: 'start', width: '100%' }} onClick={() => go({ name: 'test', lessonId: lesson.id, set: 'konkur' })}>
              <Icon name="target" size={26} style={{ color: 'var(--primary)' }} />
              <div className="grow">
                <b>تست کنکوری</b>
                <div className="small muted">
                  {fmt(lesson.konkur.tests.length)} تست در سطح کنکور ارشد، با زمان و نمره‌دهی کنکوری و پاسخ تشریحی
                  {lp?.konkur ? ` · بهترین نمره: ${fmt(lp.konkur.best, 1)}٪` : ''}
                </div>
              </div>
              <Icon name="next" />
            </button>
          )}
          {lesson.konkur.tips.length > 0 && (
            <div className="card" style={{ marginTop: 10 }}>
              <b>نکته‌های کنکوری</b>
              <KonkurTips tips={lesson.konkur.tips} />
            </div>
          )}
        </>
      )}

      {lp && lp.tests.length > 0 && (
        <>
          <h2 className="section-title">کارنامهٔ آزمون‌ها</h2>
          <div className="card">
            {lp.tests
              .slice()
              .reverse()
              .slice(0, 8)
              .map((t, i) => (
                <div key={i} className="spread small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <span>{fullDate(t.at)}</span>
                  <span className="muted">
                    {fmt(t.correct)} درست · {fmt(t.wrong)} غلط · {fmt(t.blank)} نزده
                  </span>
                  <b>{fmt(t.score, 1)}٪</b>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
