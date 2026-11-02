import { useMemo, useState } from 'react';
import { GRADES, subjectById, subjectsForMajor } from '../content';
import type { SubjectId } from '../content/types';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { itemTitle, StatusPill, usePlanSchedule } from '../components/PlanCard';
import { Rich } from '../components/Rich';
import { Bar, Confirm, SubjectIcon } from '../components/ui';
import { fmt, toFa } from '../lib/digits';
import { lessonProgress } from '../lib/learner';
import { go, openPathNode, toast } from '../lib/nav';
import {
  DEFAULT_DAYS,
  defaultSubjects,
  GOALS,
  goalPreset,
  itemDone,
  makePlan,
  MINUTE_CHOICES,
  mockLesson,
  schedule,
  stepsDoneByDay,
  WEEK,
  WEEKDAY_NAMES,
  weekStart,
  type PlanDay,
  type PlanItem,
  type PlanSettings,
  type Schedule,
} from '../lib/plan';
import type { AppState, StudyPlan } from '../lib/state';
import { update, useAppState } from '../lib/store';
import { addDays, dayKey, dayMonth, diffDays, fromKey, fromPersian, fullDay, PERSIAN_MONTHS, persianMonthDays, persianOf, weekdayLong } from '../lib/time';

/** «برنامهٔ مطالعه» (#/plan): set it up, then today's tasks, the week, and the books. */
export function Plan() {
  const s = useAppState();
  const [editing, setEditing] = useState(false);
  const show = (edit: boolean) => {
    setEditing(edit);
    window.scrollTo({ top: 0 });
  };
  if (!s.plan || editing) return <PlanSetup plan={s.plan} onDone={() => show(false)} />;
  return <PlanView onEdit={() => show(true)} />;
}

function BackHome() {
  return (
    <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => go({ name: 'home' })}>
      <Icon name="back" size={18} /> مسیر یادگیری
    </button>
  );
}

/* ───────────────────────── setup ───────────────────────── */

const sameSet = (a: readonly (string | number)[], b: readonly (string | number)[]) => a.length === b.length && a.every((x) => b.includes(x));

function PlanSetup({ plan, onDone }: { plan?: StudyPlan; onDone: () => void }) {
  const s = useAppState();
  const today = dayKey();
  const books = subjectsForMajor(s.profile.major).filter((x) => x.lessons.length);
  const shelves = [s.profile.grade, ...GRADES.map((g) => g.id).filter((g) => g !== s.profile.grade).reverse()]
    .map((g) => ({ grade: g, title: GRADES.find((x) => x.id === g)!.title, books: books.filter((b) => b.grade === g) }))
    .filter((x) => x.books.length);
  const myBooks = defaultSubjects(s.profile.major, s.profile.grade);
  const [kind, setKind] = useState<StudyPlan['kind']>(plan?.kind ?? 'final');
  const [custom, setCustom] = useState(plan?.kind === 'custom' ? plan.goal : addDays(today, 60));
  const [subjects, setSubjects] = useState<SubjectId[]>(plan?.subjects ?? myBooks);
  const [days, setDays] = useState<number[]>(plan?.days ?? DEFAULT_DAYS);
  const [minutes, setMinutes] = useState(plan?.minutes ?? 60);
  const goal = kind === 'custom' ? custom : goalPreset(kind, today);
  const left = diffDays(today, goal);
  const settings: PlanSettings = { goal, kind, subjects, days, minutes };
  const ready = subjects.length > 0 && days.length > 0 && left > 0;
  const preview = useMemo(() => (ready ? schedule(makePlan(settings, s, today), s, today) : null), [ready, goal, kind, subjects, days, minutes, s, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBook = (id: SubjectId) => setSubjects((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const toggleDay = (d: number) => setDays((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]));
  const save = () => {
    if (!ready) return;
    update((st) => void (st.plan = makePlan(settings, st, today)));
    toast(plan ? 'برنامه‌ات به‌روز شد.' : 'برنامه‌ات آماده شد!');
    onDone();
  };

  return (
    <div className="stack plan">
      {plan ? (
        <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={onDone}>
          <Icon name="back" size={18} /> برنامهٔ من
        </button>
      ) : (
        <BackHome />
      )}
      <div className="mx-hero">
        <Mascot mood="think" size={78} />
        <div>
          <h1 className="page-title">برنامهٔ مطالعه</h1>
          <p className="page-sub">بگو تا کی وقت داری؛ بیومانا درس‌های مانده را روزبه‌روز برایت می‌چیند و هفته‌های آخر را برای جمع‌بندی نگه می‌دارد.</p>
        </div>
      </div>

      <h2 className="mx-step">
        <span>۱</span> هدف
      </h2>
      <div className="pl-goals" role="radiogroup" aria-label="هدف">
        {(Object.keys(GOALS) as (keyof typeof GOALS)[]).map((k) => (
          <button key={k} role="radio" aria-checked={kind === k} className="pl-goal" onClick={() => setKind(k)}>
            <Icon name={k === 'final' ? 'edit' : 'trophy'} size={22} />
            <span className="grow">
              <b>{GOALS[k].title}</b>
              <span className="tiny muted">{fullDay(goalPreset(k, today))}</span>
            </span>
          </button>
        ))}
        <button role="radio" aria-checked={kind === 'custom'} className="pl-goal" onClick={() => setKind('custom')}>
          <Icon name="calendar" size={22} />
          <span className="grow">
            <b>تاریخ دلخواه</b>
            <span className="tiny muted">{kind === 'custom' ? fullDay(custom) : 'امتحان مدرسه، میان‌ترم یا هر روز دیگر'}</span>
          </span>
        </button>
      </div>
      {kind === 'custom' && <DatePick value={custom} onChange={setCustom} today={today} />}
      {kind === 'konkur' && <p className="tiny muted mx-note">تاریخ قطعی کنکور را سازمان سنجش اعلام می‌کند؛ اگر فرق داشت، «تاریخ دلخواه» را بزن.</p>}
      <p className={`small pl-left${left > 0 ? '' : ' bad'}`}>
        {left > 0 ? (
          <>
            <Icon name="clock" size={16} /> {fmt(left)} روز مانده تا {fullDay(goal)}
          </>
        ) : (
          'این تاریخ گذشته؛ روزی بعد از امروز را انتخاب کن.'
        )}
      </p>

      <h2 className="mx-step">
        <span>۲</span> کتاب‌ها
      </h2>
      <div className="mx-quick">
        <button className="link-btn" onClick={() => setSubjects(books.map((b) => b.id))} disabled={subjects.length === books.length}>
          همهٔ کتاب‌ها ({fmt(books.length)})
        </button>
        {!sameSet(subjects, myBooks) && (
          <button className="link-btn" onClick={() => setSubjects(myBooks)}>
            <Icon name="refresh" size={16} /> از نو
          </button>
        )}
      </div>
      {books.length === 0 && <p className="small muted">هنوز کتابی با درس برای رشته‌ات نداریم.</p>}
      <div className="mx-shelves">
        {shelves.map((sh) => (
          <div key={sh.grade} className="mx-shelf" role="group" aria-label={`پایهٔ ${sh.title}`}>
            <div className="mx-shelf-title">
              پایهٔ {sh.title}
              {sh.grade === s.profile.grade && <span className="mx-shelf-mine">پایهٔ خودت</span>}
            </div>
            <div className="pl-books">
              {sh.books.map((b) => {
                const rest = b.lessons.filter((l) => lessonProgress(s, l) < 1).length;
                return (
                  <button key={b.id} aria-pressed={subjects.includes(b.id)} style={{ ['--sc' as string]: `var(--${b.color})` }} onClick={() => toggleBook(b.id)}>
                    <SubjectIcon id={b.id} size={18} />
                    <span className="grow">
                      {b.title}
                      <small>{rest ? `${fmt(rest)} درس مانده` : 'تمام شده'}</small>
                    </span>
                    <span className="pl-tick" aria-hidden="true">
                      <Icon name="check" size={14} stroke={3} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <h2 className="mx-step">
        <span>۳</span> روزهای مطالعه
      </h2>
      <div className="pl-days" role="group" aria-label="روزهای مطالعه">
        {WEEK.map((d) => (
          <button key={d} aria-pressed={days.includes(d)} aria-label={WEEKDAY_NAMES[d]} onClick={() => toggleDay(d)}>
            {WEEKDAY_NAMES[d].slice(0, 1)}
          </button>
        ))}
      </div>
      <p className="tiny muted mx-note">
        {days.length ? `${fmt(days.length)} روز در هفته` : 'دست‌کم یک روز را انتخاب کن.'}
        {!sameSet(days, DEFAULT_DAYS) && (
          <button className="link-btn pl-inline" onClick={() => setDays(DEFAULT_DAYS)}>
            <Icon name="refresh" size={14} /> از نو
          </button>
        )}
      </p>

      <h2 className="mx-step">
        <span>۴</span> زمان هر روز
      </h2>
      <div className="seg" role="radiogroup" aria-label="زمان هر روز">
        {MINUTE_CHOICES.map((m) => (
          <button key={m} role="radio" aria-checked={minutes === m} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>
            {m <= 90 ? `${fmt(m)} دقیقه` : `${fmt(m / 60)} ساعت`}
          </button>
        ))}
      </div>

      {preview && <Preview sc={preview} minutes={minutes} />}

      <div className="pl-save">
        <button className="btn lg block" onClick={save} disabled={!ready}>
          {plan ? 'ذخیرهٔ برنامه' : 'بساز'}
        </button>
        {plan && (
          <button className="btn ghost block" onClick={onDone}>
            انصراف
          </button>
        )}
      </div>
    </div>
  );
}

/** What the settings come to, before saving. */
function Preview({ sc, minutes }: { sc: Schedule; minutes: number }) {
  const learnEnd = lastLessonDay(sc);
  return (
    <div className={`note ${sc.overloaded ? 'warn' : 'key'} pl-preview`}>
      <Icon name={sc.overloaded ? 'info' : 'sparkles'} className="n-ic" size={20} />
      <div>
        {!sc.left ? (
          'درس‌های این کتاب‌ها را تمام کرده‌ای؛ برنامه‌ات فقط جمع‌بندی و آزمون جامع است.'
        ) : (
          <>
            هر روز مطالعه حدود <b>{fmt(roundTo5(sc.perDay))} دقیقه</b> درس.
            {learnEnd && <> درس‌ها تا {dayMonth(learnEnd)} تمام می‌شود</>}
            {sc.reviewStart !== sc.goal && <> و از {dayMonth(sc.reviewStart)} جمع‌بندی و آزمون جامع.</>}
            {sc.overloaded && <> این بیشتر از {fmt(minutes)} دقیقه‌ای است که گذاشتی؛ روزها یا زمان را بیشتر کن، یا کتابی را کم کن.</>}
          </>
        )}
      </div>
    </div>
  );
}

const roundTo5 = (m: number) => Math.max(5, Math.round(m / 5) * 5);
const lastLessonDay = (sc: Schedule) => [...sc.days].reverse().find((d) => d.items.some((it) => it.kind === 'lesson'))?.day;

/** A day in the Persian calendar: day, month, year. */
function DatePick({ value, onChange, today }: { value: string; onChange: (day: string) => void; today: string }) {
  const p = persianOf(value);
  const y0 = persianOf(today).y;
  const set = (y: number, m: number, d: number) => onChange(fromPersian(y, m, Math.min(d, persianMonthDays(y, m))));
  const n = persianMonthDays(p.y, p.m);
  return (
    <div className="pl-date">
      <select aria-label="روز" value={p.d} onChange={(e) => set(p.y, p.m, Number(e.target.value))}>
        {Array.from({ length: n }, (_, i) => (
          <option key={i} value={i + 1}>
            {toFa(i + 1)}
          </option>
        ))}
      </select>
      <select aria-label="ماه" value={p.m} onChange={(e) => set(p.y, Number(e.target.value), p.d)}>
        {PERSIAN_MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select aria-label="سال" value={p.y} onChange={(e) => set(Number(e.target.value), p.m, p.d)}>
        {[y0, y0 + 1, y0 + 2].map((y) => (
          <option key={y} value={y}>
            {toFa(y)}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ───────────────────────── the plan ───────────────────────── */

function PlanView({ onEdit }: { onEdit: () => void }) {
  const { s, sc, today } = usePlanSchedule();
  const [drop, setDrop] = useState(false);
  const plan = s.plan!;
  if (!sc) return null;
  const goalTitle = plan.kind === 'custom' ? 'روز امتحان' : GOALS[plan.kind].title;
  const left = diffDays(today, plan.goal);
  const shift = plan.shift?.day === today ? plan.shift.by : 0;
  const remove = () => {
    update((st) => void delete st.plan);
    toast('برنامه پاک شد.');
    go({ name: 'home' }, true);
  };

  return (
    <div className="stack plan">
      <BackHome />
      <section className="card pl-hero">
        <div className="spread">
          <div>
            <div className="plan-kicker">برنامهٔ مطالعه</div>
            <h1 className="page-title">{sc.state === 'active' ? `${fmt(left)} روز تا ${goalTitle}` : goalTitle}</h1>
            <div className="small muted">{fullDay(plan.goal)}</div>
          </div>
          <button className="icon-btn" onClick={onEdit} aria-label="تغییر برنامه" title="تغییر برنامه">
            <Icon name="edit" size={20} />
          </button>
        </div>
        <div className="pl-hero-bar">
          <Bar value={sc.lessons.total ? sc.lessons.done / sc.lessons.total : 0} color="var(--primary)" label="درس‌های تمام‌شده" />
          <span className="small bold">
            {fmt(sc.lessons.done)} از {fmt(sc.lessons.total)} درس
          </span>
        </div>
        <div className="row wrap small" style={{ gap: 6 }}>
          {sc.state === 'active' && <StatusPill status={sc.status} />}
          <span className="chip">
            {fmt(plan.days.length)} روز در هفته · {fmt(plan.minutes)} دقیقه
          </span>
        </div>
      </section>

      {sc.state === 'expired' && (
        <div className="card center stack" style={{ alignItems: 'center' }}>
          <Mascot mood="calm" size={72} />
          <b>تاریخ هدفت گذشت</b>
          <span className="small muted">امیدواریم خوب پیش رفته باشد! برای امتحان بعدی یک برنامهٔ تازه بساز.</span>
          <button className="btn" onClick={onEdit}>
            برنامهٔ تازه
          </button>
        </div>
      )}
      {sc.state === 'exam-day' && (
        <div className="card center stack" style={{ alignItems: 'center' }}>
          <Mascot mood="cheer" size={72} />
          <b>امروز روز امتحانه؛ موفق باشی!</b>
          <span className="small muted">آرام باش، خوب بخواب و به چیزهایی که خوانده‌ای اعتماد کن.</span>
        </div>
      )}

      {shift !== 0 && sc.state === 'active' && (
        <div className={`note ${shift < 0 ? 'exam' : 'tip'}`}>
          <Icon name="refresh" className="n-ic" size={20} />
          <div>
            {shift < 0
              ? `${fmt(-shift)} روز از برنامه عقب افتاده بودی. اشکالی ندارد؛ بقیهٔ برنامه را دوباره چیدیم.`
              : `${fmt(shift)} روز از برنامه جلوتری! بقیهٔ برنامه را دوباره چیدیم و روزهای بعد سبک‌تر شد.`}
            {sc.left > 0 && ` از امروز روزی حدود ${fmt(roundTo5(sc.perDay))} دقیقه درس.`}
          </div>
        </div>
      )}
      {sc.state === 'active' && sc.overloaded && (
        <div className="note warn">
          <Icon name="info" className="n-ic" size={20} />
          <div>
            برای رسیدن به همهٔ درس‌ها، روزی حدود <b>{fmt(roundTo5(sc.perDay))} دقیقه</b> لازم است؛ بیشتر از {fmt(plan.minutes)} دقیقه‌ای که گذاشتی.{' '}
            <button className="link-btn pl-inline" onClick={onEdit}>
              تغییر برنامه
            </button>
          </div>
        </div>
      )}

      {sc.state === 'active' && <Today sc={sc} s={s} today={today} />}
      {sc.state === 'active' && <Week sc={sc} plan={plan} s={s} today={today} />}
      <Books sc={sc} />

      <div className="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
        <button className="btn sm ghost" onClick={onEdit}>
          <Icon name="edit" size={18} /> تغییر برنامه
        </button>
        <button className="btn sm ghost pl-drop" onClick={() => setDrop(true)}>
          <Icon name="trash" size={18} /> پاک کردن برنامه
        </button>
      </div>
      {drop && (
        <Confirm
          title="برنامه پاک شود؟"
          text="پیشرفت درس‌هایت سر جایش می‌ماند؛ فقط این برنامه پاک می‌شود و هر وقت خواستی می‌توانی برنامهٔ تازه بسازی."
          yes="پاک کن"
          no="نه، بماند"
          danger
          onYes={remove}
          onNo={() => setDrop(false)}
        />
      )}
    </div>
  );
}

function openItem(it: PlanItem, s: AppState) {
  switch (it.kind) {
    case 'lesson': {
      const next = it.steps.find((st) => st.doneAt === null);
      if (next) openPathNode(it.lesson.id, next.node);
      else go({ name: 'lesson', lessonId: it.lesson.id });
      return;
    }
    case 'mock':
      return go({ name: 'mock', lessonId: mockLesson(s, it.subject).id });
    case 'mistakes':
      return go({ name: 'mistakes' });
    case 'cards':
      return go({ name: 'cards', scope: 'due' });
  }
}

function itemSub(it: PlanItem, done: boolean): string {
  const min = `حدود ${fmt(it.minutes)} دقیقه`;
  switch (it.kind) {
    case 'lesson': {
      const n = it.steps.length;
      const fin = it.steps.filter((st) => st.doneAt !== null).length;
      return `${subjectById(it.lesson.subject).title} · ${fin ? `${fmt(fin)} از ${fmt(n)} قدم` : `${fmt(n)} قدم`} · ${min}`;
    }
    case 'mock':
      return `تست‌های درس‌هایی که خوانده‌ای، زمان‌دار · ${min}`;
    case 'mistakes':
      return done ? 'دفتر اشتباه‌هایت خالی است.' : `سؤال‌هایی که غلط زده بودی، دوباره · ${min}`;
    case 'cards':
      return done ? 'امروز کارتی برای مرور نمانده.' : `کارت‌هایی که امروز وقت مرورشان است · ${min}`;
  }
}

const ITEM_ICON = { mock: 'trophy', mistakes: 'review', cards: 'cards' } as const;

function Today({ sc, s, today }: { sc: Schedule; s: AppState; today: string }) {
  const day = sc.todayPlan;
  const nextDay = sc.days.find((d) => d.day !== today);
  return (
    <section className="card pl-today" aria-labelledby="pl-today-h">
      <div className="spread">
        <h2 id="pl-today-h" className="pl-h">
          برنامهٔ امروز
        </h2>
        <span className="small muted">
          {weekdayLong(today)} {dayMonth(today)}
        </span>
      </div>
      {!day ? (
        <div className="pl-rest">
          <Icon name="moon" size={26} />
          <div>
            <b>امروز روز استراحت است</b>
            <div className="small muted">{nextDay ? `روز مطالعهٔ بعدی: ${weekdayLong(nextDay.day)} ${dayMonth(nextDay.day)}` : 'تا روز امتحان، روز مطالعهٔ دیگری نمانده.'}</div>
          </div>
        </div>
      ) : (
        <>
          {day.phase === 'review' && <p className="small muted pl-phase">روزهای جمع‌بندی: آزمون جامع و مرور اشتباه‌ها.</p>}
          {day.phase === 'free' && <p className="small muted pl-phase">درس‌های برنامه تمام شده؛ امروز مرور سبک.</p>}
          <ol className="pl-items">
            {day.items.map((it, k) => {
              const done = itemDone(it, s, today);
              const color = it.kind === 'lesson' ? `var(--${subjectColorKey(it.lesson.subject)})` : it.kind === 'mock' ? `var(--${it.subject.color})` : 'var(--primary)';
              return (
                <li key={k} className={`pl-item${done ? ' done' : ''}`} style={{ ['--sc' as string]: color }}>
                  <span className="pl-item-ic" aria-hidden="true">
                    {done ? (
                      <Icon name="check" size={20} stroke={3} />
                    ) : it.kind === 'lesson' ? (
                      <SubjectIcon id={it.lesson.subject} size={20} />
                    ) : (
                      <Icon name={ITEM_ICON[it.kind]} size={20} />
                    )}
                  </span>
                  <div className="grow">
                    <b>
                      <Rich text={itemTitle(it)} />
                    </b>
                    <div className="tiny muted">{itemSub(it, done)}</div>
                    {it.kind === 'lesson' && (
                      <div className="pl-steps" aria-hidden="true">
                        {it.steps.map((st) => (
                          <span key={st.node.id} className={st.doneAt !== null ? 'on' : ''} />
                        ))}
                      </div>
                    )}
                  </div>
                  {done && it.kind !== 'lesson' ? (
                    <span className="chip ok">انجام شد</span>
                  ) : (
                    <button className={`btn sm${done ? ' ghost' : ''}`} onClick={() => openItem(it, s)}>
                      {done ? 'مرور' : it.kind === 'lesson' && lessonProgress(s, it.lesson) > 0 ? 'ادامه' : 'شروع'}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}

const subjectColorKey = (id: SubjectId) => subjectById(id).color;

/** One week, Saturday to Friday: what was done on the days gone, and the plan for the rest. */
function Week({ sc, plan, s, today }: { sc: Schedule; plan: StudyPlan; s: AppState; today: string }) {
  const [week, setWeek] = useState(0);
  const first = addDays(weekStart(today), 7 * week);
  const last = Math.max(0, Math.floor(diffDays(weekStart(today), plan.goal) / 7));
  const byDay = useMemo(() => new Map(sc.days.map((d) => [d.day, d])), [sc]);
  const done = useMemo(() => stepsDoneByDay(plan, s), [plan, s]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  return (
    <section className="card pl-week" aria-labelledby="pl-week-h">
      <div className="spread">
        <h2 id="pl-week-h" className="pl-h">
          {week === 0 ? 'این هفته' : week === 1 ? 'هفتهٔ بعد' : `${dayMonth(first)} تا ${dayMonth(days[6])}`}
        </h2>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn" onClick={() => setWeek((w) => w - 1)} disabled={week <= 0} aria-label="هفتهٔ قبل">
            <Icon name="back" size={20} />
          </button>
          <button className="icon-btn" onClick={() => setWeek((w) => w + 1)} disabled={week >= last} aria-label="هفتهٔ بعد">
            <Icon name="next" size={20} />
          </button>
        </div>
      </div>
      <ol className="pl-days-list">
        {days.map((d) => (
          <WeekDay key={d} day={d} today={today} goal={plan.goal} plan={byDay.get(d)} done={done[d] ?? 0} study={plan.days.includes(fromKey(d).getDay())} />
        ))}
      </ol>
    </section>
  );
}

function WeekDay({ day, today, goal, plan, done, study }: { day: string; today: string; goal: string; plan?: PlanDay; done: number; study: boolean }) {
  const past = diffDays(day, today) > 0;
  const isGoal = day === goal;
  const after = diffDays(goal, day) > 0;
  let body: React.ReactNode;
  if (isGoal) body = <span className="pl-goal-day">روز امتحان</span>;
  else if (after) body = <span className="muted">—</span>;
  else if (past) body = done ? <span className="pl-past">{fmt(done)} قدم انجام شد</span> : <span className="muted">—</span>;
  else if (!plan) body = <span className="muted">{study ? '—' : 'استراحت'}</span>;
  else
    body = (
      <span className="pl-chips">
        {plan.items.map((it, k) => (
          <span
            key={k}
            className="pl-chip"
            style={{ ['--sc' as string]: it.kind === 'lesson' ? `var(--${subjectColorKey(it.lesson.subject)})` : it.kind === 'mock' ? `var(--${it.subject.color})` : 'var(--primary)' }}
          >
            {it.kind === 'lesson' ? <Rich text={it.lesson.title} /> : it.kind === 'mock' ? `آزمون جامع ${it.subject.short}` : it.kind === 'mistakes' ? 'اشتباه‌ها' : 'کارت‌ها'}
          </span>
        ))}
      </span>
    );
  return (
    <li className={`pl-wd${day === today ? ' today' : ''}${past ? ' past' : ''}${plan?.phase === 'review' ? ' review' : ''}`}>
      <span className="pl-wd-date">
        <b>{WEEKDAY_NAMES[fromKey(day).getDay()]}</b>
        <span>{dayMonth(day)}</span>
      </span>
      <span className="pl-wd-body">{body}</span>
      {plan && !past && <span className="pl-wd-min">{fmt(plan.minutes)}′</span>}
    </li>
  );
}

function Books({ sc }: { sc: Schedule }) {
  return (
    <section className="card" aria-labelledby="pl-books-h">
      <h2 id="pl-books-h" className="pl-h">
        کتاب‌های برنامه
      </h2>
      {sc.books.map((b) => (
        <div key={b.subject.id} className="pl-book" style={{ ['--sc' as string]: `var(--${b.subject.color})` }}>
          <span className="pl-book-ic">
            <SubjectIcon id={b.subject.id} size={20} />
          </span>
          <div className="grow">
            <div className="spread">
              <b className="small">{b.subject.title}</b>
              <span className="tiny muted">
                {b.done >= b.total ? 'تمام شد' : b.ends ? `درس‌ها تا ${dayMonth(b.ends)}` : `${fmt(b.done)} از ${fmt(b.total)}`}
              </span>
            </div>
            <Bar value={b.total ? b.done / b.total : 0} thin color={`var(--${b.subject.color})`} label={`${b.subject.title}: ${b.done} از ${b.total} درس`} />
          </div>
          <button className="icon-btn" onClick={() => go({ name: 'sheet', subject: b.subject.id })} aria-label={`برگهٔ خلاصهٔ ${b.subject.title}`} title="برگهٔ خلاصه">
            <Icon name="doc" size={20} />
          </button>
        </div>
      ))}
      {sc.reviewStart !== sc.goal && (
        <p className="tiny muted" style={{ margin: '10px 2px 0' }}>
          از {fullDay(sc.reviewStart)} تا روز امتحان: جمع‌بندی، آزمون جامع و مرور اشتباه‌ها.
        </p>
      )}
    </section>
  );
}
