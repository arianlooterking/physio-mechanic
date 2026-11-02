import { memo, useId, useMemo, type ReactNode, type Ref } from 'react';
import type { PlotCurve, PlotSpec } from '../content/types';

export interface Frame {
  W: number;
  H: number;
  pad: number;
  sx: (x: number) => number;
  sy: (y: number) => number;
  ix: (px: number) => number;
  iy: (py: number) => number;
  spec: PlotSpec;
}

export const COLORS: Record<NonNullable<PlotCurve['color']>, string> = {
  base: 'var(--plot-base)',
  main: 'var(--plot-main)',
  alt: 'var(--plot-alt)',
  ok: 'var(--ok)',
  bad: 'var(--bad)',
  muted: 'var(--ink-3)',
};

export function makeFrame(spec: PlotSpec, width = 360): Frame {
  const pad = 24;
  const [x0, x1] = spec.x;
  const [y0, y1] = spec.y;
  const ux = (width - 2 * pad) / (x1 - x0);
  let H = spec.height ?? ux * (y1 - y0) + 2 * pad;
  H = Math.max(170, Math.min(H, 440));
  const uy = (H - 2 * pad) / (y1 - y0);
  return {
    W: width,
    H,
    pad,
    sx: (x) => pad + (x - x0) * ux,
    sy: (y) => H - pad - (y - y0) * uy,
    ix: (px) => x0 + (px - pad) / ux,
    iy: (py) => y0 + (H - pad - py) / uy,
    spec,
  };
}

export function minus(n: number): string {
  const r = Math.round(n * 100) / 100;
  return r < 0 ? `−${Math.abs(r)}` : String(r);
}

/** Path for y = fn(x), split wherever the function jumps or leaves the visible window. */
/** Closed region between a curve and y = 0 (clamped to the frame), for shaded areas. */
export function areaPath(f: Frame, c: PlotCurve): string {
  const [x0, x1] = f.spec.x;
  const pts: [number, number][] = c.pts
    ? c.pts
    : (() => {
        const a = Math.max(x0, c.domain?.[0] ?? -Infinity);
        const b = Math.min(x1, c.domain?.[1] ?? Infinity);
        if (!c.fn || !(b > a)) return [];
        return Array.from({ length: 161 }, (_, i) => {
          const x = a + ((b - a) * i) / 160;
          return [x, c.fn!(x)] as [number, number];
        }).filter(([, y]) => Number.isFinite(y));
      })();
  if (pts.length < 2) return '';
  const base = Math.min(Math.max(0, f.spec.y[0]), f.spec.y[1]);
  let d = `M${f.sx(pts[0][0]).toFixed(2)} ${f.sy(base).toFixed(2)}`;
  for (const [x, y] of pts) d += `L${f.sx(x).toFixed(2)} ${f.sy(y).toFixed(2)}`;
  return `${d}L${f.sx(pts[pts.length - 1][0]).toFixed(2)} ${f.sy(base).toFixed(2)}Z`;
}

export function fnPath(f: Frame, fn: (x: number) => number, domain?: [number, number], samples = 420): string {
  const [x0, x1] = f.spec.x;
  const [y0, y1] = f.spec.y;
  const a = Math.max(x0, domain?.[0] ?? -Infinity);
  const b = Math.min(x1, domain?.[1] ?? Infinity);
  if (!(b > a)) return '';
  const span = y1 - y0;
  let d = '';
  let pen = false;
  let prev: number | null = null;
  for (let i = 0; i <= samples; i++) {
    const x = a + ((b - a) * i) / samples;
    const y = fn(x);
    const bad = !Number.isFinite(y) || y > y1 + span * 2 || y < y0 - span * 2;
    const jump = prev !== null && Number.isFinite(y) && Math.abs(y - prev) > span * 0.9;
    if (bad || jump) {
      pen = false;
      prev = bad ? null : y;
      if (bad) continue;
    }
    d += `${pen ? 'L' : 'M'}${f.sx(x).toFixed(2)} ${f.sy(y).toFixed(2)}`;
    pen = true;
    prev = y;
  }
  return d;
}

export function ptsPath(f: Frame, pts: [number, number][]): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f.sx(x).toFixed(2)} ${f.sy(y).toFixed(2)}`).join('');
}

function tickEvery(pixels: number): number {
  if (pixels >= 22) return 1;
  if (pixels >= 11) return 2;
  if (pixels >= 5) return 5;
  return 10;
}

interface PlotProps {
  spec: PlotSpec;
  width?: number;
  overlay?: (f: Frame) => ReactNode;
  svgRef?: Ref<SVGSVGElement>;
  label?: string;
  compact?: boolean;
}

export const Plot = memo(function Plot({ spec, width = 360, overlay, svgRef, label, compact }: PlotProps) {
  const uid = useId().replace(/:/g, '');
  const f = useMemo(() => makeFrame(spec, width), [spec, width]);
  const stepX = spec.xStep ?? spec.step ?? 1;
  const stepY = spec.yStep ?? spec.step ?? 1;
  const [x0, x1] = spec.x;
  const [y0, y1] = spec.y;

  const gridX: number[] = [];
  for (let x = Math.ceil(x0 / stepX) * stepX; x <= x1 + 1e-9; x += stepX) gridX.push(Number(x.toFixed(6)));
  const gridY: number[] = [];
  for (let y = Math.ceil(y0 / stepY) * stepY; y <= y1 + 1e-9; y += stepY) gridY.push(Number(y.toFixed(6)));

  const pxPerStepX = f.sx(stepX) - f.sx(0);
  const pxPerStepY = f.sy(0) - f.sy(stepY);
  const everyX = tickEvery(pxPerStepX) * stepX;
  const everyY = tickEvery(pxPerStepY) * stepY;
  const axisY = y0 <= 0 && y1 >= 0 ? f.sy(0) : f.H - f.pad;
  const axisX = x0 <= 0 && x1 >= 0 ? f.sx(0) : f.pad;
  const fs = compact ? 10 : 11;

  return (
    <svg
      ref={svgRef}
      className="plot"
      viewBox={`0 0 ${f.W} ${f.H}`}
      role="img"
      aria-label={label ?? 'نمودار'}
    >
      <defs>
        <clipPath id={`c${uid}`}>
          <rect x={f.pad - 1} y={f.pad - 1} width={f.W - 2 * f.pad + 2} height={f.H - 2 * f.pad + 2} />
        </clipPath>
        <marker id={`a${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill="var(--ink-2)" />
        </marker>
        <marker id={`ax${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 1 10 5 0 9z" fill="var(--plot-axis)" />
        </marker>
      </defs>

      <g stroke="var(--plot-grid)" strokeWidth="1">
        {gridX.map((x) => (
          <line key={`gx${x}`} x1={f.sx(x)} x2={f.sx(x)} y1={f.pad} y2={f.H - f.pad} />
        ))}
        {gridY.map((y) => (
          <line key={`gy${y}`} y1={f.sy(y)} y2={f.sy(y)} x1={f.pad} x2={f.W - f.pad} />
        ))}
      </g>

      <g stroke="var(--plot-axis)" strokeWidth="1.6">
        <line x1={f.pad - 6} x2={f.W - f.pad + 10} y1={axisY} y2={axisY} markerEnd={`url(#ax${uid})`} />
        <line y1={f.H - f.pad + 6} y2={f.pad - 10} x1={axisX} x2={axisX} markerEnd={`url(#ax${uid})`} />
      </g>

      <g fill="var(--plot-axis)" fontSize={fs} fontWeight="600">
        {(spec.xTicks ?? gridX.filter((x) => x !== 0 && Math.abs(x / everyX - Math.round(x / everyX)) < 1e-6).map((x) => ({ at: x, label: minus(x) }))).map(
          (t) => (
            <g key={`tx${t.at}`}>
              <line x1={f.sx(t.at)} x2={f.sx(t.at)} y1={axisY - 3} y2={axisY + 3} stroke="var(--plot-axis)" strokeWidth="1.4" />
              <text x={f.sx(t.at)} y={axisY + 15} textAnchor="middle" direction="ltr">
                {t.label}
              </text>
            </g>
          ),
        )}
        {(spec.yTicks ?? gridY.filter((y) => y !== 0 && Math.abs(y / everyY - Math.round(y / everyY)) < 1e-6).map((y) => ({ at: y, label: minus(y) }))).map(
          (t) => (
            <g key={`ty${t.at}`}>
              <line y1={f.sy(t.at)} y2={f.sy(t.at)} x1={axisX - 3} x2={axisX + 3} stroke="var(--plot-axis)" strokeWidth="1.4" />
              <text x={axisX - 6} y={f.sy(t.at) + 4} textAnchor="end" direction="ltr">
                {t.label}
              </text>
            </g>
          ),
        )}
        {x0 <= 0 && x1 >= 0 && y0 <= 0 && y1 >= 0 && (
          <text x={axisX - 6} y={axisY + 14} textAnchor="end">
            0
          </text>
        )}
        <text x={f.W - f.pad + 6} y={axisY - 8} textAnchor="end" fontStyle={latin(spec.axisNames?.[0] ?? "x") ? "italic" : "normal"} fontSize={fs + 2} direction="ltr">
          {spec.axisNames?.[0] ?? 'x'}
        </text>
        <text x={axisX + 8} y={f.pad - 4} textAnchor="start" fontStyle={latin(spec.axisNames?.[1] ?? "y") ? "italic" : "normal"} fontSize={fs + 2} direction="ltr">
          {spec.axisNames?.[1] ?? 'y'}
        </text>
      </g>

      <g clipPath={`url(#c${uid})`}>
        {spec.curves.map((c, i) => (c.fill ? <path key={`f${i}`} d={areaPath(f, c)} fill={COLORS[c.color ?? 'main']} opacity={0.18} /> : null))}
      </g>
      <g clipPath={`url(#c${uid})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {spec.curves.map((c, i) => {
          const d = c.fn ? fnPath(f, c.fn, c.domain) : c.pts ? ptsPath(f, c.pts) : '';
          return (
            <path
              key={i}
              d={d}
              stroke={COLORS[c.color ?? 'main']}
              strokeWidth={c.width ?? 3}
              strokeDasharray={c.dashed ? '7 6' : undefined}
              opacity={c.color === 'muted' ? 0.7 : 1}
            />
          );
        })}
      </g>

      {spec.arrows?.map((a, i) => (
        <line
          key={`ar${i}`}
          x1={f.sx(a.from[0])}
          y1={f.sy(a.from[1])}
          x2={f.sx(a.to[0])}
          y2={f.sy(a.to[1])}
          stroke="var(--ink-2)"
          strokeWidth="1.8"
          strokeDasharray="4 4"
          markerEnd={`url(#a${uid})`}
        />
      ))}

      {spec.curves.map((c, i) => (
        <g key={`m${i}`}>
          {c.marks?.map(([x, y], j) => (
            <circle key={j} cx={f.sx(x)} cy={f.sy(y)} r="4.6" fill={COLORS[c.color ?? 'main']} stroke="var(--surface)" strokeWidth="1.6" />
          ))}
          {c.open?.map(([x, y], j) => (
            <circle key={`o${j}`} cx={f.sx(x)} cy={f.sy(y)} r="4.6" fill="var(--surface)" stroke={COLORS[c.color ?? 'main']} strokeWidth="2.4" />
          ))}
        </g>
      ))}

      {placeLabels(f).map((l, i) => (
        <text
          key={`l${i}`}
          x={l.x}
          y={l.y}
          textAnchor={l.anchor}
          fontSize="12"
          fontWeight="800"
          fill={COLORS[l.color]}
          stroke="var(--surface)"
          strokeWidth="4"
          paintOrder="stroke"
          direction="ltr"
        >
          {l.text}
        </text>
      ))}

      {spec.labels?.map(([x, y, t], i) => (
        <text
          key={`lb${i}`}
          x={f.sx(x)}
          y={f.sy(y) - 9}
          textAnchor="middle"
          fontSize={fs + 1}
          fontWeight="800"
          fill="var(--ink)"
          stroke="var(--surface)"
          strokeWidth="4"
          paintOrder="stroke"
          direction="ltr"
        >
          {t}
        </text>
      ))}

      {overlay?.(f)}
    </svg>
  );
});

function curveY(c: PlotCurve, x: number): number {
  if (c.fn) {
    if (c.domain && (x < c.domain[0] || x > c.domain[1])) return NaN;
    return c.fn(x);
  }
  const pts = c.pts ?? [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    if (x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && bx !== ax) return ay + ((by - ay) * (x - ax)) / (bx - ax);
  }
  return NaN;
}

interface LabelPos {
  x: number;
  y: number;
  anchor: 'start' | 'end';
  text: string;
  color: NonNullable<PlotCurve['color']>;
}

/** Put each curve label where it is farthest from the other curves and from labels already placed. */
function placeLabels(f: Frame): LabelPos[] {
  const [x0, x1] = f.spec.x;
  const [y0, y1] = f.spec.y;
  const curves = f.spec.curves;
  const placed: LabelPos[] = [];
  curves.forEach((c, ci) => {
    if (!c.label) return;
    const others = curves.filter((o, oi) => oi !== ci && (o.fn || (o.pts && o.pts.length > 1)));
    const a = Math.max(x0, c.domain?.[0] ?? -Infinity, c.pts?.length ? Math.min(...c.pts.map((p) => p[0])) : -Infinity);
    const b = Math.min(x1, c.domain?.[1] ?? Infinity, c.pts?.length ? Math.max(...c.pts.map((p) => p[0])) : Infinity);
    const candidates: number[] = [];
    if (c.labelX !== undefined) candidates.push(c.labelX);
    else for (let i = 0; i <= 40; i++) candidates.push(a + ((b - a) * (i + 0.5)) / 41);
    let best: { score: number; x: number; y: number; above: boolean } | null = null;
    for (const x of candidates) {
      const y = curveY(c, x);
      if (!Number.isFinite(y) || y > y1 - (y1 - y0) * 0.1 || y < y0 + (y1 - y0) * 0.08) continue;
      const px = f.sx(x);
      const py = f.sy(y);
      let nearestAbove = Infinity;
      let nearestBelow = Infinity;
      for (const o of others) {
        const oy = curveY(o, x);
        if (!Number.isFinite(oy)) continue;
        const opy = f.sy(oy);
        if (opy < py) nearestAbove = Math.min(nearestAbove, py - opy);
        else nearestBelow = Math.min(nearestBelow, opy - py);
      }
      const above = nearestAbove >= nearestBelow;
      const room = Math.min(above ? nearestAbove : nearestBelow, 70);
      const ly = above ? py - 9 : py + 18;
      const clash = placed.some((p) => Math.abs(p.y - ly) < 16 && Math.abs(p.x - px) < 70) ? 60 : 0;
      const edge = Math.min(px - f.pad, f.W - f.pad - px) < 30 ? 8 : 0;
      // keep clear of the x axis and its tick numbers
      const axisPy = y0 <= 0 && y1 >= 0 ? f.sy(0) : Infinity;
      const onAxis = ly > axisPy - 14 && ly < axisPy + 24 ? 45 : 0;
      const score = room - clash - edge - onAxis + (c.labelX !== undefined ? 1000 : 0);
      if (!best || score > best.score) best = { score, x: px, y: ly, above };
    }
    if (!best) return;
    const rightHalf = best.x > f.W / 2;
    placed.push({
      x: rightHalf ? Math.min(best.x - 6, f.W - f.pad - 2) : Math.max(best.x + 6, f.pad + 2),
      y: Math.min(Math.max(f.pad + 12, best.y), f.H - f.pad - 4),
      anchor: rightHalf ? 'end' : 'start',
      text: c.label,
      color: c.color ?? 'main',
    });
  });
  return placed;
}

/** Italic only suits Latin axis names; Persian names stay upright. */
function latin(s: string): boolean {
  return /^[ -~]+$/.test(s);
}
