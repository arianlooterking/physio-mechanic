import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { conceptById, lessonById, lessonBookLink, subjectColor } from '../content';
import type { Question } from '../content/types';
import { Blocks } from '../components/Blocks';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { QuestionView } from '../components/questions/QuestionView';
import { Rich } from '../components/Rich';
import { encourage, Feedback, praise, SessionTop } from '../components/session';
import { Confetti, Confirm, Sheet } from '../components/ui';
import { awardBadges, type BadgeDef } from '../lib/badges';
import { fmt, pct } from '../lib/digits';
import { grade, isComplete, rightAnswerText, testToQuestion, type Answer } from '../lib/grade';
import { buildPath, pickPractice, pickReview, pickWritten, trackFinish } from '../lib/learner';
import { exitTo, go, toast } from '../lib/nav';
import { sfx } from '../lib/sound';
import { addStudyTime, awardXp, conceptOf, ensureLesson, gainHearts, heartsNow, loseHeart, MAX_HEARTS, recordAnswer } from '../lib/state';
import { getState, update, useAppState } from '../lib/store';
import { clock, minutesLabel } from '../lib/time';

export function PracticeSession({ lessonId, nodeId }: { lessonId: string; nodeId: string }) {
  const lesson = lessonById(lessonId);
  const node = lesson ? buildPath(lesson).find((n) => n.id === nodeId) : undefined;
  const questions = useMemo(
    () =>
      !lesson || !node?.concepts
        ? []
        : node.kind === 'final'
          ? pickWritten(getState(), lesson)
          : node.kind === 'hard'
            ? (lesson.hard ?? []).map(testToQuestion)
            : pickPractice(getState(), lesson, node.concepts, 10),
    [lessonId, nodeId],
  );
  if (!lesson || !node || !questions.length) return <Missing />;
  return <Runner key={nodeId} questions={questions} mode="practice" lessonId={lessonId} nodeId={nodeId} color={subjectColor(lesson.subject).c} />;
}

export function MistakesSession() {
  const questions = useMemo(() => pickReview(getState(), 10), []);
  if (!questions.length) {
    return (
      <div className="onb">
        <div className="onb-body center">
          <Mascot mood="cheer" size={120} />
          <h1>اشتباهی برای مرور نمانده!</h1>
          <p className="lead">هر وقت در تمرین‌ها اشتباه کنی، آن سؤال‌ها اینجا جمع می‌شوند تا دوباره تمرینشان کنی.</p>
          <button className="btn lg" onClick={() => exitTo({ name: 'review' })}>
            باشه
          </button>
        </div>
      </div>
    );
  }
  return <Runner questions={questions} mode="review" color="var(--primary)" />;
}

function Missing() {
  return (
    <div className="onb">
      <div className="onb-body center">
        <Mascot mood="oops" />
        <h1>این تمرین پیدا نشد</h1>
        <button className="btn" onClick={() => exitTo()}>
          بازگشت به خانه
        </button>
      </div>
    </div>
  );
}

interface Item {
  q: Question;
  attempt: number;
  retry: boolean;
}

function Runner({ questions, mode, lessonId, nodeId, color }: { questions: Question[]; mode: 'practice' | 'review'; lessonId?: string; nodeId?: string; color: string }) {
  const state = useAppState();
  const [queue, setQueue] = useState<Item[]>(() => questions.map((q) => ({ q, attempt: 0, retry: false })));
  const [pos, setPos] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [locked, setLocked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [combo, setCombo] = useState(0);
  const [firstTry, setFirstTry] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(false);
  const [outOfHearts, setOutOfHearts] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [peek, setPeek] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ xp: number; badges: BadgeDef[]; ms: number } | null>(null);
  // Answered questions, so «قبلی» can show them again (read-only) without losing the current answer.
  const [history, setHistory] = useState<{ item: Item; answer: Answer; correct: boolean }[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const startedAt = useRef(Date.now());
  const hearts = heartsNow(state).n;

  const item = queue[pos];
  const total = queue.length;
  const progress = finished ? 1 : pos / total;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pos, viewing]);

  function check() {
    if (!item || !answer || !isComplete(item.q, answer)) return;
    const ok = grade(item.q, answer);
    setCorrect(ok);
    setLocked(true);
    setHistory((h) => [...h, { item, answer, correct: ok }]);
    if (!item.retry) setFirstTry((f) => ({ ...f, [item.q.id]: ok }));
    update((s) => {
      recordAnswer(s, item.q, ok, mode === 'review' ? 'review' : 'practice');
      // Self-marked written answers never cost a heart: honesty must not be punished.
      if (!ok && mode === 'practice' && item.q.type !== 'written' && !nodeId?.endsWith(':hard')) loseHeart(s);
      if (ok && mode === 'review') gainHearts(s, 1);
    });
    if (ok) {
      sfx.correct();
      const c = combo + 1;
      setCombo(c);
      if (c === 3 || c === 5 || c === 8) toast(`🔥 ${c} جواب درست پشت‌سرهم!`);
    } else {
      sfx.wrong();
      setCombo(0);
    }
  }

  function next() {
    let q = queue;
    if (!correct && item && !item.retry) {
      // Bring the question back once at the end, shuffled differently.
      q = [...queue, { q: item.q, attempt: item.attempt + 1, retry: true }];
      setQueue(q);
    }
    setAnswer(null);
    setLocked(false);
    if (mode === 'practice' && !correct && heartsNow(getState()).n <= 0) {
      setOutOfHearts(true);
      return;
    }
    if (pos + 1 >= q.length) finish();
    else setPos(pos + 1);
  }

  function finish() {
    const unique = questions.length;
    // firstTry already includes the last question: it was set when that answer was checked.
    const right = questions.filter((x) => firstTry[x.id]).length;
    const perfect = right === unique;
    const xp = mode === 'practice' ? 10 + right + (perfect ? 5 : 0) : 5 + right;
    const ms = Date.now() - startedAt.current;
    let fresh: BadgeDef[] = [];
    update((s) => {
      awardXp(s, xp);
      addStudyTime(s, ms);
      s.counters.sessions += 1;
      if (mode === 'practice' && lessonId && nodeId) {
        trackFinish(s, lessonId, () => {
          const lp = ensureLesson(s, lessonId);
          lp.practiceRuns += 1;
          if (perfect) lp.perfectRuns += 1;
          lp.done = { ...(lp.done ?? {}), [nodeId]: lp.done?.[nodeId] ?? Date.now() };
        });
      }
      if (perfect && mode === 'practice') s.counters.perfect += 1;
      if (mode === 'review') s.counters.reviewsDone += 1;
      fresh = awardBadges(s);
    });
    sfx.complete();
    setSummary({ xp, badges: fresh, ms });
    setFinished(true);
  }

  function leave() {
    if (!finished) update((s) => addStudyTime(s, Date.now() - startedAt.current));
    exitTo(mode === 'review' ? { name: 'review' } : { name: 'home' });
  }

  if (finished && summary) {
    const unique = questions.length;
    const right = questions.filter((x) => firstTry[x.id]).length;
    const acc = right / unique;
    return (
      <div className="session">
        <Confetti />
        <div className="session-body">
          <div className="result">
            <Mascot mood={acc >= 0.7 ? 'cheer' : 'happy'} size={130} className="pop" />
            <h1>{acc === 1 ? 'بی‌نقص! 🎯' : acc >= 0.7 ? 'تمرین تمام شد!' : 'تمام شد؛ ادامه بده!'}</h1>
            <p className="muted">
              {acc >= 0.7
                ? 'عالی پیش رفتی. سؤال‌هایی که اشتباه زدی در «مرور» منتظرت هستند.'
                : 'سؤال‌هایی که اشتباه شدند برای مرور ذخیره شدند. یک بار دیگر توضیح‌ها را ببین و دوباره تمرین کن؛ قوی‌تر برمی‌گردی.'}
            </p>
            <div className="result-stats">
              <div className="rstat" style={{ ['--rs' as string]: 'var(--accent)' }}>
                <div className="rs-h">امتیاز</div>
                <div className="rs-v">
                  <Icon name="bolt" size={20} style={{ color: 'var(--accent)' }} /><bdi dir="ltr">+{summary.xp}</bdi>
                </div>
              </div>
              <div className="rstat" style={{ ['--rs' as string]: 'var(--ok)' }}>
                <div className="rs-h">دقت</div>
                <div className="rs-v">{pct(acc)}</div>
              </div>
              <div className="rstat" style={{ ['--rs' as string]: 'var(--primary)' }}>
                <div className="rs-h">زمان</div>
                <div className="rs-v small">{clock(summary.ms / 1000)}</div>
              </div>
            </div>
            <ConceptDeltas questions={questions} />
            {summary.badges.map((b) => (
              <div key={b.id} className="card pop row" style={{ width: '100%' }}>
                <span style={{ fontSize: 34 }}>{b.emoji}</span>
                <div className="grow" style={{ textAlign: 'start' }}>
                  <b>نشان جدید: {b.title}</b>
                  <div className="small muted">{b.desc}</div>
                </div>
              </div>
            ))}
            <p className="small muted">زمان مطالعه: {minutesLabel(summary.ms)}</p>
          </div>
        </div>
        <div className="session-foot">
          <div className="session-foot-in">
            {mode === 'practice' && lessonId ? (
              <>
                <button className="btn ghost" onClick={() => go({ name: 'lesson', lessonId }, true)}>
                  جزئیات درس
                </button>
                <button className="btn lg" onClick={leave}>
                  ادامه
                </button>
              </>
            ) : (
              <button className="btn lg" onClick={leave}>
                ادامه
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!item) return null;
  const past = viewing !== null ? history[viewing] : null;
  const shown = past ? past.item : item;
  const q = shown.q;
  const conceptTitle = conceptById(q.concept)?.concept.title;
  // Answered questions of this session, newest last; the current one is not in it until checked.
  const backTo = viewing !== null ? viewing - 1 : locked ? history.length - 2 : history.length - 1;
  const backBtn =
    backTo >= 0 ? (
      <button className="btn ghost back-step" onClick={() => setViewing(backTo)} aria-label="سؤال قبلی">
        <Icon name="back" size={18} /> <span className="lbl">قبلی</span>
      </button>
    ) : null;
  let foot: ReactNode;
  let footClass = '';
  if (past) {
    footClass = past.correct ? 'ok' : 'bad';
    const why = !past.correct && q.type === 'mcq' && past.answer.t === 'mcq' ? q.why?.[past.answer.choice] : undefined;
    const last = viewing! >= (locked ? history.length - 1 : history.length) - 1;
    foot = (
      <>
        <Feedback
          ok={past.correct}
          title={past.correct ? 'این را درست جواب دادی' : 'این را اشتباه زدی'}
          text={past.correct ? q.explain : `${why ? why + '\n' : ''}${q.type !== 'match' ? `**جواب درست:** ${rightAnswerText(q)}\n` : ''}${q.explain}`}
        />
        {backBtn}
        <button className="btn lg" onClick={() => setViewing(last ? null : viewing! + 1)}>
          {last ? 'برگرد به سؤال فعلی' : 'بعدی'}
        </button>
      </>
    );
  } else if (!locked) {
    foot = (
      <>
        {backBtn}
        {mode === 'practice' && (
          <button
            className="btn ghost"
            onClick={() => {
              setPeek(q.concept);
            }}
          >
            <Icon name="bulb" size={18} /> یادم بده
          </button>
        )}
        <button className="btn ok lg" onClick={check} disabled={!isComplete(q, answer)}>
          بررسی
        </button>
      </>
    );
  } else {
    footClass = correct ? 'ok' : 'bad';
    const why = !correct && q.type === 'mcq' && answer?.t === 'mcq' ? q.why?.[answer.choice] : undefined;
    foot = (
      <>
        <Feedback
          ok={correct}
          title={correct ? praise(pos + combo) : encourage(pos)}
          text={correct ? q.explain : `${why ? why + '\n' : ''}${q.type !== 'match' ? `**جواب درست:** ${rightAnswerText(q)}\n` : ''}${q.explain}`}
          questionId={q.id}
          extra={
            !correct ? (
              <button className="link-btn" style={{ padding: '4px 0' }} onClick={() => setPeek(q.concept)}>
                <Icon name="bulb" size={16} /> این مفهوم را دوباره برایم توضیح بده
              </button>
            ) : undefined
          }
        />
        <button className={`btn ${correct ? 'ok' : 'bad'} lg`} onClick={next}>
          ادامه
        </button>
      </>
    );
  }

  return (
    <div className="session">
      <SessionTop
        onClose={() => setConfirmExit(true)}
        progress={progress}
        color={color}
        right={
          mode === 'practice' ? (
            <span className="stat-pill heart" aria-label={`${hearts} قلب`}>
              <Icon name="heart" size={22} /> {hearts}
            </span>
          ) : (
            <span className="chip primary">مرور</span>
          )
        }
      />
      <div className="session-body">
        {past && (
          <div className="chip primary" style={{ marginTop: 8 }}>
            <Icon name="review" size={16} /> مرور سؤال {fmt(viewing! + 1)}؛ فقط برای دیدن
          </div>
        )}
        {!past && item.retry && <div className="chip accent" style={{ marginTop: 8 }}>دوباره همین را امتحان کن</div>}
        {conceptTitle && (
          <div className="small muted bold" style={{ marginTop: 8 }}>
            <Rich text={conceptTitle} />
          </div>
        )}
        {past ? (
          <QuestionView key={`past-${viewing}`} q={q} answer={past.answer} onAnswer={() => {}} locked attempt={past.item.attempt} onSubmit={() => {}} />
        ) : (
          <QuestionView q={q} answer={answer} onAnswer={setAnswer} locked={locked} attempt={item.attempt} onSubmit={check} />
        )}
      </div>
      <div className={`session-foot ${footClass}`}>
        <div className="session-foot-in">{foot}</div>
      </div>

      {peek && <ConceptPeek conceptId={peek} onClose={() => setPeek(null)} />}
      {confirmExit && (
        <Confirm
          title="تمرین را نیمه‌کاره رها می‌کنی؟"
          text="جواب‌هایی که داده‌ای ثبت شده‌اند، ولی امتیاز پایان تمرین را نمی‌گیری."
          yes="خروج"
          no="ادامه می‌دهم"
          onYes={leave}
          onNo={() => setConfirmExit(false)}
        />
      )}
      {outOfHearts && (
        <Sheet title="قلب‌هایت تمام شد" onClose={leave}>
          <div className="stack center">
            <Mascot mood="calm" size={100} />
            <p>
              اشکالی ندارد؛ اشتباه بخشی از یادگیری است. هر {fmt(25)} دقیقه یک قلب برمی‌گردد. با <b>مرور اشتباه‌ها</b> هم می‌توانی همین الان قلب جمع کنی (هر جواب درست = یک قلب، تا {MAX_HEARTS}).
            </p>
            <button className="btn lg block" onClick={() => go({ name: 'mistakes' }, true)}>
              <Icon name="refresh" /> مرور اشتباه‌ها و پر کردن قلب
            </button>
            <button className="btn ghost block" onClick={leave}>
              فعلاً بس است
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function ConceptDeltas({ questions }: { questions: Question[] }) {
  const s = useAppState();
  const ids = Array.from(new Set(questions.map((q) => q.concept)));
  return (
    <div className="card" style={{ width: '100%', textAlign: 'start' }}>
      <h3 style={{ marginBottom: 6 }}>تسلط تو روی مفهوم‌ها</h3>
      {ids.map((id) => {
        const c = conceptById(id);
        const m = conceptOf(s, id).mastery;
        return (
          <div className="mastery-row" key={id}>
            <span className="small">
              <Rich text={c?.concept.title ?? id} />
            </span>
            <div className="bar thin">
              <span style={{ width: `${m * 100}%`, background: m >= 0.75 ? 'var(--ok)' : m >= 0.45 ? 'var(--accent)' : 'var(--bad)' }} />
            </div>
            <span className="small bold">{pct(m)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Quick refresher of a concept without leaving the session. */
export function ConceptPeek({ conceptId, onClose }: { conceptId: string; onClose: () => void }) {
  const hit = conceptById(conceptId);
  const s = getState();
  if (!hit) return null;
  const { concept, lesson } = hit;
  const best = conceptOf(s, conceptId).understoodWith;
  const approach = concept.approaches.find((a) => a.kind === best) ?? concept.approaches[0];
  return (
    <Sheet
      title={<Rich text={concept.title} />}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn ghost" onClick={() => go({ name: 'learn', lessonId: lesson.id, conceptId }, true)}>
            درس کامل این مفهوم
          </button>
          <button className="btn" onClick={onClose}>
            برگردم به سؤال
          </button>
        </>
      }
    >
      <div className="summary-card" style={{ marginBottom: 14 }}>
        <h3>
          <Icon name="starf" style={{ color: 'var(--accent)' }} /> خلاصهٔ طلایی
        </h3>
        <ul>
          {concept.summary.map((x, i) => (
            <li key={i}>
              <Rich text={x} />
            </li>
          ))}
        </ul>
      </div>
      <h3 style={{ margin: '4px 0 10px', fontSize: '1rem' }}>
        <Rich text={approach.title} />
      </h3>
      <Blocks blocks={approach.blocks} bookLink={lessonBookLink(lesson)} />
    </Sheet>
  );
}
