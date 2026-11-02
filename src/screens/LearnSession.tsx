import { useEffect, useMemo, useRef, useState } from 'react';
import { conceptById, lessonBookLink, subjectById, subjectColor } from '../content';
import { findTerm } from '../content/glossary';
import { INTROS, introTerms } from '../content/intros';
import { WARMUPS } from '../content/warmups';
import { openGlossary, useSubject } from '../components/Glossary';
import type { ApproachKind, Question } from '../content/types';
import { Blocks } from '../components/Blocks';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { QuestionView } from '../components/questions/QuestionView';
import { Rich } from '../components/Rich';
import { encourage, Feedback, KIND_META, praise, SessionTop } from '../components/session';
import { TutorSheet, type TutorContext } from '../components/TutorSheet';
import { Confetti, Confirm } from '../components/ui';
import { useOwner } from '../lib/account';
import { detectTutor, type TutorProvider } from '../lib/ai';
import { awardBadges, type BadgeDef } from '../lib/badges';
import { grade, isComplete, rightAnswerText, type Answer } from '../lib/grade';
import { buildPath, nodeDone, trackFinish } from '../lib/learner';
import { exitTo, go, toast } from '../lib/nav';
import { sfx } from '../lib/sound';
import { addStudyTime, awardXp, conceptOf, lessonOf, markApproachSeen, markUnderstood, nextApproach, recordAnswer, type Confusion } from '../lib/state';
import { getState, update } from '../lib/store';

type Phase = 'intro' | 'explain' | 'confused' | 'check' | 'exhausted' | 'done';

const CONFUSIONS: { v: Confusion; label: string; ai: string }[] = [
  { v: 'examples', label: '🧩 مثال بیشتر می‌خواهم', ai: 'مثال‌های بیشتر و ساده‌تر می‌خواهم' },
  { v: 'formula', label: '🔣 فرمولش گیجم کرده', ai: 'فرمول‌ها و نمادها گیجم کرده‌اند' },
  { v: 'figure', label: '📈 نمودار و شکلش را نمی‌فهمم', ai: 'نمودار و شکل را نمی‌فهمم' },
  { v: 'lost', label: '😵 کلاً گیج شدم', ai: 'کل موضوع برایم گنگ است؛ از پایه توضیح بده' },
];

export function LearnSession({ lessonId, conceptId }: { lessonId: string; conceptId: string }) {
  const hit = conceptById(conceptId);
  if (!hit || hit.lesson.id !== lessonId) {
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
  // First time into a lesson: «پیش از درس» comes first (once; it can be skipped).
  const st = getState();
  if (WARMUPS[lessonId] && !lessonOf(st, lessonId).warmed && hit.lesson.concepts.every((c) => conceptOf(st, c.id).status === 'new')) {
    return <ToWarmup lessonId={lessonId} conceptId={conceptId} />;
  }
  return <Learn key={conceptId} conceptId={conceptId} />;
}

function ToWarmup({ lessonId, conceptId }: { lessonId: string; conceptId: string }) {
  useEffect(() => go({ name: 'warmup', lessonId, next: conceptId }, true), [lessonId, conceptId]);
  return null;
}

function Learn({ conceptId }: { conceptId: string }) {
  const { concept, lesson } = conceptById(conceptId)!;
  const subject = subjectById(lesson.subject);
  const field = useSubject();
  const col = subjectColor(lesson.subject);
  const kinds = concept.approaches.map((a) => a.kind);
  const bookLink = useMemo(() => lessonBookLink(lesson), [lesson]);
  const startedAt = useRef(Date.now());
  const wasUnderstood = useRef(conceptOf(getState(), conceptId).status === 'understood');
  const owner = useOwner();

  // A refresh (or coming back later) reopens the concept at the explanation the learner was on.
  const saved = useMemo(() => loadResume(conceptId, concept.approaches.length), [conceptId, concept.approaches.length]);
  const [seen, setSeen] = useState<number[]>(saved?.seen ?? [0]);
  const [current, setCurrent] = useState(saved?.current ?? 0);
  // Start with the plain-language context, unless the learner is coming back to a concept already under way.
  const intro = INTROS[conceptId];
  const [phase, setPhase] = useState<Phase>(intro && !saved ? 'intro' : 'explain');
  const [checkIdx, setCheckIdx] = useState(() => saved?.checkIdx ?? firstCheck(concept.checks));
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [locked, setLocked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [checkAttempts, setCheckAttempts] = useState(0);
  const [confusion, setConfusion] = useState<Confusion | undefined>();
  const [tutor, setTutor] = useState<null | 'chat' | 'explain' | 'teachback'>(null);
  const [provider, setProvider] = useState<TutorProvider | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [newBadges, setNewBadges] = useState<BadgeDef[]>([]);
  const [xpGained, setXpGained] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void detectTutor().then(setProvider);
    update((s) => markApproachSeen(s, conceptId, 0));
  }, [conceptId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [current, phase]);

  useEffect(() => {
    if (phase === 'done') clearResume();
    else if (phase !== 'intro') saveResume({ conceptId, seen, current, checkIdx, t: Date.now() });
  }, [conceptId, seen, current, checkIdx, phase]);

  const approach = concept.approaches[current];
  const meta = KIND_META[approach.kind];
  const q: Question = concept.checks[checkIdx % concept.checks.length];
  const progress = phase === 'done' ? 1 : Math.min(0.92, (seen.length / (kinds.length + 1)) * 0.75 + (phase === 'check' ? 0.2 : 0));

  const tutorCtx: TutorContext = {
    subject: subject.title,
    lesson: lesson.title,
    concept: concept.title,
    summary: concept.summary,
    tried: seen.map((i) => concept.approaches[i].title.replace(/\$/g, '')),
    confusion: CONFUSIONS.find((c) => c.v === confusion)?.ai,
  };

  function show(i: number) {
    setCurrent(i);
    setPhase('explain');
    if (!seen.includes(i)) {
      setSeen((prev) => [...prev, i]);
      update((s) => markApproachSeen(s, conceptId, i));
    }
  }

  function nextExplanation(c?: Confusion) {
    const style = getState().style;
    const n = nextApproach(kinds, seen, style, c ?? confusion);
    if (n === null) {
      setPhase('exhausted');
      return;
    }
    show(n);
  }

  function startCheck() {
    setAnswer(null);
    setLocked(false);
    setPhase('check');
  }

  function onCheck() {
    if (!answer || !isComplete(q, answer)) return;
    const ok = grade(q, answer);
    setCorrect(ok);
    setLocked(true);
    setCheckAttempts((n) => n + 1);
    if (ok) sfx.correct();
    else sfx.wrong();
    update((s) => recordAnswer(s, q, ok, 'check'));
  }

  function afterCheck() {
    if (correct) {
      finish();
      return;
    }
    // Wrong: next time use a different check question, and explain again from another angle.
    setCheckIdx((i) => i + 1);
    setAnswer(null);
    setLocked(false);
    const style = getState().style;
    const n = nextApproach(kinds, seen, style, confusion);
    if (n === null) setPhase('exhausted');
    else {
      toast('بیا از یک زاویهٔ دیگر نگاهش کنیم 💡');
      show(n);
    }
  }

  function finish() {
    const shownKinds: ApproachKind[] = seen.map((i) => concept.approaches[i].kind);
    // credit the explanation the student was on when it clicked
    const ordered = [...shownKinds.filter((k) => k !== approach.kind), approach.kind];
    const xp = (wasUnderstood.current ? 5 : 15) + (checkAttempts <= 1 ? 5 : 0);
    let fresh: BadgeDef[] = [];
    update((s) => {
      trackFinish(s, lesson.id, () => markUnderstood(s, conceptId, ordered));
      awardXp(s, xp);
      addStudyTime(s, Date.now() - startedAt.current);
      s.counters.sessions += 1;
      fresh = awardBadges(s);
    });
    setXpGained(xp);
    setNewBadges(fresh);
    sfx.aha();
    setPhase('done');
  }

  function goNext() {
    const s = getState();
    const nodes = buildPath(lesson);
    const here = nodes.findIndex((n) => n.conceptId === conceptId);
    const next = nodes.slice(here + 1).find((n) => !nodeDone(s, lesson, n));
    if (next?.kind === 'concept') go({ name: 'learn', lessonId: lesson.id, conceptId: next.conceptId! }, true);
    else if (next?.kind === 'practice' || next?.kind === 'final' || next?.kind === 'hard') go({ name: 'practice', lessonId: lesson.id, nodeId: next.id }, true);
    else exitTo({ name: 'home' });
  }

  function leave() {
    update((s) => addStudyTime(s, Date.now() - startedAt.current));
    exitTo({ name: 'home' });
  }

  /* ---------------- render ---------------- */

  let foot: React.ReactNode = null;
  let footClass = '';
  const seenAt = seen.indexOf(current);
  const prev = seenAt > 0 ? seen[seenAt - 1] : null;
  if (phase === 'intro') {
    foot = (
      <button className="btn lg" onClick={() => setPhase('explain')} style={{ flex: 1 }}>
        بزن بریم؛ اولین توضیح <Icon name="next" />
      </button>
    );
  } else if (phase === 'explain') {
    foot = (
      <>
        <div className="understood-ask">این توضیح را فهمیدی؟</div>
        {prev !== null && (
          <button className="btn ghost back-step" onClick={() => show(prev)} aria-label="توضیح قبلی">
            <Icon name="back" size={18} /> <span className="lbl">قبلی</span>
          </button>
        )}
        <button className="btn ghost" onClick={() => setPhase('confused')}>
          <Icon name="refresh" /> جور دیگه بگو
        </button>
        <button className="btn ok" onClick={startCheck}>
          <Icon name="check" /> فهمیدم
        </button>
      </>
    );
  } else if (phase === 'confused') {
    foot = (
      <>
        <div className="understood-ask">کجایش گنگ بود؟ (این کمک می‌کند توضیح بعدی بهتر باشد)</div>
        <div className="confusion" style={{ width: '100%' }}>
          {CONFUSIONS.map((c) => (
            <button
              key={c.v}
              onClick={() => {
                setConfusion(c.v);
                nextExplanation(c.v);
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button className="btn ghost back-step" onClick={() => setPhase('explain')}>
          <Icon name="back" size={18} /> برگرد
        </button>
        <button className="btn" onClick={() => nextExplanation()}>
          فقط یه جور دیگه بگو
        </button>
      </>
    );
  } else if (phase === 'check') {
    if (!locked) {
      foot = (
        <>
          <button className="btn ghost back-step" onClick={() => setPhase('explain')} aria-label="برگشت به توضیح">
            <Icon name="back" size={18} /> <span className="lbl">توضیح</span>
          </button>
          <button className="btn ok lg" onClick={onCheck} disabled={!isComplete(q, answer)}>
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
            title={correct ? praise(checkAttempts) : encourage(checkAttempts)}
            text={correct ? q.explain : `${why ? why + '\n' : ''}${q.type !== 'match' ? `**جواب درست:** ${rightAnswerText(q)}\n` : ''}${q.explain}`}
            questionId={q.id}
          />
          <button className={`btn ${correct ? 'ok' : 'bad'} lg`} onClick={afterCheck}>
            {correct ? 'ادامه' : 'یک توضیح دیگر ببینم'}
          </button>
        </>
      );
    }
  }

  return (
    <div className="session">
      <SessionTop
        onClose={() => (phase === 'done' ? leave() : setConfirmExit(true))}
        progress={progress}
        color={col.c}
        right={
          <button className="icon-btn" onClick={() => setTutor('chat')} aria-label="از بیو بپرس" title="از بیو بپرس">
            <Icon name="chat" />
          </button>
        }
      />
      <div className="session-body" ref={bodyRef}>
        {phase !== 'done' && (
          <div className="concept-head">
            <div className="row small muted bold">
              <span style={{ color: col.c }}>{subject.title}</span>
              <span>·</span>
              <span>{lesson.title}</span>
            </div>
            <h1>
              <Rich text={concept.title} />
            </h1>
            <div className="concept-goal">
              🎯 <Rich text={concept.goal} />
            </div>
          </div>
        )}

        {phase === 'intro' && intro && (
          <section className="intro-card" style={{ ['--u' as string]: col.c }} aria-labelledby="intro-h">
            <span className="intro-kicker" id="intro-h">
              <Icon name="sparkles" size={15} /> پیش از شروع
            </span>
            <div className="intro-talk">
              <Mascot mood="wave" size={74} glow={false} />
              <div className="speech">
                <Rich text={intro} />
              </div>
            </div>
            <div className="intro-goal">
              <span className="ic-wrap">
                <Icon name="target" size={18} />
              </span>
              <div>
                <b>در این بخش یاد می‌گیری </b>
                <Rich text={concept.goal} />
              </div>
            </div>
            {introTerms(intro).length > 0 && (
              <div className="intro-terms">
                <span>کلمه‌های کلیدی؛ برای دیدن معنی هرکدام، رویش بزن</span>
                <div className="chips">
                  {introTerms(intro).map((w) => {
                    const t = findTerm(w, field);
                    return t ? (
                      <button key={w} onClick={(e) => openGlossary(e.currentTarget, [t])}>
                        {t.title}
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
            )}
            <div className="tap-tip">
              <Icon name="hint" size={16} /> در توضیح‌ها هم روی کلمه‌های رنگی و فرمول‌هایی که خط‌چین دارند بزن تا معنی‌شان را ببینی.
            </div>
          </section>
        )}

        {(phase === 'explain' || phase === 'confused') && (
          <>
            <div className="approach-tabs" role="tablist" aria-label="توضیح‌ها">
              {intro && (
                <button className="approach-tab seen" onClick={() => setPhase('intro')} title="مقدمه">
                  <Icon name="sparkles" size={15} />
                  مقدمه
                </button>
              )}
              {concept.approaches.map((a, i) => {
                // The owner can open any explanation; learners unlock them one by one.
                const was = seen.includes(i) || owner;
                return (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={i === current}
                    className={`approach-tab${i === current ? ' active' : was ? ' seen' : ''}`}
                    onClick={() => (was ? show(i) : undefined)}
                    disabled={!was}
                    title={was ? a.title.replace(/\$/g, '') : 'هنوز باز نشده'}
                  >
                    <Icon name={was ? KIND_META[a.kind].icon : 'lock'} size={15} />
                    {KIND_META[a.kind].label}
                  </button>
                );
              })}
            </div>
            <article className="explain" key={current}>
              <div className="explain-kind">
                <span className="k-ic">
                  <Icon name={meta.icon} size={24} />
                </span>
                <div>
                  <small>
                    توضیح {seen.indexOf(current) + 1} · {meta.sub}
                  </small>
                  <h2>
                    <Rich text={approach.title} />
                  </h2>
                </div>
              </div>
              <Blocks blocks={approach.blocks} bookLink={bookLink} />
            </article>
            <div className="row wrap" style={{ marginTop: 14, justifyContent: 'center' }}>
              <button className="link-btn" onClick={() => setTutor('chat')}>
                <Icon name="chat" size={18} /> سؤال دارم؟ از بیو بپرس
              </button>
            </div>
          </>
        )}

        {phase === 'check' && (
          <>
            <div className="mascot-row" style={{ marginBottom: 6 }}>
              <Mascot mood={locked ? (correct ? 'cheer' : 'oops') : 'think'} size={70} />
              <div className="speech small">
                {locked
                  ? correct
                    ? 'دیدی؟ واقعاً فهمیده بودی!'
                    : 'عیبی ندارد. یعنی هنوز یک تکه‌اش جا نیفتاده؛ با یک توضیح دیگر درستش می‌کنیم.'
                  : 'برای اینکه مطمئن شویم، یک سؤال کوتاه:'}
              </div>
            </div>
            <QuestionView q={q} answer={answer} onAnswer={setAnswer} locked={locked} attempt={checkAttempts} onSubmit={onCheck} />
          </>
        )}

        {phase === 'exhausted' && (
          <div className="stack" style={{ animation: 'rise .3s' }}>
            <div className="mascot-row">
              <Mascot mood="calm" size={80} />
              <div className="speech">
                همهٔ توضیح‌های آماده را دیدی. این یعنی این مفهوم کمی سخت است؛ نه اینکه تو نمی‌توانی! بیا یک راه دیگر امتحان کنیم:
              </div>
            </div>
            {provider && provider !== 'offline' && (
              <button className="btn lg" onClick={() => setTutor('explain')}>
                <Icon name="sparkles" /> بیو با هوش مصنوعی یک توضیح تازه بسازد
              </button>
            )}
            <div className="summary-card">
              <h3>
                <Icon name="starf" style={{ color: 'var(--accent)' }} /> خلاصهٔ طلایی
              </h3>
              <ul>
                {concept.summary.map((s, i) => (
                  <li key={i}>
                    <Rich text={s} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="row wrap">
              <button
                className="btn ghost grow"
                onClick={() => {
                  setSeen([0]);
                  show(0);
                }}
              >
                <Icon name="refresh" /> از اول، آرام‌تر بخوانم
              </button>
              <button className="btn ok grow" onClick={startCheck}>
                حالا فهمیدم؛ امتحانم کن
              </button>
            </div>
            {(concept.pages?.[0] ?? lesson.pages[0]) > 0 && (
            <a className="book-ref" href={bookLink(concept.pages?.[0] ?? lesson.pages[0])} target="_blank" rel="noopener noreferrer">
              <Icon name="book" size={20} />
              <span className="grow">متن کتاب درسی را هم ببین (صفحهٔ {concept.pages?.[0] ?? lesson.pages[0]})</span>
              <Icon name="external" size={16} />
            </a>
            )}
            <p className="small muted center">اگر باز هم سؤال داشتی، از استادت بپرس؛ همین سؤال‌ها نشان می‌دهد داری عمیق یاد می‌گیری.</p>
            <button className="link-btn" style={{ alignSelf: 'center' }} onClick={leave}>
              فعلاً بعداً برمی‌گردم
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="result">
            <Confetti />
            <Mascot mood="cheer" size={130} className="pop" />
            <h1 style={{ color: 'var(--ok)' }}>{wasUnderstood.current ? 'مرور شد!' : 'فهمیدی! 🎉'}</h1>
            <p className="muted">
              «<Rich text={concept.title} />» حالا مال توست.{' '}
              {seen.length >= 3 && !wasUnderstood.current ? 'با پشتکار به اینجا رسیدی؛ این ارزشمندترین نوع یادگیری است.' : ''}
            </p>
            <div className="result-stats">
              <div className="rstat" style={{ ['--rs' as string]: 'var(--accent)' }}>
                <div className="rs-h">امتیاز</div>
                <div className="rs-v">
                  <Icon name="bolt" size={20} style={{ color: 'var(--accent)' }} /><bdi dir="ltr">+{xpGained}</bdi>
                </div>
              </div>
              <div className="rstat" style={{ ['--rs' as string]: 'var(--primary)' }}>
                <div className="rs-h">توضیح‌ها</div>
                <div className="rs-v">{seen.length}</div>
              </div>
              <div className="rstat" style={{ ['--rs' as string]: 'var(--ok)' }}>
                <div className="rs-h">جواب درست</div>
                <div className="rs-v">{checkAttempts <= 1 ? 'بار اول' : `بار ${checkAttempts}`}</div>
              </div>
            </div>
            <div className="summary-card" style={{ width: '100%', textAlign: 'start' }}>
              <h3>
                <Icon name="starf" style={{ color: 'var(--accent)' }} /> خلاصهٔ طلایی
              </h3>
              <ul>
                {concept.summary.map((s, i) => (
                  <li key={i}>
                    <Rich text={s} />
                  </li>
                ))}
              </ul>
            </div>
            {newBadges.map((b) => (
              <div key={b.id} className="card pop row" style={{ width: '100%' }}>
                <span style={{ fontSize: 34 }}>{b.emoji}</span>
                <div className="grow" style={{ textAlign: 'start' }}>
                  <b>نشان جدید: {b.title}</b>
                  <div className="small muted">{b.desc}</div>
                </div>
              </div>
            ))}
            {provider && provider !== 'offline' && (
              <button className="link-btn" onClick={() => setTutor('teachback')}>
                <Icon name="graduation" size={18} /> می‌خواهی به بیو درسش بدهی؟ (بهترین راه تثبیت)
              </button>
            )}
          </div>
        )}
      </div>

      {foot && (
        <div className={`session-foot ${footClass}`}>
          <div className="session-foot-in">{foot}</div>
        </div>
      )}
      {phase === 'done' && (
        <div className="session-foot">
          <div className="session-foot-in">
            <button className="btn ghost" onClick={leave}>
              بازگشت به مسیر
            </button>
            <button className="btn lg" onClick={goNext}>
              ادامه
            </button>
          </div>
        </div>
      )}

      {tutor && <TutorSheet ctx={tutorCtx} mode={tutor} onClose={() => setTutor(null)} />}
      {confirmExit && (
        <Confirm
          title="از این درس بیرون می‌روی؟"
          text="توضیح‌هایی که دیدی ذخیره شده‌اند؛ هر وقت برگردی از همین مفهوم ادامه می‌دهیم."
          yes="خروج"
          no="ادامه می‌دهم"
          onYes={leave}
          onNo={() => setConfirmExit(false)}
        />
      )}
    </div>
  );
}

/** Prefer a check question the student has not yet answered correctly. */
function firstCheck(checks: Question[]): number {
  const s = getState();
  const i = checks.findIndex((q) => !s.questions[q.id]?.last);
  return i === -1 ? 0 : i;
}

/* ---------------- resume ---------------- */

const RESUME_KEY = 'biomana:resume:learn';
type Resume = { conceptId: string; seen: number[]; current: number; checkIdx: number; t: number };

function loadResume(conceptId: string, approaches: number): Resume | null {
  try {
    const r = JSON.parse(localStorage.getItem(RESUME_KEY) ?? 'null') as Resume | null;
    if (!r || r.conceptId !== conceptId || Date.now() - r.t > 14 * 864e5) return null;
    const seen = r.seen.filter((i) => Number.isInteger(i) && i >= 0 && i < approaches);
    if (!seen.length || !seen.includes(r.current)) return null;
    return { ...r, seen };
  } catch {
    return null;
  }
}

function saveResume(r: Resume) {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(r));
  } catch {
    /* storage blocked: resume is a convenience */
  }
}

function clearResume() {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {
    /* ignore */
  }
}
