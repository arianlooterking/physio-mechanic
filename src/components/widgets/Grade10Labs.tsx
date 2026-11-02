import { useState } from 'react';
import { averageMass, configuration, elementOf, isotopeTex, isUnstable, periodOf, valenceElectrons } from '../../lib/atoms';
import { texOf } from '../../lib/digits';
import { convert, conversionPower, density, materialFor, orderOfMagnitude, PREFIXES, prefixOf, readWithPrecision, scientific } from '../../lib/units';
import { M, Rich } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

/*
 * Labs for the grade-10 books: unit conversion, measuring precision, density (فیزیک ۱), isotopes,
 * average atomic mass and electron shells (شیمی ۱), and the unit circle and right triangle (ریاضی ۱).
 */

const sciTex = (v: number) => {
  if (v === 0) return '0';
  const { a, e } = scientific(v);
  if (e >= -2 && e <= 4) return texOf(v, 6);
  return `${texOf(a, 4)}\\times10^{${e}}`;
};

/* ───────── فیزیک ۱ ───────── */

const PREFIX_CHOICES = PREFIXES.filter((p) => [3, 0, -1, -2, -3, -6].includes(p.exp));
const unitTex = (exp: number, power: 1 | 2 | 3) => `\\mathrm{${prefixOf(exp).sym.replace('μ', '\\mu ')}m}${power > 1 ? `^${power}` : ''}`;

/** Chain conversion: pick a value, a from-prefix and a to-prefix (and length, area or volume); see the factor. */
export function UnitsLab() {
  const [power, setPower] = useState<'1' | '2' | '3'>('1');
  const [value, setValue] = useState(2.5);
  const [from, setFrom] = useState(3);
  const [to, setTo] = useState(-2);
  const pw = Number(power) as 1 | 2 | 3;
  const k = conversionPower(from, to, pw);
  const out = convert(value, from, to, pw);
  const pick = (cur: number, set: (v: number) => void) => (
    <Seg value={String(cur)} onChange={(v) => set(Number(v))} options={PREFIX_CHOICES.map((p) => ({ v: String(p.exp), label: <M tex={unitTex(p.exp, 1)} /> }))} />
  );
  return (
    <WidgetFrame title="تبدیل یکا با زنجیرهٔ ضریب‌ها" icon="formula">
      <Seg value={power} onChange={setPower} options={[{ v: '1', label: 'طول' }, { v: '2', label: 'مساحت' }, { v: '3', label: 'حجم' }]} />
      <Slider label="مقدار" value={value} min={0.5} max={10} step={0.5} onChange={setValue} />
      <div className="slider">
        <label>از</label>
      </div>
      {pick(from, setFrom)}
      <div className="slider">
        <label>به</label>
      </div>
      {pick(to, setTo)}
      <div className="widget-formula">
        <M tex={`\\begin{aligned}&${texOf(value)}\\,${unitTex(from, pw)}\\times\\dfrac{10^{${from * pw}}\\,\\mathrm{m}${pw > 1 ? `^${pw}` : ''}}{1\\,${unitTex(from, pw)}}\\times\\dfrac{1\\,${unitTex(to, pw)}}{10^{${to * pw}}\\,\\mathrm{m}${pw > 1 ? `^${pw}` : ''}}\\\\ &=${sciTex(out)}\\,${unitTex(to, pw)}\\end{aligned}`} />
      </div>
      <div className="widget-note">
        <Rich
          text={`هر ضریب تبدیل برابر یک است، پس مقدار عوض نمی‌شود؛ فقط یکا عوض می‌شود. روی هم $10^{${k}}$ ضرب شد. ${pw > 1 ? `در ${pw === 2 ? 'مساحت' : 'حجم'} توان پیشوند ${pw === 2 ? 'دو' : 'سه'} برابر می‌شود: $1\\,\\mathrm{cm}^${pw}=10^{${-2 * pw}}\\,\\mathrm{m}^${pw}$.` : 'یکای کوچک‌تر یعنی عدد بزرگ‌تر.'}`}
        />
      </div>
    </WidgetFrame>
  );
}

/** A ruler with a movable object edge: the same length read with a cm ruler, a mm ruler and a vernier (0.1 mm). */
export function PrecisionLab() {
  const [len, setLen] = useState(4.37);
  const [step, setStep] = useState<'1' | '0.1' | '0.01'>('0.1');
  const s = Number(step);
  const reading = readWithPrecision(len, s);
  const W = 340;
  const sx = (cm: number) => 20 + (cm / 6) * (W - 40);
  const ticks = s === 1 ? 7 : 61;
  return (
    <WidgetFrame title="دقت وسیلهٔ اندازه‌گیری" icon="target">
      <svg viewBox={`0 0 ${W} 90`} className="plot" role="img" aria-label="خط‌کش و جسم">
        <rect x={sx(0)} y="12" width={sx(len) - sx(0)} height="24" rx="4" fill="var(--phys-soft, #dbeafe)" stroke="var(--phys, #2563eb)" strokeWidth="2" />
        <line x1={sx(0)} x2={sx(6)} y1="44" y2="44" stroke="var(--plot-axis)" strokeWidth="2" />
        {Array.from({ length: ticks }, (_, i) => {
          const cm = s === 1 ? i : i / 10;
          const major = Math.abs(cm - Math.round(cm)) < 1e-9;
          return <line key={i} x1={sx(cm)} x2={sx(cm)} y1="44" y2={major ? 60 : 52} stroke="var(--plot-axis)" strokeWidth={major ? 1.6 : 1} />;
        })}
        {Array.from({ length: 7 }, (_, i) => (
          <text key={i} x={sx(i)} y="76" textAnchor="middle" fontSize="11" fill="var(--plot-axis)">
            {i}
          </text>
        ))}
      </svg>
      <Slider label="طول واقعی جسم (cm)" value={len} min={0.5} max={5.9} step={0.01} onChange={setLen} />
      <Seg
        value={step}
        onChange={setStep}
        options={[
          { v: '1', label: 'خط‌کش سانتی‌متری' },
          { v: '0.1', label: 'خط‌کش میلی‌متری' },
          { v: '0.01', label: 'کولیس' },
        ]}
      />
      <div className="widget-formula">
        <M tex={`L=${texOf(reading.value, reading.decimals)}\\,\\mathrm{cm}`} />
      </div>
      <div className="widget-note">
        <Rich text={`دقت این وسیله $${texOf(s, 2)}\\,\\mathrm{cm}$ است. گزارش هر اندازه‌گیری تا کوچک‌ترین درجهٔ وسیله است و رقم آخرش کمی تردید دارد. با وسیلهٔ دقیق‌تر رقم‌های بیشتری به دست می‌آید؛ نوشتن رقم بیشتر از دقت وسیله درست نیست.`} />
      </div>
    </WidgetFrame>
  );
}

/** Mass and volume sliders: ρ = m/V, the nearest material from the book's table and whether it floats. */
export function DensityLab() {
  const [m, setM] = useState(54);
  const [v, setV] = useState(20);
  const d = density(m, v);
  const mat = materialFor(d.gcm3);
  const W = 340;
  const top = mat.floats ? 30 + 34 * d.gcm3 : 92;
  return (
    <WidgetFrame title="چگالی: جرم تقسیم بر حجم" icon="atom">
      <svg viewBox={`0 0 ${W} 140`} className="plot" role="img" aria-label="جسم در ظرف آب">
        <rect x="70" y="30" width="200" height="100" rx="6" fill="#7cc4f2" opacity="0.35" stroke="var(--plot-axis)" />
        <rect x="70" y="30" width="200" height="3" fill="#3a9be0" />
        <rect x="145" y={top - 34} width="50" height="34" rx="5" fill={mat.floats ? '#c48a3a' : '#8a8f99'} stroke="var(--ink)" strokeWidth="1.5" />
        <text x={W / 2} y="20" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--ink-2)">
          {mat.floats ? 'روی آب می‌ماند' : 'در آب فرو می‌رود'}
        </text>
      </svg>
      <Slider label="جرم (g)" value={m} min={5} max={400} step={1} onChange={setM} />
      <Slider label="حجم (cm³)" value={v} min={5} max={100} step={1} onChange={setV} />
      <div className="widget-formula">
        <M tex={`\\begin{aligned}\\rho&=\\dfrac{m}{V}=\\dfrac{${m}\\,\\mathrm{g}}{${v}\\,\\mathrm{cm^3}}=${texOf(d.gcm3, 2)}\\,\\mathrm{\\tfrac{g}{cm^3}}\\\\ &=${texOf(d.kgm3, 0)}\\,\\mathrm{\\tfrac{kg}{m^3}}\\end{aligned}`} />
      </div>
      <div className="widget-note">
        <Rich text={`نزدیک‌ترین مادهٔ جدول کتاب: **${mat.name}** ($${texOf(mat.rho, 2)}\\,\\mathrm{g/cm^3}$). جسمی که چگالی‌اش از آب ($1\\,\\mathrm{g/cm^3}$) کمتر است روی آب می‌ماند. برای رفتن از $\\mathrm{g/cm^3}$ به $\\mathrm{kg/m^3}$ در ۱۰۰۰ ضرب کن.`} />
      </div>
    </WidgetFrame>
  );
}

/** Order of magnitude: slide a number over many powers of ten and see it rounded to the nearest one. */
export function MagnitudeLab() {
  const [lg, setLg] = useState(6.8);
  const v = Number((10 ** lg).toPrecision(2));
  const { a, e } = scientific(v);
  const o = orderOfMagnitude(v);
  return (
    <WidgetFrame title="مرتبهٔ بزرگی" icon="chart">
      <Slider label="عدد" value={lg} min={-9} max={12} step={0.1} onChange={setLg} format={() => ''} />
      <div className="widget-formula">
        <M tex={`${texOf(a, 1)}\\times10^{${e}}\\ \\longrightarrow\\ 10^{${o}}`} />
      </div>
      <div className="widget-note">
        <Rich text={`عدد را به صورت نمادگذاری علمی بنویس. ضریب $${texOf(a, 1)}$ ${a >= 5 ? 'از ۵ کمتر نیست، پس یکی به توان اضافه می‌شود' : 'از ۵ کمتر است، پس توان همان می‌ماند'}. مرتبهٔ بزرگی برای مقایسهٔ سریع است، نه حساب دقیق.`} />
      </div>
    </WidgetFrame>
  );
}

/* ───────── شیمی ۱ ───────── */

/** Build a nucleus: protons and neutrons → element, isotope notation, mass number and the stability rule. */
export function IsotopeLab() {
  const [z, setZ] = useState(6);
  const [n, setN] = useState(8);
  const el = elementOf(z)!;
  const unstable = isUnstable(z, n);
  const W = 340;
  const balls = [...Array(z).fill('p'), ...Array(n).fill('n')].sort((a, b) => (a === b ? 0 : a === 'p' ? -1 : 1));
  // Interleave protons and neutrons so the nucleus looks mixed.
  const mixed = balls.map((_, i) => (i % 2 === 0 ? balls[i / 2] : balls[balls.length - 1 - (i - 1) / 2]));
  return (
    <WidgetFrame title="ایزوتوپ‌ساز" icon="atom">
      <svg viewBox={`0 0 ${W} 120`} className="plot" role="img" aria-label="هستهٔ اتم">
        {mixed.map((t, i) => {
          const ang = i * 2.4;
          const rad = 5 * Math.sqrt(i);
          return <circle key={i} cx={W / 2 + rad * Math.cos(ang) * 1.6} cy={60 + rad * Math.sin(ang) * 1.6} r="7" fill={t === 'p' ? '#e5354b' : '#9aa3b2'} stroke="#fff" strokeWidth="1.2" />;
        })}
      </svg>
      <Slider label="پروتون (Z)" value={z} min={1} max={20} step={1} onChange={setZ} />
      <Slider label="نوترون (N)" value={n} min={0} max={30} step={1} onChange={setN} />
      <div className="widget-formula">
        <M tex={`\\begin{gathered}${isotopeTex(z, n)}\\\\ A=Z+N=${z}+${n}=${z + n}\\\\ \\dfrac{N}{Z}=${texOf(n / z, 2)}\\end{gathered}`} />
      </div>
      <div className="widget-note">
        <Rich
          text={`عدد پروتون عنصر را تعیین می‌کند: این **${el.name}** است. با تغییر نوترون‌ها همان عنصر می‌ماند و فقط ==ایزوتوپ== عوض می‌شود. ${unstable ? `چون $\\tfrac{N}{Z}\\ge1{\\dec}5$ است، این هسته **ناپایدار** است و پرتوزا خواهد بود.` : `نسبت $\\tfrac{N}{Z}$ از $1{\\dec}5$ کمتر است؛ طبق قاعدهٔ کتاب انتظار داریم پایدارتر باشد.`}`}
        />
      </div>
    </WidgetFrame>
  );
}

/** Two isotopes with an abundance slider: the average atomic mass moves toward the more abundant one. */
export function AverageMassLab() {
  const [pair, setPair] = useState<'Cl' | 'Li' | 'Cu'>('Cl');
  const P = { Cl: { name: 'کلر', m: [35, 37], p: 75 }, Li: { name: 'لیتیم', m: [6, 7], p: 7.5 }, Cu: { name: 'مس', m: [63, 65], p: 69 } } as const;
  const [p, setP] = useState<number>(P.Cl.p);
  const cur = P[pair];
  const avg = averageMass([
    [cur.m[0], p],
    [cur.m[1], 100 - p],
  ]);
  return (
    <WidgetFrame title="جرم اتمی میانگین" icon="chart">
      <Seg
        value={pair}
        onChange={(v) => {
          setPair(v);
          setP(P[v].p);
        }}
        options={(Object.keys(P) as ('Cl' | 'Li' | 'Cu')[]).map((k) => ({ v: k, label: P[k].name }))}
      />
      <Slider label={`فراوانی ایزوتوپ ${cur.m[0]}`} value={p} min={0} max={100} step={0.5} onChange={setP} format={(v) => `${v}٪`} />
      <div className="widget-formula">
        <M tex={`\\begin{aligned}\\bar M&=\\dfrac{${cur.m[0]}\\times${texOf(p, 1)}+${cur.m[1]}\\times${texOf(100 - p, 1)}}{100}\\\\ &=${texOf(avg, 2)}\\,\\mathrm{amu}\\end{aligned}`} />
      </div>
      <div className="widget-note">
        <Rich text={`میانگین همیشه بین جرم دو ایزوتوپ است و به ایزوتوپی که فراوان‌تر است نزدیک‌تر. عدد جدول دوره‌ای برای ${cur.name} با فراوانی طبیعی (${texOf(cur.p, 1)} درصد) به دست می‌آید.`} />
      </div>
    </WidgetFrame>
  );
}

/** Electron shells: pick Z, see the subshell filling order, the configuration, period and valence electrons. */
export function ShellsLab() {
  const [z, setZ] = useState(11);
  const conf = configuration(z);
  const el = elementOf(z);
  const W = 340;
  const shells = [1, 2, 3, 4].map((k) => conf.filter(([l]) => Number(l[0]) === k).reduce((s, [, c]) => s + c, 0));
  return (
    <WidgetFrame title="آرایش الکترونی و لایه‌ها" icon="atom">
      <svg viewBox={`0 0 ${W} 170`} className="plot" role="img" aria-label="لایه‌های الکترونی">
        <circle cx={W / 2} cy="85" r="12" fill="#e5354b" />
        {shells.map((count, i) =>
          count === 0 ? null : (
            <g key={i}>
              <circle cx={W / 2} cy="85" r={26 + i * 18} fill="none" stroke="var(--plot-axis)" strokeDasharray="3 3" />
              {Array.from({ length: count }, (_, j) => {
                const ang = (2 * Math.PI * j) / count - Math.PI / 2;
                return <circle key={j} cx={W / 2 + (26 + i * 18) * Math.cos(ang)} cy={85 + (26 + i * 18) * Math.sin(ang)} r="4" fill="var(--chem, #10b981)" />;
              })}
            </g>
          ),
        )}
      </svg>
      <Slider label="عدد اتمی Z" value={z} min={1} max={36} step={1} onChange={setZ} />
      <div className="widget-formula">
        <M tex={`{}_{${z}}${el ? `\\mathrm{${el.sym}}` : '\\mathrm{X}'}:\\ ${conf.map(([l, k]) => `${l}^{${k}}`).join('\\,')}`} />
      </div>
      <div className="widget-note">
        <Rich
          text={`زیرلایه‌ها به ترتیب $n+l$ پر می‌شوند (برای همین $4s$ پیش از $3d$ است). این اتم در **دورهٔ ${periodOf(z)}** است${z <= 20 ? ` و ${valenceElectrons(z)} الکترون ظرفیتی دارد` : ''}.${z === 24 || z === 29 ? ' کروم و مس دو استثنای معروف‌اند: یک الکترون از $4s$ به $3d$ می‌رود.' : ''}`}
        />
      </div>
    </WidgetFrame>
  );
}

/* ───────── ریاضی ۱ ───────── */

/** A right triangle with an angle slider: opposite, adjacent and hypotenuse, and sin, cos, tan as ratios. */
export function RightTriangleLab() {
  const [deg, setDeg] = useState(30);
  const [hyp, setHyp] = useState(4);
  const t = (deg * Math.PI) / 180;
  const opp = hyp * Math.sin(t);
  const adj = hyp * Math.cos(t);
  const W = 340;
  const s = 50;
  const A: [number, number] = [40, 150];
  const B: [number, number] = [40 + adj * s, 150];
  const C: [number, number] = [40 + adj * s, 150 - opp * s];
  return (
    <WidgetFrame title="نسبت‌های مثلثاتی در مثلث قائم‌الزاویه" icon="geo">
      <svg viewBox={`0 0 ${W} 165`} className="plot" role="img" aria-label="مثلث قائم‌الزاویه">
        <polygon points={[A, B, C].map((p) => p.join(',')).join(' ')} fill="var(--math-soft, #ede9fe)" stroke="var(--ink)" strokeWidth="2" />
        <rect x={B[0] - 10} y={B[1] - 10} width="10" height="10" fill="none" stroke="var(--ink)" />
        <text x={A[0] + 22} y={A[1] - 6} fontSize="12" fill="var(--ink)">α</text>
        <text x={(A[0] + B[0]) / 2} y={A[1] + 14} textAnchor="middle" fontSize="11" fill="#2563eb">مجاور</text>
        <text x={B[0] + 6} y={(B[1] + C[1]) / 2} fontSize="11" fill="#e5354b">مقابل</text>
        <text x={(A[0] + C[0]) / 2 - 22} y={(A[1] + C[1]) / 2 - 4} fontSize="11" fill="var(--ink-2)">وتر</text>
      </svg>
      <Slider label="زاویهٔ α (درجه)" value={deg} min={5} max={85} step={1} onChange={setDeg} />
      <Slider label="وتر" value={hyp} min={1} max={5} step={0.5} onChange={setHyp} />
      <div className="widget-formula">
        <M tex={`\\begin{aligned}\\sin\\alpha&=\\tfrac{\\text{مقابل}}{\\text{وتر}}=${texOf(Math.sin(t), 3)}\\\\ \\cos\\alpha&=\\tfrac{\\text{مجاور}}{\\text{وتر}}=${texOf(Math.cos(t), 3)}\\\\ \\tan\\alpha&=\\tfrac{\\text{مقابل}}{\\text{مجاور}}=${deg === 90 ? '\\infty' : texOf(Math.tan(t), 3)}\\end{aligned}`} />
      </div>
      <div className="widget-note">
        <Rich text="وتر را بزرگ و کوچک کن: ضلع‌ها عوض می‌شوند ولی نسبت‌ها نه. نسبت‌های مثلثاتی فقط به زاویه بستگی دارند؛ برای همین یک جدول برای همهٔ مثلث‌ها کافی است." />
      </div>
    </WidgetFrame>
  );
}

/** The unit circle: an angle slider, the point (cos θ, sin θ), the quadrant and the signs of the ratios. */
export function UnitCircleLab() {
  const [deg, setDeg] = useState(150);
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const W = 340;
  const R = 70;
  const cx = W / 2;
  const cy = 90;
  const P: [number, number] = [cx + R * c, cy - R * s];
  const quad = deg % 90 === 0 ? null : Math.floor((((deg % 360) + 360) % 360) / 90) + 1;
  const sign = (v: number) => (Math.abs(v) < 1e-9 ? '0' : v > 0 ? '+' : '-');
  // A positive angle turns counterclockwise from A (SVG sweep 0, since SVG's y axis points down) and a negative one clockwise (sweep 1).
  const arc = `M ${cx + 22} ${cy} A 22 22 0 ${Math.abs(deg) > 180 ? 1 : 0} ${deg < 0 ? 1 : 0} ${cx + 22 * c} ${cy - 22 * s}`;
  return (
    <WidgetFrame title="دایرهٔ مثلثاتی" icon="geo">
      <svg viewBox={`0 0 ${W} 180`} className="plot" role="img" aria-label="دایرهٔ مثلثاتی">
        <line x1={cx - R - 20} x2={cx + R + 20} y1={cy} y2={cy} stroke="var(--plot-axis)" />
        <line x1={cx} x2={cx} y1={cy - R - 15} y2={cy + R + 15} stroke="var(--plot-axis)" />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--ink-2)" strokeWidth="1.5" />
        <path d={arc} fill="none" stroke="var(--plot-alt, #f59e0b)" strokeWidth="2" />
        <line x1={cx} y1={cy} x2={P[0]} y2={P[1]} stroke="var(--ink)" strokeWidth="2" />
        <line x1={P[0]} y1={P[1]} x2={P[0]} y2={cy} stroke="#e5354b" strokeWidth="2.5" />
        <line x1={cx} y1={cy} x2={P[0]} y2={cy} stroke="#2563eb" strokeWidth="2.5" />
        <circle cx={P[0]} cy={P[1]} r="5" fill="var(--ink)" />
        {['۱', '۲', '۳', '۴'].map((q, i) => (
          <text key={q} x={cx + (i === 0 || i === 3 ? 1 : -1) * (R + 8)} y={cy + (i < 2 ? -1 : 1) * (R - 2)} textAnchor="middle" fontSize="11" fill="var(--plot-axis)">
            ربع {q}
          </text>
        ))}
      </svg>
      <Slider label="زاویهٔ θ (درجه)" value={deg} min={-360} max={360} step={5} onChange={setDeg} />
      <div className="widget-formula">
        <M tex={`\\begin{gathered}P=(\\cos\\theta,\\sin\\theta)\\\\ =(${texOf(c, 3)},\\,${texOf(s, 3)})\\\\ \\tan\\theta=${Math.abs(c) < 1e-9 ? '\\text{تعریف نشده}' : texOf(s / c, 3)}\\end{gathered}`} />
      </div>
      <div className="widget-note">
        <Rich
          text={`${quad ? `انتهای کمان در **ربع ${['اول', 'دوم', 'سوم', 'چهارم'][quad - 1]}** است` : 'انتهای کمان روی یکی از محورهاست'}: علامت سینوس $${sign(s)}$، کسینوس $${sign(c)}$ و تانژانت $${Math.abs(c) < 1e-9 ? '\\text{—}' : sign(s / c)}$. پارهٔ آبی کسینوس و پارهٔ قرمز سینوس است؛ $\\sin^2\\theta+\\cos^2\\theta=1$ همان فیثاغورس در این مثلث است. ${deg < 0 ? 'زاویهٔ منفی یعنی در جهت عقربه‌های ساعت چرخیده‌ای.' : ''}`}
        />
      </div>
    </WidgetFrame>
  );
}
