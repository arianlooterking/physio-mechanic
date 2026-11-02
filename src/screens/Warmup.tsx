import { useEffect, useRef, useState } from 'react';
import { lessonById, subjectById, subjectColor } from '../content';
import { WARMUPS } from '../content/warmups';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { QuestionView } from '../components/questions/QuestionView';
import { Rich } from '../components/Rich';
import { encourage, Feedback, praise, SessionTop } from '../components/session';
import { grade, isComplete, rightAnswerText, type Answer } from '../lib/grade';
import { exitTo, go } from '../lib/nav';
import { sfx } from '../lib/sound';
import { ensureLesson } from '../lib/state';
import { update } from '../lib/store';
import { fmt } from '../lib/digits';

/**
 * «پیش از درس»: one minute before a lesson's first concept. Why the lesson matters, what the learner will be able
 * to do, and a short warm-up on what they need to know already, each answer followed by a reminder. Nothing here
 * is graded into the learner model.
 */
export function Warmup({ lessonId, next }: { lessonId: string; next?: string }) {
  const lesson = lessonById(lessonId);
  const w = WARMUPS[lessonId];
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [locked, setLocked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  if (!lesson || !w) {
    return (
      <div className="onb">
        <div className="onb-body center">
          <Mascot mood="oops" />
          <h1>این بخش پیدا نشد</h1>
          <button className="btn" onClick={() => exitTo()}>
            بازگشت به خانه
          </button>
        </div>
      </div>
    );
  }
  const subject = subjectById(lesson.subject);
  const col = subjectColor(lesson.subject);
  const n = w.prereqs.length;
  const qi = step - 1;
  const item = step >= 1 && step <= n ? w.prereqs[qi] : null;
  const done = step > n;

  function start() {
    update((s) => {
      ensureLesson(s, lessonId).warmed = Date.now();
    });
    go({ name: 'learn', lessonId, conceptId: next ?? lesson!.concepts[0].id }, true);
  }

  function check() {
    if (!item || !answer || !isComplete(item.q, answer)) return;
    const ok = grade(item.q, answer);
    setCorrect(ok);
    setLocked(true);
    if (ok) setScore((x) => x + 1);
    if (ok) sfx.correct();
    else sfx.wrong();
  }

  function advance() {
    setAnswer(null);
    setLocked(false);
    setStep((x) => x + 1);
  }

  let foot: React.ReactNode;
  let footClass = '';
  if (step === 0) {
    foot = (
      <>
        <button className="btn ghost" onClick={start}>
          رد شو
        </button>
        <button className="btn lg" onClick={advance}>
          گرم کنیم
        </button>
      </>
    );
  } else if (item && !locked) {
    foot = (
      <button className="btn ok lg" onClick={check} disabled={!isComplete(item.q, answer)}>
        بررسی
      </button>
    );
  } else if (item) {
    footClass = correct ? 'ok' : 'bad';
    foot = (
      <>
        <Feedback
          ok={correct}
          title={correct ? praise(qi) : encourage(qi)}
          text={`${correct ? '' : `**جواب درست:** ${rightAnswerText(item.q)}\n`}${item.q.explain}\n\n📌 ${item.refresh}`}
        />
        <button className={`btn ${correct ? 'ok' : 'bad'} lg`} onClick={advance}>
          ادامه
        </button>
      </>
    );
  } else {
    foot = (
      <button className="btn lg" onClick={start}>
        شروع درس
      </button>
    );
  }

  return (
    <div className="session warmup">
      <SessionTop onClose={() => exitTo({ name: 'lesson', lessonId })} progress={done ? 1 : step / (n + 1)} color={col.c} />
      <div className="session-body" ref={bodyRef}>
        <div className="concept-head">
          <div className="row small muted bold">
            <span style={{ color: col.c }}>{subject.title}</span>
            <span>·</span>
            <span>{lesson.label}</span>
          </div>
          <h1>
            <Rich text={lesson.title} />
          </h1>
        </div>

        {step === 0 && (
          <div className="stack" style={{ gap: 14 }}>
            <section className="intro-card" style={{ ['--u' as string]: col.c }} aria-labelledby="wu-h">
              <span className="intro-kicker" id="wu-h">
                <Icon name="target" size={15} /> پیش از درس: این درس به چه دردت می‌خورد؟
              </span>
              <div className="intro-talk">
                <Mascot mood="wave" size={64} />
                <div className="speech">
                  <Rich text={w.why} />
                </div>
              </div>
              <div className="warmup-uses">
                {w.uses.map((u) => (
                  <span key={u} className="chip">
                    <Icon name="check" size={14} /> {u}
                  </span>
                ))}
              </div>
            </section>
            <section className="card stack" style={{ gap: 8 }}>
              <b>در پایان این درس می‌توانی:</b>
              <ol className="warmup-goals">
                {lesson.concepts.map((c) => (
                  <li key={c.id}>
                    <Rich text={c.goal} />
                  </li>
                ))}
              </ol>
            </section>
            <p className="small muted center">قبل از شروع، با {fmt(n)} سؤال کوتاه چیزهایی را که از قبل لازم داری یادت می‌آوریم. نمره ندارد.</p>
          </div>
        )}

        {item && <QuestionView q={item.q} answer={answer} onAnswer={setAnswer} locked={locked} onSubmit={check} kicker={`گرم کردن ${fmt(step)} از ${fmt(n)}`} />}

        {done && (
          <div className="result">
            <Mascot mood={score === n ? 'cheer' : 'happy'} size={110} />
            <h2>{score === n ? 'آماده‌ای!' : score >= n / 2 ? 'تقریباً آماده‌ای' : 'خوب شد که مرور کردیم'}</h2>
            <p className="muted">
              {fmt(score)} از {fmt(n)} درست.{' '}
              {score === n ? 'پیش‌نیازها را بلدی؛ برویم سراغ درس.' : 'یادآوری‌ها را دیدی؛ اگر جایی از درس سخت شد، «یک توضیح دیگر» را بزن.'}
            </p>
          </div>
        )}
      </div>

      <div className={`session-foot ${footClass}`}>
        <div className="session-foot-in">{foot}</div>
      </div>
    </div>
  );
}
