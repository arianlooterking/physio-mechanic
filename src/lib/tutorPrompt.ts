/*
 * Prompt for the AI tutor «بیو». Shared by the browser (when the app runs as a claude.ai artifact)
 * and by the server endpoint (server/tutor.ts), so both behave the same.
 */

export type TutorMode = 'explain' | 'chat' | 'teachback';

export interface TutorTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface TutorRequest {
  mode: TutorMode;
  subject: string;
  lesson: string;
  concept: string;
  /** The concept's key points, so answers stay inside the textbook's scope. */
  summary: string[];
  /** Titles of the explanations the student has already seen. */
  tried: string[];
  /** What the student said they did not get (explain mode). */
  confusion?: string;
  /** Chat history; the last turn is the student's new message (chat/teachback). */
  turns?: TutorTurn[];
  name?: string;
}

export const LIMITS = {
  field: 300,
  summaryItems: 10,
  tried: 8,
  turns: 12,
  turnChars: 1500,
} as const;

const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);

/** Coerce untrusted input into a bounded TutorRequest. Returns null when it is unusable. */
export function sanitizeRequest(raw: unknown): TutorRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const mode = r.mode === 'explain' || r.mode === 'chat' || r.mode === 'teachback' ? r.mode : null;
  if (!mode) return null;
  const arr = (v: unknown, n: number, len: number) =>
    Array.isArray(v) ? v.slice(0, n).map((x) => clip(x, len)).filter(Boolean) : [];
  const turns: TutorTurn[] = Array.isArray(r.turns)
    ? (r.turns as unknown[])
        .slice(-LIMITS.turns)
        .map((t) => {
          const o = (t ?? {}) as Record<string, unknown>;
          return {
            role: o.role === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: clip(o.content, LIMITS.turnChars).trim(),
          };
        })
        .filter((t) => t.content)
    : [];
  if ((mode === 'chat' || mode === 'teachback') && (turns.length === 0 || turns[turns.length - 1].role !== 'user')) {
    return null;
  }
  return {
    mode,
    subject: clip(r.subject, LIMITS.field),
    lesson: clip(r.lesson, LIMITS.field),
    concept: clip(r.concept, LIMITS.field),
    summary: arr(r.summary, LIMITS.summaryItems, LIMITS.field),
    tried: arr(r.tried, LIMITS.tried, 120),
    confusion: r.confusion ? clip(r.confusion, LIMITS.field) : undefined,
    turns,
    name: r.name ? clip(r.name, 40) : undefined,
  };
}

const STYLE = `تو «بیو» هستی، استاد راهنمای مهربان و دقیق اپ «بیومانا» برای دانشجویان فیزیوتراپی و علوم توان‌بخشی در ایران. موضوع: بیومکانیک دستگاه اسکلتی‌ـ‌عضلانی.
قواعد:
- فقط فارسی ساده و صمیمی بنویس (محاوره‌ای ملایم، مثل یک استاد خوب). اصطلاح‌های تخصصی را با معادل انگلیسی‌شان بیاور..
- کوتاه بنویس: حداکثر حدود ۱۸۰ کلمه، در چند پاراگراف کوتاه یا فهرست.
- در محدودهٔ درس بمان و نمادگذاری رایج بیومکانیک را به کار ببر. هر جا مناسب است مثال بالینی بزن. هیچ مطلب نادرست نگو و توصیهٔ درمانی شخصی نده؛ اگر مطمئن نیستی، صادقانه بگو.
- فرمول‌ها را با LaTeX بین $...$ بنویس (برای معادلهٔ شیمی از \\ce{...} داخل $...$ استفاده کن). از جدول و عنوان Markdown استفاده نکن؛ فقط **پررنگ** و فهرست با «- » مجاز است.
- دانشجو را تشویق کن ولی چاپلوسی نکن. جواب کامل تمرین‌های کتاب را به‌جای دانشجو ننویس؛ راهنمایی کن تا خودش برسد.
- اگر سؤال به درس ربطی ندارد، مؤدبانه برگردان به همین درس.`;

function context(req: TutorRequest): string {
  const lines = [
    `درس: ${req.subject} — ${req.lesson}`,
    `مفهوم فعلی: ${req.concept}`,
  ];
  if (req.summary.length) lines.push(`نکته‌های اصلی این مفهوم (طبق کتاب):\n${req.summary.map((s) => `- ${s}`).join('\n')}`);
  if (req.name) lines.push(`نام دانشجو: ${req.name}`);
  return lines.join('\n');
}

/** System prompt (server) or leading instruction turn (artifact). */
export function buildSystem(req: TutorRequest): string {
  let task = '';
  if (req.mode === 'explain') {
    task = `کار تو: دانشجو این مفهوم را با توضیح‌های قبلی نفهمیده است. یک توضیح «کاملاً تازه» بده که با توضیح‌های قبلی فرق داشته باشد.
توضیح‌هایی که قبلاً دیده: ${req.tried.length ? req.tried.join('، ') : 'هیچ'}.
${req.confusion ? `دانشجو گفته مشکلش این است: «${req.confusion}».` : ''}
ساختار جواب: ۱) یک تشبیه یا موقعیت آشنا از زندگی روزمره، ۲) یک مثال عددی خیلی ساده و حل‌شده، ۳) یک جملهٔ جمع‌بندی، ۴) در پایان یک سؤال کوتاه برای اینکه خودش امتحان کند (جوابش را نگو).`;
  } else if (req.mode === 'chat') {
    task = `کار تو: به سؤال دانشجو دربارهٔ همین مفهوم جواب بده. اگر سؤالش مبهم است، یک سؤال روشن‌کننده بپرس. اگر اشتباه مفهومی دارد، با مهربانی و دقیق اصلاحش کن.`;
  } else {
    task = `کار تو: دانشجو سعی کرده این مفهوم را با زبان خودش توضیح دهد (روش «به من درس بده»). توضیحش را ارزیابی کن:
- اول بگو کدام بخش‌ها درست است.
- بعد اشتباه‌ها یا جاهای ناقص را دقیق و مهربان بگو (اگر نیست، بگو).
- در پایان یک خط با این قالب بنویس: «نمره: N از ۳» که N عدد ۰ تا ۳ است (۳ یعنی کامل و درست).`;
  }
  return `${STYLE}\n\n${context(req)}\n\n${task}`;
}

/** The user-facing turns. In explain mode there is one synthetic request turn. */
export function buildTurns(req: TutorRequest): TutorTurn[] {
  if (req.mode === 'explain') {
    return [{ role: 'user', content: `لطفاً «${req.concept}» را یک جور دیگر برایم توضیح بده.` }];
  }
  return req.turns ?? [];
}

/** Parse «نمره: N از ۳» from a teach-back answer. */
export function parseTeachbackScore(text: string): number | null {
  const norm = text.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const m = norm.match(/نمره\s*[:：]\s*(\d)\s*از\s*3/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 0 && n <= 3 ? n : null;
}
