import { useEffect, useMemo, useRef, useState } from 'react';
import { subjectById } from '../content';
import { FIELD } from '../content/fields';
import type { Question } from '../content/types';
import { SubjectContext } from '../components/Glossary';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { QuestionView } from '../components/questions/QuestionView';
import { Rich } from '../components/Rich';
import { encourage, Feedback, praise, SessionTop } from '../components/session';
import { Confetti, Confirm, Sheet } from '../components/ui';
import { useOwner } from '../lib/account';
import { awardBadges, type BadgeDef } from '../lib/badges';
import { copyText, dailyIds, dailyQuestions, dailyShareText, DAILY_SIZE } from '../lib/daily';
import { fmt } from '../lib/digits';
import { grade, isComplete, rightAnswerText, type Answer } from '../lib/grade';
import { findQuestion } from '../lib/learner';
import { exitTo, go, toast } from '../lib/nav';
import { sfx } from '../lib/sound';
import { addStudyTime, awardXp, dailyOf, dailyStreak, dailyXp, recordAnswer, recordDaily, type DailyRecord } from '../lib/state';
import { getState, update, useAppState } from '../lib/store';
import { dayKey, fullDate, fromKey } from '../lib/time';

/** «چالش امروز»: five questions, the same all day; once done, today's result with a «کپی نتیجه» button. */
export function DailyChallenge() {
  const s = useAppState();
  const today = useMemo(() => dayKey(), []);
  const ids = useMemo(() => dailyIds(getState(), today), [today]);
  const questions = useMemo(() => dailyQuestions(ids), [ids]);
  const done = dailyOf(s, today);
  const [badges, setBadges] = useState<BadgeDef[]>([]);
  // The owner may play today's challenge again; the extra rounds are not recorded.
  const owner = useOwner();
  const [again, setAgain] = useState(false);

  // Pin today's questions the first time the challenge opens, so they stay the same until midnight.
  useEffect(() => {
    if (ids.length && getState().dailyPlan?.day !== today) update((st) => void (st.dailyPlan = { day: today, ids }));
  }, [ids, today]);

  if (done && again) return <Round key="again" day={today} questions={questions} onBadges={setBadges} replay={() => setAgain(false)} />;
  if (done) return <DailyResult day={today} rec={done} questions={questions} badges={badges} onAgain={owner ? () => setAgain(true) : undefined} />;
  if (!questions.length) {
    return (
      <div className="onb">
        <div className="onb-body center">
          <Mascot mood="calm" size={110} />
          <h1>چالش امروز آماده نشد</h1>
          <p className="lead">برای رشته و پایه‌ات هنوز سؤال تمرینی نداریم. یک درس را شروع کن و فردا دوباره سر بزن.</p>
          <button className="btn lg" onClick={() => exitTo()}>
            باشه
          </button>
        </div>
      </div>
    );
  }
  return <Round day={today} questions={questions} onBadges={setBadges} />;
}

function Round({ day, questions, onBadges, replay }: { day: string; questions: Question[]; onBadges: (b: BadgeDef[]) => void; replay?: () => void }) {
  const [pos, setPos] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [locked, setLocked] = useState(false);
  const [marks, setMarks] = useState<boolean[]>([]);
  const [confirmExit, setConfirmExit] = useState(false);
  const startedAt = useRef(Date.now());
  const q = questions[pos];
  const ok = marks[pos];
  const lesson = findQuestion(q.id)?.lesson;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pos]);

  function check() {
    if (!answer || !isComplete(q, answer)) return;
    const right = grade(q, answer);
    setMarks((m) => [...m, right]);
    setLocked(true);
    if (right) sfx.correct();
    else sfx.wrong();
  }

  function next() {
    if (pos + 1 < questions.length) {
      setAnswer(null);
      setLocked(false);
      setPos(pos + 1);
      return;
    }
    if (replay) {
      sfx.complete();
      toast(`${fmt(marks.filter(Boolean).length)} از ${fmt(questions.length)}؛ این دور در نتیجهٔ امروز حساب نشد.`);
      replay();
      return;
    }
    // The answers count in the learner model only once the challenge is done, so a half-done one never counts twice.
    const now = Date.now();
    const xp = dailyXp(marks);
    let badges: BadgeDef[] = [];
    update((s) => {
      questions.forEach((x, k) => recordAnswer(s, x, marks[k], 'practice', now));
      recordDaily(s, day, marks, xp, now);
      awardXp(s, xp, now);
      addStudyTime(s, now - startedAt.current, now);
      s.counters.sessions += 1;
      badges = awardBadges(s, now);
    });
    // Saving the result swaps this screen for the result screen (same render), which shows the badges.
    onBadges(badges);
    sfx.complete();
  }

  function leave() {
    update((s) => addStudyTime(s, Date.now() - startedAt.current));
    exitTo();
  }

  const why = locked && !ok && q.type === 'mcq' && answer?.t === 'mcq' ? q.why?.[answer.choice] : undefined;
  const text = ok ? q.explain : `${why ? why + '\n' : ''}${q.type !== 'match' ? `**جواب درست:** ${rightAnswerText(q)}\n` : ''}${q.explain}`;

  return (
    <div className="session">
      <SessionTop
        onClose={() => setConfirmExit(true)}
        progress={(pos + (locked ? 1 : 0)) / questions.length}
        color="var(--accent)"
        right={
          <span className="chip accent">
            <Icon name="bolt" size={16} /> چالش امروز
          </span>
        }
      />
      <div className="session-body">
        <div className="row wrap dc-meta">
          <span className="dc-dots" aria-label={`سؤال ${pos + 1} از ${questions.length}`}>
            {questions.map((x, k) => (
              <i key={x.id} className={k < marks.length ? (marks[k] ? 'ok' : 'bad') : k === pos ? 'cur' : ''} />
            ))}
          </span>
          {lesson && <span className="small muted bold">{subjectById(lesson.subject).title}</span>}
        </div>
        <SubjectContext.Provider value={lesson ? FIELD[lesson.subject] : undefined}>
          <QuestionView q={q} answer={answer} onAnswer={setAnswer} locked={locked} onSubmit={check} />
        </SubjectContext.Provider>
      </div>
      <div className={`session-foot ${locked ? (ok ? 'ok' : 'bad') : ''}`}>
        <div className="session-foot-in">
          {!locked ? (
            <button className="btn ok lg" onClick={check} disabled={!isComplete(q, answer)}>
              بررسی
            </button>
          ) : (
            <>
              <Feedback ok={ok} title={ok ? praise(pos) : encourage(pos)} text={text} />
              <button className={`btn ${ok ? 'ok' : 'bad'} lg`} onClick={next}>
                {pos + 1 < questions.length ? 'ادامه' : 'دیدن نتیجه'}
              </button>
            </>
          )}
        </div>
      </div>
      {confirmExit && (
        <Confirm
          title="چالش را نیمه‌کاره رها می‌کنی؟"
          text={`هر وقت برگردی از اول شروع می‌شود؛ همین ${fmt(DAILY_SIZE)} سؤال تا آخر امروز منتظرت هستند.`}
          yes="خروج"
          no="ادامه می‌دهم"
          onYes={leave}
          onNo={() => setConfirmExit(false)}
        />
      )}
    </div>
  );
}

function DailyResult({ day, rec, questions, badges, onAgain }: { day: string; rec: DailyRecord; questions: Question[]; badges: BadgeDef[]; onAgain?: () => void }) {
  const s = useAppState();
  const streak = dailyStreak(s, day);
  const right = rec.marks.filter(Boolean).length;
  const all = rec.marks.length;
  const perfect = right === all;
  const [manual, setManual] = useState<string | null>(null);
  const share = dailyShareText(day, rec.marks, streak);
  const justNow = Date.now() - rec.at < 5000;

  const copy = async () => {
    sfx.tap();
    if (await copyText(share)) toast('نتیجه کپی شد؛ هر جا خواستی بفرستش.');
    else setManual(share);
  };

  return (
    <div className="session">
      {justNow && perfect && <Confetti />}
      <div className="session-body">
        <div className="result">
          <Mascot mood={perfect ? 'cheer' : right >= all / 2 ? 'happy' : 'calm'} size={110} className="pop" />
          <div className="small muted bold">چالش امروز · {fullDate(fromKey(day).getTime())}</div>
          <h1 style={{ color: perfect ? 'var(--ok)' : 'var(--ink)' }}>
            {fmt(right)} از {fmt(all)}
          </h1>
          <div className="dc-marks" aria-label={`${right} درست از ${all}`}>
            {rec.marks.map((m, k) => (
              <span key={k} className={m ? 'ok' : 'bad'}>
                <Icon name={m ? 'check' : 'x'} size={22} stroke={3} />
              </span>
            ))}
          </div>
          <p className="muted">
            {perfect ? 'همه را درست زدی! 🎯' : right >= all / 2 ? 'خوب بود! سؤال‌هایی که غلط شد در «مرور» منتظرت هستند.' : 'اشکالی ندارد؛ غلط‌ها را در «مرور» دوباره ببین.'} فردا یک چالش تازه داری.
          </p>
          <div className="result-stats">
            <div className="rstat" style={{ ['--rs' as string]: 'var(--flame)' }}>
              <div className="rs-h">روز پشت‌سرهم</div>
              <div className="rs-v">
                <Icon name="flame" size={20} style={{ color: 'var(--flame)' }} />
                {fmt(streak)}
              </div>
            </div>
            <div className="rstat" style={{ ['--rs' as string]: 'var(--accent)' }}>
              <div className="rs-h">امتیاز</div>
              <div className="rs-v">
                <bdi dir="ltr">+{fmt(rec.xp)}</bdi>
              </div>
            </div>
            <div className="rstat" style={{ ['--rs' as string]: 'var(--ok)' }}>
              <div className="rs-h">درست</div>
              <div className="rs-v">{fmt(right)}</div>
            </div>
          </div>
          <button className="btn soft dc-copy" onClick={copy}>
            <Icon name="copy" size={20} /> کپی نتیجه
          </button>
          {onAgain && (
            <button className="btn ghost dc-copy" onClick={onAgain}>
              <Icon name="refresh" size={20} /> یک دور دیگر (ثبت نمی‌شود)
            </button>
          )}
          {badges.map((b) => (
            <div key={b.id} className="card pop row" style={{ width: '100%' }}>
              <span style={{ fontSize: 34 }}>{b.emoji}</span>
              <div className="grow" style={{ textAlign: 'start' }}>
                <b>نشان جدید: {b.title}</b>
                <div className="small muted">{b.desc}</div>
              </div>
            </div>
          ))}
        </div>
        {questions.length > 0 && (
          <>
            <h2 className="section-title">سؤال‌های امروز</h2>
            <div className="stack" style={{ gap: 10 }}>
              {questions.map((q, k) => (
                <div key={q.id} className="card row dc-q" style={{ alignItems: 'flex-start' }}>
                  <span className={`dc-q-mark ${rec.marks[k] ? 'ok' : 'bad'}`}>
                    <Icon name={rec.marks[k] ? 'check' : 'x'} size={16} stroke={3} />
                  </span>
                  <div className="grow small">
                    <Rich text={q.prompt} />
                    {q.type !== 'match' && q.type !== 'graph' && (
                      <div className="muted dc-q-answer">
                        جواب درست: <Rich text={rightAnswerText(q)} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="session-foot">
        <div className="session-foot-in">
          {rec.marks.some((m) => !m) && (
            <button className="btn ghost" onClick={() => go({ name: 'review' }, true)}>
              مرور غلط‌ها
            </button>
          )}
          <button className="btn lg" onClick={() => exitTo()}>
            برگرد به خانه
          </button>
        </div>
      </div>
      {manual && (
        <Sheet title="کپی نتیجه" onClose={() => setManual(null)}>
          <p className="small muted" style={{ marginBottom: 8 }}>
            کپی خودکار این‌جا کار نکرد. متن را نگه دار و کپی کن:
          </p>
          <textarea className="text-input dc-share" readOnly value={manual} rows={5} onFocus={(e) => e.currentTarget.select()} autoFocus />
        </Sheet>
      )}
    </div>
  );
}
