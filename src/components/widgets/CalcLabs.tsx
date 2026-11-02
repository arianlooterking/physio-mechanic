import { useState } from 'react';
import { fmt, texOf } from '../../lib/digits';
import { Plot } from '../Plot';
import { M, Rich } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

const num = (n: number, d = 2) => texOf(n, d);

const FNS = {
  book: { tex: 'f(x)=-x^2+10x', f: (x: number) => -x * x + 10 * x, df: (x: number) => -2 * x + 10, x: [0, 10] as [number, number], y: [-4, 30] as [number, number], a: 2, range: [0.5, 9.5] as [number, number] },
  sq: { tex: 'f(x)=x^2', f: (x: number) => x * x, df: (x: number) => 2 * x, x: [-3, 3] as [number, number], y: [-2, 9] as [number, number], a: 1, range: [-2.5, 2.5] as [number, number] },
  cube: { tex: 'f(x)=x^3-3x', f: (x: number) => x ** 3 - 3 * x, df: (x: number) => 3 * x * x - 3, x: [-2.5, 2.5] as [number, number], y: [-4, 4] as [number, number], a: 0.5, range: [-2, 2] as [number, number] },
};

/** Sums of sequences, seen: Gauss's two staircases make an n × (n+1) rectangle; halving a square approaches 1. */
export function SeriesLab({ mode: initial = 'gauss' }: { mode?: 'gauss' | 'geo' }) {
  const [mode, setMode] = useState<'gauss' | 'geo'>(initial);
  const [n, setN] = useState(6);
  const [k, setK] = useState(3);
  const W = 300;
  const cell = Math.min(26, Math.floor((W - 20) / (n + 1)));
  const sum = (n * (n + 1)) / 2;
  const colored = 1 - 0.5 ** k;
  // Halving a unit square: piece i is a strip or a block of the remaining part.
  const pieces: { x: number; y: number; w: number; h: number }[] = [];
  {
    let x = 0;
    let y = 0;
    let w = 1;
    let h = 1;
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) {
        pieces.push({ x, y, w: w / 2, h });
        x += w / 2;
        w /= 2;
      } else {
        pieces.push({ x, y, w, h: h / 2 });
        y += h / 2;
        h /= 2;
      }
    }
  }
  return (
    <WidgetFrame title="مجموع جمله‌ها را ببین" icon="eye">
      <Seg
        value={mode}
        onChange={setMode}
        options={[
          { v: 'gauss', label: 'ترفند گاوس' },
          { v: 'geo', label: 'نصف، نصف، نصف...' },
        ]}
      />
      {mode === 'gauss' ? (
        <>
          <svg viewBox={`0 0 ${W} ${cell * (n + 1) + 20}`} className="plot" role="img" aria-label="دو پله‌کان که با هم یک مستطیل می‌سازند">
            {Array.from({ length: n }, (_, c) =>
              Array.from({ length: n + 1 }, (_, r) => {
                const blue = r < c + 1;
                return (
                  <rect
                    key={`${c}-${r}`}
                    x={10 + c * cell}
                    y={10 + (n - r) * cell}
                    width={cell - 3}
                    height={cell - 3}
                    rx={cell / 3}
                    fill={blue ? 'var(--plot-base)' : 'var(--plot-main)'}
                    opacity={blue ? 1 : 0.75}
                  />
                );
              }),
            )}
          </svg>
          <Slider label={<M tex="n" />} value={n} min={3} max={10} step={1} onChange={setN} />
          <div className="widget-formula">
            <M tex={`1+2+\\dots+${n}=\\dfrac{${n}\\times${n + 1}}{2}=${sum}`} />
          </div>
          <div className="widget-note">
            <Rich text={`آبی‌ها پله‌کان $1+2+\\dots+${n}$ هستند و صورتی‌ها همان پله‌کان، وارونه. با هم یک مستطیل $${n}\\times${n + 1}$ می‌سازند؛ پس هر پله‌کان نصف مستطیل است.`} />
          </div>
        </>
      ) : (
        <>
          <svg viewBox="0 0 240 240" className="plot" role="img" aria-label="مربعی که هر بار نصف باقی‌مانده‌اش رنگ می‌شود">
            <rect x="20" y="20" width="200" height="200" rx="6" fill="var(--surface-2)" stroke="var(--line-2)" strokeWidth="2" />
            {pieces.slice(0, k).map((p, i) => (
              <rect
                key={i}
                x={20 + p.x * 200}
                y={20 + p.y * 200}
                width={p.w * 200}
                height={p.h * 200}
                fill={i % 2 ? 'var(--plot-main)' : 'var(--plot-base)'}
                opacity={0.55 + 0.05 * i}
                stroke="var(--surface)"
                strokeWidth="2"
              />
            ))}
          </svg>
          <Slider label="مرحله" value={k} min={1} max={8} step={1} onChange={setK} />
          <div className="widget-formula">
            <M tex={`\\tfrac{1}{2}+\\tfrac{1}{4}+\\dots+\\tfrac{1}{2^{${k}}}=1-\\tfrac{1}{2^{${k}}}=${num(colored, 4)}`} />
          </div>
          <div className="widget-note">
            <Rich text={`هر مرحله نصفِ باقی‌مانده رنگ می‌شود؛ یک دنبالهٔ هندسی با قدر نسبت $\\tfrac{1}{2}$. بعد از ${k} مرحله $${num(colored * 100, 2)}$ درصد مربع رنگی است و هرگز به صددرصد نمی‌رسد.`} />
          </div>
        </>
      )}
    </WidgetFrame>
  );
}

/** Secant through A and B; as h shrinks, its slope approaches the tangent slope f′(a). */
export function TangentLab() {
  const [key, setKey] = useState<keyof typeof FNS>('book');
  const F = FNS[key];
  const [a, setA] = useState(F.a);
  const [h, setH] = useState(2);
  const [showTan, setShowTan] = useState(false);
  const pick = (k: keyof typeof FNS) => {
    setKey(k);
    setA(FNS[k].a);
    setH(FNS[k].x[1] - FNS[k].x[0] > 6 ? 2 : 1);
  };
  const fa = F.f(a);
  const b = a + h;
  const ms = (F.f(b) - fa) / h;
  const mt = F.df(a);
  const rows = [1, 0.5, 0.1, 0.01].map((hh) => [hh, (F.f(a + hh) - fa) / hh] as const);

  return (
    <WidgetFrame title="از خط قاطع تا خط مماس" icon="eye">
      <Seg
        value={key}
        onChange={pick}
        options={[
          { v: 'book', label: <M tex="-x^2+10x" /> },
          { v: 'sq', label: <M tex="x^2" /> },
          { v: 'cube', label: <M tex="x^3-3x" /> },
        ]}
      />
      <Plot
        spec={{
          x: F.x,
          y: F.y,
          height: 280,
          curves: [
            { fn: F.f, color: 'main', width: 3.4 },
            { fn: (x) => fa + ms * (x - a), color: 'base', marks: [[a, fa], [b, F.f(b)]] },
            ...(showTan ? [{ fn: (x: number) => fa + mt * (x - a), color: 'ok' as const, dashed: true }] : []),
          ],
          labels: [
            [a, fa, 'A'],
            [b, F.f(b), 'B'],
          ],
        }}
      />
      <Slider label={<M tex="a" />} value={a} min={F.range[0]} max={F.range[1]} step={0.5} onChange={setA} />
      <Slider label={<M tex="h" />} value={h} min={-2} max={2} step={0.05} onChange={setH} skipZero format={(v) => fmt(v, 2)} />
      <label className="row small" style={{ gap: 8, fontWeight: 800 }}>
        <input type="checkbox" checked={showTan} onChange={(e) => setShowTan(e.target.checked)} /> نمایش خط مماس در A
      </label>
      <div className="widget-formula">
        <M tex={`m_{AB}=\\dfrac{f(a+h)-f(a)}{h}=${num(ms, 3)}`} />
      </div>
      <table className="mini-table">
        <thead>
          <tr>
            <th>
              <M tex="h" />
            </th>
            <th>شیب خط قاطع</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([hh, m]) => (
            <tr key={hh}>
              <td>
                <M tex={num(hh, 2)} />
              </td>
              <td>
                <M tex={num(m, 3)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="widget-note">
        <Rich
          text={`تابع: $${F.tex}$. هرچه $h$ به صفر نزدیک‌تر شود، B به A می‌چسبد و شیب خط قاطع به عدد $${num(mt, 2)}$ نزدیک می‌شود. همین عدد شیب خط مماس در A است: $f'(${num(a, 1)})=${num(mt, 2)}$.`}
        />
      </div>
    </WidgetFrame>
  );
}
