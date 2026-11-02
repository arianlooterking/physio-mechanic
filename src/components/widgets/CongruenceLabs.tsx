import { useState } from 'react';
import { fmt } from '../../lib/digits';
import { M, Rich } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

const mod = (a: number, m: number) => ((a % m) + m) % m;
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** Days of the week in the order the book counts them from Saturday (شنبه = 0). */
const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

/**
 * A clock with m hours: walking a steps from 0 lands on a mod m, so a ≡ r (mod m). In «week» mode the clock has the
 * seven days and answers «d days after a given day».
 */
export function CongruenceLab({ mode: initial = 'clock' }: { mode?: 'clock' | 'week' }) {
  const [mode, setMode] = useState<'clock' | 'week'>(initial);
  const [m, setM] = useState(5);
  const [a, setA] = useState(17);
  const [start, setStart] = useState(1);
  const [d, setD] = useState(131);
  const M_ = mode === 'week' ? 7 : m;
  const r = mode === 'week' ? mod(start + d, 7) : mod(a, m);
  const cx = 150;
  const cy = 135;
  const R = mode === 'week' ? 96 : 100;
  const pos = (k: number): [number, number] => {
    const t = -Math.PI / 2 + (2 * Math.PI * k) / M_;
    return [cx + R * Math.cos(t), cy + R * Math.sin(t)];
  };
  const laps = mode === 'week' ? Math.floor(d / 7) : Math.floor(Math.abs(a) / m);
  const others = Array.from({ length: 5 }, (_, i) => r + (i - 2) * m);

  return (
    <WidgetFrame title={mode === 'week' ? 'هم‌نهشتی و روزهای هفته' : 'ساعت هم‌نهشتی'} icon="grid">
      <Seg
        value={mode}
        onChange={setMode}
        options={[
          { v: 'clock', label: 'ساعت m‌ساعته' },
          { v: 'week', label: 'روزهای هفته' },
        ]}
      />
      <svg viewBox="0 0 300 270" className="plot" role="img" aria-label="دایره‌ای با جایگاه‌های ۰ تا m منهای ۱">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--plot-axis)" strokeWidth={2} />
        {Array.from({ length: M_ }, (_, k) => {
          const [x, y] = pos(k);
          const on = k === r;
          const isStart = mode === 'week' && k === start;
          return (
            <g key={k}>
              <circle cx={x} cy={y} r={mode === 'week' ? (on ? 25 : 22) : on ? 17 : 14} fill={on ? 'var(--math)' : isStart ? 'var(--ok)' : 'var(--surface-2)'} stroke={on ? 'var(--math)' : 'var(--line)'} strokeWidth={2} />
              <text x={x} y={y + 5} fontSize={mode === 'week' ? 9 : 14} fontWeight={800} textAnchor="middle" fill={on || isStart ? '#fff' : 'var(--ink)'}>
                {mode === 'week' ? DAYS[k] : fmt(k)}
              </text>
            </g>
          );
        })}
        <text x={cx} y={cy - 4} fontSize={13} textAnchor="middle" fill="var(--ink-2)" fontWeight={700}>
          {mode === 'week' ? `${fmt(d)} روز بعد` : `${fmt(Math.abs(a))} قدم ${a < 0 ? 'پادساعتگرد' : 'ساعتگرد'}`}
        </text>
        <text x={cx} y={cy + 16} fontSize={12} textAnchor="middle" fill="var(--ink-3)">
          {`${fmt(laps)} دور کامل`}
        </text>
      </svg>
      {mode === 'clock' ? (
        <>
          <Slider label="پیمانه (m)" value={m} min={2} max={12} step={1} onChange={setM} />
          <Slider label="عدد (a)" value={a} min={-30} max={60} step={1} onChange={setA} />
          <div className="widget-formula">
            <M tex={`${a}\\overset{${m}}{\\equiv}${r}`} />
          </div>
          <div className="widget-note">
            <Rich
              text={`از ۰ شروع کن و ${fmt(Math.abs(a))} قدم ${a < 0 ? 'پادساعتگرد' : 'ساعتگرد'} برو؛ روی ${fmt(r)} می‌ایستی. همهٔ عددهایی که روی همین خانه می‌ایستند هم‌نهشت‌اند: $${others.join(',\\ ')},\\dots$ فاصلهٔ هر دوتایشان مضرب ${fmt(m)} است؛ یعنی $${m}\\mid a-b$.`}
            />
          </div>
        </>
      ) : (
        <>
          <div className="day-pick">
            {DAYS.map((name, k) => (
              <button key={k} className={k === start ? 'on' : ''} onClick={() => setStart(k)}>
                {name}
              </button>
            ))}
          </div>
          <Slider label="چند روز بعد (d)" value={d} min={0} max={365} step={1} onChange={setD} />
          <div className="widget-formula">
            <M tex={`${d}\\overset{7}{\\equiv}${mod(d, 7)}`} />
          </div>
          <div className="widget-note">
            <Rich
              text={`هر ۷ روز همان روز هفته تکرار می‌شود؛ پس فقط باقی‌ماندهٔ ${fmt(d)} بر ۷ مهم است: ${fmt(mod(d, 7))}. ${fmt(d)} روز بعد از **${DAYS[start]}** می‌شود **${DAYS[r]}**.`}
            />
          </div>
        </>
      )}
    </WidgetFrame>
  );
}

/**
 * ax + by = c on a grid: every lattice point on the line is an integer solution; the green ones are the non-negative
 * solutions word problems ask for. Shows when there is no solution ((a, b) ∤ c).
 */
export function DiophantineLab() {
  const [a, setA] = useState(4);
  const [b, setB] = useState(3);
  const [c, setC] = useState(19);
  const g = gcd(a, b);
  const ok = c % g === 0;
  const sols: [number, number][] = [];
  if (ok) for (let x = 0; x * a <= c; x++) if ((c - a * x) % b === 0) sols.push([x, (c - a * x) / b]);
  const max = Math.max(6, Math.ceil(c / Math.min(a, b)) + 1);
  const S = 240 / max;
  const X = (x: number) => 40 + x * S;
  const Y = (y: number) => 260 - y * S;
  const ticks = Array.from({ length: max + 1 }, (_, i) => i).filter((i) => max <= 12 || i % Math.ceil(max / 10) === 0);
  // A particular solution and the general one (x = x0 + (b/g)k, y = y0 − (a/g)k) when solvable.
  const first = sols[0];
  let general = '';
  if (ok) {
    let x0 = 0;
    while ((c - a * x0) % b !== 0) x0++;
    const y0 = (c - a * x0) / b;
    const kx = b / g === 1 ? 'k' : `${b / g}k`;
    const ky = a / g === 1 ? 'k' : `${a / g}k`;
    general = `x=${kx}${x0 ? `+${x0}` : ''},\\quad y=${y0 ? y0 : ''}-${ky}`;
  }
  return (
    <WidgetFrame title="معادلهٔ سیاله روی شبکه" icon="grid">
      <svg viewBox="0 0 300 280" className="plot" role="img" aria-label={`خط ${a}x+${b}y=${c} و نقطه‌های صحیح روی آن`}>
        {ticks.map((i) => (
          <g key={i}>
            <line x1={X(i)} y1={Y(0)} x2={X(i)} y2={Y(max)} stroke="var(--plot-grid)" />
            <line x1={X(0)} y1={Y(i)} x2={X(max)} y2={Y(i)} stroke="var(--plot-grid)" />
            <text x={X(i)} y={Y(0) + 14} fontSize={10} textAnchor="middle" fill="var(--ink-3)">
              {fmt(i)}
            </text>
            {i > 0 && (
              <text x={X(0) - 8} y={Y(i) + 4} fontSize={10} textAnchor="end" fill="var(--ink-3)">
                {fmt(i)}
              </text>
            )}
          </g>
        ))}
        <line x1={X(0)} y1={Y(0)} x2={X(max)} y2={Y(0)} stroke="var(--plot-axis)" strokeWidth={2} />
        <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(max)} stroke="var(--plot-axis)" strokeWidth={2} />
        <text x={X(max) - 4} y={Y(0) - 6} fontSize={12} fill="var(--ink-2)" fontWeight={700}>
          x
        </text>
        <text x={X(0) + 6} y={Y(max) + 12} fontSize={12} fill="var(--ink-2)" fontWeight={700}>
          y
        </text>
        <line x1={X(0)} y1={Y(c / b)} x2={X(c / a)} y2={Y(0)} stroke="var(--math)" strokeWidth={3} strokeLinecap="round" />
        {sols.map(([x, y]) => (
          <circle key={`${x},${y}`} cx={X(x)} cy={Y(y)} r={6} fill="var(--ok)" stroke="var(--surface)" strokeWidth={2} />
        ))}
      </svg>
      <Slider label="a (ضریب x)" value={a} min={1} max={9} step={1} onChange={setA} />
      <Slider label="b (ضریب y)" value={b} min={1} max={9} step={1} onChange={setB} />
      <Slider label="c" value={c} min={0} max={60} step={1} onChange={setC} />
      <div className="widget-formula">
        <M tex={`${a}x+${b}y=${c}`} />
        {ok && (
          <div className="widget-sub">
            <M tex={general} />
          </div>
        )}
      </div>
      <div className="widget-note">
        <Rich
          text={
            !ok
              ? `$(${a},${b})=${g}$ و $${g}\\nmid ${c}$؛ پس این معادله **هیچ جواب صحیحی ندارد** (خط از هیچ نقطهٔ شبکه نمی‌گذرد).`
              : sols.length === 0
                ? `$(${a},${b})=${g}$ عدد ${fmt(c)} را عاد می‌کند، پس جواب صحیح هست؛ ولی هیچ‌کدام در ربع اول نیست (جواب نامنفی ندارد).`
                : `$(${a},${b})=${g}\\mid ${c}$. جواب‌های نامنفی (نقطه‌های سبز): ${sols.map(([x, y]) => `$(${x},${y})$`).join('، ')}؛ یعنی **${fmt(sols.length)} طریق**. ${first ? 'با هر قدم روی خط، x به اندازهٔ b/(a,b) زیاد و y به اندازهٔ a/(a,b) کم می‌شود.' : ''}`
          }
        />
      </div>
    </WidgetFrame>
  );
}
