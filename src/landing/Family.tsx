import { motion } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { KaviMascot } from './family/Kavi';
import { YadiMascot } from './family/Yadi';

const EASE = [0.22, 1, 0.36, 1] as const;

type App = {
  id: string;
  name: string;
  latin: string;
  url?: string;
  mascot: ReactNode;
  mascotName: string;
  tagline: string;
  body: string;
  points: string[];
  c1: string;
  c2: string;
  glow: string;
  here?: boolean;
};

const APPS: App[] = [
  {
    id: 'yadmana',
    name: 'یادمانا',
    latin: 'yadmana.com',
    url: 'https://yadmana.com',
    mascot: <YadiMascot mood="wave" size={104} />,
    mascotName: 'یادی',
    tagline: 'استفادهٔ درست و امن از هوش مصنوعی، برای همه',
    body: 'درس‌های کوتاه و بازی‌وار که یاد می‌دهند چطور با هوش مصنوعی درست سؤال کنی، به جوابش اعتماد بی‌جا نکنی و اطلاعاتت را امن نگه داری.',
    points: ['مسیر ویژهٔ هر نقش: از دانش‌آموز تا مدیر ارشد', 'درس‌های کوتاه و بازی‌وار، با گواهی پایانی'],
    c1: '#1d6bff',
    c2: '#0a3fd1',
    glow: 'rgba(60, 130, 255, 0.45)',
  },
  {
    id: 'biomana',
    name: 'بیومانا',
    latin: 'همین‌جا هستی',
    mascot: <Mascot mood="happy" size={104} glow={false} />,
    mascotName: 'بیو',
    tagline: 'بیومکانیک را واقعاً بفهم',
    body: 'هر مفهوم بیومکانیک دستگاه اسکلتی‌ـ‌عضلانی را با چند جور توضیح، تمرین، فلش‌کارت و آزمون یاد می‌دهد؛ به ترتیب فصل‌های کتاب نوردین و فرانکل.',
    points: ['برای دانشجویان فیزیوتراپی', 'متن تألیفی، با شمارهٔ صفحهٔ کتاب مرجع'],
    c1: '#0f8a83',
    c2: '#0a5f5a',
    glow: 'rgba(15, 138, 131, 0.45)',
    here: true,
  },
  {
    id: 'kavyad',
    name: 'کاویاد',
    latin: 'kavyad.com',
    url: 'https://kavyad.com',
    mascot: <KaviMascot mood="wave" size={96} />,
    mascotName: 'کاوی',
    tagline: 'یادگیری کاربردی هوش مصنوعی برای صنعت',
    body: 'برای نیروهای فولاد و صنایع سنگین: با پرونده‌های واقعی کارخانه یاد می‌گیری از هوش مصنوعی کمک بگیری، بی‌آنکه داده‌ای لو برود یا به عدد ساختگی اعتماد کنی.',
    points: ['مسیر ویژهٔ هر نقش کاری در کارخانه', 'نگهبان داده و جعبه‌ابزار شیفت'],
    c1: '#ff7a1a',
    c2: '#c24e00',
    glow: 'rgba(255, 122, 26, 0.42)',
  },
];

function Card({ a, i }: { a: App; i: number }) {
  const inner = (
    <>
      <div className="fm-art" aria-hidden="true">
        <span className="fm-ring" />
        <span className="fm-ring two" />
        <div className="fm-mascot">{a.mascot}</div>
      </div>
      <div className="fm-body">
        <div className="fm-name">
          <b>{a.name}</b>
          <span dir={a.url ? 'ltr' : undefined}>{a.latin}</span>
        </div>
        <p className="fm-tagline">{a.tagline}</p>
        <p className="fm-text">{a.body}</p>
        <ul>
          {a.points.map((p) => (
            <li key={p}>
              <Icon name="check" size={15} />
              {p}
            </li>
          ))}
        </ul>
        <span className="fm-go">
          {a.here ? (
            <>
              <Icon name="sparkles" size={16} /> مهمان بیو هستی
            </>
          ) : (
            <>
              دیدن {a.name} <Icon name="external" size={16} />
            </>
          )}
        </span>
      </div>
    </>
  );
  const style = { '--c1': a.c1, '--c2': a.c2, '--glow': a.glow } as CSSProperties;
  const anim = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '0px 0px -60px 0px' },
    transition: { duration: 0.7, ease: EASE, delay: i * 0.1 },
  };
  return a.url ? (
    <motion.a
      href={a.url}
      target="_blank"
      rel="noopener"
      className={`fm-card ${a.id}`}
      style={style}
      {...anim}
      whileHover={{ y: -10 }}
      aria-label={`${a.name}: ${a.tagline} (در صفحهٔ تازه باز می‌شود)`}
    >
      {inner}
    </motion.a>
  ) : (
    <motion.div className={`fm-card ${a.id} here`} style={style} {...anim}>
      {inner}
    </motion.div>
  );
}

/** «خانوادهٔ ما»: the three sister apps, with a scrolling ribbon above them. */
export function Family() {
  const ribbon = (
    <div className="fm-ribbon-row">
      {Array.from({ length: 3 }).flatMap((_, r) =>
        APPS.map((a) => (
          <span key={`${r}-${a.id}`} style={{ '--c1': a.c1 } as CSSProperties}>
            <i aria-hidden="true" />
            {a.name}
            <small>{a.tagline}</small>
          </span>
        )),
      )}
    </div>
  );
  return (
    <section className="fm" id="family" aria-labelledby="h-family">
      <div className="fm-ribbon" aria-hidden="true">
        <div className="fm-ribbon-track">
          {ribbon}
          {ribbon}
        </div>
      </div>
      <div className="fl-wrap">
        <motion.div className="fl-head" initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.65, ease: EASE }}>
          <span className="fl-tag">
            <i aria-hidden="true" />
            خانوادهٔ ما
          </span>
          <h2 id="h-family">سه برنامه، یک هدف: یادگرفتنِ واقعی</h2>
          <p>بیومانا خواهر کوچک‌تر دو برنامهٔ دیگر است. هر سه بازی‌وار، فارسی و ساخته‌شده برای گوشی‌اند؛ هرکدام برای یک نیاز.</p>
        </motion.div>
        <div className="fm-grid">
          {APPS.map((a, i) => (
            <Card key={a.id} a={a} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
