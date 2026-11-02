import { useMemo, useState } from 'react';
import type { PlotSpec } from '../../content/types';
import { fmt } from '../../lib/digits';
import { argTex, BASES, outerTex, texNum, type BaseName } from '../../lib/fns';
import { Plot } from '../Plot';
import { M, Rich } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

type Mode = 'vshift' | 'hshift' | 'vscale' | 'hscale' | 'combo';

const WINDOW: Record<BaseName, { x: [number, number]; y: [number, number] }> = {
  sq: { x: [-6, 6], y: [-5, 7] },
  abs: { x: [-6, 6], y: [-5, 7] },
  sqrt: { x: [-6, 8], y: [-5, 6] },
  cube: { x: [-5, 5], y: [-6, 6] },
  sin: { x: [-7, 7], y: [-4, 4] },
  cos: { x: [-7, 7], y: [-4, 4] },
  tri: { x: [-7, 7], y: [-5, 5] },
};

const TITLES: Record<Mode, string> = {
  vshift: 'آزمایشگاه انتقال عمودی',
  hshift: 'آزمایشگاه انتقال افقی',
  vscale: 'آزمایشگاه انبساط و انقباض عمودی',
  hscale: 'آزمایشگاه انبساط و انقباض افقی',
  combo: 'آزمایشگاه ترکیب تبدیل‌ها',
};

export function TransformLab({ mode = 'vshift', base: base0 = 'sq', bases }: { mode?: Mode; base?: BaseName; bases?: BaseName[] }) {
  const [base, setBase] = useState<BaseName>(base0);
  const [k, setK] = useState(2);
  // The combo lab starts at the textbook example y = −f(x − 1) + 2.
  const [a, setA] = useState(-1);
  const [b, setB] = useState(1);
  const [c, setC] = useState(-1);
  const [d, setD] = useState(2);

  const B = BASES[base];
  const win = WINDOW[base];

  // y = A·f(Bx + C) + D for every mode.
  const [A, Bc, C, D] =
    mode === 'vshift' ? [1, 1, 0, k] : mode === 'hshift' ? [1, 1, k, 0] : mode === 'vscale' ? [k, 1, 0, 0] : mode === 'hscale' ? [1, k, 0, 0] : [a, b, c, d];

  const g = (x: number) => A * B.fn(Bc * x + C) + D;

  // Track one key point of the base graph and its image.
  const px = base === 'sqrt' ? 4 : base === 'tri' ? 1 : B.key;
  const py = B.fn(px);
  const qx = (px - C) / Bc;
  const qy = A * py + D;

  const spec: PlotSpec = useMemo(
    () => ({
      x: win.x,
      y: win.y,
      curves: [
        { fn: B.fn, color: 'base', width: 2.6, marks: [[px, py]] },
        { fn: g, color: 'main', width: 3.4, marks: [[qx, qy]] },
      ],
      arrows: Math.hypot(qx - px, qy - py) > 0.3 ? [{ from: [px, py], to: [qx, qy] }] : [],
      labels: [
        [px, py, 'P'],
        [qx, qy, "P'"],
      ],
    }),
    // Everything in the spec is derived from these values.
    [base, A, Bc, C, D],
  );

  const baseTex = `y=${B.tex('x')}`;
  const gTex = `y=${outerTex(A, B.tex(argTex(Bc, C)), D)}`;

  let note = '';
  if (mode === 'vshift') {
    note =
      k === 0
        ? 'با $k=0$ نمودار تکان نمی‌خورد.'
        : `هر نقطه ${fmt(Math.abs(k))} واحد به ${k > 0 ? '**بالا**' : '**پایین**'} رفت؛ طول نقطه‌ها عوض نشد. $P(${texNum(px)},${texNum(py)})\\to P'(${texNum(qx)},${texNum(qy)})$`;
  } else if (mode === 'hshift') {
    note =
      k === 0
        ? 'با $k=0$ نمودار تکان نمی‌خورد.'
        : `با $k=${texNum(k)}$ نمودار ${fmt(Math.abs(k))} واحد به ${k > 0 ? '**چپ**' : '**راست**'} رفت (برعکسِ علامت k!). $P(${texNum(px)},${texNum(py)})\\to P'(${texNum(qx)},${texNum(qy)})$`;
  } else if (mode === 'vscale') {
    const kind = Math.abs(k) > 1 ? 'انبساط عمودی' : Math.abs(k) < 1 ? 'انقباض عمودی' : 'بدون کشیدگی';
    note = `${k < 0 ? '**قرینه نسبت به محور x** و ' : ''}${kind}: عرض هر نقطه در ${texNumFa(k)} ضرب شد. نقطه‌های روی محور x جابه‌جا نمی‌شوند.`;
  } else if (mode === 'hscale') {
    const kind = Math.abs(k) > 1 ? 'انقباض افقی' : Math.abs(k) < 1 ? 'انبساط افقی' : 'بدون کشیدگی';
    note = `${k < 0 ? '**قرینه نسبت به محور y** و ' : ''}${kind}: طول هر نقطه بر ${texNumFa(k)} تقسیم شد. نقطه‌های روی محور y جابه‌جا نمی‌شوند.`;
  } else {
    const inner = C === 0 ? 'x_0' : `x_0${C > 0 ? '-' : '+'}${texNum(Math.abs(C))}`;
    const xs = Bc === 1 ? inner : Bc === -1 ? `-(${inner})` : `\\dfrac{${inner}}{${texNum(Bc)}}`;
    const ys = `${A === 1 ? '' : A === -1 ? '-' : texNum(A)}y_0${D === 0 ? '' : D > 0 ? `+${texNum(D)}` : `-${texNum(-D)}`}`;
    note = `هر نقطهٔ $(x_0,y_0)$ می‌رود به $\\left(${xs},\\ ${ys}\\right)$. مثلاً $P(${texNum(px)},${texNum(py)})\\to P'(${texNum(qx)},${texNum(qy)})$`;
  }

  const baseChoices = bases ?? [];

  return (
    <WidgetFrame title={TITLES[mode]} icon="wand">
      {baseChoices.length > 1 && (
        <Seg
          value={base}
          onChange={(v) => setBase(v)}
          options={baseChoices.map((bn) => ({ v: bn, label: <M tex={BASES[bn].tex('x')} /> }))}
        />
      )}
      <div className="widget-formula">
        <M tex={gTex} />
      </div>
      <Plot spec={spec} label={`نمودار ${baseTex} و ${gTex}`} />
      <div className="legend">
        <span>
          <i style={{ background: 'var(--plot-base)' }} />
          <M tex={baseTex} />
        </span>
        <span>
          <i style={{ background: 'var(--plot-main)' }} />
          <M tex={gTex} />
        </span>
      </div>
      {mode === 'vshift' && <Slider label={<M tex="k" />} value={k} min={-4} max={4} step={0.5} onChange={setK} />}
      {mode === 'hshift' && <Slider label={<M tex="k" />} value={k} min={-4} max={4} step={0.5} onChange={setK} />}
      {(mode === 'vscale' || mode === 'hscale') && (
        <Slider label={<M tex="k" />} value={k} min={-3} max={3} step={0.25} onChange={setK} skipZero />
      )}
      {mode === 'combo' && (
        <>
          <Slider label={<M tex="a" />} value={a} min={-3} max={3} step={0.5} onChange={setA} skipZero />
          <Slider label={<M tex="b" />} value={b} min={-3} max={3} step={0.5} onChange={setB} skipZero />
          <Slider label={<M tex="c" />} value={c} min={-4} max={4} step={0.5} onChange={setC} />
          <Slider label={<M tex="d" />} value={d} min={-4} max={4} step={0.5} onChange={setD} />
          <div className="small muted center">
            <M tex="y=a\,f(bx+c)+d" />
          </div>
        </>
      )}
      <div className="widget-note">
        <Rich text={note} />
      </div>
    </WidgetFrame>
  );
}

function texNumFa(n: number): string {
  return `$${texNum(n)}$`;
}
