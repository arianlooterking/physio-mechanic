import { FIELD } from '../content/fields';
import { LESSONS } from '../content';
import { conceptOf, dailyBestRun, type AppState } from './state';

export interface BadgeDef {
  id: string;
  title: string;
  desc: string;
  emoji: string;
  earned: (s: AppState) => boolean;
}

export const BADGES: BadgeDef[] = [
  {
    id: 'first',
    title: 'اولین جرقه',
    desc: 'اولین مفهوم را فهمیدی',
    emoji: '💡',
    earned: (s) => Object.values(s.concepts).some((c) => c.status === 'understood'),
  },
  {
    id: 'grit',
    title: 'پشتکار',
    desc: 'مفهومی را بعد از ۳ توضیح مختلف فهمیدی',
    emoji: '🧗',
    earned: (s) => s.counters.hardWon >= 1,
  },
  {
    id: 'streak3',
    title: 'سه روز پیاپی',
    desc: 'زنجیرهٔ ۳ روزه',
    emoji: '🔥',
    earned: (s) => s.streak.best >= 3,
  },
  {
    id: 'streak7',
    title: 'یک هفتهٔ کامل',
    desc: 'زنجیرهٔ ۷ روزه',
    emoji: '📅',
    earned: (s) => s.streak.best >= 7,
  },
  {
    id: 'streak30',
    title: 'یک ماه بی‌وقفه',
    desc: 'زنجیرهٔ ۳۰ روزه',
    emoji: '🏔️',
    earned: (s) => s.streak.best >= 30,
  },
  {
    id: 'perfect',
    title: 'بی‌نقص',
    desc: 'یک تمرین کامل بدون حتی یک اشتباه',
    emoji: '🎯',
    earned: (s) => s.counters.perfect >= 1,
  },
  {
    id: 'full-test',
    title: 'صددرصد',
    desc: 'نمرهٔ کامل در آزمون یک درس',
    emoji: '🥇',
    earned: (s) => Object.values(s.lessons).some((l) => (l.best ?? 0) >= 99.99),
  },
  {
    id: 'cards50',
    title: 'حافظهٔ قوی',
    desc: '۵۰ بار مرور کارت',
    emoji: '🧠',
    earned: (s) => s.counters.cardsReviewed >= 50,
  },
  {
    id: 'trio',
    title: 'سه‌گانه',
    desc: 'در ریاضی، فیزیک و شیمی هر کدام دست‌کم یک مفهوم را فهمیدی',
    emoji: '🌈',
    earned: (s) =>
      (['math', 'physics', 'chemistry'] as const).every((field) =>
        LESSONS.filter((l) => FIELD[l.subject] === field).some((l) => l.concepts.some((c) => conceptOf(s, c.id).status === 'understood')),
      ),
  },
  {
    id: 'master',
    title: 'استاد درس',
    desc: 'همهٔ مفهوم‌های یک درس + آزمون بالای ۸۰٪',
    emoji: '👑',
    earned: (s) => LESSONS.some((l) => l.concepts.every((c) => conceptOf(s, c.id).status === 'understood') && (s.lessons[l.id]?.best ?? 0) >= 80),
  },
  {
    id: 'ai',
    title: 'هم‌صحبت بیو',
    desc: 'از معلم هوش مصنوعی سؤال پرسیدی',
    emoji: '💬',
    earned: (s) => s.counters.aiAsks >= 1,
  },
  {
    id: 'xp500',
    title: 'پانصدتایی',
    desc: '۵۰۰ امتیاز جمع کردی',
    emoji: '⚡',
    earned: (s) => s.xp.total >= 500,
  },
  {
    id: 'reviewer',
    title: 'مرورگر',
    desc: '۳ جلسهٔ مرور اشتباه‌ها',
    emoji: '🔁',
    earned: (s) => s.counters.reviewsDone >= 3,
  },
  {
    id: 'daily7',
    title: 'هفت چالش پیاپی',
    desc: '۷ روز پشت‌سرهم «چالش امروز» را تمام کردی',
    emoji: '🗓️',
    earned: (s) => dailyBestRun(s) >= 7,
  },
];

/** Award any newly earned badges; returns them so the UI can celebrate. */
export function awardBadges(s: AppState, now = Date.now()): BadgeDef[] {
  const fresh: BadgeDef[] = [];
  for (const b of BADGES) {
    if (!s.badges[b.id] && b.earned(s)) {
      s.badges[b.id] = now;
      fresh.push(b);
    }
  }
  return fresh;
}
