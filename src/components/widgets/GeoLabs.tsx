import { useEffect, useState } from 'react';
import { fmt } from '../../lib/digits';
import { Plot } from '../Plot';
import { M, Rich } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Angle at P between rays PA and PB, in degrees. */
function angleAt(P: [number, number], A: [number, number], B: [number, number]): number {
  const u = [A[0] - P[0], A[1] - P[1]];
  const v = [B[0] - P[0], B[1] - P[1]];
  const c = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]));
  return deg(Math.acos(Math.max(-1, Math.min(1, c))));
}

/**
 * A whole-number cell from −9 to 9. It keeps what is typed as text, so «-» can be typed before the digit,
 * and uses a text keyboard because the iPhone number pad has no minus key.
 */
function NumCell({ value, onChange, label, className = 'mat-cell' }: { value: number; onChange: (v: number) => void; label: string; className?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      className={className}
      type="text"
      inputMode="text"
      dir="ltr"
      value={text}
      aria-label={label}
      onChange={(e) => {
        const t = e.target.value.replace(/[−–]/g, '-').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
        setText(t);
        if (/^-?\d+$/.test(t)) onChange(Math.max(-9, Math.min(9, Number(t))));
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

type Mat = number[][];
const mul = (A: Mat, B: Mat): Mat => A.map((row) => B[0].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)));

const A0: Mat = [
  [1, 2],
  [3, -1],
];
const B0: Mat = [
  [2, 0],
  [1, 4],
];

/** 2×2 matrix product: tap a cell of AB to see which row of A meets which column of B; compare with BA. */
export function MatrixLab() {
  const [A, setA] = useState<Mat>(A0);
  const [B, setB] = useState<Mat>(B0);
  const [cell, setCell] = useState<[number, number]>([0, 0]);
  const AB = mul(A, B);
  const BA = mul(B, A);
  const [i, j] = cell;
  const same = AB.every((r, x) => r.every((v, y) => v === BA[x][y]));
  const edit = (which: 'A' | 'B', r: number, c: number, v: number) => {
    const set = which === 'A' ? setA : setB;
    set((m) => m.map((row, x) => row.map((val, y) => (x === r && y === c ? v : val))));
  };
  const grid = (m: Mat, which: 'A' | 'B') => (
    <div className="mat">
      {m.map((row, r) =>
        row.map((v, c) => {
          const lit = which === 'A' ? r === i : c === j;
          return (
            <NumCell
              key={`${r}${c}`}
              className={`mat-cell${lit ? ' lit' : ''}`}
              value={v}
              label={`درایهٔ سطر ${r + 1} و ستون ${c + 1} ماتریس ${which}`}
              onChange={(n) => edit(which, r, c, n)}
            />
          );
        }),
      )}
    </div>
  );
  const out = (m: Mat, pickable: boolean) => (
    <div className="mat">
      {m.map((row, r) =>
        row.map((v, c) => (
          <button key={`${r}${c}`} className={`mat-cell out${pickable && r === i && c === j ? ' lit' : ''}`} disabled={!pickable} onClick={() => setCell([r, c])} dir="ltr">
            {v}
          </button>
        )),
      )}
    </div>
  );
  return (
    <WidgetFrame title="ضرب ماتریس‌ها: سطر در ستون" icon="grid">
      <div className="mat-row" dir="ltr">
        <span className="mat-name">A</span>
        {grid(A, 'A')}
        <span className="mat-op">×</span>
        <span className="mat-name">B</span>
        {grid(B, 'B')}
        <span className="mat-op">=</span>
        {out(AB, true)}
      </div>
      <div className="widget-formula">
        <M tex={`c_{${i + 1}${j + 1}}=(${A[i][0]})(${B[0][j]})+(${A[i][1]})(${B[1][j]})=${AB[i][j]}`} />
      </div>
      <div className="mat-row small" dir="ltr">
        <span className="mat-name">BA =</span>
        {out(BA, false)}
      </div>
      <div className="graph-tools">
        <button onClick={() => (setA(A0), setB(B0), setCell([0, 0]))}>از نو</button>
      </div>
      <div className="widget-note">
        <Rich
          text={`روی هر خانهٔ حاصل‌ضرب بزن: سطر ${i + 1} از A در ستون ${j + 1} از B ضرب می‌شود (درایه‌به‌درایه و جمع). عددها را عوض کن. ${same ? 'این بار $AB=BA$ شد؛ ولی این اتفاقی است!' : 'ببین $AB\\ne BA$؛ ضرب ماتریس‌ها جابه‌جایی ندارد.'}`}
        />
      </div>
    </WidgetFrame>
  );
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
/** p/q in lowest terms as TeX. */
function frac(p: number, q: number): string {
  if (q < 0) [p, q] = [-p, -q];
  const g = gcd(p, q) || 1;
  [p, q] = [p / g, q / g];
  return q === 1 ? `${p}` : `${p < 0 ? '-' : ''}\\frac{${Math.abs(p)}}{${q}}`;
}

/**
 * Inverse of a 2×2 matrix and the system AX=B it solves: the determinant decides between one solution
 * (crossing lines), none (parallel lines) and infinitely many (the same line).
 */
export function SystemLab() {
  const [m, setM] = useState([3, -4, -1, 2]);
  const [e, setE] = useState([1, 1]);
  const [a, b, c, d] = m;
  const det = a * d - b * c;
  const cell = (v: number, set: (v: number) => void, label: string) => <NumCell value={v} onChange={set} label={label} />;
  const setAt = (i: number) => (v: number) => setM((s) => s.map((x, k) => (k === i ? v : x)));
  const setB = (i: number) => (v: number) => setE((s) => s.map((x, k) => (k === i ? v : x)));
  // Lines a·x+b·y=e1 and c·x+d·y=e2 as curves (vertical lines become two-point polylines).
  const line = (p: number, q: number, r: number, color: 'main' | 'alt', label: string) =>
    q !== 0 ? { fn: (x: number) => (r - p * x) / q, color, label } : p !== 0 ? { pts: [[r / p, -8], [r / p, 8]] as [number, number][], color, label } : { pts: [] as [number, number][], color };
  const x = det !== 0 ? (e[0] * d - b * e[1]) / det : NaN;
  const y = det !== 0 ? (a * e[1] - c * e[0]) / det : NaN;
  // Same line when one row (with its right side) is a multiple of the other.
  const same = det === 0 && a * e[1] - c * e[0] === 0 && b * e[1] - d * e[0] === 0 && (a || b) && (c || d);
  // A row of zero coefficients is no line at all: 0=k never holds, 0=0 always does.
  const zero1 = !a && !b;
  const zero2 = !c && !d;
  const verdict =
    det !== 0
      ? `$|A|=${det}\\ne0$: دو خط **متقاطع‌اند** و دستگاه یک جواب دارد: $x=${frac(e[0] * d - b * e[1], det)}$ و $y=${frac(a * e[1] - c * e[0], det)}$.`
      : (zero1 && e[0]) || (zero2 && e[1])
        ? `$|A|=0$ و یک معادله شده $0x+0y=${zero1 && e[0] ? e[0] : e[1]}$ که هیچ‌وقت درست نیست: دستگاه **هیچ جوابی ندارد** و $A$ وارون ندارد.`
        : zero1 || zero2
          ? `$|A|=0$ و یک معادله شده $0x+0y=0$ که همیشه درست است: هر نقطهٔ ${zero1 && zero2 ? 'صفحه' : 'خط دیگر'} جواب است، پس دستگاه **بی‌شمار جواب** دارد.`
          : same
            ? '$|A|=0$ و دو خط **بر هم منطبق‌اند**: دستگاه بی‌شمار جواب دارد.'
            : '$|A|=0$ و دو خط **موازی‌اند**: دستگاه هیچ جوابی ندارد و $A$ وارون ندارد.';
  return (
    <WidgetFrame title="وارون ماتریس و حل دستگاه" icon="grid">
      <div className="mat-row" dir="ltr">
        <span className="mat-name">A</span>
        <div className="mat">
          {cell(a, setAt(0), 'ضریب x در معادلهٔ اول')}
          {cell(b, setAt(1), 'ضریب y در معادلهٔ اول')}
          {cell(c, setAt(2), 'ضریب x در معادلهٔ دوم')}
          {cell(d, setAt(3), 'ضریب y در معادلهٔ دوم')}
        </div>
        <span className="mat-op">X =</span>
        <div className="mat" style={{ gridTemplateColumns: '1fr' }}>
          {cell(e[0], setB(0), 'سمت راست معادلهٔ اول')}
          {cell(e[1], setB(1), 'سمت راست معادلهٔ دوم')}
        </div>
      </div>
      <div className="graph-tools">
        <button onClick={() => (setM([3, -4, -1, 2]), setE([1, 1]))}>از نو</button>
      </div>
      <div className="widget-formula">
        <M tex={`|A|=(${a})(${d})-(${b})(${c})=${det}`} />
      </div>
      {det !== 0 && (
        <div className="widget-formula">
          <M tex={`A^{-1}=\\frac{1}{${det}}\\begin{bmatrix}${d}&${-b}\\\\${-c}&${a}\\end{bmatrix}=\\begin{bmatrix}${frac(d, det)}&${frac(-b, det)}\\\\${frac(-c, det)}&${frac(a, det)}\\end{bmatrix}`} />
        </div>
      )}
      <Plot
        spec={{
          x: [-8, 8],
          y: [-8, 8],
          step: 2,
          height: 300,
          curves: [line(a, b, e[0], 'main', 'معادلهٔ ۱'), line(c, d, e[1], 'alt', 'معادلهٔ ۲'), ...(det !== 0 && Math.abs(x) <= 8 && Math.abs(y) <= 8 ? [{ pts: [] as [number, number][], marks: [[x, y]] as [number, number][], color: 'ok' as const }] : [])],
        }}
      />
      <div className="widget-note">
        <Rich text={`${verdict} ضریب‌ها را عوض کن و ببین کِی خط‌ها موازی یا منطبق می‌شوند (مثلاً سطر دوم را مضربی از سطر اول کن).`} />
      </div>
    </WidgetFrame>
  );
}

/**
 * Inscribed angle = half the opposite arc: move P around the circle and the angle APB does not change
 * while P stays on the same side. A second mode shows the tangent-chord («ظلی») angle.
 */
export function InscribedLab() {
  const [mode, setMode] = useState<'inscribed' | 'tangent'>('inscribed');
  const [arc, setArc] = useState(100);
  const [p, setP] = useState(250);
  const R = 100;
  const cx = 150;
  const cy = 140;
  // A and B sit symmetric about the top; the arc AB measured through the top is `arc`.
  const aA = 90 + arc / 2;
  const aB = 90 - arc / 2;
  const pt = (a: number): [number, number] => [cx + R * Math.cos(rad(a)), cy - R * Math.sin(rad(a))];
  const A = pt(aA);
  const B = pt(aB);
  const P = pt(p);
  // Is P on the arc through the top (between aB and aA)?
  const norm = (a: number) => ((a % 360) + 360) % 360;
  const onTop = norm(p - aB) <= arc;
  const opposite = onTop ? 360 - arc : arc;
  const angP = mode === 'inscribed' ? angleAt(P, A, B) : 0;
  // Tangent at A (perpendicular to OA) for the «ظلی» mode.
  const tdir: [number, number] = [Math.sin(rad(aA)), Math.cos(rad(aA))];
  const T1: [number, number] = [A[0] + tdir[0] * 80, A[1] + tdir[1] * 80];
  const T2: [number, number] = [A[0] - tdir[0] * 80, A[1] - tdir[1] * 80];
  const big = arc > 180 ? 1 : 0;
  const arcPath = `M${A[0]} ${A[1]} A${R} ${R} 0 ${big} 1 ${B[0]} ${B[1]}`;
  const near = (Q: [number, number]) => <circle cx={Q[0]} cy={Q[1]} r="6" fill="var(--plot-main)" stroke="var(--surface)" strokeWidth="2" />;

  return (
    <WidgetFrame title="زاویه‌ها در دایره" icon="eye">
      <Seg
        value={mode}
        onChange={setMode}
        options={[
          { v: 'inscribed', label: 'زاویهٔ محاطی' },
          { v: 'tangent', label: 'زاویهٔ ظلی' },
        ]}
      />
      <svg viewBox="0 0 300 280" className="plot" role="img" aria-label="دایره، کمان AB و زاویه‌ای که روبه‌روی آن است">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--plot-axis)" strokeWidth="2" />
        <path d={arcPath} fill="none" stroke="var(--plot-alt)" strokeWidth="7" strokeLinecap="round" opacity="0.85" />
        <line x1={cx} y1={cy} x2={A[0]} y2={A[1]} stroke="var(--ink-3)" strokeDasharray="4 4" />
        <line x1={cx} y1={cy} x2={B[0]} y2={B[1]} stroke="var(--ink-3)" strokeDasharray="4 4" />
        <circle cx={cx} cy={cy} r="3.5" fill="var(--ink-2)" />
        {mode === 'inscribed' ? (
          <>
            <line x1={P[0]} y1={P[1]} x2={A[0]} y2={A[1]} stroke="var(--plot-base)" strokeWidth="3" />
            <line x1={P[0]} y1={P[1]} x2={B[0]} y2={B[1]} stroke="var(--plot-base)" strokeWidth="3" />
            {near(P)}
            <text x={P[0] + (P[0] < cx ? -16 : 10)} y={P[1] + 16} fontSize="14" fontWeight="800" fill="var(--ink)">
              P
            </text>
          </>
        ) : (
          <>
            <line x1={T1[0]} y1={T1[1]} x2={T2[0]} y2={T2[1]} stroke="var(--ok)" strokeWidth="3" />
            <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke="var(--plot-base)" strokeWidth="3" />
            <text x={T1[0] - 14} y={T1[1] + 4} fontSize="14" fontWeight="800" fill="var(--ok)">
              T
            </text>
          </>
        )}
        {near(A)}
        {near(B)}
        <text x={A[0] - 18} y={A[1] - 6} fontSize="14" fontWeight="800" fill="var(--ink)">
          A
        </text>
        <text x={B[0] + 8} y={B[1] - 6} fontSize="14" fontWeight="800" fill="var(--ink)">
          B
        </text>
        <text x={cx + 6} y={cy + 16} fontSize="12" fill="var(--ink-2)">
          O
        </text>
      </svg>
      <Slider label="کمان AB (بنفش)" value={arc} min={30} max={300} step={5} onChange={setArc} format={(v) => `${fmt(v)}°`} />
      {mode === 'inscribed' && <Slider label="جای P روی دایره" value={p} min={0} max={355} step={5} onChange={setP} format={(v) => `${fmt(v)}°`} />}
      <div className="widget-formula">
        {mode === 'inscribed' ? (
          <M tex={`\\widehat{APB}=\\dfrac{${Math.round(opposite)}^\\circ}{2}=${fmt(Math.round(angP * 10) / 10, 1)}^\\circ`} />
        ) : (
          <M tex={`\\widehat{TAB}=\\dfrac{\\widehat{AB}}{2}=\\dfrac{${arc}^\\circ}{2}=${arc / 2}^\\circ`} />
        )}
      </div>
      <div className="widget-note">
        <Rich
          text={
            mode === 'inscribed'
              ? onTop
                ? `P روی کمان بنفش است، پس کمانِ روبه‌روی زاویه، کمانِ دیگر ($${360 - arc}^\\circ$) است. زاویهٔ P نصف آن است.`
                : `P را روی کمان پایینی جابه‌جا کن: زاویهٔ P عوض نمی‌شود! همیشه نصف کمان روبه‌رو ($${arc}^\\circ$) است. زاویهٔ مرکزی AOB خودِ کمان است.`
              : 'خط سبز در A بر شعاع OA عمود است (مماس). زاویهٔ بین مماس و وتر AB هم نصف کمانِ داخل آن است؛ درست مثل زاویهٔ محاطی.'
          }
        />
      </div>
    </WidgetFrame>
  );
}
