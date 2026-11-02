import { useMemo, useState } from 'react';
import { fmt } from '../../lib/digits';
import { M, Rich } from '../Rich';
import { Seg, WidgetFrame } from './common';

const NAMES = 'abcdefghijklmnop'.split('');
type Pt = [number, number];
const key = (i: number, j: number) => (i < j ? `${i}-${j}` : `${j}-${i}`);
const circle = (n: number, r = 92, cx = 150, cy = 128): Pt[] => Array.from({ length: n }, (_, k) => [cx + r * Math.sin((2 * Math.PI * k) / n), cy - r * Math.cos((2 * Math.PI * k) / n)]);

function degrees(n: number, edges: Set<string>): number[] {
  const d = Array(n).fill(0);
  for (const e of edges) {
    const [i, j] = e.split('-').map(Number);
    d[i]++;
    d[j]++;
  }
  return d;
}

function neighbours(n: number, edges: Set<string>): number[][] {
  const out: number[][] = Array.from({ length: n }, () => []);
  for (const e of edges) {
    const [i, j] = e.split('-').map(Number);
    out[i].push(j);
    out[j].push(i);
  }
  out.forEach((l) => l.sort((a, b) => a - b));
  return out;
}

function components(n: number, nb: number[][]): number {
  const seen = Array(n).fill(false);
  let c = 0;
  for (let s = 0; s < n; s++) {
    if (seen[s]) continue;
    c++;
    const stack = [s];
    seen[s] = true;
    while (stack.length) {
      const v = stack.pop()!;
      for (const u of nb[v])
        if (!seen[u]) {
          seen[u] = true;
          stack.push(u);
        }
    }
  }
  return c;
}

const set = (xs: number[]) => (xs.length ? `\\{${xs.map((i) => NAMES[i]).join(',')}\\}` : '\\varnothing');

const PRESETS: Record<string, { n: number; edges: [number, number][] }> = {
  free: { n: 6, edges: [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4]] },
  regular: { n: 6, edges: [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3], [0, 3], [1, 4], [2, 5]] },
  walk: { n: 6, edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 3], [1, 4]] },
};

/**
 * A small graph editor: tap two vertices to add or remove the edge between them. Shows V(G), E(G), degrees, the sum of
 * degrees = 2q, Δ and δ, regularity, isolated vertices, connectivity and neighbourhoods; buttons make the empty graph,
 * the complete graph K_n or the complement. «مسیر» mode checks whether a tapped sequence is a path or a cycle.
 */
export function GraphLab({ preset = 'free', tool: initialTool = 'edit' }: { preset?: string; tool?: 'edit' | 'path' }) {
  const start = PRESETS[preset] ?? PRESETS.free;
  const [n, setN] = useState(start.n);
  const [edges, setEdges] = useState(() => new Set(start.edges.map(([i, j]) => key(i, j))));
  const [tool, setTool] = useState<'edit' | 'path'>(initialTool);
  const [sel, setSel] = useState<number | null>(null);
  const [walk, setWalk] = useState<number[]>([]);
  const pts = useMemo(() => circle(n), [n]);
  const deg = degrees(n, edges);
  const nb = neighbours(n, edges);
  const q = edges.size;
  const comps = components(n, nb);
  const maxD = Math.max(...deg);
  const minD = Math.min(...deg);
  const odd = deg.map((d, i) => (d % 2 ? i : -1)).filter((i) => i >= 0);
  const isolated = deg.map((d, i) => (d === 0 ? i : -1)).filter((i) => i >= 0);

  const tap = (v: number) => {
    if (tool === 'path') {
      setWalk((w) => [...w, v]);
      return;
    }
    if (sel === null) setSel(v);
    else if (sel === v) setSel(null);
    else {
      const k = key(sel, v);
      setEdges((old) => {
        const e = new Set(old);
        if (e.has(k)) e.delete(k);
        else e.add(k);
        return e;
      });
      setSel(null);
    }
  };
  const all = () => {
    const e = new Set<string>();
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) e.add(key(i, j));
    return e;
  };
  const restart = () => {
    setN(start.n);
    setEdges(new Set(start.edges.map(([i, j]) => key(i, j))));
    setSel(null);
    setWalk([]);
  };
  const resize = (m: number) => {
    setN(m);
    setEdges((old) => new Set([...old].filter((e) => e.split('-').every((x) => Number(x) < m))));
    setSel(null);
    setWalk([]);
  };

  // Path / cycle check for the tapped sequence.
  let walkMsg = 'رأس‌ها را به ترتیب بزن تا یک مسیر بسازی؛ برای دور، آخر سر دوباره روی رأس اول بزن.';
  let walkEdges: string[] = [];
  if (walk.length) {
    let ok = true;
    let why = '';
    for (let i = 1; i < walk.length; i++) {
      if (!edges.has(key(walk[i - 1], walk[i]))) {
        ok = false;
        why = `$${NAMES[walk[i - 1]]}$ و $${NAMES[walk[i]]}$ مجاور نیستند؛ این دنباله مسیر نیست.`;
        break;
      }
      walkEdges.push(key(walk[i - 1], walk[i]));
    }
    const closed = walk.length >= 4 && walk[0] === walk[walk.length - 1];
    const body = closed ? walk.slice(0, -1) : walk;
    if (ok && new Set(body).size !== body.length) {
      ok = false;
      why = 'رأس تکراری داری؛ در مسیر و دور رأس‌ها باید متمایز باشند.';
    }
    const name = walk.map((i) => NAMES[i]).join('');
    walkMsg = !ok
      ? why
      : closed
        ? `$${name}$ یک **دور** به طول ${fmt(walk.length - 1)} است.`
        : `$${name}$ یک **مسیر** به طول ${fmt(walk.length - 1)} است (تعداد یال‌ها، یکی کمتر از تعداد رأس‌ها).`;
    if (!ok) walkEdges = [];
  }

  const nbOfSel = sel === null ? [] : nb[sel];
  return (
    <WidgetFrame title="آزمایشگاه گراف" icon="nodes">
      <Seg
        value={tool}
        onChange={(t) => (setTool(t), setSel(null), setWalk([]))}
        options={[
          { v: 'edit', label: 'ساختن یال' },
          { v: 'path', label: 'مسیر و دور' },
        ]}
      />
      <svg viewBox="0 0 300 256" className="plot graph-svg" role="img" aria-label={`گرافی با ${n} رأس و ${q} یال`}>
        {[...edges].map((e) => {
          const [i, j] = e.split('-').map(Number);
          const lit = walkEdges.includes(e) || (sel !== null && (i === sel || j === sel));
          return <line key={e} x1={pts[i][0]} y1={pts[i][1]} x2={pts[j][0]} y2={pts[j][1]} stroke={lit ? 'var(--disc)' : 'var(--plot-axis)'} strokeWidth={lit ? 4 : 2.5} strokeLinecap="round" />;
        })}
        {pts.map(([x, y], i) => {
          const isSel = sel === i;
          const isNb = nbOfSel.includes(i);
          const inWalk = walk.includes(i);
          const fill = isSel ? 'var(--disc)' : isNb ? 'var(--disc-soft)' : inWalk ? 'var(--ok)' : 'var(--surface)';
          return (
            <g key={i} onClick={() => tap(i)} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r={17} fill={fill} stroke={isSel || isNb ? 'var(--disc)' : 'var(--ink-2)'} strokeWidth={2.5} />
              <text x={x} y={y + 5} fontSize={15} fontWeight={800} textAnchor="middle" fill={isSel || inWalk ? '#fff' : 'var(--ink)'}>
                {NAMES[i]}
              </text>
              <g transform={`translate(${x + (x >= 150 ? 16 : -16)},${y - 15})`}>
                <circle r={9} fill={deg[i] % 2 ? 'var(--geo)' : 'var(--math)'} />
                <text y={4} fontSize={11} fontWeight={800} textAnchor="middle" fill="#fff">
                  {fmt(deg[i])}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
      <div className="graph-tools">
        <button onClick={() => resize(Math.max(3, n - 1))} aria-label="یک رأس کمتر">
          −
        </button>
        <span>{fmt(n)} رأس</span>
        <button onClick={() => resize(Math.min(8, n + 1))} aria-label="یک رأس بیشتر">
          +
        </button>
        <button onClick={() => (setEdges(new Set()), setWalk([]))}>تهی</button>
        <button onClick={() => (setEdges(all()), setWalk([]))}>
          کامل <M tex={`K_{${n}}`} />
        </button>
        <button onClick={() => (setEdges((old) => new Set([...all()].filter((e) => !old.has(e)))), setWalk([]))}>مکمل</button>
        <button onClick={() => (tool === 'path' ? setWalk([]) : restart())}>از نو</button>
      </div>
      <table className="mini-table graph-stats">
        <tbody>
          <tr>
            <th>مرتبه و اندازه</th>
            <td>
              <M tex={`p=${n},\\ q=${q}`} />
            </td>
          </tr>
          <tr>
            <th>مجموع درجه‌ها</th>
            <td>
              <M tex={`\\sum\\deg(v)=${2 * q}=2q`} />
            </td>
          </tr>
          <tr>
            <th>بیشترین و کمترین درجه</th>
            <td>
              <M tex={`\\Delta=${maxD},\\ \\delta=${minD}`} />
              {maxD === minD && <span className="tag-ok"> {fmt(maxD)}-منتظم</span>}
            </td>
          </tr>
          <tr>
            <th>رأس‌های فرد</th>
            <td>
              <M tex={set(odd)} />
              <div className="muted">{fmt(odd.length)} رأس فرد؛ همیشه تعداد زوج</div>
            </td>
          </tr>
          <tr>
            <th>همبندی</th>
            <td>
              {comps === 1 ? 'همبند' : `ناهمبند (${fmt(comps)} تکه)`}
              {isolated.length ? (
                <div className="muted">
                  رأس تنها: <M tex={set(isolated)} />
                </div>
              ) : null}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="widget-note">
        <Rich
          text={
            tool === 'path'
              ? walkMsg
              : sel !== null
                ? `$N(${NAMES[sel]})=${set(nb[sel])}$ و $N[${NAMES[sel]}]=${set([...nb[sel], sel].sort((a, b) => a - b))}$؛ $\\deg(${NAMES[sel]})=${deg[sel]}$. حالا روی رأس دیگری بزن تا یال بینشان اضافه یا حذف شود.`
                : `روی یک رأس و بعد روی رأس دیگر بزن تا یال بینشان ساخته یا پاک شود. عدد کنار هر رأس درجهٔ آن است (نارنجی = فرد، بنفش = زوج). ${q === (n * (n - 1)) / 2 ? `این گراف کامل است و $\\tfrac{n(n-1)}{2}=${q}$ یال دارد.` : ''}`
          }
        />
      </div>
    </WidgetFrame>
  );
}

/* ───────── domination ───────── */

const DOM: Record<string, { label: string; names: string[]; pts: Pt[]; edges: [number, number][] }> = {
  c7: {
    label: 'دور C₇',
    names: ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7'],
    pts: circle(7, 95, 150, 125),
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]],
  },
  p10: {
    label: 'مسیر P₁₀',
    names: 'abcdefghij'.split(''),
    pts: Array.from({ length: 10 }, (_, i): Pt => [24 + i * 28, i % 2 ? 150 : 100]),
    edges: Array.from({ length: 9 }, (_, i): [number, number] => [i, i + 1]),
  },
  radio: {
    label: 'رادیو',
    names: 'abcdefghijk'.split(''),
    pts: [
      [120, 70],
      [60, 100],
      [205, 120],
      [130, 145],
      [150, 210],
      [240, 185],
      [180, 165],
      [110, 220],
      [40, 30],
      [25, 75],
      [90, 25],
    ],
    // Cities joined when they are at most 50 km apart (the book's distance table).
    edges: [[0, 1], [0, 3], [0, 6], [0, 8], [0, 10], [1, 3], [2, 3], [2, 5], [2, 6], [3, 4], [3, 6], [3, 7], [4, 5], [4, 6], [4, 7], [5, 6], [5, 7], [6, 7], [8, 9], [8, 10], [9, 10]],
  },
  star: {
    label: 'ستاره',
    names: 'abcdefg'.split(''),
    pts: [[150, 125] as Pt, ...circle(6, 90, 150, 125)],
    edges: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 2], [4, 5]],
  },
};

function dominated(n: number, nb: number[][], D: Set<number>): boolean[] {
  return Array.from({ length: n }, (_, v) => D.has(v) || nb[v].some((u) => D.has(u)));
}

/** Smallest dominating set by brute force (n ≤ 12), with the first one found. */
function gammaOf(n: number, nb: number[][]): { g: number; set: number[] } {
  for (let size = 1; size <= n; size++) {
    const pick: number[] = [];
    const go = (from: number): number[] | null => {
      if (pick.length === size) return dominated(n, nb, new Set(pick)).every(Boolean) ? [...pick] : null;
      for (let v = from; v < n; v++) {
        pick.push(v);
        const r = go(v + 1);
        pick.pop();
        if (r) return r;
      }
      return null;
    };
    const s = go(0);
    if (s) return { g: size, set: s };
  }
  return { g: n, set: [] };
}

/**
 * Pick vertices for D: each chosen vertex covers itself and its neighbours. Shows whether D dominates, whether it is
 * minimal, the lower bound ⌈n/(Δ+1)⌉ and, on request, γ(G) with one γ-set.
 */
export function DominationLab({ preset = 'c7' }: { preset?: string }) {
  const [which, setWhich] = useState(DOM[preset] ? preset : 'c7');
  const g = DOM[which];
  const n = g.names.length;
  const [D, setD] = useState<Set<number>>(new Set());
  const [reveal, setReveal] = useState(false);
  const nb = useMemo(() => {
    const out: number[][] = Array.from({ length: n }, () => []);
    for (const [i, j] of g.edges) {
      out[i].push(j);
      out[j].push(i);
    }
    return out;
  }, [g, n]);
  const cov = dominated(n, nb, D);
  const allCov = cov.every(Boolean);
  const minimal = allCov && D.size > 0 && [...D].every((v) => !dominated(n, nb, new Set([...D].filter((x) => x !== v))).every(Boolean));
  const Delta = Math.max(...nb.map((l) => l.length));
  const bound = Math.ceil(n / (Delta + 1));
  const best = useMemo(() => gammaOf(n, nb), [n, nb]);
  const missing = cov.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
  const toggle = (v: number) =>
    setD((old) => {
      const s = new Set(old);
      if (s.has(v)) s.delete(v);
      else s.add(v);
      return s;
    });
  const nm = (i: number) => g.names[i].replace(/^v(\d+)$/, 'v_{$1}');

  return (
    <WidgetFrame title="مجموعهٔ احاطه‌گر" icon="nodes">
      <Seg
        value={which}
        onChange={(w) => (setWhich(w), setD(new Set()), setReveal(false))}
        options={Object.entries(DOM).map(([k, v]) => ({ v: k, label: v.label }))}
      />
      <svg viewBox="0 0 300 250" className="plot graph-svg" role="img" aria-label={`گراف ${g.label}`}>
        {g.edges.map(([i, j]) => (
          <line key={`${i}-${j}`} x1={g.pts[i][0]} y1={g.pts[i][1]} x2={g.pts[j][0]} y2={g.pts[j][1]} stroke={D.has(i) || D.has(j) ? 'var(--disc)' : 'var(--plot-axis)'} strokeWidth={D.has(i) || D.has(j) ? 3.5 : 2.2} />
        ))}
        {g.pts.map(([x, y], i) => {
          const inD = D.has(i);
          return (
            <g key={i} onClick={() => toggle(i)} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r={14} fill={inD ? 'var(--disc)' : cov[i] ? 'var(--disc-soft)' : 'var(--surface)'} stroke={inD || cov[i] ? 'var(--disc)' : 'var(--bad)'} strokeWidth={2.5} strokeDasharray={cov[i] ? undefined : '4 3'} />
              <text x={x} y={y + 4.5} fontSize={g.names[i].length > 1 ? 11 : 13} fontWeight={800} textAnchor="middle" fill={inD ? '#fff' : 'var(--ink)'}>
                {g.names[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="graph-tools">
        <button onClick={() => (setD(new Set()), setReveal(false))}>پاک کن</button>
        <button onClick={() => (setD(new Set(best.set)), setReveal(true))}>یک مجموعهٔ مینیمم نشانم بده</button>
      </div>
      <div className="widget-formula">
        <M tex={`n=${n},\\ \\Delta=${Delta},\\ |D|=${D.size}`} />
        <div className="widget-sub">
          <M tex={`\\gamma(G)\\ge\\left\\lceil\\tfrac{${n}}{${Delta + 1}}\\right\\rceil=${bound}`} />
        </div>
        {reveal && (
          <div className="widget-sub">
            <M tex={`\\gamma(G)=${best.g}`} />
          </div>
        )}
      </div>
      <div className="widget-note">
        <Rich
          text={
            D.size === 0
              ? 'روی رأس‌ها بزن تا در مجموعهٔ D قرار بگیرند. هر رأسِ D خودش و همسایه‌هایش را احاطه می‌کند. رأس‌های خط‌چین قرمز هنوز احاطه نشده‌اند.'
              : !allCov
                ? `هنوز احاطه‌گر نیست؛ این رأس‌ها احاطه نشده‌اند: $${'\\{' + missing.map(nm).join(',') + '\\}'}$.`
                : `**D احاطه‌گر است** ✓ ${minimal ? 'و **مینیمال** هم هست (با حذف هر رأس، دیگر احاطه‌گر نمی‌ماند).' : 'ولی مینیمال نیست: می‌شود دست‌کم یک رأس را برداشت و باز احاطه‌گر ماند.'} ${D.size === best.g ? `اندازه‌اش ${fmt(D.size)} است که برابر $\\gamma(G)$ است؛ پس **مینیمم** است.` : reveal ? '' : 'آیا با رأس‌های کمتری هم می‌شود؟'}`
          }
        />
      </div>
    </WidgetFrame>
  );
}
