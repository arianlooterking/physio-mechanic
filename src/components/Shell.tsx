import { useEffect, useState, type ReactNode } from 'react';
import { useAccount } from '../lib/account';
import { detectTutor, onTutorProvider, type TutorProvider } from '../lib/ai';
import { fmt } from '../lib/digits';
import { dueCards, reviewAvailable } from '../lib/learner';
import { go, type Route } from '../lib/nav';
import { heartsNow, liveStreak, studiedToday, xpToday } from '../lib/state';
import { useAppState } from '../lib/store';
import { minutesLabel } from '../lib/time';
import { Icon, type IconName } from './Icon';
import { BrandMark, Mascot } from './Mascot';
import { SidebarLessons } from './SidebarLessons';
import { Bar, Ring, Sheet } from './ui';

const TABS: { name: Route['name']; label: string; icon: IconName }[] = [
  { name: 'home', label: 'یادگیری', icon: 'home' },
  { name: 'review', label: 'مرور', icon: 'review' },
  { name: 'lab', label: 'آزمایشگاه', icon: 'wand' },
  { name: 'progress', label: 'پیشرفت', icon: 'chart' },
  { name: 'profile', label: 'من', icon: 'user' },
];

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const s = useAppState();
  const pending = dueCards(s).length + reviewAvailable(s);
  const nav = (r: Route['name']) => go({ name: r } as Route);
  return (
    <div className="shell with-nav">
      <aside className="sidebar" aria-label="منوی اصلی">
        <a className="brand" href="#/welcome" title="صفحهٔ معرفی بیومانا">
          <BrandMark /> بیومانا
        </a>
        <nav>
          {TABS.map((t) => (
            <button key={t.name} aria-current={route.name === t.name ? 'page' : undefined} onClick={() => nav(t.name)}>
              <Icon name={t.icon} size={24} />
              {t.label}
              {t.name === 'review' && pending > 0 && <span className="badge-dot">{fmt(Math.min(pending, 99))}</span>}
            </button>
          ))}
        </nav>
        <SidebarLessons route={route} />
      </aside>
      <TopBar />
      <main className="main" id="main">
        {children}
      </main>
      <aside className="rail" aria-label="خلاصهٔ امروز">
        <DailyGoalCard />
        <StreakCard />
        <ReviewCard />
        <TutorCard />
      </aside>
      <nav className="bottomnav" aria-label="منوی اصلی">
        {TABS.map((t) => (
          <button key={t.name} aria-current={route.name === t.name ? 'page' : undefined} onClick={() => nav(t.name)}>
            <span className="nav-ic">
              <Icon name={t.icon} size={24} />
            </span>
            {t.label}
            {t.name === 'review' && pending > 0 && <span className="badge-dot">{fmt(Math.min(pending, 99))}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

function TopBar() {
  const s = useAppState();
  const [sheet, setSheet] = useState<null | 'streak' | 'hearts' | 'xp'>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const streak = liveStreak(s);
  const today = studiedToday(s);
  const h = heartsNow(s);
  return (
    <header className="topbar">
      <div className="topbar-in">
        <a className="brand mobile-brand" href="#/welcome" title="صفحهٔ معرفی بیومانا">
          <BrandMark size={34} />
          <span style={{ fontSize: '1.2rem' }}>بیومانا</span>
        </a>
        <div className="grow" />
        <button className={`stat-pill flame${today ? ' on' : ''}`} onClick={() => setSheet('streak')} aria-label={`زنجیرهٔ ${streak} روزه`}>
          <Icon name="flame" size={24} /> {fmt(streak)}
        </button>
        <button className="stat-pill xp" onClick={() => setSheet('xp')} aria-label={`${xpToday(s)} امتیاز امروز`}>
          <Icon name="bolt" size={22} /> {fmt(s.xp.total)}
        </button>
        <button className="stat-pill heart" onClick={() => setSheet('hearts')} aria-label={`${h.n} قلب`}>
          <Icon name="heart" size={22} /> {fmt(h.n)}
        </button>
      </div>
      {sheet === 'streak' && (
        <Sheet title="زنجیرهٔ روزانه" onClose={() => setSheet(null)}>
          <StreakCard bare />
        </Sheet>
      )}
      {sheet === 'xp' && (
        <Sheet title="هدف امروز" onClose={() => setSheet(null)}>
          <DailyGoalCard bare />
        </Sheet>
      )}
      {sheet === 'hearts' && (
        <Sheet title="قلب‌ها" onClose={() => setSheet(null)}>
          <div className="stack center">
            <div style={{ fontSize: 40, color: 'var(--heart)' }}>
              {Array.from({ length: 5 }, (_, i) => (
                <Icon key={i} name="heart" size={36} style={{ opacity: i < h.n ? 1 : 0.2 }} />
              ))}
            </div>
            <p>
              هر جواب غلط در <b>تمرین</b> یک قلب کم می‌کند. یادگیری مفهوم‌ها، کارت‌ها و آزمون‌ها قلب مصرف نمی‌کنند.
            </p>
            {h.n < 5 ? <p className="muted small">قلب بعدی تا {minutesLabel(h.nextIn)} دیگر برمی‌گردد. با «مرور اشتباه‌ها» هم قلب جمع کن.</p> : <p className="muted small">قلب‌هایت پر است!</p>}
            {h.n < 5 && (
              <button
                className="btn block"
                onClick={() => {
                  setSheet(null);
                  go({ name: 'mistakes' });
                }}
              >
                مرور اشتباه‌ها
              </button>
            )}
          </div>
        </Sheet>
      )}
    </header>
  );
}

export function DailyGoalCard({ bare }: { bare?: boolean }) {
  const s = useAppState();
  const xp = xpToday(s);
  const goal = s.profile.goal;
  const done = xp >= goal;
  const body = (
    <div className="row" style={{ gap: 14 }}>
      <Ring value={xp / goal} size={64} stroke={7} color={done ? 'var(--ok)' : 'var(--accent)'}>
        {done ? <Icon name="check" size={22} /> : <Icon name="bolt" size={22} style={{ color: 'var(--accent)' }} />}
      </Ring>
      <div className="grow">
        <b>هدف امروز</b>
        <div className="small muted">
          {fmt(Math.min(xp, goal))} از {fmt(goal)} امتیاز
        </div>
        <div style={{ marginTop: 6 }}>
          <Bar value={xp / goal} thin color={done ? 'var(--ok)' : 'var(--accent)'} />
        </div>
        {done && <div className="small bold" style={{ color: 'var(--ok)', marginTop: 4 }}>هدف امروز کامل شد! 🎉</div>}
      </div>
    </div>
  );
  return bare ? body : <div className="card">{body}</div>;
}

export function StreakCard({ bare }: { bare?: boolean }) {
  const s = useAppState();
  const n = liveStreak(s);
  const today = studiedToday(s);
  const body = (
    <div className="row" style={{ gap: 14 }}>
      <span style={{ color: today ? 'var(--flame)' : 'var(--ink-3)' }}>
        <Icon name="flame" size={52} />
      </span>
      <div className="grow">
        <b>{n > 0 ? `${fmt(n)} روز پشت‌سرهم` : 'زنجیره را شروع کن'}</b>
        <div className="small muted">
          {today ? 'امروز را ثبت کردی. فردا هم بیا!' : n > 0 ? 'امروز یک جلسه کامل کن تا زنجیره نشکند.' : 'هر روز حداقل یک جلسه، زنجیره را بلندتر می‌کند.'}
        </div>
        <div className="small muted">بهترین رکورد: {fmt(s.streak.best)} روز</div>
      </div>
    </div>
  );
  return bare ? body : <div className="card">{body}</div>;
}

function ReviewCard() {
  const s = useAppState();
  const cards = dueCards(s).length;
  const mistakes = reviewAvailable(s);
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <b>مرور امروز</b>
      <button className="row link-btn" style={{ justifyContent: 'space-between', width: '100%' }} onClick={() => go({ name: 'cards', scope: 'due' })}>
        <span className="row">
          <Icon name="cards" /> کارت‌های آماده
        </span>
        <span className="chip accent">{fmt(cards)}</span>
      </button>
      <button className="row link-btn" style={{ justifyContent: 'space-between', width: '100%' }} onClick={() => go({ name: 'mistakes' })}>
        <span className="row">
          <Icon name="refresh" /> اشتباه‌های قبلی
        </span>
        <span className="chip bad">{fmt(mistakes)}</span>
      </button>
    </div>
  );
}

function TutorCard() {
  const [p, setP] = useState<TutorProvider | null>(null);
  const { account } = useAccount();
  useEffect(() => {
    void detectTutor().then(setP);
    return onTutorProvider(setP);
  }, []);
  return (
    <div className="card row" style={{ alignItems: 'flex-start' }}>
      <Mascot mood={p === 'offline' ? 'calm' : 'happy'} size={52} glow={false} />
      <div className="grow small">
        <b>فهمی، معلم هوش مصنوعی</b>
        <div className="muted">
          {p === null
            ? 'در حال بررسی…'
            : p === 'offline'
              ? 'الان آفلاین است؛ توضیح‌های آماده همه در دسترس‌اند.'
              : p === 'server' && !account
                ? 'آنلاین است. برای گفت‌وگو با بیو با حساب گوگل وارد شو.'
                : 'آنلاین است. هر جا گیر کردی، از دکمهٔ گفت‌وگو بپرس.'}
        </div>
      </div>
    </div>
  );
}
