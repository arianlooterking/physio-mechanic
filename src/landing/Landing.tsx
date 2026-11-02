import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Blocks } from '../components/Blocks';
import { Icon, type IconName } from '../components/Icon';
import { BrandMark, Mascot } from '../components/Mascot';
import { M, Rich } from '../components/Rich';
import { KIND_META } from '../components/session';
import { BOOKS, conceptById, LESSONS } from '../content';
import type { ApproachKind } from '../content/types';
import { useAccount } from '../lib/account';
import { fmt } from '../lib/digits';
import { go } from '../lib/nav';
import { useAppState } from '../lib/store';
import { Family } from './Family';
import { GoogleG } from './GoogleG';
import { isApp } from '../lib/platform';
import './landing.css';
import './matrix.css';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade up once when the block scrolls into view. */
const rv = (delay = 0) => ({
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '0px 0px -70px 0px' },
  transition: { duration: 0.65, ease: EASE, delay },
});

const ALL_CONCEPTS = LESSONS.flatMap((l) => l.concepts);

const NAV: [string, string][] = [
  ['method', 'روش فهماندن'],
  ['subjects', 'فصل‌ها'],
  ['features', 'امکانات'],
  ['faq', 'پرسش‌ها'],
];

function scrollToId(id: string, reduce: boolean | null) {
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

function Head({ tag, title, children, id, light }: { tag: string; title: ReactNode; children?: ReactNode; id: string; light?: boolean }) {
  return (
    <motion.div className={`fl-head${light ? ' light' : ''}`} {...rv()}>
      <span className="fl-tag">
        <i aria-hidden="true" />
        {tag}
      </span>
      <h2 id={id}>{title}</h2>
      {children && <p>{children}</p>}
    </motion.div>
  );
}

/** A number that counts up when it scrolls into view. */
function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: '0px 0px -40px 0px' });
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!seen || reduce) {
      if (reduce) setN(to);
      return;
    }
    const c = animate(0, to, { duration: 1.6, ease: EASE, onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [seen, to, reduce]);
  return (
    <span ref={ref}>
      {fmt(n)}
      {suffix}
    </span>
  );
}

/* ───────────────────────── hero background ───────────────────────── */

const FORMULAS: { tex: string; x: number; y: number; d: number; z: number }[] = [
  { tex: 'M=F\\times d', x: 6, y: 18, d: 0, z: 1 },
  { tex: String.raw`\sigma=\dfrac{F}{A}`, x: 80, y: 12, d: 1.2, z: 0.6 },
  { tex: String.raw`\varepsilon=\dfrac{\Delta L}{L_0}`, x: 90, y: 62, d: 0.6, z: 1.2 },
  { tex: String.raw`\sum M=0`, x: 4, y: 78, d: 2, z: 0.7 },
  { tex: String.raw`E=\dfrac{\sigma}{\varepsilon}`, x: 48, y: 88, d: 1.6, z: 0.9 },
  { tex: String.raw`P=F\,v`, x: 40, y: 6, d: 0.3, z: 0.8 },
  { tex: String.raw`F\cos\alpha`, x: 70, y: 84, d: 2.4, z: 1.1 },
  { tex: String.raw`\sum F=0`, x: 22, y: 50, d: 1, z: 0.5 },
];

const SPARKS: [number, number, number, number][] = [
  [6, 11, 0, 3], [14, 14, 3, 2], [23, 12, 6, 3], [31, 16, 1.5, 2], [42, 13, 8, 2], [53, 15, 4, 3],
  [61, 11, 2, 2], [70, 14, 7, 3], [79, 12, 0.8, 2], [88, 15, 5, 3], [95, 13, 9, 2], [47, 17, 11, 2],
];

function HeroBackdrop({ mx, my }: { mx: MotionValue<number>; my: MotionValue<number> }) {
  return (
    <div className="fl-hero-bg" aria-hidden="true">
      <div className="fl-aurora a" />
      <div className="fl-aurora b" />
      <div className="fl-aurora c" />
      <div className="fl-grid" />
      <div className="fl-sparks">
        {SPARKS.map(([x, dur, delay, s], k) => (
          <span key={k} style={{ '--x': `${x}%`, '--d': `${dur}s`, '--dl': `${delay}s`, '--s': `${s}px` } as CSSProperties} />
        ))}
      </div>
      {FORMULAS.map((f, k) => (
        <Formula key={k} f={f} mx={mx} my={my} />
      ))}
    </div>
  );
}

function Formula({ f, mx, my }: { f: (typeof FORMULAS)[number]; mx: MotionValue<number>; my: MotionValue<number> }) {
  const x = useTransform(mx, (v) => v * 26 * f.z);
  const y = useTransform(my, (v) => v * 18 * f.z);
  return (
    <motion.div className={`fl-formula${f.y > 10 && f.y < 75 ? ' mid' : ''}`} style={{ insetInlineStart: `${f.x}%`, top: `${f.y}%`, x, y, '--fd': `${f.d}s`, '--fs': f.z } as never}>
      <M tex={f.tex} />
    </motion.div>
  );
}

/* ───────────────────────── hero phone: the explain-again loop ───────────────────────── */

const PLOT_W = 220;
const PLOT_H = 130;
/** The forearm as a lever: pivot (elbow) on the right, a weight that slides out along it. */
const PIVOT_X = 190;
const ARM_Y = 70;
function PhoneDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: '0px 0px -10% 0px' });
  const reduce = useReducedMotion();
  // 0 example · 1 tap «جور دیگه» · 2 visual · 3 tap «فهمیدم» · 4 check · 5 correct
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const wait = [3000, 900, 3600, 900, 1700, 2600][stage];
    const t = setTimeout(() => setStage((s) => (s + 1) % 6), wait);
    return () => clearTimeout(t);
  }, [stage, visible]);
  const kind: ApproachKind = stage < 2 ? 'example' : 'visual';
  const progress = [18, 22, 46, 52, 78, 100][stage];

  return (
    <div className="fl-phone" ref={ref} role="img" aria-label="نمونهٔ یک درس بیومانا روی گوشی: توضیح با مثال، بعد توضیح با شکل، بعد یک سؤال کوتاه">
      <div className="fl-phone-notch" aria-hidden="true" />
      <div className="fl-phone-screen" aria-hidden="true">
        <div className="fl-phone-top">
          <Icon name="x" size={15} />
          <div className="fl-phone-bar">
            <motion.span animate={{ width: `${progress}%` }} transition={{ type: 'spring', stiffness: 80, damping: 18 }} />
          </div>
          <span className="fl-phone-heart">
            <Icon name="heart" size={13} /> ۵
          </span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {stage < 4 ? (
            <motion.div key={kind} className="fl-phone-body" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.35 }}>
              <span className={`fl-kind ${kind}`}>
                <Icon name={KIND_META[kind].icon} size={14} /> {KIND_META[kind].label}
              </span>
              <b className="fl-phone-title">گشتاور و بازوی گشتاور</b>
              {kind === 'example' ? (
                <>
                  <p>
                    یک در سنگین را کنار لولا هل بده: سخت باز می‌شود. همان نیرو کنار دستگیره: راحت. فرق در <b>فاصله</b> از محور است.
                  </p>
                  <div className="fl-phone-math">
                    <M tex="M=F\times d" />
                    <span>گشتاور = نیرو × بازو</span>
                  </div>
                </>
              ) : (
                <>
                  <svg viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} className="fl-phone-plot">
                    <line x1="20" y1={ARM_Y} x2={PIVOT_X} y2={ARM_Y} className="base" style={{ strokeWidth: 8, strokeLinecap: 'round' }} />
                    <circle cx={PIVOT_X} cy={ARM_Y} r="9" className="moved" style={{ fill: 'currentColor', opacity: 0.35 }} />
                    <motion.g
                      initial={{ x: 0 }}
                      animate={{ x: -110 }}
                      transition={{ duration: reduce ? 0 : 1.4, delay: 0.4, ease: EASE, repeat: reduce ? 0 : 1, repeatType: 'reverse', repeatDelay: 0.5 }}
                    >
                      <line x1={PIVOT_X - 40} y1={ARM_Y + 6} x2={PIVOT_X - 40} y2={ARM_Y + 40} className="moved" />
                      <rect x={PIVOT_X - 54} y={ARM_Y + 40} width="28" height="20" rx="4" className="moved" style={{ fill: 'currentColor', opacity: 0.6 }} />
                    </motion.g>
                  </svg>
                  <p>
                    هرچه وزنه از آرنج دورتر شود، بازوی گشتاور <M tex="d" /> بلندتر و گشتاور بیشتر می‌شود؛ عضله باید نیروی بیشتری بسازد.
                  </p>
                </>
              )}
              <div className="fl-phone-actions">
                <motion.span
                  className={`fl-pbtn ghost${stage === 1 ? ' press' : ''}`}
                  animate={stage === 1 ? { scale: [1, 0.92, 1] } : { scale: 1 }}
                  transition={{ duration: 0.35 }}
                >
                  جور دیگه بگو
                </motion.span>
                <motion.span className={`fl-pbtn${stage === 3 ? ' press' : ''}`} animate={stage === 3 ? { scale: [1, 0.92, 1] } : { scale: 1 }} transition={{ duration: 0.35 }}>
                  فهمیدم!
                </motion.span>
              </div>
            </motion.div>
          ) : (
            <motion.div key="check" className="fl-phone-body" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.35 }}>
              <span className="fl-kind check">
                <Icon name="target" size={14} /> یک سؤال کوتاه
              </span>
              <b className="fl-phone-title">
                اگر وزنه دو برابر دورتر از آرنج باشد، گشتاورش …
              </b>
              <div className="fl-phone-opts">
                {['نصف می‌شود', 'دو برابر می‌شود', 'چهار برابر می‌شود'].map((o, k) => (
                  <motion.div key={o} className={`fl-popt${stage === 5 && k === 1 ? ' right' : ''}`} animate={stage === 5 && k === 1 ? { scale: [1, 1.04, 1] } : { scale: 1 }}>
                    {o}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {stage === 5 && (
            <motion.div className="fl-phone-fb" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
              <div className="fl-phone-fb-head">
                <Icon name="checkf" size={18} /> آفرین، فهمیدی!
                <bdi className="fl-xp" dir="ltr">
                  +۲۰
                </bdi>
              </div>
              <p>این مفهوم با توضیح «تصویری» برایت جا افتاد؛ دفعهٔ بعد زودتر نشانت می‌دهم.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ───────────────────────── hero ───────────────────────── */

function Hero({ onStart, onLogin, signedIn, returning }: { onStart: () => void; onLogin: () => void; signedIn: boolean; returning: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const yPhone = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -70]);
  const yCopy = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 40]);
  const mxRaw = useMotionValue(0);
  const myRaw = useMotionValue(0);
  const mx = useSpring(mxRaw, { stiffness: 50, damping: 18 });
  const my = useSpring(myRaw, { stiffness: 50, damping: 18 });
  const up = (delay: number) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, ease: EASE, delay } });

  return (
    <section
      className="fl-hero"
      ref={ref}
      aria-labelledby="fl-hero-title"
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        mxRaw.set((e.clientX - r.left) / r.width - 0.5);
        myRaw.set((e.clientY - r.top) / r.height - 0.5);
      }}
    >
      <HeroBackdrop mx={mx} my={my} />
      <div className="fl-wrap fl-hero-grid">
        <motion.div className="fl-hero-copy" style={{ y: yCopy }}>
          <motion.span className="fl-hero-tag" {...up(0)}>
            <i aria-hidden="true" />
            فیزیوتراپی و علوم توان‌بخشی · بیومکانیک دستگاه اسکلتی‌ـ‌عضلانی
          </motion.span>
          <motion.h1 id="fl-hero-title" {...up(0.08)}>
            بیومکانیک را <span className="fl-shine">آن‌قدر جور دیگر</span> توضیح می‌دهد <span className="fl-keep">تا بفهمی</span>
          </motion.h1>
          <motion.p className="fl-hero-sub" {...up(0.16)}>
            از گشتاور و تنش تا استخوان، غضروف، لیگامان، عصب و عضله؛ هر مفهوم اول با یک مثال بالینی ساده، و اگر نفهمیدی، با شکل، قدم‌به‌قدم یا یک تشبیه دوباره.
            بعد با تمرین، فلش‌کارت و آزمون چهارگزینه‌ای تثبیتش می‌کند.
          </motion.p>
          <motion.div className="fl-cta" {...up(0.24)}>
            <button type="button" className="fl-btn hot lg" onClick={onStart}>
              {signedIn || returning ? 'ادامهٔ یادگیری' : 'شروع یادگیری'} <Icon name="next" size={20} />
            </button>
            {!signedIn && (
              <button type="button" className="fl-btn glass lg" onClick={onLogin}>
                <span className="fl-g">
                  <GoogleG />
                </span>
                ورود با حساب گوگل
              </button>
            )}
          </motion.div>
          <motion.ul className="fl-facts" {...up(0.32)}>
            <li>
              <Icon name="bulb" size={17} />
              <span>هر مفهوم با پنج جور توضیح</span>
            </li>
            <li>
              <Icon name="dumbbell" size={17} />
              <span>تمرین، فلش‌کارت و آزمون چهارگزینه‌ای</span>
            </li>
            <li>
              <Icon name="book" size={17} />
              <span>به ترتیب فصل‌های کتاب نوردین و فرانکل</span>
            </li>
          </motion.ul>
          <motion.p className="fl-hero-weekly" {...up(0.38)}>
            <Icon name="sparkles" size={15} /> فصل‌های مفصل‌ها و راه رفتن در راه است.
          </motion.p>
        </motion.div>

        <div className="fl-hero-visual">
          <motion.div className="fl-phone-wrap" style={{ y: yPhone }} initial={{ opacity: 0, y: 40, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}>
            <div className="fl-phone-halo" aria-hidden="true" />
            <div className="fl-orbit" aria-hidden="true">
              <span />
              <span />
            </div>
            <motion.div className="fl-hero-mascot" initial={{ opacity: 0, scale: 0.6, x: 30 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ delay: 0.7, type: 'spring', stiffness: 140, damping: 13 }} aria-hidden="true">
              <Mascot mood="wink" size={118} />
            </motion.div>
            <PhoneDemo />
            <motion.div className="fl-float a" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1, duration: 0.5, ease: EASE }} aria-hidden="true">
              <span className="fl-float-ico flame">
                <Icon name="flame" size={18} />
              </span>
              <span>
                <b>زنجیرهٔ ۱۲ روزه</b>
                <small>هدف امروز کامل شد</small>
              </span>
            </motion.div>
            <motion.div className="fl-float b" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.2, duration: 0.5, ease: EASE }} aria-hidden="true">
              <span className="fl-float-ico ok">
                <Icon name="brain" size={18} />
              </span>
              <span>
                <b>سبک یادگیری تو</b>
                <small>توضیح تصویری بهتر جواب می‌دهد</small>
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>
      <a
        href="#method"
        className="fl-scroll-cue"
        onClick={(e) => {
          e.preventDefault();
          scrollToId('method', reduce);
        }}
        aria-label="رفتن به بخش بعد"
      >
        <span />
      </a>
    </section>
  );
}

/* ───────────────────────── concept ticker ───────────────────────── */

function Ticker() {
  const items = ALL_CONCEPTS.map((c) => c.title);
  const row = (
    <div className="fl-ticker-row">
      {items.map((t, k) => (
        <span key={k}>
          <i aria-hidden="true">✦</i>
          <Rich text={t} />
        </span>
      ))}
    </div>
  );
  return (
    <div className="fl-ticker" aria-label="چند مفهوم از درس‌ها">
      <div className="fl-ticker-track">
        {row}
        <div aria-hidden="true">{row}</div>
      </div>
    </div>
  );
}

/* ───────────────────────── problem → answer ───────────────────────── */

function Problem() {
  const cards: { icon: IconName; tone: string; title: string; body: string }[] = [
    { icon: 'book', tone: 'a', title: 'یک توضیح برای همه', body: 'کتاب و کلاس هر مفهوم را معمولاً یک بار و به یک شکل می‌گویند، آن هم پر از اصطلاح انگلیسی. اگر آن شکل با ذهن تو جور نباشد، می‌مانی.' },
    { icon: 'brain', tone: 'b', title: 'حفظ‌کردن به‌جای فهمیدن', body: 'منحنی تنش‌ـ‌کرنش را حفظ می‌کنی، ولی وقتی بیمار واقعی جلویت است، معلوم نیست به کارت بیاید.' },
    { icon: 'clock', tone: 'c', title: 'وقت کم، حجم زیاد', body: 'کلاس، کارآموزی و امتحان‌ها وقت دوباره خواندن همه‌چیز را نمی‌گذارند؛ باید بدانی دقیقاً کجا ضعیفی.' },
  ];
  return (
    <section className="fl-sec" id="why" aria-labelledby="h-why">
      <div className="fl-wrap">
        <Head id="h-why" tag="چرا بیومانا" title={<>فهمیدن یک راه ندارد</>}>
          هر کس با یک جور توضیح راحت‌تر می‌فهمد. بیومانا همین را جدی گرفته است.
        </Head>
        <div className="fl-problems">
          {cards.map((c, k) => (
            <motion.article key={c.title} className={`fl-card fl-problem ${c.tone}`} {...rv(k * 0.08)} whileHover={{ y: -6 }}>
              <span className="fl-ico-tile">
                <Icon name={c.icon} size={22} />
              </span>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── the method: one concept, five ways ───────────────────────── */

const SHOWCASE = conceptById('b1.2')?.concept ?? ALL_CONCEPTS[0];

function Method() {
  const [k, setK] = useState(0);
  const a = SHOWCASE.approaches[k];
  const tabsId = useId();
  return (
    <section className="fl-sec fl-alt" id="method" aria-labelledby="h-method">
      <div className="fl-wrap">
        <Head id="h-method" tag="روش فهماندن" title={<>یک مفهوم، <span className="fl-u">چند جور توضیح</span></>}>
          این بخش واقعی از درس «{SHOWCASE.title}» است. هر بار که بگویی «جور دیگه بگو»، توضیح بعدی می‌آید؛ همان‌ها که اینجا می‌بینی.
        </Head>
        <motion.div className="fl-method" {...rv(0.05)}>
          <div className="fl-method-tabs" role="tablist" aria-label="نوع توضیح">
            {SHOWCASE.approaches.map((ap, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                id={`${tabsId}-t${i}`}
                aria-selected={i === k}
                aria-controls={`${tabsId}-p`}
                className={i === k ? 'on' : ''}
                onClick={() => setK(i)}
              >
                {i === k && <motion.span layoutId="fl-tab-pill" className="fl-tab-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                <span className="fl-tab-in">
                  <Icon name={KIND_META[ap.kind].icon} size={18} />
                  <span>
                    <b>{KIND_META[ap.kind].label}</b>
                    <small>{KIND_META[ap.kind].sub}</small>
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="fl-method-panel" role="tabpanel" id={`${tabsId}-p`} aria-labelledby={`${tabsId}-t${k}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={k} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: EASE }}>
                <div className="fl-panel-head">
                  <span className="fl-step">
                    توضیح {fmt(k + 1)} از {fmt(SHOWCASE.approaches.length)}
                  </span>
                  <h3>
                    <Blocks blocks={[{ t: 'p', text: a.title }]} />
                  </h3>
                </div>
                <div className="fl-panel-body">
                  <Blocks blocks={a.blocks} />
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="fl-panel-foot">
              <button type="button" className="fl-btn line sm" onClick={() => setK((k + 1) % SHOWCASE.approaches.length)}>
                <Icon name="refresh" size={17} /> جور دیگه بگو
              </button>
              <span className="fl-panel-note">
                <Icon name="sparkles" size={16} /> در برنامه، ترتیب توضیح‌ها با سبک یادگیری تو عوض می‌شود.
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────────────────── the loop diagram ───────────────────────── */

const LOOP: { icon: IconName; title: string; body: string }[] = [
  { icon: 'example', title: 'توضیح ساده', body: 'اول با یک مثال آشنا و بی‌فرمول.' },
  { icon: 'chat', title: 'کجایش گنگ بود؟', body: 'مثال کم بود؟ فرمول گیجت کرد؟ شکل را نفهمیدی؟' },
  { icon: 'refresh', title: 'یک راه دیگر', body: 'توضیح بعدی بر اساس جواب تو انتخاب می‌شود.' },
  { icon: 'target', title: 'یک سؤال کوتاه', body: 'تا مطمئن شویم واقعاً فهمیدی، نه اینکه فقط حس کنی.' },
  { icon: 'check', title: 'فهمیدم!', body: 'خلاصهٔ طلایی، امتیاز و رفتن به مفهوم بعد.' },
];

function Loop() {
  return (
    <section className="fl-sec fl-dark" id="loop" aria-labelledby="h-loop">
      <div className="fl-dark-bg" aria-hidden="true">
        <div className="fl-aurora a" />
        <div className="fl-aurora c" />
        <div className="fl-grid" />
      </div>
      <div className="fl-wrap">
        <Head id="h-loop" tag="تا وقتی بگویی فهمیدم" title="چرخه‌ای که تو را جا نمی‌گذارد" light>
          اگر جواب سؤال غلط باشد، بیومانا ناامید نمی‌شود؛ یک توضیح تازه می‌آورد. اگر همهٔ راه‌ها تمام شد، معلم هوشمند و صفحهٔ کتاب کنارت هستند.
        </Head>
        <ol className="fl-loop">
          {LOOP.map((s, k) => (
            <motion.li key={s.title} className={`fl-loop-step${k === LOOP.length - 1 ? ' done' : ''}`} {...rv(k * 0.12)}>
              <span className="fl-loop-ico">
                <Icon name={s.icon} size={24} />
              </span>
              <b>{s.title}</b>
              <p>{s.body}</p>
              {k < LOOP.length - 1 && <span className="fl-loop-arrow" aria-hidden="true" />}
            </motion.li>
          ))}
        </ol>
        <motion.div className="fl-loop-back" {...rv(0.5)} aria-hidden="true">
          <svg viewBox="0 0 600 60" preserveAspectRatio="none">
            <path d="M560 6 C 560 54, 40 54, 40 6" />
          </svg>
          <span>نفهمیدی؟ برمی‌گردیم و جور دیگری می‌گوییم</span>
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────────────────── subjects ───────────────────────── */

/** The four parts of the book: what each covers and whether its lessons are ready. */
const PARTS: { id: string; title: string; icon: IconName; color: string; chapters: string[] }[] = [
  { id: 'bm1', title: 'مقدمه و مفاهیم پایه', icon: 'lever', color: 'phys', chapters: ['نیرو و گشتاور', 'نمودار جسم آزاد و تعادل', 'تنش و کرنش', 'ویسکوالاستیسیته', 'خستگی'] },
  { id: 'bm2', title: 'بیومکانیک بافت‌ها', icon: 'bone', color: 'bio', chapters: ['استخوان', 'غضروف مفصلی', 'تاندون و لیگامان', 'اعصاب محیطی', 'عضلهٔ اسکلتی'] },
  { id: 'bm3', title: 'بیومکانیک مفصل‌ها', icon: 'joint', color: 'math', chapters: ['زانو', 'ران', 'مچ و کف پا', 'ستون فقرات کمری و گردنی', 'شانه', 'آرنج', 'مچ و دست'] },
  { id: 'bm4', title: 'بیومکانیک کاربردی', icon: 'muscle', color: 'chem', chapters: ['تثبیت شکستگی', 'آرتروپلاستی', 'راه رفتن'] },
];

function Subjects({ onStart }: { onStart: () => void }) {
  return (
    <section className="fl-sec fl-alt" id="subjects" aria-labelledby="h-subjects">
      <div className="fl-wrap">
        <Head id="h-subjects" tag="فصل‌ها" title={<>کل کتاب، <span className="fl-keep">فصل به فصل</span></>}>
          درس‌ها به ترتیب فصل‌های «بیومکانیک پایهٔ دستگاه اسکلتی‌ـ‌عضلانی» (نوردین و فرانکل) جلو می‌روند. متن‌ها برای بیومانا نوشته شده‌اند و جای کتاب را نمی‌گیرند.
        </Head>
        <div className="fl-subjects">
          {PARTS.map((part, k) => {
            const ready = BOOKS.find((b) => b.id === part.id)?.available;
            return (
              <motion.article key={part.id} className={`fl-subject c-${part.color}`} {...rv(k * 0.08)} whileHover={{ y: -8 }}>
                <div className="fl-subject-top">
                  <span className="fl-subject-ico">
                    <Icon name={part.icon} size={30} />
                  </span>
                  <div>
                    <h3>{part.title}</h3>
                    <span>{ready ? 'آماده' : 'به‌زودی'}</span>
                  </div>
                </div>
                <ul className="fl-chips">
                  {part.chapters.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <div className="fl-subject-foot">
                  <span>
                    <Icon name="bulb" size={15} /> درس تعاملی
                  </span>
                  <span>
                    <Icon name="dumbbell" size={15} /> تمرین
                  </span>
                  <span>
                    <Icon name="cards" size={15} /> فلش‌کارت
                  </span>
                  <span>
                    <Icon name="trophy" size={15} /> آزمون
                  </span>
                </div>
              </motion.article>
            );
          })}
        </div>
        <div className="center" style={{ marginTop: 24 }}>
          <button type="button" className="fl-btn ink sm" onClick={onStart}>
            همین حالا شروع کن <Icon name="next" size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── features bento ───────────────────────── */

function FlipCard() {
  const [flip, setFlip] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setFlip((f) => !f), 2600);
    return () => clearInterval(t);
  }, [reduce]);
  return (
    <div className="fl-flip" aria-hidden="true">
      <motion.div className="fl-flip-in" animate={{ rotateY: flip ? 180 : 0 }} transition={{ duration: 0.7, ease: EASE }}>
        <div className="fl-flip-face">
          <small>کارت ۷ از ۱۴</small>
          <b>
            قرینهٔ نمودار <M tex="f" /> نسبت به محور <M tex="x" />؟
          </b>
        </div>
        <div className="fl-flip-face back">
          <small>جواب</small>
          <b>
            <M tex="y=-f(x)" />
          </b>
        </div>
      </motion.div>
      <div className="fl-boxes">
        {[1, 2, 4, 8, 16].map((d, i) => (
          <span key={d} style={{ '--h': `${[70, 46, 30, 18, 10][i]}%` } as CSSProperties}>
            <i />
            <small>{fmt(d)} روز</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function ScoreRing() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true });
  const value = 0.78;
  return (
    <div className="fl-score" ref={ref} aria-hidden="true">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" className="track" />
        <motion.circle
          cx="60"
          cy="60"
          r="50"
          className="val"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: seen ? value : 0 }}
          transition={{ duration: 1.6, ease: EASE, delay: 0.2 }}
        />
      </svg>
      <div className="fl-score-in">
        <b>{seen ? <CountUp to={78} /> : '۰'}٪</b>
        <small>نمرهٔ آزمون</small>
      </div>
    </div>
  );
}

function Heat() {
  const cells = useMemo(() => Array.from({ length: 35 }, (_, i) => (Math.sin(i * 1.7) + Math.cos(i * 0.6) + 2) / 4), []);
  return (
    <div className="fl-heat" aria-hidden="true">
      {cells.map((v, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, scale: 0.4 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.018, duration: 0.3 }}
          style={{ '--v': v > 0.75 ? 1 : v > 0.5 ? 0.7 : v > 0.3 ? 0.4 : 0.12 } as CSSProperties}
        />
      ))}
    </div>
  );
}

function Styles() {
  const rows: [ApproachKind, number][] = [
    ['visual', 0.86],
    ['example', 0.72],
    ['analogy', 0.55],
    ['steps', 0.4],
  ];
  return (
    <div className="fl-styles" aria-hidden="true">
      {rows.map(([k, v], i) => (
        <div key={k}>
          <span>
            <Icon name={KIND_META[k].icon} size={15} /> {KIND_META[k].label}
          </span>
          <i>
            <motion.b initial={{ width: 0 }} whileInView={{ width: `${v * 100}%` }} viewport={{ once: true }} transition={{ duration: 1.1, delay: 0.15 + i * 0.12, ease: EASE }} />
          </i>
        </div>
      ))}
    </div>
  );
}

function Chat() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: '0px 0px -60px 0px' });
  const lines: [ReactNode, 'me' | 'ai'][] = [
    [
      <>
        چرا <M tex="f(x-2)" /> می‌رود راست؟ منطقی نیست!
      </>,
      'me',
    ],
    [
      <>
        حق داری عجیب به نظر برسد 🙂 بیا با یک جدول ببینیم: برای اینکه داخل پرانتز صفر شود، <M tex="x" /> باید <M tex="2" /> باشد…
      </>,
      'ai',
    ],
  ];
  return (
    <div className="fl-chat" ref={ref} aria-hidden="true">
      {lines.map(([t, who], i) => (
        <motion.div key={i} className={`fl-bubble ${who}`} initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={seen ? { opacity: 1, y: 0, scale: 1 } : {}} transition={{ delay: 0.3 + i * 0.9, duration: 0.4 }}>
          {t}
        </motion.div>
      ))}
      <motion.div className="fl-typing" initial={{ opacity: 0 }} animate={seen ? { opacity: [0, 1, 1, 0] } : {}} transition={{ delay: 2.3, duration: 2.4, repeat: Infinity, repeatDelay: 1 }}>
        <i />
        <i />
        <i />
      </motion.div>
    </div>
  );
}

function Hearts() {
  return (
    <div className="fl-hearts" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span key={i} initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.1 + i * 0.08 }}>
          <Icon name="heart" size={26} />
        </motion.span>
      ))}
      <small>هر اشتباه یک جان؛ جان‌ها کم‌کم پر می‌شوند</small>
    </div>
  );
}

function Features() {
  return (
    <section className="fl-sec" id="features" aria-labelledby="h-features">
      <div className="fl-wrap">
        <Head id="h-features" tag="امکانات" title="هر چیزی که برای فهمیدن و نگه‌داشتن لازم است">
          فهمیدن شروع کار است. تمرین، مرور فاصله‌دار و آزمون، آن را تا روز امتحان و کار بالینی در ذهنت نگه می‌دارند.
        </Head>
        <div className="fl-bento">
          <motion.article className="fl-tile wide t-violet" {...rv(0)}>
            <div className="fl-tile-copy">
              <span className="fl-tile-ico">
                <Icon name="dumbbell" size={22} />
              </span>
              <h3>تمرین تطبیقی</h3>
              <p>۷ نوع سؤال: چندگزینه‌ای، درست/نادرست، عددی، ترتیب، جفت‌کردن، جای خالی و انتخاب نمودار. سؤال بعدی از مفهومی می‌آید که ضعیف‌تری.</p>
            </div>
            <Hearts />
          </motion.article>
          <motion.article className="fl-tile t-amber" {...rv(0.06)}>
            <div className="fl-tile-copy">
              <span className="fl-tile-ico">
                <Icon name="cards" size={22} />
              </span>
              <h3>فلش‌کارت لایتنر</h3>
              <p>هر کارتی که بلدی دیرتر برمی‌گردد و هر کارتی که یادت رفته زودتر.</p>
            </div>
            <FlipCard />
          </motion.article>
          <motion.article className="fl-tile t-rose" {...rv(0.12)}>
            <div className="fl-tile-copy">
              <span className="fl-tile-ico">
                <Icon name="trophy" size={22} />
              </span>
              <h3>آزمون زمان‌دار</h3>
              <p>مثل امتحان دانشکده: زمان‌دار، با پاسخ تشریحی برای هر سؤال.</p>
            </div>
            <ScoreRing />
          </motion.article>
          <motion.article className="fl-tile wide t-sky" {...rv(0)}>
            <div className="fl-tile-copy">
              <span className="fl-tile-ico">
                <Icon name="chat" size={22} />
              </span>
              <h3>بیو، معلم هوشمند</h3>
              <p>هر جا گیر کردی از بیو بپرس، یا مفهوم را برایش توضیح بده تا ببینی واقعاً فهمیده‌ای. با زبان ساده و فارسی روان جواب می‌دهد.</p>
            </div>
            <Chat />
          </motion.article>
          <motion.article className="fl-tile t-green" {...rv(0.06)}>
            <div className="fl-tile-copy">
              <span className="fl-tile-ico">
                <Icon name="calendar" size={22} />
              </span>
              <h3>پیشرفت و زنجیره</h3>
              <p>تقویم مطالعه، هدف روزانه، امتیاز، سطح و ۱۳ نشان.</p>
            </div>
            <Heat />
          </motion.article>
          <motion.article className="fl-tile t-violet2" {...rv(0.12)}>
            <div className="fl-tile-copy">
              <span className="fl-tile-ico">
                <Icon name="brain" size={22} />
              </span>
              <h3>سبک یادگیری تو</h3>
              <p>بیومانا ثبت می‌کند با کدام نوع توضیح زودتر می‌فهمی.</p>
            </div>
            <Styles />
          </motion.article>
          <motion.article className="fl-tile t-ink" {...rv(0.18)}>
            <div className="fl-tile-copy">
              <span className="fl-tile-ico">
                <Icon name="flag" size={22} />
              </span>
              <h3>دفتر اشتباه‌ها</h3>
              <p>هر سؤالی که غلط زدی، با توضیحش اینجا می‌ماند تا دوباره درستش کنی.</p>
            </div>
          </motion.article>
          <motion.article className="fl-tile t-ink" {...rv(0.24)}>
            <div className="fl-tile-copy">
              <span className="fl-tile-ico">
                <Icon name="shield" size={22} />
              </span>
              <h3>روی گوشی، حتی بدون اینترنت</h3>
              <p>{isApp ? 'همهٔ درس‌ها داخل همین برنامه است و بدون اینترنت هم کار می‌کند.' : 'نصب لازم ندارد و بعد از یک بار باز شدن، بدون اینترنت هم کار می‌کند.'}</p>
            </div>
          </motion.article>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── numbers band ───────────────────────── */

function Numbers() {
  const items: [number, string][] = [
    [LESSONS.length, 'درس آماده'],
    [ALL_CONCEPTS.length, 'مفهوم'],
    [LESSONS.reduce((a, l) => a + l.cards.length, 0), 'فلش‌کارت'],
    [5, 'جور توضیح برای هر مفهوم'],
    [7, 'نوع سؤال تمرینی'],
  ];
  return (
    <section className="fl-numbers" aria-label="بیومانا در یک نگاه">
      <div className="fl-wrap fl-numbers-in">
        {items.map(([n, l], k) => (
          <motion.div key={l} {...rv(k * 0.06)}>
            <b>
              <CountUp to={n} />
            </b>
            <span>{l}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── FAQ ───────────────────────── */

const FAQ: [string, string][] = [
  ['بیومانا چیست؟', 'یک برنامهٔ یادگیری برای دانشجویان فیزیوتراپی و علوم توان‌بخشی که بیومکانیک دستگاه اسکلتی‌ـ‌عضلانی را مفهوم به مفهوم یاد می‌دهد. هر مفهوم با چند نوع توضیح (مثال بالینی، شکل، قدم‌به‌قدم، تشبیه و نسخهٔ دقیق) می‌آید و بعد با تمرین، فلش‌کارت و آزمون تثبیت می‌شود.'],
  ['از روی کدام کتاب است؟', 'ترتیب فصل‌ها از «بیومکانیک پایهٔ دستگاه اسکلتی‌ـ‌عضلانی» نوشتهٔ نوردین و فرانکل گرفته شده است. متن‌ها، مثال‌ها و سؤال‌ها برای بیومانا نوشته شده‌اند؛ برای جزئیات و شکل‌های کامل، کتاب را کنار دستت داشته باش.'],
  ['کدام فصل‌ها آماده است؟', 'مقدمه و مفاهیم پایه (حرکت، نیرو و گشتاور، رفتار مواد) و بیومکانیک بافت‌ها (استخوان، غضروف، تاندون و لیگامان، عصب، عضله). مفصل‌ها و بیومکانیک کاربردی در راه است.'],
  ['حتماً باید وارد حساب شوم؟', 'نه. بدون حساب شروع کن؛ همه‌چیز روی همین دستگاه ذخیره می‌شود و از پروفایل می‌توانی نسخهٔ پشتیبان بگیری.'],
  ['استاد هوشمند چطور کار می‌کند؟', 'بیو با هوش مصنوعی Claude جواب می‌دهد: سؤال آزاد، توضیح دوباره به زبان ساده، یا گوش دادن به توضیح تو و نمره دادن به آن. حتی وقتی در دسترس نباشد، همهٔ توضیح‌ها و تمرین‌ها کار می‌کنند.'],
  ['جای کلاس و استاد را می‌گیرد؟', 'نه؛ کنارشان است. جایی که در کلاس جا ماندی یا قبل از امتحان، اینجا با سرعت خودت دوباره می‌خوانی. بیومانا توصیهٔ درمانی نمی‌دهد.'],
  ['روی گوشی کار می‌کند؟', isApp ? 'بله. برای گوشی طراحی شده و همین برنامه همهٔ درس‌ها را دارد.' : 'بله. برای گوشی طراحی شده است. در مرورگر بازش کن و اگر خواستی با «افزودن به صفحهٔ اصلی» مثل یک برنامه داشته باش.'],
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <section className="fl-sec fl-alt" id="faq" aria-labelledby="h-faq">
      <div className="fl-wrap fl-faq-grid">
        <div className="fl-faq-side">
          <Head id="h-faq" tag="پرسش‌های رایج" title="پیش از شروع">
            جواب سؤال‌هایی که بیشتر از همه می‌پرسند.
          </Head>
          <motion.div className="fl-faq-mascot" {...rv(0.1)} aria-hidden="true">
            <Mascot mood="think" size={110} />
          </motion.div>
        </div>
        <motion.div className="fl-faq" {...rv(0.05)}>
          {FAQ.map(([q, a], k) => {
            const isOpen = open === k;
            return (
              <div key={q} className={`fl-faq-item${isOpen ? ' open' : ''}`}>
                <h3>
                  <button type="button" id={`${base}-q${k}`} aria-expanded={isOpen} aria-controls={`${base}-a${k}`} onClick={() => setOpen(isOpen ? null : k)}>
                    <span>{q}</span>
                    <motion.span className="fl-faq-chev" animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.25 }}>
                      <Icon name="plus" size={20} />
                    </motion.span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`${base}-a${k}`}
                      role="region"
                      aria-labelledby={`${base}-q${k}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      style={{ overflow: 'hidden' }}
                    >
                      <p>{a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────────────────── page ───────────────────────── */

export function Landing() {
  const reduce = useReducedMotion();
  const s = useAppState();
  const { account } = useAccount();
  const [solid, setSolid] = useState(false);
  const [menu, setMenu] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });

  useEffect(() => {
    const prev = document.title;
    document.title = 'بیومانا | درس را آن‌قدر توضیح می‌دهد تا بفهمی';
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('scroll', on);
      document.title = prev;
    };
  }, []);

  const inApp = s.profile.onboarded;
  const onStart = () => go(inApp ? { name: 'home' } : account ? { name: 'start' } : { name: 'login' });
  const onLogin = () => go({ name: 'login' });
  const nav = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu(false);
    scrollToId(id, reduce);
  };

  return (
    <div className="fl">
      <motion.div className="fl-progress" style={{ scaleX: progress }} aria-hidden="true" />
      <header className={`fl-hdr${solid ? ' solid' : ''}${menu ? ' open' : ''}`}>
        <div className="fl-wrap fl-hdr-in">
          <a
            href="#/welcome"
            className="fl-logo"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
            }}
            aria-label="بیومانا، بازگشت به بالای صفحه"
          >
            <BrandMark size={36} />
            <span>بیومانا</span>
          </a>
          <nav className="fl-nav" aria-label="بخش‌های صفحه">
            {NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={nav(id)}>
                {label}
              </a>
            ))}
          </nav>
          <div className="fl-hdr-actions">
            {!account && (
              <button type="button" className="fl-btn line sm fl-hide-sm" onClick={onLogin}>
                ورود
              </button>
            )}
            <button type="button" className="fl-btn hot sm" onClick={onStart}>
              {inApp || account ? 'ادامهٔ یادگیری' : 'شروع یادگیری'}
            </button>
            <button type="button" className="fl-menu-btn" aria-label="منو" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <Icon name={menu ? 'x' : 'menu'} size={22} />
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menu && (
            <motion.nav className="fl-mnav" aria-label="بخش‌های صفحه" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {NAV.map(([id, label]) => (
                <a key={id} href={`#${id}`} onClick={nav(id)}>
                  {label}
                </a>
              ))}
              {!account && (
                <button type="button" className="fl-btn line" onClick={onLogin}>
                  <span className="fl-g">
                    <GoogleG />
                  </span>
                  ورود با حساب گوگل
                </button>
              )}
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main>
        <Hero onStart={onStart} onLogin={onLogin} signedIn={Boolean(account)} returning={inApp} />
        <Ticker />
        <Problem />
        <Method />
        <Loop />
        <Numbers />
        <Subjects onStart={onStart} />
        <Features />
        <Faq />

        <section className="fl-final" aria-labelledby="h-final">
          <div className="fl-dark-bg" aria-hidden="true">
            <div className="fl-aurora a" />
            <div className="fl-aurora b" />
            <div className="fl-grid" />
          </div>
          <div className="fl-wrap fl-final-in">
            <motion.div className="fl-final-mascot" {...rv()} aria-hidden="true">
              <Mascot mood="cheer" size={170} />
            </motion.div>
            <motion.div className="fl-final-copy" {...rv(0.08)}>
              <h2 id="h-final">اولین مفهوم را همین حالا بفهم</h2>
              <p>کمتر از ده دقیقه وقت می‌گیرد؛ روی همین گوشی{isApp ? '' : ' و بدون نصب'}.</p>
              <div className="fl-cta">
                <button type="button" className="fl-btn hot lg" onClick={onStart}>
                  {inApp || account ? 'ادامهٔ یادگیری' : 'شروع یادگیری'} <Icon name="next" size={20} />
                </button>
                {!account && (
                  <button type="button" className="fl-btn glass lg" onClick={onLogin}>
                    <span className="fl-g">
                      <GoogleG />
                    </span>
                    ورود با حساب گوگل
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        <Family />
      </main>

      <footer className="fl-footer">
        <div className="fl-wrap fl-footer-in">
          <div className="fl-footer-brand">
            <BrandMark size={34} />
            <div>
              <b>بیومانا</b>
              <span>درس را آن‌قدر توضیح می‌دهد تا بفهمی</span>
            </div>
          </div>
          <nav className="fl-footer-links" aria-label="پیوندها">
            <a href="#/privacy">حریم خصوصی</a>
            <a href="#/terms">شرایط استفاده</a>
            <a href="https://yadmana.com" target="_blank" rel="noopener">
              یادمانا
            </a>
            <a href="https://kavyad.com" target="_blank" rel="noopener">
              کاویاد
            </a>
          </nav>
          <p className="fl-copy">© ۱۴۰۵ بیومانا</p>
        </div>
      </footer>
    </div>
  );
}
