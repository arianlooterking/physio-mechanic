import { useMemo, useState } from 'react';
import type { PlotCurve, PlotSpec } from '../../content/types';
import { Plot } from '../Plot';
import { M, Rich } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

type Key = 'book' | 'sq' | 'exp' | 'step';

interface Preset {
  tex: string;
  pieces: { fn: (x: number) => number; from: number; to: number; closedFrom?: boolean; closedTo?: boolean }[];
  x: [number, number];
  y: [number, number];
  summary: string;
}

const PRESETS: Record<Key, Preset> = {
  book: {
    tex: 'f(x)=\\begin{cases}1 & x\\le -1\\\\ x^2 & x>-1\\end{cases}',
    pieces: [
      { fn: () => 1, from: -5, to: -1 },
      { fn: (x) => x * x, from: -1, to: 3 },
    ],
    x: [-5, 3],
    y: [-1, 5],
    summary: 'روی $(-\\infty,-1]$ **ثابت** است، روی $[-1,0]$ **اکیداً نزولی** و روی $[0,+\\infty)$ **اکیداً صعودی**. پس روی $(-\\infty,0]$ نزولی (ولی نه اکیداً) است.',
  },
  sq: {
    tex: 'f(x)=x^2',
    pieces: [{ fn: (x) => x * x, from: -3, to: 3 }],
    x: [-3.5, 3.5],
    y: [-1, 9],
    summary: 'روی $(-\\infty,0]$ **اکیداً نزولی** و روی $[0,+\\infty)$ **اکیداً صعودی** است؛ در کل دامنه یکنوا نیست.',
  },
  exp: {
    tex: 'f(x)=2^{-x}',
    pieces: [{ fn: (x) => 2 ** -x, from: -3.5, to: 4 }],
    x: [-3.5, 4],
    y: [-1, 9],
    summary: 'در **کل دامنه** اکیداً نزولی است؛ پس اکیداً یکنواست.',
  },
  step: {
    tex: 'f(x)=\\begin{cases}2 & x<-1\\\\ 1 & -1\\le x<1\\\\ \\frac{1-x}{2} & x\\ge 1\\end{cases}',
    pieces: [
      { fn: () => 2, from: -4, to: -1, closedTo: false },
      { fn: () => 1, from: -1, to: 1, closedFrom: true, closedTo: false },
      { fn: (x) => (1 - x) / 2, from: 1, to: 4, closedFrom: true },
    ],
    x: [-4, 4],
    y: [-2.5, 3.5],
    summary: 'با حرکت به راست، هیچ‌وقت بالا نمی‌رود؛ پس در کل دامنه **نزولی** است. ولی چون تکه‌های ثابت دارد، **اکیداً** نزولی نیست.',
  },
};

type Trend = 'up' | 'down' | 'flat';

function trendAt(p: Preset, x: number): Trend {
  const piece = p.pieces.find((q) => x >= q.from && x <= q.to);
  if (!piece) return 'flat';
  const h = 0.02;
  const a = piece.fn(Math.max(piece.from, x - h));
  const b = piece.fn(Math.min(piece.to, x + h));
  if (Math.abs(b - a) < 1e-9) return 'flat';
  return b > a ? 'up' : 'down';
}

export function MonotoneLab({ preset = 'book' }: { preset?: Key }) {
  const [key, setKey] = useState<Key>(preset);
  const p = PRESETS[key];
  const [x, setX] = useState(p.x[0] + 0.5);
  const xx = Math.min(Math.max(x, p.x[0] + 0.1), p.x[1] - 0.1);

  const spec: PlotSpec = useMemo(() => {
    const curves: PlotCurve[] = [];
    for (const piece of p.pieces) {
      // colour each stretch by its trend
      const n = 80;
      let start = piece.from;
      let cur = trendAt(p, piece.from + 1e-3);
      for (let i = 1; i <= n; i++) {
        const xi = piece.from + ((piece.to - piece.from) * i) / n;
        const t = i === n ? cur : trendAt(p, xi);
        if (t !== cur || i === n) {
          const end = i === n ? piece.to : xi;
          curves.push({
            fn: piece.fn,
            domain: [start, end],
            color: cur === 'up' ? 'ok' : cur === 'down' ? 'bad' : 'muted',
            width: 3.6,
          });
          start = end;
          cur = t;
        }
      }
      const marks: [number, number][] = [];
      const open: [number, number][] = [];
      if (piece.closedFrom === true) marks.push([piece.from, piece.fn(piece.from)]);
      if (piece.closedTo === false) open.push([piece.to, piece.fn(piece.to)]);
      if (marks.length || open.length) curves.push({ pts: [], marks, open, color: 'muted' });
    }
    const piece = p.pieces.find((q) => xx >= q.from && xx <= q.to);
    const y = piece ? piece.fn(xx) : 0;
    curves.push({ pts: [], marks: [[xx, y]], color: 'alt' });
    return { x: p.x, y: p.y, curves };
  }, [key, xx]); // p and trends depend only on key

  const t = trendAt(p, xx);
  const label = t === 'up' ? 'اینجا تابع رو به بالا می‌رود: **صعودی**' : t === 'down' ? 'اینجا تابع رو به پایین می‌رود: **نزولی**' : 'اینجا مقدار تابع عوض نمی‌شود: **ثابت**';

  return (
    <WidgetFrame title="روی نمودار راه برو (از چپ به راست)" icon="eye">
      <Seg
        value={key}
        onChange={(v) => {
          setKey(v);
          setX(PRESETS[v].x[0] + 0.5);
        }}
        options={[
          { v: 'book', label: 'مثال کتاب' },
          { v: 'sq', label: <M tex="x^2" /> },
          { v: 'exp', label: <M tex="2^{-x}" /> },
          { v: 'step', label: 'پله‌ای' },
        ]}
      />
      <div className="widget-formula">
        <M tex={p.tex} />
      </div>
      <Plot spec={spec} />
      <div className="legend">
        <span>
          <i style={{ background: 'var(--ok)' }} />
          صعودی
        </span>
        <span>
          <i style={{ background: 'var(--bad)' }} />
          نزولی
        </span>
        <span>
          <i style={{ background: 'var(--ink-3)' }} />
          ثابت
        </span>
      </div>
      <Slider label={<M tex="x" />} value={Math.round(xx * 10) / 10} min={p.x[0] + 0.1} max={p.x[1] - 0.1} step={0.1} onChange={setX} />
      <div className="widget-note">
        <Rich text={label} />
      </div>
      <div className="widget-note">
        <Rich text={p.summary} />
      </div>
    </WidgetFrame>
  );
}
