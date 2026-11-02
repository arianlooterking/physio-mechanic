import { useState, type ReactNode } from 'react';
import { fmt } from '../../lib/digits';
import { M, Rich } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

/** Remainder that is never negative, as in the division theorem (0 ≤ r < b). */
export const mod = (a: number, b: number) => ((a % b) + b) % b;
const quo = (a: number, b: number) => (a - mod(a, b)) / b;
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** One colour per remainder class (up to 8 classes). */
const CLASS_COLORS = ['var(--math)', 'var(--chem)', 'var(--phys)', 'var(--geo)', 'var(--stat)', 'var(--bad)', 'var(--disc)', 'var(--ok)'];

type DivMode = 'groups' | 'line' | 'classes';

/**
 * The division theorem three ways: a objects in groups of b (what «b | a» means), a on the number line between two
 * multiples of b (also for negative a), and every integer sorted into b remainder classes (a partition of ℤ).
 */
export function IntDivLab({ mode: initial = 'groups' }: { mode?: DivMode }) {
  const [mode, setMode] = useState<DivMode>(initial);
  const [a, setA] = useState(initial === 'line' ? -25 : 23);
  const [b, setB] = useState(initial === 'classes' ? 4 : 7);
  const [pick, setPick] = useState<number | null>(null);

  const A = mode === 'groups' ? Math.max(0, a) : a;
  const q = quo(A, b);
  const r = mod(A, b);

  let body: ReactNode;
  if (mode === 'groups') {
    const cols = b;
    const rows = Math.ceil(Math.max(A, 1) / cols);
    const cell = Math.min(26, 270 / Math.max(cols, 1), 260 / rows);
    const h = Math.max(rows, 1) * cell + 12;
    body = (
      <>
        <svg viewBox={`0 0 300 ${h}`} className="plot" role="img" aria-label={`${A} شیء در دسته‌های ${b}تایی`}>
          {Array.from({ length: A }, (_, i) => {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const full = row < q;
            return (
              <circle
                key={i}
                cx={300 - 14 - col * cell}
                cy={10 + row * cell + cell / 2}
                r={cell * 0.36}
                fill={full ? 'var(--math)' : 'var(--bad)'}
                opacity={full ? 0.85 : 1}
              />
            );
          })}
          {Array.from({ length: q }, (_, row) => (
            <rect
              key={row}
              x={300 - 14 - (cols - 1) * cell - cell / 2 + 2}
              y={10 + row * cell + 2}
              width={cols * cell - 4}
              height={cell - 4}
              rx={8}
              fill="none"
              stroke="var(--plot-axis)"
              strokeDasharray="3 3"
            />
          ))}
        </svg>
        <Slider label="تعداد شیءها (a)" value={a} min={0} max={40} step={1} onChange={setA} />
        <Slider label="اندازهٔ هر دسته (b)" value={b} min={1} max={10} step={1} onChange={setB} />
        <div className="widget-formula">
          <M tex={`${A}=${b}\\times${q}${r ? `+${r}` : ''}\\quad\\Rightarrow\\quad ${b}${r ? '\\nmid' : '\\mid'}${A}`} />
        </div>
        <div className="widget-note">
          <Rich
            text={
              r === 0
                ? `هر ${fmt(b)} شیء یک دسته شد و **چیزی باقی نماند**؛ پس $${b}\\mid ${A}$ (${fmt(b)} عدد ${fmt(A)} را می‌شمارد).`
                : `${fmt(q)} دستهٔ کامل و ${fmt(r)} شیء قرمزِ اضافه؛ چون باقی‌مانده صفر نیست، $${b}\\nmid ${A}$. اندازهٔ دسته را عوض کن تا شمارنده‌های ${fmt(A)} را پیدا کنی.`
            }
          />
        </div>
      </>
    );
  } else if (mode === 'line') {
    const lo = Math.min(-b, Math.floor(Math.min(A, 0) / b) * b - b);
    const hi = Math.max(b, Math.ceil(Math.max(A, 0) / b) * b + b);
    const X = (v: number) => 20 + ((v - lo) / (hi - lo)) * 260;
    const multiples: number[] = [];
    for (let m = Math.ceil(lo / b) * b; m <= hi; m += b) multiples.push(m);
    const base = b * q;
    body = (
      <>
        <svg viewBox="0 0 300 120" className="plot" role="img" aria-label={`${A} بین دو مضرب پشت‌سرهم ${b}`}>
          <line x1={10} y1={70} x2={290} y2={70} stroke="var(--plot-axis)" strokeWidth={2} />
          {multiples.map((m) => (
            <g key={m}>
              <line x1={X(m)} y1={62} x2={X(m)} y2={78} stroke={m === base ? 'var(--math)' : 'var(--ink-3)'} strokeWidth={m === base ? 3 : 1.5} />
              <text x={X(m)} y={96} fontSize={11} textAnchor="middle" fill={m === base ? 'var(--math)' : 'var(--ink-2)'} fontWeight={m === base ? 800 : 500}>
                {fmt(m)}
              </text>
            </g>
          ))}
          <line x1={X(0)} y1={56} x2={X(0)} y2={84} stroke="var(--ink)" strokeWidth={1} />
          {r > 0 && <line x1={X(base)} y1={48} x2={X(A)} y2={48} stroke="var(--bad)" strokeWidth={5} strokeLinecap="round" />}
          {r > 0 && (
            <text x={(X(base) + X(A)) / 2} y={40} fontSize={12} textAnchor="middle" fill="var(--bad)" fontWeight={800}>
              r = {fmt(r)}
            </text>
          )}
          <circle cx={X(A)} cy={70} r={7} fill="var(--ok)" stroke="var(--surface)" strokeWidth={2} />
          <text x={X(A)} y={116} fontSize={12} textAnchor="middle" fill="var(--ok)" fontWeight={800}>
            a = {fmt(A)}
          </text>
        </svg>
        <Slider label="مقسوم (a)" value={a} min={-30} max={30} step={1} onChange={setA} />
        <Slider label="مقسوم‌علیه (b)" value={b} min={2} max={9} step={1} onChange={setB} />
        <div className="widget-formula">
          <M tex={`${A}=${b}\\times(${q})+${r}`} />
          <div className="widget-sub">
            <M tex={`0\\le r=${r}<${b}`} />
          </div>
        </div>
        <div className="widget-note">
          <Rich
            text={`خط‌های روی محور مضرب‌های ${fmt(b)}‌اند. $bq$ همیشه **نزدیک‌ترین مضربِ سمت چپ** $a$ است (خط بنفش) و باقی‌مانده فاصلهٔ $a$ (نقطهٔ سبز) تا آن است (پارهٔ قرمز)؛ برای همین هیچ‌وقت منفی نمی‌شود. ${A < 0 ? r ? `برای عدد منفی، خارج قسمت $${q}$ است نه $${q + 1}$؛ وگرنه باقی‌مانده منفی می‌شد.` : 'این بار باقی‌مانده صفر است؛ یعنی b عدد a را عاد می‌کند.' : 'a را منفی کن و ببین خارج قسمت چطور انتخاب می‌شود.'}`}
          />
        </div>
      </>
    );
  } else {
    const nums = Array.from({ length: 36 }, (_, i) => i - 8);
    const pr = pick === null ? null : mod(pick, b);
    body = (
      <>
        <div className="num-grid" dir="ltr">
          {nums.map((n) => (
            <button
              key={n}
              className={`num-chip${pick === n ? ' lit' : ''}`}
              style={{ background: CLASS_COLORS[mod(n, b)], opacity: pr === null || mod(n, b) === pr ? 1 : 0.28 }}
              onClick={() => setPick(pick === n ? null : n)}
              aria-label={`عدد ${n}، باقی‌مانده ${mod(n, b)}`}
            >
              {fmt(n)}
            </button>
          ))}
        </div>
        <Slider label="تقسیم بر (b)" value={b} min={2} max={6} step={1} onChange={(v) => (setB(v), setPick(null))} />
        <div className="legend">
          {Array.from({ length: b }, (_, k) => (
            <span key={k}>
              <i style={{ background: CLASS_COLORS[k] }} />
              <M tex={`${b}k${k ? `+${k}` : ''}`} />
            </span>
          ))}
        </div>
        <div className="widget-note">
          <Rich
            text={
              pick === null
                ? `هر رنگ یک باقی‌مانده است. هر عدد صحیح **دقیقاً یک** رنگ دارد: این ${fmt(b)} دسته مجموعهٔ $\\mathbb{Z}$ را **افراز** می‌کنند. روی یک عدد بزن.`
                : `$${pick}=${b}\\times(${quo(pick, b)})+${mod(pick, b)}$؛ پس ${fmt(pick)} به شکل $${b}k${mod(pick, b) ? `+${mod(pick, b)}` : ''}$ است. همهٔ عددهای پررنگ هم‌دستهٔ او هستند و فاصلهٔ هر دوتایشان مضرب ${fmt(b)} است.`
            }
          />
        </div>
      </>
    );
  }

  return (
    <WidgetFrame title="قضیهٔ تقسیم" icon="grid">
      <Seg
        value={mode}
        onChange={(m) => (setMode(m), setPick(null))}
        options={[
          { v: 'groups', label: 'دسته کردن' },
          { v: 'line', label: 'روی محور' },
          { v: 'classes', label: 'افراز' },
        ]}
      />
      {body}
    </WidgetFrame>
  );
}

const divisors = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);

/** Divisors and multiples of two numbers side by side: the largest common divisor and the smallest common multiple. */
export function GcdLab() {
  const [a, setA] = useState(12);
  const [b, setB] = useState(18);
  const g = gcd(a, b);
  const l = (a * b) / g;
  const da = divisors(a);
  const db = divisors(b);
  const ma = Array.from({ length: Math.min(12, Math.ceil((l + a) / a)) }, (_, i) => a * (i + 1));
  const mb = Array.from({ length: Math.min(12, Math.ceil((l + b) / b)) }, (_, i) => b * (i + 1));
  const chip = (v: number, common: boolean, best: boolean) => (
    <span key={v} className={`num-chip small${common ? ' common' : ''}${best ? ' best' : ''}`}>
      {fmt(v)}
    </span>
  );
  return (
    <WidgetFrame title="ب‌م‌م و ک‌م‌م" icon="grid">
      <Slider label="a" value={a} min={1} max={48} step={1} onChange={setA} />
      <Slider label="b" value={b} min={1} max={48} step={1} onChange={setB} />
      <div className="gcd-rows">
        <div className="gcd-label">شمارنده‌های مثبت {fmt(a)}</div>
        <div className="num-row" dir="ltr">{da.map((d) => chip(d, b % d === 0, d === g))}</div>
        <div className="gcd-label">شمارنده‌های مثبت {fmt(b)}</div>
        <div className="num-row" dir="ltr">{db.map((d) => chip(d, a % d === 0, d === g))}</div>
        <div className="gcd-label">مضرب‌های {fmt(a)}</div>
        <div className="num-row" dir="ltr">{ma.map((m) => chip(m, m % b === 0, m === l))}</div>
        <div className="gcd-label">مضرب‌های {fmt(b)}</div>
        <div className="num-row" dir="ltr">{mb.map((m) => chip(m, m % a === 0, m === l))}</div>
      </div>
      <div className="widget-formula">
        <M tex={`(${a},${b})=${g},\\qquad [${a},${b}]=${l}`} />
      </div>
      <div className="widget-note">
        <Rich
          text={`شمارنده‌های مشترک پررنگ شده‌اند و بزرگ‌ترینشان ب‌م‌م است. اولین مضرب مشترک ک‌م‌م است. ${g === 1 ? `چون $(${a},${b})=1$، این دو عدد **نسبت به هم اول‌اند**.` : ''} ${a % b === 0 || b % a === 0 ? 'یکی دیگری را عاد می‌کند؛ ببین ب‌م‌م همان عدد کوچک‌تر و ک‌م‌م همان بزرگ‌تر شد.' : ''}`}
        />
      </div>
    </WidgetFrame>
  );
}
