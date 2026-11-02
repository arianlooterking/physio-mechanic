import { useEffect, useRef, useState } from 'react';
import { fmt, texOf } from '../../lib/digits';
import { Plot } from '../Plot';
import { M, Rich } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

const num = (n: number, d = 2) => texOf(n, d);

function usePlayer(max: number, speed = 1) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    const tick = (now: number) => {
      if (last.current !== null) {
        const dt = ((now - last.current) / 1000) * speed;
        setT((prev) => {
          const next = prev + dt;
          if (next >= max) {
            setPlaying(false);
            return max;
          }
          return next;
        });
      }
      last.current = now;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      last.current = null;
    };
  }, [playing, max, speed]);
  return {
    t,
    setT: (v: number) => {
      setPlaying(false);
      setT(v);
    },
    playing,
    toggle: () => {
      if (!playing && t >= max) setT(0);
      setPlaying((p) => !p);
    },
  };
}

function PlayButton({ playing, onClick }: { playing: boolean; onClick: () => void }) {
  return (
    <button className="btn sm soft" onClick={onClick} style={{ minWidth: 96 }}>
      {playing ? '⏸ مکث' : '▶ پخش'}
    </button>
  );
}

/* ---------------- distance vs displacement ---------------- */

const ROUTE = { x0: 1, turn: 8, end: 4, speed: 1 };
const T1 = (ROUTE.turn - ROUTE.x0) / ROUTE.speed; // 7 s
const T_END = T1 + (ROUTE.turn - ROUTE.end) / ROUTE.speed; // 11 s

function routeX(t: number) {
  if (t <= T1) return ROUTE.x0 + ROUTE.speed * t;
  return ROUTE.turn - ROUTE.speed * (t - T1);
}

export function MotionLab({ graph = false }: { graph?: boolean }) {
  const p = usePlayer(T_END, 1.6);
  const t = p.t;
  const x = routeX(t);
  const dist = ROUTE.speed * t;
  const disp = x - ROUTE.x0;

  const W = 360;
  const H = 150;
  const xmin = -1;
  const xmax = 10;
  const sx = (v: number) => 20 + ((v - xmin) * (W - 40)) / (xmax - xmin);
  const trackY = 108;
  const goneTo = Math.min(x, ROUTE.turn);

  return (
    <WidgetFrame title="مسیر یک دونده روی خط راست" icon="eye">
      <svg viewBox={`0 0 ${W} ${H}`} className="plot" role="img" aria-label="دونده روی محور x">
        <defs>
          <marker id="ml-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" fill="var(--bad)" />
          </marker>
        </defs>
        <line x1={sx(xmin)} x2={sx(xmax)} y1={trackY} y2={trackY} stroke="var(--plot-axis)" strokeWidth="2" />
        {Array.from({ length: xmax - xmin + 1 }, (_, i) => xmin + i).map((v) => (
          <g key={v}>
            <line x1={sx(v)} x2={sx(v)} y1={trackY - 4} y2={trackY + 4} stroke="var(--plot-axis)" strokeWidth="1.5" />
            <text x={sx(v)} y={trackY + 20} textAnchor="middle" fontSize="11" fill="var(--plot-axis)" direction="ltr">
              {v < 0 ? `−${-v}` : v}
            </text>
          </g>
        ))}
        <text x={sx(xmax)} y={trackY + 36} textAnchor="end" fontSize="11" fill="var(--ink-3)">
          x (m)
        </text>
        {/* travelled route */}
        <path
          d={`M${sx(ROUTE.x0)} ${trackY - 26} L${sx(goneTo)} ${trackY - 26}${t > T1 ? ` Q${sx(ROUTE.turn) + 14} ${trackY - 34} ${sx(ROUTE.turn)} ${trackY - 42} L${sx(x)} ${trackY - 42}` : ''}`}
          fill="none"
          stroke="var(--plot-base)"
          strokeWidth="3.5"
          strokeDasharray="6 5"
          strokeLinecap="round"
        />
        {/* displacement arrow */}
        {Math.abs(disp) > 0.05 && (
          <line x1={sx(ROUTE.x0)} x2={sx(x)} y1={trackY - 8} y2={trackY - 8} stroke="var(--bad)" strokeWidth="3.5" markerEnd="url(#ml-ar)" />
        )}
        <circle cx={sx(ROUTE.x0)} cy={trackY} r="5" fill="var(--ok)" />
        <text x={sx(ROUTE.x0)} y={trackY + 36} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--ok)">
          شروع
        </text>
        {/* runner */}
        <g transform={`translate(${sx(x)} ${trackY - 70})`}>
          <circle r="11" fill="var(--primary)" />
          <text y="5" textAnchor="middle" fontSize="13" fill="#fff">
            {t <= T1 ? '→' : '←'}
          </text>
        </g>
      </svg>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--plot-base)' }} />
          مسیر طی‌شده (مسافت)
        </span>
        <span>
          <i style={{ background: 'var(--bad)' }} />
          بردار جابه‌جایی
        </span>
      </div>
      <div className="row">
        <PlayButton playing={p.playing} onClick={p.toggle} />
        <div className="grow">
          <Slider label={<M tex="t" />} value={Math.round(t * 10) / 10} min={0} max={T_END} step={0.1} onChange={p.setT} format={(v) => `${fmt(v, 1)} s`} />
        </div>
      </div>
      <div className="widget-note">
        <Rich
          text={`مکان: $x=${num(x, 1)}\\,\\text{m}$ — مسافت طی‌شده: $\\ell=${num(dist, 1)}\\,\\text{m}$ — جابه‌جایی: $\\Delta x=${num(disp, 1)}\\,\\text{m}$`}
        />
      </div>
      {t >= T_END - 1e-6 && (
        <div className="widget-note">
          <Rich
            text={`در کل مسیر: تندی متوسط $s_{av}=\\dfrac{${T_END}\\,\\text{m}}{${T_END}\\,\\text{s}}=1\\,\\text{m/s}$ ولی سرعت متوسط $v_{av}=\\dfrac{3\\,\\text{m}}{${T_END}\\,\\text{s}}\\approx${num(3 / T_END, 2)}\\,\\text{m/s}$. چون دونده برگشته، مسافت از اندازهٔ جابه‌جایی بیشتر شد.`}
          />
        </div>
      )}
      {graph && (
        <Plot
          spec={{
            x: [0, 12],
            y: [0, 9],
            axisNames: ['t (s)', 'x (m)'],
            curves: [
              { fn: routeX, domain: [0, T_END], color: 'muted', dashed: true, width: 2 },
              { fn: routeX, domain: [0, Math.max(0.01, t)], color: 'main', marks: [[t, x]] },
            ],
          }}
          label="نمودار مکان-زمان دونده"
        />
      )}
    </WidgetFrame>
  );
}

/* ---------------- secant → tangent ---------------- */

const xt = (t: number) => -0.75 * t * t + 3 * t + 1;
const vt = (t: number) => -1.5 * t + 3;

export function SlopeLab({ kind = 'x' }: { kind?: 'x' | 'v' }) {
  const [t1, setT1] = useState(0.5);
  const [dt, setDt] = useState(2);
  const f = kind === 'x' ? xt : (t: number) => 2 + 6 * Math.sin((t * Math.PI) / 9) - 0.15 * t * t;
  const fprime = kind === 'x' ? vt : (t: number) => ((6 * Math.PI) / 9) * Math.cos((t * Math.PI) / 9) - 0.3 * t;
  const tmax = kind === 'x' ? 4.4 : 9;
  const t2 = Math.min(tmax, t1 + dt);
  const A: [number, number] = [t1, f(t1)];
  const B: [number, number] = [t2, f(t2)];
  const sec = (B[1] - A[1]) / (t2 - t1);
  const tan = fprime(t1);
  const unit = kind === 'x' ? '\\text{m/s}' : '\\text{m/s}^2';
  const qty = kind === 'x' ? 'v' : 'a';
  const yr: [number, number] = kind === 'x' ? [-1, 5.5] : [-1, 9];

  return (
    <WidgetFrame title={kind === 'x' ? 'از سرعت متوسط تا سرعت لحظه‌ای' : 'از شتاب متوسط تا شتاب لحظه‌ای'} icon="eye">
      <Plot
        spec={{
          x: [0, tmax],
          y: yr,
          axisNames: ['t (s)', kind === 'x' ? 'x (m)' : 'v (m/s)'],
          curves: [
            { fn: f, color: 'base', width: 3 },
            { fn: (t) => A[1] + sec * (t - t1), color: 'ok', width: 2.4 },
            { fn: (t) => A[1] + tan * (t - t1), color: 'alt', width: 2, dashed: true },
            { pts: [], marks: [A, B], color: 'main' },
          ],
          labels: [
            [A[0], A[1], 'A'],
            [B[0], B[1], 'B'],
          ],
        }}
      />
      <div className="legend">
        <span>
          <i style={{ background: 'var(--ok)' }} />
          پاره‌خط AB (متوسط)
        </span>
        <span>
          <i style={{ background: 'var(--plot-alt)' }} />
          خط مماس در A (لحظه‌ای)
        </span>
      </div>
      <Slider label={<M tex="t_1" />} value={t1} min={0} max={kind === 'x' ? 3.5 : 7.5} step={0.1} onChange={setT1} format={(v) => `${fmt(v, 1)} s`} />
      <Slider label={<M tex="\Delta t" />} value={dt} min={0.05} max={3} step={0.05} onChange={setDt} format={(v) => `${fmt(v, 2)} s`} />
      <div className="widget-note">
        <Rich
          text={`شیب AB: $${qty}_{av}=\\dfrac{\\Delta ${kind}}{\\Delta t}\\approx ${num(sec)}\\,${unit}$ — شیب مماس: $${qty}(t_1)\\approx ${num(tan)}\\,${unit}$`}
        />
      </div>
      <div className="widget-note">
        <Rich text={`$\\Delta t$ را کم و کم‌تر کن: نقطهٔ B به A نزدیک می‌شود، پاره‌خط سبز روی خط مماس می‌خوابد و ${kind === 'x' ? 'سرعت متوسط به سرعت لحظه‌ای' : 'شتاب متوسط به شتاب لحظه‌ای'} می‌رسد.`} />
      </div>
    </WidgetFrame>
  );
}

/* ---------------- x = vt + x0 ---------------- */

export function ConstantVelocity() {
  const [v, setV] = useState(2);
  const [x0, setX0] = useState(-10);
  const p = usePlayer(10, 2);
  const t = p.t;
  const x = v * t + x0;
  const [view, setView] = useState<'x' | 'v'>('x');
  const W = 360;
  const sx = (val: number) => 20 + ((val + 40) * (W - 40)) / 80;

  return (
    <WidgetFrame title="حرکت با سرعت ثابت: x = vt + x₀" icon="eye">
      <svg viewBox={`0 0 ${W} 70`} className="plot" role="img" aria-label="متحرک روی محور x">
        <line x1={sx(-40)} x2={sx(40)} y1={44} y2={44} stroke="var(--plot-axis)" strokeWidth="2" />
        {[-40, -30, -20, -10, 0, 10, 20, 30, 40].map((val) => (
          <g key={val}>
            <line x1={sx(val)} x2={sx(val)} y1={40} y2={48} stroke="var(--plot-axis)" strokeWidth="1.5" />
            <text x={sx(val)} y={63} textAnchor="middle" fontSize="10" fill="var(--plot-axis)" direction="ltr">
              {val < 0 ? `−${-val}` : val}
            </text>
          </g>
        ))}
        <circle cx={sx(x0)} cy={44} r="4" fill="var(--ok)" />
        {x >= -40 && x <= 40 && (
          <g transform={`translate(${sx(x)} 24)`}>
            <circle r="10" fill="var(--plot-main)" />
            <text y="4.5" textAnchor="middle" fontSize="12" fill="#fff">
              {v >= 0 ? '→' : '←'}
            </text>
          </g>
        )}
      </svg>
      <div className="widget-formula">
        <M tex={`x=${num(v)}\\,t${x0 < 0 ? '' : '+'}${num(x0)}`} />
      </div>
      <Seg
        value={view}
        onChange={setView}
        options={[
          { v: 'x', label: 'نمودار مکان-زمان' },
          { v: 'v', label: 'نمودار سرعت-زمان' },
        ]}
      />
      {view === 'x' ? (
        <Plot
          spec={{
            x: [0, 10],
            y: [-40, 40],
            xStep: 1,
            yStep: 10,
            height: 260,
            axisNames: ['t (s)', 'x (m)'],
            curves: [{ fn: (s) => v * s + x0, color: 'main', marks: [[t, x]] }],
          }}
        />
      ) : (
        <Plot
          spec={{
            x: [0, 10],
            y: [-5, 5],
            height: 220,
            axisNames: ['t (s)', 'v (m/s)'],
            curves: [{ fn: () => v, color: 'alt' }],
          }}
        />
      )}
      <Slider label={<M tex="v" />} value={v} min={-5} max={5} step={0.5} onChange={setV} format={(val) => `${fmt(val)} m/s`} />
      <Slider label={<M tex="x_0" />} value={x0} min={-30} max={30} step={5} onChange={setX0} format={(val) => `${fmt(val)} m`} />
      <div className="row">
        <PlayButton playing={p.playing} onClick={p.toggle} />
        <div className="grow">
          <Slider label={<M tex="t" />} value={Math.round(t * 10) / 10} min={0} max={10} step={0.1} onChange={p.setT} format={(val) => `${fmt(val, 1)} s`} />
        </div>
      </div>
      <div className="widget-note">
        <Rich
          text={`در لحظهٔ $t=${num(t, 1)}\\,\\text{s}$: $x=${num(v)}\\times${num(t, 1)}${x0 < 0 ? '' : '+'}${num(x0)}=${num(x, 1)}\\,\\text{m}$. شیب خط مکان-زمان همان $v$ است و عرض از مبدأ آن $x_0$.`}
        />
      </div>
    </WidgetFrame>
  );
}

/* ---------------- Coulomb's law ---------------- */

/** Two point charges: like charges repel, unlike attract; F = k|q1||q2|/r², so doubling r quarters F. */
export function CoulombLab() {
  const [q1, setQ1] = useState(2);
  const [q2, setQ2] = useState(-3);
  const [r, setR] = useState(30);
  const k = 9e9;
  const F = (k * Math.abs(q1 * 1e-6) * Math.abs(q2 * 1e-6)) / (r / 100) ** 2;
  const repel = q1 * q2 > 0;
  const W = 340;
  const cx = W / 2;
  const half = 25 + (r / 60) * 110;
  const x1 = cx - half;
  const x2 = cx + half;
  const len = Math.min(70, 8 + 22 * Math.log10(1 + F * 4));
  const dir = repel ? -1 : 1; // arrow on q1 points away from q2 when repelling
  const charge = (x: number, q: number) => (
    <g>
      <circle cx={x} cy={60} r={12 + Math.abs(q) * 2} fill={q > 0 ? 'var(--plot-main)' : q < 0 ? 'var(--plot-base)' : 'var(--ink-3)'} />
      <text x={x} y={66} textAnchor="middle" fontSize="18" fontWeight="900" fill="#fff">
        {q > 0 ? '+' : q < 0 ? '−' : '0'}
      </text>
    </g>
  );
  const arrow = (x: number, d: number) =>
    q1 === 0 || q2 === 0 ? null : (
      <g stroke="var(--ok)" strokeWidth="4" strokeLinecap="round" fill="var(--ok)">
        <line x1={x} y1={22} x2={x + d * len} y2={22} />
        <path d={`M${x + d * len} 22 l${d > 0 ? -9 : 9} -6 v12z`} stroke="none" />
      </g>
    );
  return (
    <WidgetFrame title="قانون کولن: دو بار نقطه‌ای" icon="eye">
      <svg viewBox={`0 0 ${W} 110`} className="plot" role="img" aria-label="دو بار الکتریکی و نیرویی که به هم وارد می‌کنند">
        <line x1={x1} x2={x2} y1={96} y2={96} stroke="var(--ink-3)" strokeDasharray="4 4" />
        <text x={cx} y={92} textAnchor="middle" fontSize="12" fill="var(--ink-2)" direction="ltr">
          {`r = ${r} cm`}
        </text>
        {charge(x1, q1)}
        {charge(x2, q2)}
        {arrow(x1, dir)}
        {arrow(x2, -dir)}
      </svg>
      <Slider label={<M tex="q_1" />} value={q1} min={-5} max={5} step={1} onChange={setQ1} format={(v) => `${fmt(v)} μC`} />
      <Slider label={<M tex="q_2" />} value={q2} min={-5} max={5} step={1} onChange={setQ2} format={(v) => `${fmt(v)} μC`} />
      <Slider label={<M tex="r" />} value={r} min={5} max={60} step={5} onChange={setR} format={(v) => `${fmt(v)} cm`} />
      <div className="widget-formula">
        <M tex={`F=k\\dfrac{|q_1||q_2|}{r^2}=${num(F, F < 1 ? 3 : 2)}\\,\\text{N}`} />
      </div>
      <div className="widget-note">
        <Rich
          text={
            q1 === 0 || q2 === 0
              ? 'یکی از بارها صفر است؛ نیرویی وارد نمی‌شود.'
              : `بارها ${repel ? '**همنام**‌اند؛ نیرو **دافعه** است.' : '**ناهمنام**‌اند؛ نیرو **جاذبه** است.'} دو نیرو هم‌اندازه و خلاف جهت‌اند (قانون سوم نیوتون). فاصله را دو برابر کن: نیرو $\\tfrac14$ می‌شود.`
          }
        />
      </div>
    </WidgetFrame>
  );
}

/* ---------------- constant acceleration ---------------- */

/** Track drawn above the graphs: the moving cart with its velocity (pink) and acceleration (violet) arrows. */
function Track({ x, v, a, range = 40 }: { x: number; v: number; a: number; range?: number }) {
  const W = 360;
  const sx = (val: number) => 20 + ((val + range) * (W - 40)) / (2 * range);
  const ticks = Array.from({ length: 9 }, (_, i) => -range + (i * range) / 4);
  const arrow = (len: number, y: number, color: string) =>
    Math.abs(len) < 0.5 ? null : (
      <g stroke={color} strokeWidth="3" strokeLinecap="round" fill={color}>
        <line x1={sx(x)} x2={sx(x) + len} y1={y} y2={y} />
        <path d={`M${sx(x) + len} ${y} l${len > 0 ? -7 : 7} -5 v10z`} stroke="none" />
      </g>
    );
  return (
    <svg viewBox={`0 0 ${W} 86`} className="plot" role="img" aria-label="متحرک روی محور x با بردار سرعت و شتاب">
      <line x1={sx(-range)} x2={sx(range)} y1={62} y2={62} stroke="var(--plot-axis)" strokeWidth="2" />
      {ticks.map((val) => (
        <g key={val}>
          <line x1={sx(val)} x2={sx(val)} y1={58} y2={66} stroke="var(--plot-axis)" strokeWidth="1.5" />
          <text x={sx(val)} y={80} textAnchor="middle" fontSize="10" fill="var(--plot-axis)" direction="ltr">
            {val < 0 ? `−${-val}` : val}
          </text>
        </g>
      ))}
      {Math.abs(x) <= range && <circle cx={sx(x)} cy={46} r="10" fill="var(--plot-main)" />}
      {Math.abs(x) <= range && arrow(Math.max(-60, Math.min(60, v * 6)), 22, 'var(--plot-main)')}
      {Math.abs(x) <= range && arrow(Math.max(-40, Math.min(40, a * 10)), 10, 'var(--plot-alt)')}
    </svg>
  );
}

export function AccelMotion() {
  const [a, setA] = useState(2);
  const [v0, setV0] = useState(-4);
  const p = usePlayer(6, 1.2);
  const t = p.t;
  const v = a * t + v0;
  const x = 0.5 * a * t * t + v0 * t;
  const [view, setView] = useState<'v' | 'x'>('v');
  const state =
    Math.abs(v) < 1e-6 ? 'در این لحظه متحرک ایستاده و جهتش عوض می‌شود.' : a === 0 ? 'شتاب صفر است؛ حرکت با سرعت ثابت.' : a * v > 0 ? 'سرعت و شتاب هم‌علامت‌اند: حرکت **تندشونده** است.' : 'سرعت و شتاب ناهم‌علامت‌اند: حرکت **کندشونده** است.';

  return (
    <WidgetFrame title="حرکت با شتاب ثابت" icon="eye">
      <Track x={x} v={v} a={a} />
      <div className="widget-formula">
        <M tex={`v=${num(a)}\\,t${v0 < 0 ? '' : '+'}${num(v0)}`} />
      </div>
      <Seg
        value={view}
        onChange={setView}
        options={[
          { v: 'v', label: 'نمودار سرعت-زمان' },
          { v: 'x', label: 'نمودار مکان-زمان' },
        ]}
      />
      {view === 'v' ? (
        <Plot
          spec={{
            x: [0, 6],
            y: [-12, 12],
            xStep: 1,
            yStep: 2,
            height: 260,
            axisNames: ['t (s)', 'v (m/s)'],
            curves: [
              { fn: (s) => a * s + v0, domain: [0, Math.max(t, 0.001)], color: 'alt', fill: true, width: 0.01 },
              { fn: (s) => a * s + v0, color: 'alt', marks: [[t, v]] },
            ],
          }}
        />
      ) : (
        <Plot
          spec={{
            x: [0, 6],
            y: [-30, 40],
            xStep: 1,
            yStep: 10,
            height: 260,
            axisNames: ['t (s)', 'x (m)'],
            curves: [{ fn: (s) => 0.5 * a * s * s + v0 * s, color: 'main', marks: [[t, x]] }],
          }}
        />
      )}
      <Slider label={<M tex="a" />} value={a} min={-3} max={3} step={0.5} onChange={setA} format={(val) => `${fmt(val)} m/s²`} />
      <Slider label={<M tex="v_0" />} value={v0} min={-8} max={8} step={1} onChange={setV0} format={(val) => `${fmt(val)} m/s`} />
      <div className="row">
        <PlayButton playing={p.playing} onClick={p.toggle} />
        <div className="grow">
          <Slider label={<M tex="t" />} value={Math.round(t * 10) / 10} min={0} max={6} step={0.1} onChange={p.setT} format={(val) => `${fmt(val, 1)} s`} />
        </div>
      </div>
      <div className="widget-note">
        <Rich
          text={`در $t=${num(t, 1)}\\,\\text{s}$: سرعت $v=${num(v, 1)}\\,\\text{m/s}$ و جابه‌جایی از شروع $\\Delta x=${num(x, 1)}\\,\\text{m}$. ${view === 'v' ? 'سطح رنگی زیر نمودار سرعت-زمان (زیر محور منفی) همین جابه‌جایی است.' : 'نمودار مکان-زمان در این حرکت یک سهمی است.'} ${state}`}
        />
      </div>
    </WidgetFrame>
  );
}

/* ---------------- free fall ---------------- */

const PLANETS = { earth: { g: 9.8, label: 'زمین' }, moon: { g: 1.6, label: 'ماه' }, mars: { g: 3.7, label: 'مریخ' } };

export function FreeFall() {
  const [h, setH] = useState(45);
  const [planet, setPlanet] = useState<keyof typeof PLANETS>('earth');
  const g = PLANETS[planet].g;
  const T = Math.sqrt((2 * h) / g);
  const p = usePlayer(T, 1);
  const t = Math.min(p.t, T);
  const fallen = 0.5 * g * t * t;
  const v = -g * t;
  const H = 300;
  const top = 26;
  const sy = (d: number) => top + (d / h) * (H - top - 30);
  const ghosts = Array.from({ length: Math.floor(t / 0.5) + 1 }, (_, i) => i * 0.5).filter((s) => s < t - 0.05);

  return (
    <WidgetFrame title="سقوط آزاد: رها کن و ببین" icon="eye">
      <Seg value={planet} onChange={setPlanet} options={(Object.keys(PLANETS) as (keyof typeof PLANETS)[]).map((k) => ({ v: k, label: `${PLANETS[k].label}` }))} />
      <svg viewBox={`0 0 360 ${H}`} className="plot" role="img" aria-label="گلوله‌ای که از ارتفاع رها می‌شود">
        <rect x="40" y={top - 6} width="70" height={H - top - 18} rx="6" fill="var(--surface-3)" />
        <rect x="30" y={H - 24} width="300" height="6" rx="3" fill="var(--plot-axis)" />
        <line x1="190" x2="190" y1={top} y2={H - 24} stroke="var(--plot-grid)" strokeWidth="2" strokeDasharray="4 6" />
        {ghosts.map((s) => (
          <circle key={s} cx="190" cy={sy(0.5 * g * s * s)} r="9" fill="var(--plot-main)" opacity="0.22" />
        ))}
        <circle cx="190" cy={sy(fallen)} r="11" fill="var(--plot-main)" />
        <text x="214" y={sy(fallen) + 4} fontSize="12" fill="var(--ink-2)" direction="ltr">
          {`${fallen.toFixed(1)} m`}
        </text>
        <text x="75" y={top + 14} textAnchor="middle" fontSize="11" fill="var(--ink-2)" direction="ltr">
          {`h = ${h} m`}
        </text>
      </svg>
      <Slider label={<M tex="h" />} value={h} min={5} max={125} step={5} onChange={(val) => { setH(val); p.setT(0); }} format={(val) => `${fmt(val)} m`} />
      <div className="row">
        <PlayButton playing={p.playing} onClick={p.toggle} />
        <div className="grow">
          <Slider label={<M tex="t" />} value={Math.round(t * 100) / 100} min={0} max={Math.round(T * 100) / 100} step={0.05} onChange={p.setT} format={(val) => `${fmt(val, 2)} s`} />
        </div>
      </div>
      <div className="widget-note">
        <Rich
          text={`با $g=${num(g, 1)}\\,\\text{m/s}^2$ (رو به بالا مثبت): $v=-gt=${num(v, 1)}\\,\\text{m/s}$ و جسم $\\dfrac{1}{2}gt^2=${num(fallen, 1)}\\,\\text{m}$ پایین آمده است. زمان رسیدن به زمین: $t=\\sqrt{\\dfrac{2h}{g}}\\approx${num(T, 2)}\\,\\text{s}$. سایه‌ها هر نیم ثانیه گذاشته شده‌اند؛ فاصله‌شان مدام بیشتر می‌شود چون تندی زیاد می‌شود.`}
        />
      </div>
    </WidgetFrame>
  );
}
