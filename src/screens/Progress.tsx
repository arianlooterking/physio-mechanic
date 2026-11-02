import { SUBJECTS, subjectById } from '../content';
import { Icon } from '../components/Icon';
import { Rich } from '../components/Rich';
import { KIND_META } from '../components/session';
import { PlanCard } from '../components/PlanCard';
import { WeeklyReport } from '../components/WeeklyReport';
import { Bar, Ring, SubjectIcon } from '../components/ui';
import { BADGES } from '../lib/badges';
import { fmt, pct } from '../lib/digits';
import { lessonMastery, understoodCount } from '../lib/learner';
import { go } from '../lib/nav';
import { APPROACH_KINDS, bestStyle, levelInfo, liveStreak, type ExamRecord } from '../lib/state';
import { useAppState } from '../lib/store';
import { addDays, clock, dayKey, fromKey, fullDate, minutesLabel, weekdayShort } from '../lib/time';

export function Progress() {
  const s = useAppState();
  const today = dayKey();
  const lv = levelInfo(s.xp.total);
  const { done, total } = understoodCount(s);
  const totalMs = Object.values(s.study.msByDay).reduce((a, b) => a + b, 0);
  const answered = Object.values(s.questions).reduce((a, q) => a + q.seen, 0);
  const right = Object.values(s.questions).reduce((a, q) => a + q.correct, 0);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const maxXp = Math.max(s.profile.goal, ...week.map((d) => s.xp.byDay[d] ?? 0));
  const best = bestStyle(s.style);

  // calendar: last 5 weeks aligned to Saturday (Iranian week start)
  const start = (() => {
    let d = addDays(today, -34);
    while (fromKey(d).getDay() !== 6) d = addDays(d, -1);
    return d;
  })();
  const days: string[] = [];
  for (let d = start; d <= today; d = addDays(d, 1)) days.push(d);

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">پیشرفت تو</h1>
        <p className="page-sub">هر روز کمی، در پایان سال خیلی زیاد می‌شود.</p>
      </div>

      <div className="card row" style={{ gap: 16 }}>
        <Ring value={lv.into / lv.need} size={78} stroke={8} color="var(--primary)">
          {fmt(lv.level)}
        </Ring>
        <div className="grow">
          <b style={{ fontSize: '1.15rem' }}>سطح {fmt(lv.level)}</b>
          <div className="small muted">
            {fmt(lv.into)} از {fmt(lv.need)} امتیاز تا سطح بعد
          </div>
          <div style={{ marginTop: 6 }}>
            <Bar value={lv.into / lv.need} thin color="var(--primary)" />
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <Stat icon={<Icon name="flame" size={24} />} bg="var(--accent-soft)" fg="var(--flame)" value={fmt(liveStreak(s))} label="روز زنجیره" />
        <Stat icon={<Icon name="bolt" size={24} />} bg="var(--accent-soft)" fg="var(--accent-dark)" value={fmt(s.xp.total)} label="کل امتیاز" />
        <Stat icon={<Icon name="bulb" size={24} />} bg="var(--primary-soft)" fg="var(--primary)" value={`${fmt(done)}/${fmt(total)}`} label="مفهوم فهمیده‌شده" />
        <Stat icon={<Icon name="target" size={24} />} bg="var(--ok-soft)" fg="var(--ok)" value={answered ? pct(right / answered) : '—'} label="دقت جواب‌ها" />
        <Stat icon={<Icon name="clock" size={24} />} bg="var(--info-soft)" fg="var(--info)" value={minutesLabel(totalMs)} label="زمان مطالعه" />
        <Stat icon={<Icon name="cards" size={24} />} bg="var(--bad-soft)" fg="var(--bad)" value={fmt(s.counters.cardsReviewed)} label="مرور کارت" />
      </div>

      <PlanCard />

      <WeeklyReport s={s} />

      <ExamHistory exams={s.exams ?? []} />

      <div className="card">
        <div className="spread">
          <h3>امتیاز هفت روز اخیر</h3>
          <span className="small muted">هدف روزانه: {fmt(s.profile.goal)}</span>
        </div>
        <div className="week" role="img" aria-label="نمودار امتیاز هفت روز اخیر">
          {week.map((d) => {
            const v = s.xp.byDay[d] ?? 0;
            return (
              <div key={d} className={`col${d === today ? ' today' : ''}`}>
                <span className="v">{v ? fmt(v) : ''}</span>
                <div className={`colbar${v >= s.profile.goal ? ' met' : ''}`} style={{ height: `${(v / maxXp) * 100}%` }} />
                <span>{weekdayShort(d)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>تقویم مطالعه</h3>
        <div className="cal" style={{ marginBottom: 6 }}>
          {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((w) => (
            <div key={w} style={{ background: 'transparent', aspectRatio: 'auto' }}>
              {w}
            </div>
          ))}
        </div>
        <div className="cal">
          {days.map((d) => {
            const v = s.xp.byDay[d] ?? 0;
            const lvl = v === 0 ? '' : v < s.profile.goal / 2 ? 'l1' : v < s.profile.goal ? 'l2' : 'l3';
            return (
              <div key={d} className={`${lvl}${d === today ? ' today' : ''}`} title={`${d}: ${v}`}>
                {fromKey(d).toLocaleDateString('fa-IR-u-ca-persian-nu-latn', { day: 'numeric' })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>سبک یادگیری تو</h3>
        <p className="small muted" style={{ marginBottom: 10 }}>
          بیومانا ثبت می‌کند با کدام نوع توضیح زودتر می‌فهمی و از این به بعد آن‌ها را جلوتر نشانت می‌دهد.
        </p>
        {APPROACH_KINDS.map((k) => {
          const st = s.style[k];
          return (
            <div className="mastery-row" key={k}>
              <span className="row small" style={{ gap: 6 }}>
                <Icon name={KIND_META[k].icon} size={18} /> {KIND_META[k].label}
              </span>
              <Bar value={st.shown ? st.worked / st.shown : 0} thin color="var(--primary)" />
              <span className="small bold">{st.shown ? `${fmt(st.worked)} از ${fmt(st.shown)}` : '—'}</span>
            </div>
          );
        })}
        {best ? (
          <div className="note key" style={{ marginTop: 10 }}>
            <Icon name="sparkles" className="n-ic" size={20} />
            <div>
              <Rich text={`تا اینجا توضیح‌های «**${KIND_META[best].label}**» بیشتر از بقیه برایت جواب داده‌اند.`} />
            </div>
          </div>
        ) : (
          <p className="tiny muted" style={{ marginTop: 8 }}>
            بعد از فهمیدن چند مفهوم، سبک یادگیری تو اینجا مشخص می‌شود.
          </p>
        )}
      </div>

      <h2 className="section-title">تسلط بر درس‌ها</h2>
      {SUBJECTS.map((sub) => (
        <div key={sub.id} className="card">
          <div className="row" style={{ marginBottom: 6, color: `var(--${sub.color})` }}>
            <SubjectIcon id={sub.id} />
            <b>{sub.title}</b>
          </div>
          {sub.lessons.length === 0 && <div className="small muted">به‌زودی</div>}
          {sub.lessons.map((l) => {
            const m = lessonMastery(s, l);
            return (
              <div className="mastery-row" key={l.id}>
                <span className="small">{l.title}</span>
                <Bar value={m} thin color={`var(--${sub.color})`} />
                <span className="small bold">{pct(m)}</span>
              </div>
            );
          })}
        </div>
      ))}

      <h2 className="section-title">نشان‌ها</h2>
      <div className="badges">
        {BADGES.map((b) => {
          const got = Boolean(s.badges[b.id]);
          return (
            <div key={b.id} className={`badge${got ? '' : ' locked'}`} title={b.desc}>
              <span className="b-ic">{b.emoji}</span>
              <b>{b.title}</b>
              <span>{b.desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** «آزمون‌های جامع»: the latest mock exams, newest first. */
function ExamHistory({ exams }: { exams: ExamRecord[] }) {
  if (!exams.length) {
    return (
      <div className="card row" style={{ gap: 14 }}>
        <Icon name="trophy" size={28} style={{ color: 'var(--accent-dark)', flex: 'none' }} />
        <div className="grow">
          <b>آزمون جامع</b>
          <div className="small muted">چند درس را با هم محک بزن؛ نمره‌هایت این‌جا ثبت می‌شوند.</div>
        </div>
        <button className="btn sm soft" onClick={() => go({ name: 'mock' })}>
          شروع
        </button>
      </div>
    );
  }
  const best = Math.max(...exams.map((e) => e.score));
  return (
    <div className="card">
      <div className="spread" style={{ marginBottom: 6 }}>
        <h3>آزمون‌های جامع</h3>
        <span className="small muted">بهترین: {fmt(best, 1)}٪</span>
      </div>
      {exams
        .slice()
        .reverse()
        .slice(0, 6)
        .map((e) => (
          <div key={e.at} className="exam-row">
            <div className="grow">
              <b className="small">{subjectById(e.subject)?.title ?? 'آزمون'}</b>
              <div className="tiny muted">
                {fullDate(e.at)} · {fmt(e.total)} سؤال · {fmt(e.correct)} درست، {fmt(e.wrong)} غلط · {clock(e.seconds)}
              </div>
            </div>
            <b className={`exam-score${e.score >= 70 ? ' good' : ''}`}>{fmt(e.score, 1)}٪</b>
          </div>
        ))}
      <button className="btn sm ghost block" style={{ marginTop: 10 }} onClick={() => go({ name: 'mock' })}>
        <Icon name="refresh" size={18} /> آزمون جامع تازه
      </button>
    </div>
  );
}

function Stat({ icon, bg, fg, value, label }: { icon: React.ReactNode; bg: string; fg: string; value: string; label: string }) {
  return (
    <div className="stat">
      <span className="s-ic" style={{ background: bg, color: fg }}>
        {icon}
      </span>
      <div>
        <b>{value}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}
