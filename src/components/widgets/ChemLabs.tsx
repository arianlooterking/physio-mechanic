import { useMemo, useState } from 'react';
import { M, Rich, TeX } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

/* ---------------- how soap cleans ---------------- */

interface Pose {
  x: number;
  y: number;
  r: number;
}

function rand(seed: number) {
  const s = Math.sin(seed * 9301 + 49297) * 233280;
  return s - Math.floor(s);
}

/** Rotation (degrees) that turns the tail (local +y) to point along (dx, dy). */
function tailAngle(dx: number, dy: number) {
  return (Math.atan2(dy, dx) * 180) / Math.PI - 90;
}

function Molecule({ pose }: { pose: Pose }) {
  return (
    <g style={{ transform: `translate(${pose.x}px, ${pose.y}px) rotate(${pose.r}deg)`, transition: 'transform 0.9s cubic-bezier(0.4, 1.2, 0.5, 1)' }}>
      <path d="M0 6 l4 4 -8 4 8 4 -8 4 8 4 -4 4" fill="none" stroke="var(--ink-2)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle r="6.5" fill="var(--bad)" />
      <path d="M-3 0h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
}

export function SoapLab() {
  const [step, setStep] = useState<'1' | '2' | '3'>('1');
  const N = 14;
  const blob = step === '3' ? { x: 180, y: 108, rx: 26, ry: 22 } : { x: 180, y: 182, rx: 52, ry: 20 };

  const poses: Pose[] = useMemo(() => {
    return Array.from({ length: N }, (_, i) => {
      if (step === '1') {
        const x = 30 + rand(i + 1) * 300;
        const y = 30 + rand(i + 50) * 120;
        return { x, y, r: rand(i + 99) * 360 };
      }
      if (step === '2') {
        // upper half of the stain only: tails dig into the grease
        const a = Math.PI + (Math.PI * (i + 0.5)) / N;
        const ex = blob.x + Math.cos(a) * (blob.rx + 30);
        const ey = blob.y + Math.sin(a) * (blob.ry + 30);
        return { x: ex, y: ey, r: tailAngle(blob.x - ex, blob.y - ey) };
      }
      const a = (2 * Math.PI * i) / N;
      const ex = blob.x + Math.cos(a) * (blob.rx + 30);
      const ey = blob.y + Math.sin(a) * (blob.ry + 30);
      return { x: ex, y: ey, r: tailAngle(blob.x - ex, blob.y - ey) };
    });
  }, [step, blob.x, blob.y, blob.rx, blob.ry]);

  const text =
    step === '1'
      ? 'مولکول‌های صابون در آب پخش می‌شوند. **سرِ قطبی** (دایرهٔ قرمز) آب‌دوست است و با آب جاذبه دارد؛ **دمِ ناقطبی** (زنجیر زیگزاگی) چربی‌دوست است.'
      : step === '2'
        ? 'دم‌های ناقطبی در لکهٔ چربی فرو می‌روند (شبیه، شبیه را حل می‌کند) و سرهای قطبی بیرون، در آب می‌مانند. صابون مثل یک **پل** بین آب و چربی است.'
        : 'با هم زدن، ذره‌های چربی که دورشان را مولکول‌های صابون گرفته‌اند از پارچه جدا می‌شوند و در آب **پخش** می‌شوند. حالا با آب شسته می‌شوند.';

  return (
    <WidgetFrame title="صابون چطور لکهٔ چربی را پاک می‌کند؟" icon="eye">
      <Seg
        value={step}
        onChange={setStep}
        options={[
          { v: '1', label: '۱. صابون در آب' },
          { v: '2', label: '۲. چسبیدن به چربی' },
          { v: '3', label: '۳. جدا شدن لکه' },
        ]}
      />
      <svg viewBox="0 0 360 240" className="plot" role="img" aria-label="مراحل پاک شدن لکهٔ چربی با صابون">
        <rect x="0" y="0" width="360" height="205" fill="var(--info-soft)" />
        <text x="12" y="22" fontSize="12" fontWeight="800" fill="var(--info)">
          آب
        </text>
        <pattern id="soap-fabric" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="10" fill="#9c6b8f" />
          <rect width="4" height="10" fill="#b5859f" />
        </pattern>
        <rect x="0" y="202" width="360" height="38" fill="url(#soap-fabric)" />
        <text x="348" y="226" fontSize="12" fontWeight="800" fill="#fff" textAnchor="end">
          پارچه
        </text>
        <ellipse
          cx={blob.x}
          cy={blob.y}
          rx={blob.rx}
          ry={blob.ry}
          fill="#5e5a6e"
          style={{ transition: 'all 0.9s cubic-bezier(0.4, 1.2, 0.5, 1)' }}
        />
        <text x={blob.x} y={blob.y + 5} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" style={{ transition: 'all 0.9s' }}>
          چربی
        </text>
        {poses.map((p, i) => (
          <Molecule key={i} pose={p} />
        ))}
      </svg>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--bad)' }} />
          سر قطبی، آب‌دوست
        </span>
        <span>
          <i style={{ background: 'var(--ink-2)' }} />
          دم ناقطبی، چربی‌دوست
        </span>
      </div>
      <div className="widget-note">
        <Rich text={text} />
      </div>
    </WidgetFrame>
  );
}

/* ---------------- solution, colloid, suspension ---------------- */

export function MixturesLab() {
  const [laser, setLaser] = useState(false);
  const [time, setTime] = useState(0);
  const beakers = [
    { key: 'sol', title: 'محلول', sub: 'آب‌نمک', color: 'rgba(120,190,255,0.25)' },
    { key: 'col', title: 'کلوئید', sub: 'شیر رقیق', color: 'rgba(240,235,220,0.85)' },
    { key: 'sus', title: 'سوسپانسیون', sub: 'آب و گل', color: 'rgba(170,130,80,0.18)' },
  ];
  const dots = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: rand(i + 3) * 70, y: rand(i + 40) * 90 })), []);
  return (
    <WidgetFrame title="سه نوع مخلوط زیر نور" icon="eye">
      <svg viewBox="0 0 360 200" className="plot" role="img" aria-label="مقایسهٔ محلول، کلوئید و سوسپانسیون">
        {laser && <line x1="0" y1="92" x2="360" y2="92" stroke="#ff3b3b" strokeWidth="1.2" opacity="0.5" />}
        {beakers.map((b, i) => {
          const x0 = 20 + (2 - i) * 115; // first beaker on the right, like the page
          return (
            <g key={b.key}>
              <rect x={x0} y="40" width="90" height="110" rx="6" fill={b.color} stroke="var(--ink-3)" strokeWidth="2" />
              {b.key === 'sus' &&
                dots.map((d, j) => {
                  const fall = Math.min(1, time * (0.6 + rand(j + 7)));
                  const y = 48 + d.y + (140 - 48 - d.y) * fall;
                  return <circle key={j} cx={x0 + 10 + d.x} cy={y} r={2.6 + rand(j) * 1.6} fill="#8a5a2b" />;
                })}
              {b.key === 'col' &&
                dots.map((d, j) => <circle key={j} cx={x0 + 10 + d.x} cy={48 + d.y} r={1.3} fill="#c9bd9a" opacity="0.8" />)}
              {laser && b.key !== 'sol' && (
                <line x1={x0} y1="92" x2={x0 + 90} y2="92" stroke="#ff2d2d" strokeWidth={b.key === 'col' ? 6 : 4} opacity={b.key === 'col' ? 0.85 : 0.55} strokeLinecap="round" />
              )}
              <text x={x0 + 45} y="172" textAnchor="middle" fontSize="13" fontWeight="900" fill="var(--ink)">
                {b.title}
              </text>
              <text x={x0 + 45} y="190" textAnchor="middle" fontSize="11" fill="var(--ink-3)">
                {b.sub}
              </text>
            </g>
          );
        })}
        {laser && <rect x="0" y="86" width="10" height="12" rx="2" fill="var(--ink-2)" />}
      </svg>
      <div className="row wrap">
        <button className={`btn sm ${laser ? 'bad' : 'soft'}`} onClick={() => setLaser((v) => !v)}>
          {laser ? 'خاموش کردن نور لیزر' : 'تاباندن نور لیزر'}
        </button>
      </div>
      <Slider label="زمان" value={time} min={0} max={1} step={0.05} onChange={setTime} format={(v) => (v === 0 ? 'الان' : v < 1 ? 'کمی بعد' : 'خیلی بعد')} />
      <div className="widget-note">
        <Rich text="نور از **محلول** رد می‌شود و مسیرش دیده نمی‌شود (ذره‌ها در حد مولکول و یون‌اند). **کلوئید** و **سوسپانسیون** نور را پخش می‌کنند و مسیر نور دیده می‌شود. با گذشت زمان فقط **سوسپانسیون** ته‌نشین می‌شود؛ کلوئید پایدار است." />
      </div>
    </WidgetFrame>
  );
}

/* ---------------- soap in hard water ---------------- */

export function HardWaterLab() {
  const [water, setWater] = useState<'pure' | 'mg' | 'ca'>('pure');
  const [cleaner, setCleaner] = useState<'soap' | 'det'>('soap');
  const hard = water !== 'pure';
  const foam = cleaner === 'det' ? 1 : hard ? 0.25 : 1;
  const precip = cleaner === 'soap' && hard;
  const bubbles = useMemo(() => Array.from({ length: 34 }, (_, i) => ({ x: rand(i + 5) * 120, y: rand(i + 77), r: 5 + rand(i + 13) * 7 })), []);
  const eq =
    water === 'mg'
      ? '\\ce{2RCOONa(aq) + MgCl2(aq) -> (RCOO)2Mg(s) + 2NaCl(aq)}'
      : '\\ce{2RCOONa(aq) + CaCl2(aq) -> (RCOO)2Ca(s) + 2NaCl(aq)}';
  return (
    <WidgetFrame title="کف صابون در آب‌های مختلف" icon="flask">
      <Seg
        value={water}
        onChange={setWater}
        options={[
          { v: 'pure', label: 'آب مقطر' },
          { v: 'mg', label: <M tex="\ce{+ MgCl2}" /> },
          { v: 'ca', label: <M tex="\ce{+ CaCl2}" /> },
        ]}
      />
      <Seg
        value={cleaner}
        onChange={setCleaner}
        options={[
          { v: 'soap', label: 'صابون' },
          { v: 'det', label: 'پاک‌کنندهٔ غیرصابونی' },
        ]}
      />
      <svg viewBox="0 0 360 210" className="plot" role="img" aria-label="ارتفاع کف">
        <rect x="110" y="30" width="140" height="160" rx="10" fill="rgba(120,190,255,0.2)" stroke="var(--ink-3)" strokeWidth="2.5" />
        <rect x="112" y="110" width="136" height="78" rx="8" fill="rgba(80,160,255,0.28)" />
        {bubbles
          .filter((b) => b.y < foam)
          .map((b, i) => (
            <circle
              key={i}
              cx={120 + b.x}
              cy={108 - b.y * 74}
              r={b.r}
              fill="rgba(255,255,255,0.95)"
              stroke="rgba(140,170,220,0.7)"
              strokeWidth="1"
              style={{ transition: 'all 0.5s' }}
            />
          ))}
        {precip &&
          bubbles.slice(0, 22).map((b, i) => <rect key={`p${i}`} x={120 + b.x} y={176 - b.y * 10} width="4" height="3" fill="#f5f5f5" stroke="#aaa" strokeWidth="0.5" />)}
        <text x="270" y={108 - foam * 74} fontSize="12" fontWeight="800" fill="var(--ink-2)">
          {foam > 0.5 ? 'کف زیاد' : 'کف کم'}
        </text>
        {precip && (
          <text x="270" y="182" fontSize="12" fontWeight="800" fill="var(--bad)">
            رسوب
          </text>
        )}
      </svg>
      {precip && (
        <div className="widget-formula">
          <M tex={eq} />
        </div>
      )}
      <div className="widget-note">
        <Rich
          text={
            precip
              ? 'یون‌های کلسیم یا منیزیم آب سخت با صابون **رسوب** می‌دهند؛ صابون مصرف می‌شود، کف کم می‌شود و قدرت پاک‌کنندگی پایین می‌آید.'
              : cleaner === 'det'
                ? 'پاک‌کنندهٔ غیرصابونی با یون‌های آب سخت رسوب نمی‌دهد، پس در هر آبی کف می‌کند و خاصیت پاک‌کنندگی‌اش را نگه می‌دارد.'
                : 'در آب مقطر یونی برای رسوب دادن نیست؛ صابون به‌خوبی کف می‌کند.'
          }
        />
      </div>
    </WidgetFrame>
  );
}

/* ---------------- strong vs weak acid ---------------- */

export function IonLab() {
  const [acid, setAcid] = useState<'HCl' | 'HF'>('HCl');
  const strong = acid === 'HCl';
  const total = 12;
  const ionized = strong ? 12 : 1;
  const pos = useMemo(() => Array.from({ length: total }, (_, i) => ({ x: 20 + rand(i + 21) * 190, y: 20 + rand(i + 61) * 110 })), []);
  return (
    <WidgetFrame title="اسید قوی و اسید ضعیف از نزدیک" icon="eye">
      <Seg
        value={acid}
        onChange={setAcid}
        options={[
          { v: 'HCl', label: <M tex="\ce{HCl(aq)}" /> },
          { v: 'HF', label: <M tex="\ce{HF(aq)}" /> },
        ]}
      />
      <svg viewBox="0 0 360 180" className="plot" role="img" aria-label={`ذره‌های ${acid} در آب`}>
        <rect x="10" y="10" width="230" height="150" rx="14" fill="rgba(120,190,255,0.18)" stroke="var(--ink-3)" strokeWidth="2" />
        {pos.map((p, i) =>
          i < ionized ? (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="7" fill="var(--plot-main)" />
              <text x={p.x} y={p.y + 4} fontSize="9" textAnchor="middle" fill="#fff" fontWeight="900">
                +
              </text>
              <circle cx={p.x + 16} cy={p.y + 6} r="8" fill={strong ? 'var(--ok)' : 'var(--accent)'} />
              <text x={p.x + 16} y={p.y + 10} fontSize="10" textAnchor="middle" fill="#fff" fontWeight="900">
                −
              </text>
            </g>
          ) : (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="6" fill="var(--plot-main)" />
              <circle cx={p.x + 10} cy={p.y + 2} r="8" fill="var(--accent)" />
            </g>
          ),
        )}
        {/* bulb */}
        <g transform="translate(300 70)">
          <circle r={strong ? 36 : 22} fill="#ffd84d" opacity={strong ? 0.45 : 0.15} />
          <circle r="16" fill={strong ? '#ffd84d' : '#f4e9b8'} stroke="#c9a400" strokeWidth="2" />
          <rect x="-8" y="16" width="16" height="12" rx="3" fill="var(--ink-3)" />
          <text y="50" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--ink-2)">
            {strong ? 'روشن' : 'کم‌نور'}
          </text>
        </g>
      </svg>
      <div className="widget-formula">
        <M tex={strong ? '\\ce{HCl(aq) -> H+(aq) + Cl-(aq)}' : '\\ce{HF(aq) <=> H+(aq) + F-(aq)}'} />
      </div>
      <div className="widget-note">
        <Rich
          text={
            strong
              ? `هر ${total} مولکول یونیده شده‌اند: $\\alpha=\\dfrac{${total}}{${total}}=1$. یون‌های زیاد ⟵ رسانایی زیاد ⟵ **اسید قوی**.`
              : `از ${total} مولکول فقط ${ionized} تا یونیده شده: $\\alpha=\\dfrac{1}{${total}}<1$. بیشتر ذره‌ها مولکول یونیده‌نشده‌اند ⟵ یون کم ⟵ رسانایی کم ⟵ **اسید ضعیف**. (شکل نمادین است؛ عدد واقعی به غلظت و دما بستگی دارد.)`
          }
        />
      </div>
    </WidgetFrame>
  );
}

/* ---------------- oxides in water ---------------- */

const OXIDES = [
  { f: 'SO3', eq: '\\ce{SO3(g) + H2O(l) -> H2SO4(aq)}', acid: true, name: 'گوگرد تری‌اکسید' },
  { f: 'N2O5', eq: '\\ce{N2O5 + H2O(l) -> 2HNO3(aq)}', acid: true, name: 'دی‌نیتروژن پنتااکسید' },
  { f: 'CO2', eq: '\\ce{CO2(g) + H2O(l) -> H2CO3(aq)}', acid: true, name: 'کربن دی‌اکسید' },
  { f: 'Li2O', eq: '\\ce{Li2O(s) + H2O(l) -> 2LiOH(aq)}', acid: false, name: 'لیتیم اکسید' },
  { f: 'Na2O', eq: '\\ce{Na2O(s) + H2O(l) -> 2NaOH(aq)}', acid: false, name: 'سدیم اکسید' },
  { f: 'CaO', eq: '\\ce{CaO(s) + H2O(l) -> Ca(OH)2(aq)}', acid: false, name: 'کلسیم اکسید' },
  { f: 'BaO', eq: '\\ce{BaO(s) + H2O(l) -> Ba(OH)2(aq)}', acid: false, name: 'باریم اکسید' },
] as const;

export function OxideLab() {
  const [i, setI] = useState(0);
  const o = OXIDES[i];
  return (
    <WidgetFrame title="اکسید + آب = ؟" icon="flask">
      <div className="seg">
        {OXIDES.map((ox, j) => (
          <button key={ox.f} aria-pressed={i === j} onClick={() => setI(j)}>
            <M tex={`\\ce{${ox.f}}`} />
          </button>
        ))}
      </div>
      <div className="widget-formula">
        <TeX tex={o.eq} />
      </div>
      <div className="row" style={{ justifyContent: 'center', gap: 16 }}>
        <div
          aria-hidden="true"
          style={{
            width: 34,
            height: 90,
            borderRadius: 6,
            background: `linear-gradient(to bottom, #f2c94c 0 45%, ${o.acid ? '#e5383b' : '#3a6fd8'} 45% 100%)`,
            border: '2px solid var(--line-2)',
          }}
        />
        <div>
          <b>{o.name}</b>
          <div className="small">
            {o.acid ? 'اکسید نافلز ⟵ در آب اسید می‌سازد ⟵ ' : 'اکسید فلز ⟵ در آب باز (هیدروکسید) می‌سازد ⟵ '}
            <span className={`chip ${o.acid ? 'bad' : 'primary'}`}>{o.acid ? 'اکسید اسیدی' : 'اکسید بازی'}</span>
          </div>
          <div className="small muted">رنگ کاغذ pH: {o.acid ? 'قرمز/نارنجی' : 'آبی'}</div>
        </div>
      </div>
      <div className="widget-note">
        <Rich text={o.acid ? 'محلول حاصل یون $\\ce{H+(aq)}$ دارد، پس طبق آرنیوس **اسیدی** است.' : 'محلول حاصل یون $\\ce{OH-(aq)}$ دارد، پس طبق آرنیوس **بازی** است.'} />
      </div>
    </WidgetFrame>
  );
}

/* ---------------- periodic trends ---------------- */

type Kind = 'metal' | 'semi' | 'non';
/** Periods 2–4, main groups 1, 2, 13–17; atomic radii in pm (textbook values). */
const TREND: { s: string; fa: string; z: number; r: number; k: Kind }[][] = [
  [
    { s: 'Li', fa: 'لیتیم', z: 3, r: 152, k: 'metal' },
    { s: 'Be', fa: 'بریلیم', z: 4, r: 112, k: 'metal' },
    { s: 'B', fa: 'بور', z: 5, r: 85, k: 'semi' },
    { s: 'C', fa: 'کربن', z: 6, r: 77, k: 'non' },
    { s: 'N', fa: 'نیتروژن', z: 7, r: 75, k: 'non' },
    { s: 'O', fa: 'اکسیژن', z: 8, r: 73, k: 'non' },
    { s: 'F', fa: 'فلوئور', z: 9, r: 72, k: 'non' },
  ],
  [
    { s: 'Na', fa: 'سدیم', z: 11, r: 186, k: 'metal' },
    { s: 'Mg', fa: 'منیزیم', z: 12, r: 160, k: 'metal' },
    { s: 'Al', fa: 'آلومینیم', z: 13, r: 143, k: 'metal' },
    { s: 'Si', fa: 'سیلیسیم', z: 14, r: 118, k: 'semi' },
    { s: 'P', fa: 'فسفر', z: 15, r: 110, k: 'non' },
    { s: 'S', fa: 'گوگرد', z: 16, r: 103, k: 'non' },
    { s: 'Cl', fa: 'کلر', z: 17, r: 99, k: 'non' },
  ],
  [
    { s: 'K', fa: 'پتاسیم', z: 19, r: 231, k: 'metal' },
    { s: 'Ca', fa: 'کلسیم', z: 20, r: 197, k: 'metal' },
    { s: 'Ga', fa: 'گالیم', z: 31, r: 135, k: 'metal' },
    { s: 'Ge', fa: 'ژرمانیم', z: 32, r: 122, k: 'semi' },
    { s: 'As', fa: 'آرسنیک', z: 33, r: 120, k: 'semi' },
    { s: 'Se', fa: 'سلنیم', z: 34, r: 117, k: 'non' },
    { s: 'Br', fa: 'برم', z: 35, r: 114, k: 'non' },
  ],
];
const KIND_FA: Record<Kind, string> = { metal: 'فلز', semi: 'شبه‌فلز', non: 'نافلز' };
const KIND_COLOR: Record<Kind, string> = { metal: 'var(--plot-base)', semi: 'var(--accent)', non: 'var(--plot-main)' };
const GROUPS = ['1', '2', '13', '14', '15', '16', '17'];

/** Atoms drawn to scale: radius grows down a group and shrinks across a period; tap one for its details. */
export function TrendsLab() {
  const [pick, setPick] = useState({ row: 1, col: 0 });
  const el = TREND[pick.row][pick.col];
  const cell = 46;
  const W = cell * 7 + 30;
  return (
    <WidgetFrame title="روندهای دوره‌ای" icon="flask">
      <svg viewBox={`0 0 ${W} ${cell * 3 + 40}`} className="plot" role="img" aria-label="بخشی از جدول دوره‌ای با اتم‌هایی به اندازهٔ شعاعشان">
        {GROUPS.map((g, c) => (
          <text key={g} x={22 + c * cell + cell / 2} y={14} textAnchor="middle" fontSize="10" fill="var(--ink-3)">
            {g}
          </text>
        ))}
        {TREND.map((row, ri) =>
          row.map((e, ci) => {
            const cx = 22 + ci * cell + cell / 2;
            const cy = 24 + ri * cell + cell / 2;
            const sel = ri === pick.row && ci === pick.col;
            return (
              <g key={e.s} onClick={() => setPick({ row: ri, col: ci })} style={{ cursor: 'pointer' }}>
                <rect x={cx - cell / 2 + 2} y={cy - cell / 2 + 2} width={cell - 4} height={cell - 4} rx="9" fill={sel ? 'var(--primary-soft)' : 'transparent'} stroke={sel ? 'var(--primary)' : 'var(--line)'} />
                <circle cx={cx} cy={cy} r={(e.r / 231) * 19} fill={KIND_COLOR[e.k]} opacity="0.85" />
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" direction="ltr">
                  {e.s}
                </text>
              </g>
            );
          }),
        )}
        {[2, 3, 4].map((pr, i) => (
          <text key={pr} x={8} y={24 + i * cell + cell / 2 + 4} fontSize="10" fill="var(--ink-3)">
            {pr}
          </text>
        ))}
      </svg>
      <div className="row wrap small" style={{ gap: 10, justifyContent: 'center' }}>
        {(Object.keys(KIND_FA) as Kind[]).map((k) => (
          <span key={k} className="row" style={{ gap: 4 }}>
            <i style={{ width: 12, height: 12, borderRadius: 6, background: KIND_COLOR[k], display: 'inline-block' }} /> {KIND_FA[k]}
          </span>
        ))}
      </div>
      <div className="widget-formula">
        <M tex={`{}_{${el.z}}\\mathrm{${el.s}}\\qquad r=${el.r}\\,\\mathrm{pm}`} />
      </div>
      <div className="widget-note">
        <Rich
          text={`**${el.fa}** (دورهٔ ${pick.row + 2}، گروه ${GROUPS[pick.col]}) یک **${KIND_FA[el.k]}** است. در هر گروه از بالا به پایین لایه‌های الکترونی بیشتر و اتم بزرگ‌تر می‌شود؛ پس خصلت فلزی زیاد و خصلت نافلزی کم می‌شود. در هر دوره از چپ به راست پروتون‌ها بیشتر می‌شوند، الکترون‌ها را بیشتر می‌کشند و اتم کوچک‌تر می‌شود.`}
        />
      </div>
    </WidgetFrame>
  );
}

/* ---------------- the pH scale ---------------- */

const PH_SAMPLES: [string, number][] = [
  ['شیرهٔ معده', 1.5],
  ['آب لیمو', 2.2],
  ['سرکه', 2.9],
  ['قهوه', 5],
  ['باران', 5.6],
  ['شیر', 6.6],
  ['آب خالص', 7],
  ['خون', 7.4],
  ['آب دریا', 8],
  ['جوش شیرین', 8.3],
  ['آمونیاک خانگی', 11.5],
  ['لوله‌بازکن', 13.5],
];

/** 10^(−p) written as a TeX power of ten, e.g. 3.2 → 6.3×10⁻⁴. */
function powTex(p: number): string {
  if (Math.abs(p - Math.round(p)) < 1e-9) return `10^{-${Math.round(p)}}`;
  const e = Math.ceil(p);
  const m = 10 ** (e - p);
  return `${m.toFixed(1).replace('.', '{\\dec}')}\\times10^{-${e}}`;
}

export function PhLab() {
  const [ph, setPh] = useState(3);
  const kind = ph < 7 ? 'اسیدی' : ph > 7 ? 'بازی' : 'خنثی';
  const near = PH_SAMPLES.reduce((best, s) => (Math.abs(s[1] - ph) < Math.abs(best[1] - ph) ? s : best));
  const W = 340;
  const sx = (v: number) => 10 + (v / 14) * (W - 20);
  return (
    <WidgetFrame title="مقیاس pH" icon="flask">
      <svg viewBox={`0 0 ${W} 92`} className="plot" role="img" aria-label="نوار pH از صفر تا چهارده">
        <defs>
          <linearGradient id="ph-bar" x1="0" x2="1">
            <stop offset="0" stopColor="#e5354b" />
            <stop offset="0.25" stopColor="#ff9a1f" />
            <stop offset="0.45" stopColor="#f2d81e" />
            <stop offset="0.5" stopColor="#3cc35a" />
            <stop offset="0.7" stopColor="#1f9bd8" />
            <stop offset="1" stopColor="#5b3df5" />
          </linearGradient>
        </defs>
        <rect x="10" y="30" width={W - 20} height="22" rx="11" fill="url(#ph-bar)" />
        {Array.from({ length: 15 }, (_, i) => (
          <text key={i} x={sx(i)} y="70" textAnchor="middle" fontSize="10" fill="var(--plot-axis)">
            {i}
          </text>
        ))}
        <g transform={`translate(${sx(ph)} 0)`}>
          <path d="M0 28 -7 14 7 14z" fill="var(--ink)" />
          <circle cy="41" r="9" fill="#fff" stroke="var(--ink)" strokeWidth="2.5" />
        </g>
        <text x={sx(ph)} y="88" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--ink-2)">
          {near[0]}
        </text>
      </svg>
      <Slider label="pH" value={ph} min={0} max={14} step={0.5} onChange={setPh} />
      <div className="widget-formula">
        <M tex={`[\\mathrm{H^+}]=${powTex(ph)}\\qquad [\\mathrm{OH^-}]=${powTex(14 - ph)}`} />
      </div>
      <div className="widget-note">
        <Rich
          text={`محلول **${kind}** است. $\\mathrm{pH}=-\\log[\\mathrm{H^+}]$؛ یعنی هر یک واحد کم شدن pH، غلظت $\\mathrm{H^+}$ را **ده برابر** می‌کند. حاصل‌ضرب دو غلظت همیشه (در دمای اتاق) $10^{-14}$ است: هرچه یکی زیاد شود، دیگری به همان نسبت کم می‌شود.`}
        />
      </div>
    </WidgetFrame>
  );
}
