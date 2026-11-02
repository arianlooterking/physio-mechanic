import { useState } from 'react';
import { fmt, texOf } from '../../lib/digits';
import { Plot } from '../Plot';
import { M, Rich } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

export function CubeCompare() {
  const [zoom, setZoom] = useState<'all' | 'zoom'>('all');
  const [x, setX] = useState(0.5);
  const big = zoom === 'all';
  const xr: [number, number] = big ? [-2.2, 2.2] : [0, 1.2];
  const yr: [number, number] = big ? [-8.5, 8.5] : [0, 1.3];
  const xx = big ? x : Math.min(x, 1.2);
  const a = xx * xx;
  const b = xx * xx * xx;
  const cmp = Math.abs(a - b) < 1e-9 ? 'برابرند' : b < a ? 'x³ پایین‌تر است' : 'x³ بالاتر است';

  return (
    <WidgetFrame title="مقایسهٔ y = x² و y = x³" icon="eye">
      <Seg
        value={zoom}
        onChange={setZoom}
        options={[
          { v: 'all', label: 'نمای کامل' },
          { v: 'zoom', label: 'ذره‌بین روی (۰، ۱)' },
        ]}
      />
      <Plot
        spec={{
          x: xr,
          y: yr,
          step: big ? 1 : 0.2,
          height: big ? 360 : 300,
          curves: [
            { fn: (t) => t * t, color: 'base', label: 'y=x²' },
            { fn: (t) => t * t * t, color: 'main', label: 'y=x³' },
            { pts: [], marks: [[xx, a]], color: 'base' },
            { pts: [], marks: [[xx, b]], color: 'main' },
          ],
          xTicks: big ? undefined : [0.2, 0.4, 0.6, 0.8, 1].map((t) => ({ at: t, label: fmt(t) })),
          yTicks: big ? undefined : [0.2, 0.4, 0.6, 0.8, 1].map((t) => ({ at: t, label: fmt(t) })),
        }}
      />
      <Slider label={<M tex="x" />} value={xx} min={big ? -2 : 0.05} max={big ? 2 : 1.2} step={0.05} onChange={setX} />
      <div className="widget-note">
        <Rich
          text={`$x=${texOf(xx)}$:  $x^2=${texOf(a, 3)}$ و $x^3=${texOf(b, 3)}$ → ${cmp}`}
        />
      </div>
      <div className="widget-note">
        <Rich text="روی $(0,1)$ توان بالاتر **کوچک‌تر** است (مثلاً $0{\dec}5^3=0{\dec}125<0{\dec}25$)، ولی روی $(1,+\infty)$ بزرگ‌تر است. دو نمودار در $x=0$ و $x=1$ به هم می‌رسند." />
      </div>
    </WidgetFrame>
  );
}
