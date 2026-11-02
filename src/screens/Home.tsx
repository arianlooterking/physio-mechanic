import { useState } from 'react';

const NUDGE_KEY = 'biomana:nudge-hidden';
import { GRADES, lessonBookLink, MAJOR_INFO, SUBJECTS, subjectById, subjectsForMajor } from '../content';
import type { Lesson, SubjectId } from '../content/types';
import { Icon, type IconName } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { PathDeco, PathTrail, UnitArt } from '../components/PathDecor';
import { Rich } from '../components/Rich';
import { DailyCard } from '../components/DailyCard';
import { PlanCard } from '../components/PlanCard';
import { LessonSearch } from '../components/LessonSearch';
import { DailyGoalCard } from '../components/Shell';
import { GoogleG } from '../landing/GoogleG';
import { Library } from '../components/Library';
import { Bar, Confirm, Ring, SubjectIcon } from '../components/ui';
import { fmt, pct } from '../lib/digits';
import { buildPath, currentIndex, lessonProgress, nodeDone, resumePoint, type PathNode } from '../lib/learner';
import { useAccount, useOwner } from '../lib/account';
import { go, openPathNode } from '../lib/nav';
import { AppBanner } from '../native/AppCards';
import { conceptOf } from '../lib/state';
import { viewGrade } from '../lib/study';
import { update, useAppState } from '../lib/store';
import { greeting } from '../lib/time';

const OFFSETS = [0, 52, 78, 52, 0, -52, -78, -52];

export function Home() {
  const s = useAppState();
  // The learner's grade and major decide the books here; the switch below changes them (src/lib/study.ts).
  const grade = viewGrade(s);
  const major = s.profile.major;
  const mine = subjectsForMajor(major);
  const inGrade = SUBJECTS;
  const subject = inGrade.find((x) => x.id === s.profile.focus) ?? inGrade[0];
  const name = s.profile.name;
  // Fahmi stands beside the next step of the first unfinished lesson.
  const active = subject && (subject.lessons.find((l) => lessonProgress(s, l) < 1) ?? subject.lessons[0])?.id;

  return (
    <>
      <div className="hello">
        <Mascot mood="happy" size={62} />
        <div>
          <h1>
            {greeting()}
            {name ? `، ${name}` : ''}!
          </h1>
          <div className="muted small">امروز کدام درس را با هم بفهمیم؟</div>
        </div>
      </div>

      <ContinueCard lessons={mine.flatMap((x) => x.lessons)} />

      <DailyCard />

      <PlanCard />

      <div className="mobile-only" style={{ marginBottom: 16 }}>
        <DailyGoalCard />
      </div>

      <SaveNudge />
      <AppBanner />

      <LessonSearch />

      {subject ? (
        <>
          <div className={`subject-switch${inGrade.length > 3 ? ' many' : ''}`} role="group" aria-label="انتخاب درس">
            {inGrade.map((sub) => (
              <button
                key={sub.id}
                aria-pressed={sub.id === subject.id}
                style={{
                  ['--sc' as string]: `var(--${sub.color})`,
                  ['--scd' as string]: `var(--${sub.color}-dark)`,
                }}
                onClick={() => update((st) => void (st.profile.focus = sub.id as SubjectId))}
              >
                <SubjectIcon id={sub.id} size={20} />
                {inGrade.length > 3 ? sub.short : sub.title}
              </button>
            ))}
          </div>

          {subject.lessons.map((lesson) => (
            <Unit key={lesson.id} lesson={lesson} guide={lesson.id === active} />
          ))}

          <div className="card center stack" style={{ alignItems: 'center', borderStyle: 'dashed' }}>
            <Icon name="sparkles" size={28} style={{ color: `var(--${subject.color})` }} />
            <b>بخش‌های بعدی کتاب در راه است</b>
            <span className="small muted">بیومکانیک مفصل‌ها (زانو، ران، مچ پا، ستون فقرات، شانه، آرنج، مچ دست) و بیومکانیک کاربردی (راه رفتن و ...) به‌زودی اضافه می‌شوند.</span>
          </div>
        </>
      ) : (
        <div className="card center stack" style={{ alignItems: 'center', borderStyle: 'dashed' }}>
          <Icon name="sparkles" size={28} />
          <b>
            درس‌های پایهٔ {GRADES.find((g) => g.id === grade)!.title} رشتهٔ {MAJOR_INFO.find((m) => m.id === major)!.title} در راه است
          </b>
          <span className="small muted">فعلاً کتاب‌هایش را از کتابخانهٔ پایین بخوان، یا از بالا پایه یا رشتهٔ دیگری را انتخاب کن.</span>
        </div>
      )}

      {/* a new key when the grade or major changes, so the library opens on them too */}
      <Library key={`${grade}-${major}`} />
    </>
  );
}

const openNode = (lesson: Lesson, n: PathNode) => openPathNode(lesson.id, n);

/** For a returning learner: the lesson they were on and its next step, one tap away, above the path. */
function ContinueCard({ lessons }: { lessons: Lesson[] }) {
  const s = useAppState();
  const r = resumePoint(s, lessons);
  if (!r) return null;
  const subj = subjectById(r.lesson.subject);
  return (
    <section
      className="card resume"
      style={{ ['--sc' as string]: `var(--${subj.color})`, ['--scd' as string]: `var(--${subj.color}-dark)` }}
      aria-label="ادامهٔ یادگیری"
    >
      <div className="resume-top">
        <span className="resume-icon">
          <SubjectIcon id={subj.id} size={26} />
        </span>
        <div className="grow">
          <div className="resume-kicker">{r.fresh ? 'درس بعدی' : 'از همان‌جا که ماندی ادامه بده'}</div>
          <b className="resume-title">{r.lesson.title}</b>
          <div className="small muted">
            {subj.title} · {r.lesson.label}
          </div>
        </div>
      </div>
      <div className="resume-step">
        <Icon name={nodeIcon(r.node, false)} size={18} />
        <span className="grow">
          قدم {fmt(r.index + 1)} از {fmt(r.total)}: <Rich text={r.node.title} />
        </span>
      </div>
      <div className="resume-progress">
        <Bar value={r.progress} thin color={`var(--${subj.color})`} label={`پیشرفت درس ${r.lesson.title}`} />
        <span>{pct(r.progress)}</span>
      </div>
      <div className="resume-actions">
        <button className="btn resume-go" onClick={() => openNode(r.lesson, r.node)}>
          {r.fresh ? 'شروع درس' : 'ادامه'} <Icon name="next" size={20} />
        </button>
        <button className="btn sm ghost" onClick={() => go({ name: 'progress' })}>
          <Icon name="chart" size={18} /> پیشرفت من
        </button>
      </div>
    </section>
  );
}

function nodeIcon(n: PathNode, done: boolean): IconName {
  if (n.kind === 'concept') return done ? 'starf' : 'bulb';
  if (n.kind === 'practice') return 'dumbbell';
  if (n.kind === 'final') return 'edit';
  if (n.kind === 'hard') return 'crown';
  if (n.kind === 'cards') return 'cards';
  return 'trophy';
}

function Unit({ lesson, guide }: { lesson: Lesson; guide: boolean }) {
  const s = useAppState();
  const nodes = buildPath(lesson);
  const cur = currentIndex(s, lesson, nodes);
  const subj = subjectById(lesson.subject);
  const uc = `var(--${subj.color})`;
  const ucd = `var(--${subj.color}-dark)`;
  const [jump, setJump] = useState<PathNode | null>(null);
  // The owner's account has every step open, in any order.
  const owner = useOwner();
  const progress = lessonProgress(s, lesson);
  const best = s.lessons[lesson.id]?.best;
  const doneKey = nodes.map((n) => (nodeDone(s, lesson, n) ? 1 : 0)).join('');

  const open = (n: PathNode) => openNode(lesson, n);

  return (
    <section className="unit" style={{ ['--uc' as string]: uc, ['--ucd' as string]: ucd }} aria-label={lesson.title}>
      <div className="unit-head">
        <UnitArt subject={lesson.subject} />
        <div className="label">
          {lesson.label} · {lesson.chapter}
        </div>
        <h2>{lesson.title}</h2>
        <div className="row wrap">
          {lesson.pages[0] > 0 && (
            <a className="uh-btn" href={lessonBookLink(lesson)(lesson.pages[0])} target="_blank" rel="noopener noreferrer">
              <Icon name="book" size={16} /> کتاب: صفحهٔ {fmt(lesson.pages[0])} تا {fmt(lesson.pages[1])}
            </a>
          )}
          <button className="uh-btn" onClick={() => go({ name: 'lesson', lessonId: lesson.id })}>
            <Icon name="grid" size={16} /> جزئیات درس
          </button>
        </div>
        <div className="unit-progress">
          <Bar value={progress} />
          <span>{pct(progress)}</span>
          {best !== undefined && (
            <span className="row" style={{ gap: 4 }}>
              <Icon name="trophy" size={16} /> {fmt(best, 0)}٪
            </span>
          )}
        </div>
      </div>

      <div className="path">
        <PathTrail upto={cur} version={`${doneKey}:${cur}`} />
        {nodes.map((n, i) => {
          const done = nodeDone(s, lesson, n);
          const isCur = i === cur;
          const locked = !owner && !done && i > cur;
          const mastery = n.kind === 'concept' ? conceptOf(s, n.conceptId!).mastery : 0;
          const started = n.kind === 'concept' && conceptOf(s, n.conceptId!).status === 'learning';
          const dx = OFFSETS[i % OFFSETS.length];
          // Decorations sit on the open side of the zig-zag, away from the node.
          const side = dx ? -2.4 * dx : i % (OFFSETS.length * 2) === 0 ? 120 : -120;
          return (
            <div key={n.id} className={`node-wrap${isCur ? ' cur' : ''}`} style={{ ['--dx' as string]: `${dx}px`, ['--i' as string]: i }}>
              {isCur && <div className="node-tip">{started ? 'ادامه' : i === 0 && !done ? 'شروع' : 'بعدی'}</div>}
              {isCur && guide ? (
                <span className="path-guide" style={{ ['--ddx' as string]: `${side}px` }} aria-hidden="true">
                  <Mascot mood={done || i === 0 ? 'wave' : 'cheer'} size={78} />
                </span>
              ) : (
                <PathDeco subject={lesson.subject} i={i} side={side} />
              )}
              <div className="node-base">
                {n.kind === 'cards' && <span className="node-stack" aria-hidden="true" />}
                {(n.kind === 'test' || n.kind === 'hard') && <span className="node-burst" aria-hidden="true" />}
                <button
                  className={`node k-${n.kind}${done ? ' done' : ''}${isCur ? ' current' : ''}${locked ? ' locked' : ''}`}
                  onClick={() => (locked ? setJump(n) : open(n))}
                  aria-label={`${n.title.replace(/\$/g, '')}${done ? ' (انجام شده)' : locked ? ' (قفل)' : ''}`}
                >
                  {n.kind === 'concept' && (done || mastery > 0) && (
                    <span className="node-ring" aria-hidden="true">
                      <Ring value={mastery} size={92} stroke={5} color="var(--ok)" track="transparent" />
                    </span>
                  )}
                  <span className="node-shine" aria-hidden="true" />
                  <Icon name={nodeIcon(n, done)} size={n.kind === 'test' ? 36 : 32} stroke={2.6} />
                  {locked && (
                    <span className="node-lock" aria-hidden="true">
                      <Icon name="lock" size={13} stroke={2.8} />
                    </span>
                  )}
                </button>
              </div>
              <div className="node-label">
                <Rich text={n.title} />
              </div>
            </div>
          );
        })}
      </div>

      {jump && (
        <Confirm
          title="جلوتر می‌روی؟"
          text="پیشنهاد بیومانا این است که بخش‌ها را به ترتیب بروی، چون هر کدام پایهٔ بعدی است. ولی اگر این بخش را از قبل بلدی یا فردا امتحانش را داری، می‌توانی مستقیم سراغش بروی."
          yes="بله، برو"
          no="به ترتیب می‌روم"
          onYes={() => {
            const n = jump;
            setJump(null);
            open(n);
          }}
          onNo={() => setJump(null)}
        />
      )}
    </section>
  );
}

/** For guests: a gentle offer to keep progress in their Google account (can be dismissed). */
function SaveNudge() {
  const { account } = useAccount();
  const s = useAppState();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(NUDGE_KEY) === '1';
    } catch {
      return true;
    }
  });
  if (account || hidden || s.xp.total < 1) return null;
  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(NUDGE_KEY, '1');
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="card save-nudge">
      <span className="save-nudge-g">
        <GoogleG size={22} />
      </span>
      <div className="grow">
        <b>پیشرفتت را گم نکن</b>
        <div className="small muted">با حساب گوگل وارد شو تا امتیاز، زنجیره و درس‌هایت روی هر گوشی و رایانه‌ای همراهت باشد.</div>
      </div>
      <div className="save-nudge-actions">
        <button className="btn sm" onClick={() => go({ name: 'login' })}>
          ورود با گوگل
        </button>
        <button className="icon-btn" onClick={hide} aria-label="بستن">
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  );
}
