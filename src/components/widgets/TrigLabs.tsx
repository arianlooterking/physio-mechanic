import { useState } from 'react';
import { texNum } from '../../lib/fns';
import { Plot } from '../Plot';
import { M, Rich } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

const PI = Math.PI;
const piTicks = [-2, -1, 1, 2, 3, 4].map((k) => ({ at: k * PI, label: k === 1 ? 'π' : k === -1 ? '−π' : `${k < 0 ? '−' : ''}${Math.abs(k)}π` }));

/** A number as TeX, using π where it is a simple multiple of π. */
function piTex(v: number): string {
  const q = v / PI;
  // With |b| = 0.5, 1, …, 4 the period 2π/|b| is 4π, 2π, 4π/3, π, 4π/5, 2π/3, 4π/7 or π/2.
  for (const d of [1, 2, 3, 4, 5, 6, 7]) {
    const n = Math.round(q * d);
    if (Math.abs(q * d - n) < 1e-9 && n !== 0) {
      const sign = n < 0 ? '-' : '';
      const a = Math.abs(n);
      if (d === 1) return `${sign}${a === 1 ? '' : a}\\pi`;
      return `${sign}\\frac{${a === 1 ? '' : a}\\pi}{${d}}`;
    }
  }
  return texNum(v);
}

/**
 * y = a·sin(bx) + c (or cos): the sliders show that a sets the height, b the period 2π/|b| and c moves the
 * graph up or down; max = |a| + c, min = −|a| + c.
 */
export function TrigLab() {
  const [kind, setKind] = useState<'sin' | 'cos'>('sin');
  const [a, setA] = useState(2);
  const [b, setB] = useState(1);
  const [c, setC] = useState(0);
  const f = kind === 'sin' ? Math.sin : Math.cos;
  const T = (2 * PI) / Math.abs(b);
  const max = Math.abs(a) + c;
  const min = -Math.abs(a) + c;
  const sgn = (v: number) => (v < 0 ? '-' : '+');
  const tex = `y=${a === 1 ? '' : a === -1 ? '-' : texNum(a)}\\${kind}(${b === 1 ? '' : b === -1 ? '-' : texNum(b)}x)${c === 0 ? '' : `${sgn(c)}${texNum(Math.abs(c))}`}`;
  return (
    <WidgetFrame title="دورهٔ تناوب، ماکزیمم و مینیمم" icon="chart">
      <Seg value={kind} onChange={setKind} options={[{ v: 'sin', label: 'sin' }, { v: 'cos', label: 'cos' }]} />
      <div className="widget-formula">
        <M tex={tex} />
      </div>
      <Plot
        spec={{
          x: [-2 * PI, 4 * PI],
          y: [-6, 6],
          xStep: PI / 2,
          yStep: 1,
          height: 260,
          xTicks: piTicks,
          curves: [
            { fn: (x) => a * f(b * x) + c, color: 'main' },
            { fn: () => max, color: 'ok', dashed: true, label: 'max' },
            { fn: () => min, color: 'bad', dashed: true, label: 'min' },
          ],
        }}
      />
      <Slider label={<M tex="a" />} value={a} min={-4} max={4} step={0.5} onChange={setA} skipZero />
      <Slider label={<M tex="b" />} value={b} min={-4} max={4} step={0.5} onChange={setB} skipZero />
      <Slider label={<M tex="c" />} value={c} min={-2} max={2} step={0.5} onChange={setC} />
      <div className="widget-formula">
        {/* One line each: on a 375px phone the three side by side are about 500px wide. */}
        <M tex={`\\begin{aligned}T&=\\frac{2\\pi}{|b|}=${piTex(T)}\\\\ \\max&=|a|+c=${texNum(max)}\\\\ \\min&=-|a|+c=${texNum(min)}\\end{aligned}`} />
      </div>
      <div className="widget-note">
        <Rich text={`$a$ فقط ارتفاع را عوض می‌کند (دوره ثابت می‌ماند)، $b$ فقط دوره را و $c$ کل نمودار را بالا و پایین می‌برد. منفی شدن $a$ نمودار را نسبت به خط $y=c$ قرینه می‌کند و منفی شدن $b$ نسبت به محور $y$ها (برای کسینوس نمودار همان می‌ماند)؛ هیچ‌کدام دوره، ماکزیمم و مینیمم را عوض نمی‌کند.`} />
      </div>
    </WidgetFrame>
  );
}
