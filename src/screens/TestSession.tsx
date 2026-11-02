import { useEffect, useMemo, useRef, useState } from 'react';
import { lessonById, subjectColor } from '../content';
import { FIELD } from '../content/fields';
import type { KonkurQ, Lesson } from '../content/types';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { Plot } from '../components/Plot';
import { Rich } from '../components/Rich';
import { SessionTop } from '../components/session';
import { Confetti, Confirm } from '../components/ui';
import { awardBadges, type BadgeDef } from '../lib/badges';
import { fmt } from '../lib/digits';
import { hashString, shuffled } from '../lib/grade';
import { exitTo, go } from '../lib/nav';
import { sfx } from '../lib/sound';
import { trackFinish } from '../lib/learner';
import { addStudyTime, awardXp, konkurScore, lessonOf, recordAnswer, recordKonkur, recordTest, testXp } from '../lib/state';
import { getState, update } from '../lib/store';
import { clock } from '../lib/time';

const SEC_PER_Q = 75;
const KEYS = ['۱', '۲', '۳', '۴'];

/**
 * Konkur pace (1403 format): ریاضیات has 40 questions in 70 minutes, about 105 s each; فیزیک and شیمی share 65 in
 * 75 minutes and the تجربی exam is 155 in 180, about 70 s each.
 */
const konkurPace = (lesson: Lesson) => (FIELD[lesson.subject] === 'math' ? 105 : 70);

/** The questions of the lesson test, or of its «تست کنکوری». */
const questionsOf = (lesson: Lesson, set?: 'konkur'): KonkurQ[] => (set === 'konkur' ? (lesson.konkur?.tests ?? []) : lesson.test);

export function TestSession({ lessonId, set }: { lessonId: string; set?: 'konkur' }) {
  const lesson = lessonById(lessonId);
  if (!lesson || !questionsOf(lesson, set).length) {
    return (
      <div className="onb">
        <div className="onb-body center">
          <Mascot mood="oops" />
          <h1>این آزمون پیدا نشد</h1>
          <button className="btn" onClick={() => exitTo()}>
            بازگشت
          </button>
        </div>
      </div>
    );
  }
  return <Exam key={`${lessonId}:${set ?? ''}`} lessonId={lessonId} set={set} />;
}

function Exam({ lessonId, set }: { lessonId: string; set?: 'konkur' }) {
  const lesson = lessonById(lessonId)!;
  const konkur = set === 'konkur';
  const color = subjectColor(lesson.subject).c;
  const seed = useRef(Date.now());
  const qs: KonkurQ[] = useMemo(() => {
    const pool = questionsOf(lesson, set);
    return shuffled(pool.length, seed.current).map((i) => pool[i]);
  }, [lesson, set]);
  const orders = useMemo(() => qs.map((q) => shuffled(4, hashString(q.id) + seed.current)), [qs]);
  const limit = qs.length * (konkur ? konkurPace(lesson) : SEC_PER_Q);

  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => qs.map(() => null));
  const [flags, setFlags] = useState<boolean[]>(() => qs.map(() => false));
  const [left, setLeft] = useState(limit);
  const [done, setDone] = useState(false);
  const [confirm, setConfirm] = useState<null | 'submit' | 'exit'>(null);
  const [result, setResult] = useState<{ correct: number; wrong: number; blank: number; score: number; secs: number; xp: number; badges: BadgeDef[] } | null>(null);
  const startedAt = useRef(0);
  const prevBest = konkur ? lessonOf(getState(), lessonId).konkur?.best : lessonOf(getState(), lessonId).best;

  useEffect(() => {
    if (!started || done) return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      const rem = Math.max(0, limit - elapsed);
      setLeft(rem);
      if (rem <= 0) submit();
    }, 500);
    return () => clearInterval(t);
  });

  function submit() {
    if (done) return;
    const secs = Math.min(limit, (Date.now() - startedAt.current) / 1000);
    let correct = 0;
    let wrong = 0;
    let blank = 0;
    qs.forEach((q, k) => {
      const a = answers[k];
      if (a === null) blank += 1;
      else if (a === q.answer) correct += 1;
      else wrong += 1;
    });
    const score = konkurScore(correct, wrong, qs.length);
    const xp = testXp(score, correct + wrong);
    let badges: BadgeDef[] = [];
    // A test with nothing answered does not count: no XP or streak day, and the lesson's test step stays open.
    if (correct + wrong > 0) {
      update((s) => {
        qs.forEach((q, k) => {
          const a = answers[k];
          if (a !== null) recordAnswer(s, q, a === q.answer, 'test');
        });
        if (konkur) recordKonkur(s, lessonId, score);
        else trackFinish(s, lessonId, () => recordTest(s, lessonId, { at: Date.now(), correct, wrong, blank, total: qs.length, score, seconds: Math.round(secs) }));
        awardXp(s, xp);
        addStudyTime(s, secs * 1000);
        s.counters.sessions += 1;
        badges = awardBadges(s);
      });
    }
    sfx.complete();
    setResult({ correct, wrong, blank, score, secs, xp, badges });
    setDone(true);
    setConfirm(null);
    window.scrollTo({ top: 0 });
  }

  if (!started) {
    return (
      <div className="session">
        <SessionTop onClose={() => exitTo()} progress={0} color={color} />
        <div className="session-body">
          <div className="result">
            <Mascot mood="think" size={110} />
            <h1 style={{ color: 'var(--ink)' }}>
              {konkur ? 'تست کنکوری' : 'آزمون درس'}: {lesson.title}
            </h1>
            <div className="card stack" style={{ width: '100%', textAlign: 'start' }}>
              <div className="row">
                <Icon name="grid" /> {fmt(qs.length)} {konkur ? 'تست در سطح کنکور ارشد، با پاسخی که دو بار جداگانه حل و بررسی شده' : 'سؤال چهارگزینه‌ای به سبک کنکور'}
              </div>
              <div className="row">
                <Icon name="clock" /> زمان: {fmt(Math.round(limit / 60))} دقیقه
              </div>
              <div className="row">
                <Icon name="info" /> نمره‌دهی کنکوری: هر ۳ جواب غلط، یک جواب درست را خنثی می‌کند. اگر مطمئن نیستی، نزدن بهتر است.
              </div>
              <div className="row">
                <Icon name="flag" /> می‌توانی سؤال را علامت بزنی و بعداً برگردی.
              </div>
              {prevBest !== undefined && (
                <div className="row">
                  <Icon name="trophy" /> بهترین نمرهٔ قبلی تو: {fmt(prevBest, 1)}٪
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="session-foot">
          <div className="session-foot-in">
            <button
              className="btn lg"
              onClick={() => {
                startedAt.current = Date.now();
                setStarted(true);
              }}
            >
              شروع آزمون
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (done && result) {
    const good = result.score >= 70;
    return (
      <div className="session">
        {good && <Confetti />}
        <div className="session-body">
          <div className="result">
            <Mascot mood={good ? 'cheer' : result.score >= 40 ? 'happy' : 'calm'} size={120} className="pop" />
            <h1 style={{ color: good ? 'var(--ok)' : 'var(--ink)' }}>نمرهٔ تو: {fmt(result.score, 1)}٪</h1>
            <p className="muted">
              {result.score >= 90
                ? 'فوق‌العاده! این درس را عالی بلدی.'
                : good
                  ? 'خیلی خوب! چند نکتهٔ کوچک مانده که پایین می‌بینی.'
                  : 'هنوز جای کار دارد. پاسخ‌نامه را با دقت ببین و مفهوم‌های ضعیف را دوباره مرور کن.'}
              {prevBest !== undefined && result.score > prevBest && ' رکورد جدید! 🏆'}
            </p>
            <div className="result-stats">
              <div className="rstat" style={{ ['--rs' as string]: 'var(--ok)' }}>
                <div className="rs-h">درست</div>
                <div className="rs-v">{result.correct}</div>
              </div>
              <div className="rstat" style={{ ['--rs' as string]: 'var(--bad)' }}>
                <div className="rs-h">غلط</div>
                <div className="rs-v">{result.wrong}</div>
              </div>
              <div className="rstat" style={{ ['--rs' as string]: 'var(--ink-3)' }}>
                <div className="rs-h">نزده</div>
                <div className="rs-v">{result.blank}</div>
              </div>
            </div>
            <p className="small muted">
              زمان: {clock(result.secs)}
              {result.correct + result.wrong > 0 && (
                <>
                  {' '}
                  · امتیاز: <bdi dir="ltr">+{result.xp}</bdi>
                </>
              )}
            </p>
            {result.correct + result.wrong === 0 && (
              <p className="small muted">به هیچ سؤالی جواب ندادی، برای همین این آزمون امتیاز ندارد{konkur ? '.' : ' و قدم «آزمون درس» هنوز باز است.'}</p>
            )}
            {result.badges.map((b) => (
              <div key={b.id} className="card pop row" style={{ width: '100%' }}>
                <span style={{ fontSize: 34 }}>{b.emoji}</span>
                <div className="grow" style={{ textAlign: 'start' }}>
                  <b>نشان جدید: {b.title}</b>
                  <div className="small muted">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
          {!konkur && (lesson.konkur?.tests.length ?? 0) > 0 && (
            <button className="card row" style={{ textAlign: 'start', width: '100%', marginTop: 12 }} onClick={() => go({ name: 'test', lessonId, set: 'konkur' }, true)}>
              <Icon name="target" />
              <div className="grow">
                <b>تست کنکوری همین درس</b>
                <div className="small muted">{fmt(lesson.konkur!.tests.length)} تست در سطح کنکور ارشد، با پاسخ تشریحی</div>
              </div>
              <Icon name="next" />
            </button>
          )}
          <h2 className="section-title">پاسخ‌نامهٔ تشریحی</h2>
          <div className="stack">
            {qs.map((q, k) => {
              const a = answers[k];
              const ok = a === q.answer;
              return (
                <div key={q.id} className="card">
                  <div className="row" style={{ marginBottom: 8 }}>
                    <span className={`chip ${a === null ? '' : ok ? 'ok' : 'bad'}`}>
                      سؤال {k + 1} · {a === null ? 'نزده' : ok ? 'درست' : 'غلط'}
                    </span>
                    {q.source && (
                      <span className="chip" style={{ fontSize: '0.75rem' }}>
                        {q.source}
                      </span>
                    )}
                  </div>
                  <div className="bold" style={{ marginBottom: 8 }}>
                    <Rich text={q.prompt} />
                  </div>
                  {q.plot && (
                    <div style={{ maxWidth: 360, margin: '0 auto 8px' }}>
                      <Plot spec={q.plot} />
                    </div>
                  )}
                  <div className="options" style={{ gap: 8 }}>
                    {orders[k].map((orig, pos) => (
                      <div key={orig} className={`opt ${orig === q.answer ? 'right' : orig === a ? 'wrong' : 'dim'}`} style={{ minHeight: 46, animation: 'none' }}>
                        <span className="key">{KEYS[pos]}</span>
                        <span className="opt-body">
                          <Rich text={q.options[orig]} />
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="note tip" style={{ marginTop: 10 }}>
                    <Icon name="bulb" className="n-ic" size={20} />
                    <div>
                      <Rich text={q.explain} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="session-foot">
          <div className="session-foot-in">
            <button className="btn ghost" onClick={() => go({ name: 'lesson', lessonId }, true)}>
              جزئیات درس
            </button>
            <button className="btn lg" onClick={() => exitTo()}>
              پایان
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = qs[i];
  const order = orders[i];
  const answered = answers.filter((a) => a !== null).length;
  const low = left < 60;

  return (
    <div className="session">
      <SessionTop
        onClose={() => setConfirm('exit')}
        progress={answered / qs.length}
        color={color}
        right={
          <span className={`chip ${low ? 'bad' : ''}`} aria-label="زمان باقی‌مانده" style={{ direction: 'ltr' }}>
            <Icon name="clock" size={16} /> {clock(left)}
          </span>
        }
      />
      <div className="session-body">
        <div className="row wrap" style={{ gap: 6, margin: '6px 0 14px' }} role="navigation" aria-label="شمارهٔ سؤال‌ها">
          {qs.map((_, k) => (
            <button
              key={k}
              onClick={() => setI(k)}
              aria-current={k === i}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                fontWeight: 800,
                border: `2px solid ${k === i ? 'var(--primary)' : 'var(--line-2)'}`,
                background: answers[k] !== null ? 'var(--primary-soft)' : 'var(--surface)',
                color: answers[k] !== null ? 'var(--primary)' : 'var(--ink-2)',
                position: 'relative',
              }}
            >
              {k + 1}
              {flags[k] && <span style={{ position: 'absolute', top: -6, insetInlineEnd: -4, fontSize: 12 }}>🚩</span>}
            </button>
          ))}
        </div>
        <div className="q-kicker">
          سؤال {i + 1} از {qs.length}
        </div>
        <div className="q-prompt">
          <Rich text={q.prompt} />
        </div>
        {q.plot && (
          <div style={{ maxWidth: 420, margin: '0 auto 16px' }}>
            <Plot spec={q.plot} />
          </div>
        )}
        <div className="options" role="radiogroup">
          {order.map((orig, pos) => (
            <button
              key={orig}
              role="radio"
              aria-checked={answers[i] === orig}
              className={`opt${answers[i] === orig ? ' sel' : ''}`}
              onClick={() => {
                sfx.tap();
                setAnswers((prev) => prev.map((v, k) => (k === i ? (v === orig ? null : orig) : v)));
              }}
            >
              <span className="key">{KEYS[pos]}</span>
              <span className="opt-body">
                <Rich text={q.options[orig]} />
              </span>
            </button>
          ))}
        </div>
        <div className="row wrap" style={{ marginTop: 14, justifyContent: 'space-between' }}>
          <button className="link-btn" onClick={() => setFlags((f) => f.map((v, k) => (k === i ? !v : v)))}>
            <Icon name="flag" size={18} /> {flags[i] ? 'برداشتن علامت' : 'علامت برای بعد'}
          </button>
          {answers[i] !== null && (
            <button className="link-btn" onClick={() => setAnswers((prev) => prev.map((v, k) => (k === i ? null : v)))}>
              پاک کردن جواب
            </button>
          )}
        </div>
      </div>
      <div className="session-foot">
        <div className="session-foot-in">
          <button className="btn ghost" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
            <Icon name="back" /> قبلی
          </button>
          {i < qs.length - 1 ? (
            <button className="btn" onClick={() => setI(i + 1)}>
              بعدی <Icon name="next" />
            </button>
          ) : (
            <button className="btn ok" onClick={() => setConfirm('submit')}>
              پایان و تصحیح
            </button>
          )}
        </div>
      </div>
      {confirm === 'submit' && (
        <Confirm
          title="آزمون را تحویل می‌دهی؟"
          text={answered < qs.length ? `${qs.length - answered} سؤال را جواب نداده‌ای. نزده‌ها نمرهٔ منفی ندارند.` : 'به همهٔ سؤال‌ها جواب داده‌ای.'}
          yes="تحویل و تصحیح"
          no="برمی‌گردم"
          onYes={submit}
          onNo={() => setConfirm(null)}
        />
      )}
      {confirm === 'exit' && (
        <Confirm
          title="از آزمون خارج می‌شوی؟"
          text="جواب‌های این آزمون ذخیره نمی‌شوند."
          yes="خروج"
          no="ادامه"
          danger
          onYes={() => exitTo()}
          onNo={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
