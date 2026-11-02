import { useEffect, useMemo } from 'react';
import { fmt } from '../lib/digits';
import { go } from '../lib/nav';
import { itemDone, replan, schedule, type PlanItem, type PlanStatus, type Schedule } from '../lib/plan';
import type { AppState } from '../lib/state';
import { getState, update, useAppState } from '../lib/store';
import { dayKey, weekdayLong } from '../lib/time';
import { Icon } from './Icon';
import { Rich } from './Rich';

/** Today's schedule of the learner's plan (null without a plan), with the quiet re-plan kept up to date. */
export function usePlanSchedule(): { s: AppState; sc: Schedule | null; today: string } {
  const s = useAppState();
  const today = dayKey();
  const sc = useMemo(() => (s.plan ? schedule(s.plan, s, today) : null), [s, today]);
  useEffect(() => {
    const plan = getState().plan;
    if (!plan) return;
    const next = replan(plan, getState(), today);
    if (next) update((st) => void (st.plan = next));
  }, [s.plan, today]);
  return { s, sc, today };
}

export function StatusPill({ status }: { status: PlanStatus }) {
  switch (status.kind) {
    case 'done':
      return <span className="chip ok">همهٔ درس‌ها تمام شد</span>;
    case 'ahead':
      return <span className="chip primary">{fmt(status.days)} روز جلوتری</span>;
    case 'behind':
      return <span className="chip accent">{fmt(status.days)} روز عقبی</span>;
    default:
      return <span className="chip ok">طبق برنامه</span>;
  }
}

/** A task's name, for the cards and the week view. */
export function itemTitle(it: PlanItem): string {
  switch (it.kind) {
    case 'lesson':
      return it.lesson.title;
    case 'mock':
      return `آزمون جامع ${it.subject.title}`;
    case 'mistakes':
      return 'مرور اشتباه‌ها';
    case 'cards':
      return 'کارت‌های مرور';
  }
}

/** «برنامهٔ مطالعه» on Home and on the progress page: an offer to make one, or today's share of it. */
export function PlanCard() {
  const { s, sc, today } = usePlanSchedule();
  if (!s.plan || !sc) {
    return (
      <section className="card plan-card" aria-label="برنامهٔ مطالعه">
        <span className="plan-card-ic" aria-hidden="true">
          <Icon name="calendar" size={26} />
        </span>
        <div className="grow">
          <div className="plan-kicker">برنامهٔ مطالعه</div>
          <b>تا امتحان چقدر وقت داری؟</b>
          <div className="small muted">بگو؛ بیومانا درس‌های مانده را روزبه‌روز برایت می‌چیند و هفته‌های آخر را برای جمع‌بندی نگه می‌دارد.</div>
        </div>
        <button className="btn sm soft" onClick={() => go({ name: 'plan' })}>
          بساز
        </button>
      </section>
    );
  }
  const items = sc.todayPlan?.items ?? [];
  const done = items.filter((it) => itemDone(it, s, today)).length;
  const next = items.find((it) => !itemDone(it, s, today));
  const nextDay = sc.days.find((d) => d.day !== today)?.day;
  let title: React.ReactNode;
  let sub: string;
  if (sc.state === 'expired') {
    title = 'تاریخ هدفت گذشت';
    sub = 'برای امتحان بعدی یک برنامهٔ تازه بساز.';
  } else if (sc.state === 'exam-day') {
    title = 'امروز روز امتحانه؛ موفق باشی!';
    sub = 'آرام باش و به چیزهایی که خوانده‌ای اعتماد کن.';
  } else if (!sc.todayPlan) {
    title = 'امروز روز استراحت است';
    sub = nextDay ? `روز مطالعهٔ بعدی: ${weekdayLong(nextDay)}` : 'تا روز امتحان، روز مطالعهٔ دیگری نمانده.';
  } else if (!next) {
    title = 'کارهای امروز تمام شد';
    sub = 'آفرین! اگر حال داری، از کارهای فردا جلو بیفت.';
  } else {
    title = <Rich text={itemTitle(next)} />;
    sub = `${fmt(done)} از ${fmt(items.length)} کار امروز · حدود ${fmt(sc.todayPlan.minutes)} دقیقه`;
  }
  return (
    <section className={`card plan-card on${sc.todayPlan && !next ? ' done' : ''}`} aria-label="برنامهٔ امروز">
      <span className="plan-card-ic" aria-hidden="true">
        <Icon name={sc.todayPlan && !next ? 'check' : 'calendar'} size={26} stroke={sc.todayPlan && !next ? 3 : undefined} />
      </span>
      <div className="grow">
        <div className="plan-kicker">
          برنامهٔ امروز {sc.state === 'active' && <StatusPill status={sc.status} />}
        </div>
        <b className="plan-card-title">{title}</b>
        <div className="small muted">{sub}</div>
      </div>
      <button className={`btn sm${next ? '' : ' ghost'}`} onClick={() => go({ name: 'plan' })}>
        {next ? 'برنامه' : 'ببین'}
      </button>
    </section>
  );
}
