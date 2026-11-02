import { useEffect, useMemo, useRef, useState } from 'react';
import { GRADES, lessonById, subjectById, subjectColor, subjectsForMajor } from '../content';
import { FIELD } from '../content/fields';
import type { Lesson, Subject, SubjectId } from '../content/types';
import { SubjectContext } from '../components/Glossary';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { QuestionView } from '../components/questions/QuestionView';
import { Rich } from '../components/Rich';
import { SessionTop } from '../components/session';
import { Bar, Confetti, Confirm, SubjectIcon } from '../components/ui';
import { awardBadges, type BadgeDef } from '../lib/badges';
import { fmt } from '../lib/digits';
import { buildExam, chaptersOf, EXAM_LENGTHS, EXAM_SEC_PER_Q, examPool, examPoolSize, lessonResults, startedLessons, type ExamItem, type ExamLength } from '../lib/exam';
import { grade, isComplete, type Answer } from '../lib/grade';
import { buildPath } from '../lib/learner';
import { exitTo, go, openPathNode } from '../lib/nav';
import { sfx } from '../lib/sound';
import { addStudyTime, awardXp, konkurScore, recordAnswer, recordExam, testXp } from '../lib/state';
import { getState, update, useAppState } from '../lib/store';
import { clock } from '../lib/time';

interface ExamSetup {
  subject: SubjectId;
  lessons: string[];
  items: ExamItem[];
  timed: boolean;
}

/** «آزمون جامع»: pick a book, its chapters or lessons, a length and a timer; then a konkur-style exam over them. */
export function MockExam({ lessonId }: { lessonId?: string }) {
  const [exam, setExam] = useState<ExamSetup | null>(null);
  const [round, setRound] = useState(0);
  const from = lessonId ? lessonById(lessonId) : undefined;
  const leave = () => exitTo(from ? { name: 'lesson', lessonId: from.id } : { name: 'review' });
  if (!exam) return <Setup from={from} onStart={setExam} onClose={leave} />;
  return (
    <SubjectContext.Provider value={FIELD[exam.subject]}>
      <Runner
        key={round}
        exam={exam}
        onClose={leave}
        onAgain={() => {
          setExam(null);
          setRound((r) => r + 1);
        }}
      />
    </SubjectContext.Provider>
  );
}

/* ───────────────────────── setup ───────────────────────── */

function Setup({ from, onStart, onClose }: { from?: Lesson; onStart: (e: ExamSetup) => void; onClose: () => void }) {
  const s = useAppState();
  // The learner's books with exam questions; their own grade first.
  const shelves = useMemo(() => {
    const mine = subjectsForMajor(s.profile.major).filter((b) => b.lessons.some((l) => examPool(l).length));
    const order = [s.profile.grade, ...GRADES.map((g) => g.id).filter((g) => g !== s.profile.grade).reverse()];
    return order
      .map((g) => ({ grade: g, title: GRADES.find((x) => x.id === g)?.title ?? '', books: mine.filter((b) => b.grade === g) }))
      .filter((x) => x.books.length);
  }, [s.profile.major, s.profile.grade]);
  const books = shelves.flatMap((x) => x.books);
  const initialBook = (from && subjectById(from.subject)) || books.find((b) => b.id === s.profile.focus) || books[0];
  const [book, setBook] = useState<Subject | undefined>(initialBook);
  const [picked, setPicked] = useState<Set<string>>(() => defaultPick(initialBook, from));
  const [length, setLength] = useState<ExamLength>(20);
  const [timed, setTimed] = useState(true);

  if (!book) {
    return (
      <div className="onb">
        <div className="onb-body center">
          <Mascot mood="calm" />
          <h1>هنوز کتابی با تست برای رشته‌ات نداریم</h1>
          <button className="btn" onClick={onClose}>
            بازگشت
          </button>
        </div>
      </div>
    );
  }

  const chosen = book.lessons.filter((l) => picked.has(l.id));
  const pool = examPoolSize(chosen);
  const count = Math.min(length, pool);
  const started = startedLessons(s, book);
  const color = subjectColor(book.id).c;

  const pickBook = (b: Subject) => {
    setBook(b);
    setPicked(defaultPick(b));
  };
  const toggle = (ids: string[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const start = () => {
    if (!count) return;
    sfx.tap();
    const items = buildExam(chosen, count, Date.now());
    onStart({ subject: book.id, lessons: chosen.map((l) => l.id), items, timed });
  };

  return (
    <div className="session">
      <SessionTop onClose={onClose} progress={0} color={color} />
      <div className="session-body">
        <div className="mx-hero">
          <Mascot mood="think" size={84} />
          <div>
            <h1>آزمون جامع</h1>
            <p className="small muted">تست‌های درس‌هایی که انتخاب می‌کنی، قاطی و بدون تکرار؛ مثل سر جلسهٔ کنکور.</p>
          </div>
        </div>

        <h2 className="mx-step">
          <span>۱</span> کتاب
        </h2>
        <div className="mx-shelves" role="radiogroup" aria-label="کتاب">
          {shelves.map((sh) => (
            <div key={sh.grade} className="mx-shelf" role="group" aria-label={`پایهٔ ${sh.title}`}>
              <div className="mx-shelf-title">
                پایهٔ {sh.title}
                {sh.grade === s.profile.grade && <span className="mx-shelf-mine">پایهٔ خودت</span>}
              </div>
              <div className="mx-books">
                {sh.books.map((b) => (
                  <button
                    key={b.id}
                    role="radio"
                    aria-checked={b.id === book.id}
                    style={{ ['--sc' as string]: `var(--${b.color})` }}
                    onClick={() => pickBook(b)}
                  >
                    <SubjectIcon id={b.id} size={18} />
                    {b.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <h2 className="mx-step">
          <span>۲</span> فصل‌ها و درس‌ها
        </h2>
        <div className="mx-quick">
          <button className="link-btn" onClick={() => setPicked(new Set(started.map((l) => l.id)))} disabled={!started.length}>
            درس‌هایی که شروع کرده‌ام ({fmt(started.length)})
          </button>
          <button className="link-btn" onClick={() => setPicked(new Set(book.lessons.map((l) => l.id)))}>
            کل کتاب
          </button>
          {picked.size > 0 && (
            <button className="link-btn" onClick={() => setPicked(new Set())}>
              <Icon name="refresh" size={16} /> از نو
            </button>
          )}
        </div>
        {!started.length && <p className="tiny muted mx-note">هنوز درسی از این کتاب را شروع نکرده‌ای؛ فصل اول را برایت انتخاب کردیم.</p>}
        <div className="mx-chapters">
          {chaptersOf(book).map(({ chapter, lessons }) => {
            const on = lessons.filter((l) => picked.has(l.id)).length;
            const ids = lessons.map((l) => l.id);
            return (
              <div key={chapter} className="card mx-chapter">
                <label className="mx-check mx-chapter-head">
                  <input
                    type="checkbox"
                    checked={on === lessons.length}
                    ref={(el) => {
                      if (el) el.indeterminate = on > 0 && on < lessons.length;
                    }}
                    onChange={(e) => toggle(ids, e.target.checked)}
                  />
                  <span className="grow">
                    <b>
                      <Rich text={chapter} />
                    </b>
                  </span>
                  <span className="tiny muted">
                    {fmt(on)} از {fmt(lessons.length)}
                  </span>
                </label>
                {lessons.map((l) => (
                  <label key={l.id} className="mx-check mx-lesson">
                    <input type="checkbox" checked={picked.has(l.id)} onChange={(e) => toggle([l.id], e.target.checked)} />
                    <span className="grow">
                      <span className="tiny muted">{l.label}</span>
                      <span className="mx-lesson-title">
                        <Rich text={l.title} />
                      </span>
                    </span>
                    {started.includes(l) && <span className="chip ok mx-started">شروع‌شده</span>}
                  </label>
                ))}
              </div>
            );
          })}
        </div>

        <h2 className="mx-step">
          <span>۳</span> تعداد سؤال
        </h2>
        <div className="seg mx-seg" role="radiogroup" aria-label="تعداد سؤال">
          {EXAM_LENGTHS.map((n) => (
            <button key={n} role="radio" aria-checked={length === n} aria-pressed={length === n} onClick={() => setLength(n)}>
              {fmt(n)} سؤال
            </button>
          ))}
        </div>
        {chosen.length > 0 && pool < length && (
          <p className="tiny muted mx-note">
            این درس‌ها روی هم {fmt(pool)} تست دارند؛ آزمون {fmt(pool)} سؤالی می‌شود. برای آزمون بلندتر، درس‌های بیشتری انتخاب کن.
          </p>
        )}

        <h2 className="mx-step">
          <span>۴</span> زمان
        </h2>
        <div className="card setting mx-timer">
          <div className="s-txt">
            <b>زمان‌دار، با سرعت کنکور</b>
            <span>{timed ? `${fmt(Math.round((Math.max(count, 1) * EXAM_SEC_PER_Q) / 60))} دقیقه؛ حدود یک دقیقه برای هر سؤال` : 'بدون ساعت؛ با خیال راحت فکر کن'}</span>
          </div>
          <button className="switch" role="switch" aria-checked={timed} aria-label="زمان‌دار" onClick={() => setTimed((t) => !t)} />
        </div>
        <div className="note info mx-rules">
          <Icon name="info" className="n-ic" size={20} />
          <div>نمره‌دهی کنکوری است: هر ۳ جواب غلط یک جواب درست را خنثی می‌کند، پس اگر مطمئن نیستی نزن. تا وقتی آزمون را تحویل نداده‌ای، هر جوابی را می‌توانی عوض یا پاک کنی.</div>
        </div>
      </div>
      <div className="session-foot">
        <div className="session-foot-in">
          <button className="btn lg" onClick={start} disabled={!count}>
            {count ? `شروع آزمون ${fmt(count)} سؤالی` : 'یک درس انتخاب کن'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Lessons ticked at first: the one the learner came from, else those started, else the first chapter. */
function defaultPick(book: Subject | undefined, from?: Lesson): Set<string> {
  if (!book) return new Set();
  const started = startedLessons(getState(), book);
  const ids = started.length ? started.map((l) => l.id) : (chaptersOf(book)[0]?.lessons ?? []).map((l) => l.id);
  if (from && from.subject === book.id && !ids.includes(from.id)) ids.push(from.id);
  return new Set(ids);
}

/* ───────────────────────── the exam ───────────────────────── */

interface Result {
  correct: number;
  wrong: number;
  blank: number;
  score: number;
  secs: number;
  xp: number;
  badges: BadgeDef[];
  marks: (boolean | null)[];
}

function Runner({ exam, onClose, onAgain }: { exam: ExamSetup; onClose: () => void; onAgain: () => void }) {
  const { items, timed } = exam;
  const n = items.length;
  const limit = n * EXAM_SEC_PER_Q;
  const color = subjectColor(exam.subject).c;
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<(Answer | null)[]>(() => items.map(() => null));
  const [flags, setFlags] = useState<boolean[]>(() => items.map(() => false));
  const [elapsed, setElapsed] = useState(0);
  const [confirm, setConfirm] = useState<null | 'submit' | 'exit'>(null);
  const [result, setResult] = useState<Result | null>(null);
  const startedAt = useRef(Date.now());
  const submitRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (result || !timed) return;
    const t = setInterval(() => {
      const secs = (Date.now() - startedAt.current) / 1000;
      setElapsed(secs);
      if (timed && secs >= limit) submitRef.current();
    }, 500);
    return () => clearInterval(t);
  }, [result, timed, limit]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [i]);

  const answered = answers.filter((a, k) => a && isComplete(items[k].q, a)).length;

  function submit() {
    if (result) return;
    const secs = Math.min(timed ? limit : Infinity, (Date.now() - startedAt.current) / 1000);
    const marks = items.map((it, k) => {
      const a = answers[k];
      return a && isComplete(it.q, a) ? grade(it.q, a) : null;
    });
    const correct = marks.filter((m) => m === true).length;
    const wrong = marks.filter((m) => m === false).length;
    const blank = n - correct - wrong;
    const score = konkurScore(correct, wrong, n);
    const xp = testXp(score, correct + wrong);
    let badges: BadgeDef[] = [];
    const now = Date.now();
    // An exam with nothing answered (handed in empty, or left until the clock ran out) does not count: no XP,
    // no streak day, no study time, and it stays out of the history and today's plan.
    if (correct + wrong > 0) {
      update((s) => {
        items.forEach((it, k) => {
          if (marks[k] !== null) recordAnswer(s, it.q, marks[k]!, 'test', now);
        });
        recordExam(s, { at: now, subject: exam.subject, lessons: exam.lessons, total: n, correct, wrong, blank, score, seconds: Math.round(secs), timed });
        awardXp(s, xp, now);
        addStudyTime(s, secs * 1000, now);
        s.counters.sessions += 1;
        badges = awardBadges(s, now);
      });
    }
    sfx.complete();
    setResult({ correct, wrong, blank, score, secs, xp, badges, marks });
    setConfirm(null);
    window.scrollTo({ top: 0 });
  }
  submitRef.current = submit;

  if (result) return <ExamResult exam={exam} answers={answers} result={result} limit={limit} onClose={onClose} onAgain={onAgain} />;

  const item = items[i];
  const left = Math.max(0, limit - elapsed);
  const clear = () => setAnswers((prev) => prev.map((v, k) => (k === i ? null : v)));

  return (
    <div className="session">
      <SessionTop
        onClose={() => setConfirm('exit')}
        progress={answered / n}
        color={color}
        right={
          timed ? (
            <span className={`chip ${left < 60 ? 'bad' : ''}`} aria-label="زمان باقی‌مانده" style={{ direction: 'ltr' }}>
              <Icon name="clock" size={16} /> {clock(left)}
            </span>
          ) : (
            <span className="chip">
              {fmt(answered)}/{fmt(n)}
            </span>
          )
        }
      />
      <div className="session-body">
        <div className="mx-grid" role="navigation" aria-label="شمارهٔ سؤال‌ها">
          {items.map((it, k) => (
            <button
              key={it.q.id}
              onClick={() => setI(k)}
              aria-current={k === i}
              aria-label={`سؤال ${k + 1}${answers[k] ? '، جواب داده‌ای' : ''}${flags[k] ? '، علامت‌دار' : ''}`}
              className={`${answers[k] ? 'on' : ''}${k === i ? ' cur' : ''}`}
            >
              {fmt(k + 1)}
              {flags[k] && <span className="mx-flag" aria-hidden="true">🚩</span>}
            </button>
          ))}
        </div>
        <QuestionView q={item.q} answer={answers[i]} onAnswer={(a) => setAnswers((prev) => prev.map((v, k) => (k === i ? a : v)))} locked={false} kicker={`سؤال ${fmt(i + 1)} از ${fmt(n)}`} />
        <div className="row wrap mx-tools">
          <button className="link-btn" onClick={() => setFlags((f) => f.map((v, k) => (k === i ? !v : v)))}>
            <Icon name="flag" size={18} /> {flags[i] ? 'برداشتن علامت' : 'علامت برای بعد'}
          </button>
          {answers[i] && (
            <button className="link-btn" onClick={clear}>
              <Icon name="refresh" size={16} /> پاک کردن جواب
            </button>
          )}
        </div>
      </div>
      <div className="session-foot">
        <div className="session-foot-in">
          <button className="btn ghost back-step" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} aria-label="سؤال قبلی">
            <Icon name="back" /> <span className="lbl">قبلی</span>
          </button>
          {i < n - 1 ? (
            <>
              <button className="btn ghost" onClick={() => setConfirm('submit')}>
                تحویل
              </button>
              <button className="btn" onClick={() => setI(i + 1)}>
                بعدی <Icon name="next" />
              </button>
            </>
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
          text={answered < n ? `${fmt(n - answered)} سؤال را جواب نداده‌ای. نزده‌ها نمرهٔ منفی ندارند.` : 'به همهٔ سؤال‌ها جواب داده‌ای.'}
          yes="تحویل و تصحیح"
          no="برمی‌گردم"
          onYes={submit}
          onNo={() => setConfirm(null)}
        />
      )}
      {confirm === 'exit' && (
        <Confirm title="از آزمون بیرون می‌روی؟" text="جواب‌های این آزمون ثبت نمی‌شوند." yes="خروج" no="ادامه" danger onYes={onClose} onNo={() => setConfirm(null)} />
      )}
    </div>
  );
}

/* ───────────────────────── result ───────────────────────── */

type Filter = 'all' | 'wrong' | 'blank' | 'right';

function ExamResult({
  exam,
  answers,
  result,
  limit,
  onClose,
  onAgain,
}: {
  exam: ExamSetup;
  answers: (Answer | null)[];
  result: Result;
  limit: number;
  onClose: () => void;
  onAgain: () => void;
}) {
  const { items } = exam;
  const n = items.length;
  const [filter, setFilter] = useState<Filter>(result.wrong ? 'wrong' : 'all');
  const good = result.score >= 70;
  const empty = result.correct + result.wrong === 0;
  // Per-lesson breakdown, weakest first.
  const byLesson = lessonResults(exam.lessons, items, result.marks)
    .map((r) => ({ ...r, lesson: lessonById(r.lessonId)! }))
    .filter((r) => r.lesson);
  const counts: Record<Filter, number> = { all: n, wrong: result.wrong, blank: result.blank, right: result.correct };
  const shown = items.map((it, k) => ({ it, k })).filter(({ k }) => filter === 'all' || (filter === 'wrong' ? result.marks[k] === false : filter === 'blank' ? result.marks[k] === null : result.marks[k] === true));

  return (
    <div className="session">
      {good && <Confetti />}
      <div className="session-body">
        <div className="result">
          <Mascot mood={good ? 'cheer' : result.score >= 40 ? 'happy' : 'calm'} size={110} className="pop" />
          <div className="small muted bold">آزمون جامع {subjectById(exam.subject).title}</div>
          <h1 style={{ color: good ? 'var(--ok)' : 'var(--ink)' }}>درصد تو: {fmt(result.score, 1)}٪</h1>
          <p className="muted">
            {fmt(result.correct)} جواب درست از {fmt(n)} سؤال.{' '}
            {result.score >= 90 ? 'فوق‌العاده! این درس‌ها را عالی بلدی.' : good ? 'خیلی خوب! چند نکتهٔ کوچک مانده که پایین می‌بینی.' : 'هنوز جای کار دارد؛ پاسخ‌نامه را با دقت ببین و درس‌های ضعیف‌تر را مرور کن.'}
          </p>
          <div className="result-stats">
            <div className="rstat" style={{ ['--rs' as string]: 'var(--ok)' }}>
              <div className="rs-h">درست</div>
              <div className="rs-v">{fmt(result.correct)}</div>
            </div>
            <div className="rstat" style={{ ['--rs' as string]: 'var(--bad)' }}>
              <div className="rs-h">غلط</div>
              <div className="rs-v">{fmt(result.wrong)}</div>
            </div>
            <div className="rstat" style={{ ['--rs' as string]: 'var(--ink-3)' }}>
              <div className="rs-h">نزده</div>
              <div className="rs-v">{fmt(result.blank)}</div>
            </div>
          </div>
          <p className="small muted">
            <Icon name="clock" size={16} /> زمان: {clock(result.secs)}
            {exam.timed ? ` از ${clock(limit)}` : ''}
            {!empty && (
              <>
                {' '}
                · امتیاز: <bdi dir="ltr">+{fmt(result.xp)}</bdi>
              </>
            )}
          </p>
          {empty && <p className="small muted">به هیچ سؤالی جواب ندادی، برای همین این آزمون امتیاز و روز پیاپی ندارد و در «آزمون‌های جامع» هم ثبت نمی‌شود.</p>}
          {result.wrong > 0 && <p className="tiny muted">سؤال‌هایی که غلط زدی به «دفتر اشتباه‌ها» رفتند تا در مرور دوباره ببینی‌شان.</p>}
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

        <h2 className="section-title">درس‌به‌درس</h2>
        {byLesson.length > 1 && <p className="small muted mx-lesson-hint">ضعیف‌ترین درس بالاتر است؛ از همان شروع کن.</p>}
        <div className="card">
          {byLesson.map(({ lesson, total, right }) => {
            const r = right / total;
            const practice = [...buildPath(lesson)].reverse().find((nd) => nd.kind === 'practice');
            return (
              <div key={lesson.id} className="mx-lesson-row">
                <button className="mx-lesson-name small" onClick={() => go({ name: 'lesson', lessonId: lesson.id })}>
                  <Rich text={lesson.title} />
                </button>
                <span className="small bold mx-lesson-score">
                  {fmt(right)} از {fmt(total)}
                </span>
                <Bar value={r} thin color={r >= 0.75 ? 'var(--ok)' : r >= 0.45 ? 'var(--accent)' : 'var(--bad)'} label={`${lesson.title}: ${right} از ${total}`} />
                {practice && r < 1 ? (
                  <button className="btn ghost sm mx-lesson-go" aria-label={`تمرین درس ${lesson.title}`} onClick={() => openPathNode(lesson.id, practice)}>
                    تمرین این درس
                  </button>
                ) : (
                  <span className="tiny muted mx-lesson-go">همه درست</span>
                )}
              </div>
            );
          })}
        </div>

        <h2 className="section-title">پاسخ‌نامه</h2>
        <div className="seg mx-filter" role="group" aria-label="کدام سؤال‌ها">
          {(['all', 'wrong', 'blank', 'right'] as Filter[]).map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} disabled={!counts[f]}>
              {{ all: 'همه', wrong: 'غلط‌ها', blank: 'نزده‌ها', right: 'درست‌ها' }[f]} ({fmt(counts[f])})
            </button>
          ))}
        </div>
        <div className="stack">
          {shown.map(({ it, k }) => {
            const m = result.marks[k];
            const lesson = lessonById(it.lessonId);
            return (
              <article key={it.q.id} className="card mx-review">
                <div className="row wrap" style={{ gap: 6, marginBottom: 6 }}>
                  <span className={`chip ${m === null ? '' : m ? 'ok' : 'bad'}`}>
                    <Icon name={m === null ? 'minus' : m ? 'check' : 'x'} size={14} /> {m === null ? 'نزده' : m ? 'درست' : 'غلط'}
                  </span>
                  {lesson && (
                    <span className="tiny muted">
                      {lesson.label} · <Rich text={lesson.title} />
                    </span>
                  )}
                </div>
                <QuestionView q={it.q} answer={answers[k]} onAnswer={() => undefined} locked kicker={`سؤال ${fmt(k + 1)}`} />
                {m === null && <p className="tiny muted">این را نزدی؛ گزینهٔ سبز جواب درست است.</p>}
                {m === false && <p className="tiny muted">جواب تو قرمز است و جواب درست سبز.</p>}
                <div className="note tip" style={{ marginTop: 10 }}>
                  <Icon name="bulb" className="n-ic" size={20} />
                  <div>
                    <span className="n-title">پاسخ تشریحی</span>
                    <Rich text={it.q.explain} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <div className="session-foot">
        <div className="session-foot-in">
          <button className="btn ghost" onClick={onAgain}>
            <Icon name="refresh" size={18} /> آزمون تازه
          </button>
          <button className="btn lg" onClick={onClose}>
            پایان
          </button>
        </div>
      </div>
    </div>
  );
}
