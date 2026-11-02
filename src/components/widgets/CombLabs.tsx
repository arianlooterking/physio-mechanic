import { useMemo, useState } from 'react';
import { fmt } from '../../lib/digits';
import { M, Rich } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

const choose = (n: number, k: number): number => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
};

/** All ways to write n as an ordered sum of k non-negative integers (k ≤ 5, n ≤ 12). */
function compositions(n: number, k: number, min: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];
  const go = (left: number, slots: number) => {
    if (slots === 1) {
      if (left >= min) out.push([...cur, left]);
      return;
    }
    for (let v = min; v <= left - min * (slots - 1); v++) {
      cur.push(v);
      go(left - v, slots - 1);
      cur.pop();
    }
  };
  go(n, k);
  return out;
}

const FLOWERS = ['مریم', 'رز', 'میخک', 'لاله', 'نرگس'];
const TONES = ['var(--math)', 'var(--bad)', 'var(--ok)', 'var(--geo)', 'var(--phys)'];

/**
 * Stars and bars: every bouquet of n flowers from k kinds is a row of n stars and k − 1 bars. Step through all of them
 * and compare the count with C(n + k − 1, k − 1); «حداقل یکی از هر نوع» counts positive solutions C(n − 1, k − 1).
 */
export function StarsBarsLab({ n: n0 = 3, k: k0 = 3 }: { n?: number; k?: number }) {
  const [n, setN] = useState(n0);
  const [k, setK] = useState(k0);
  const [pos, setPos] = useState(false);
  const [i, setI] = useState(0);
  const all = useMemo(() => compositions(n, k, pos ? 1 : 0), [n, k, pos]);
  const cur = all[Math.min(i, all.length - 1)] ?? [];
  const total = pos ? choose(n - 1, k - 1) : choose(n + k - 1, k - 1);
  const symbols: { star: boolean; t: number }[] = [];
  cur.forEach((c, t) => {
    for (let s = 0; s < c; s++) symbols.push({ star: true, t });
    if (t < k - 1) symbols.push({ star: false, t });
  });
  const reset = () => setI(0);
  return (
    <WidgetFrame title="ستاره و خط" icon="grid">
      <Seg
        value={pos ? 'pos' : 'any'}
        onChange={(v) => (setPos(v === 'pos'), reset())}
        options={[
          { v: 'any', label: 'انتخاب دلخواه' },
          { v: 'pos', label: 'از هر نوع حداقل یکی' },
        ]}
      />
      <div className="sb-row" aria-label="ردیف ستاره‌ها و خط‌ها">
        {symbols.map((s, j) =>
          s.star ? (
            <span key={j} className="sb-star" style={{ color: TONES[s.t] }}>
              ★
            </span>
          ) : (
            <span key={j} className="sb-bar" />
          ),
        )}
        {symbols.length === 0 && <span className="muted">—</span>}
      </div>
      <div className="sb-counts">
        {cur.map((c, t) => (
          <span key={t} style={{ borderColor: TONES[t] }}>
            {FLOWERS[t]}: <b>{fmt(c)}</b>
          </span>
        ))}
      </div>
      <div className="graph-tools">
        <button onClick={() => setI((x) => (x + all.length - 1) % all.length)}>قبلی</button>
        <span>
          حالت {fmt(Math.min(i, all.length - 1) + 1)} از {fmt(all.length)}
        </span>
        <button onClick={() => setI((x) => (x + 1) % all.length)}>بعدی</button>
      </div>
      <Slider label="تعداد شاخه‌ها (n)" value={n} min={pos ? k : 0} max={12} step={1} onChange={(v) => (setN(v), reset())} />
      <Slider label="تعداد نوع گل (k)" value={k} min={2} max={5} step={1} onChange={(v) => (setK(v), setN((m) => (pos ? Math.max(m, v) : m)), reset())} />
      <div className="widget-formula">
        <M tex={pos ? `\\binom{n-1}{k-1}=\\binom{${n - 1}}{${k - 1}}=${total}` : `\\binom{n+k-1}{k-1}=\\binom{${n + k - 1}}{${k - 1}}=${total}`} />
      </div>
      <div className="widget-note">
        <Rich
          text={
            pos
              ? `اول از هر نوع یک شاخه برمی‌داریم؛ ${fmt(n - k)} شاخهٔ باقی‌مانده دلخواه انتخاب می‌شوند. این همان تعداد جواب‌های **مثبت** $x_1+\\dots+x_${k}=${n}$ است.`
              : `هر دسته‌گل یک ردیف از ${fmt(n)} ستاره و ${fmt(k - 1)} خط است. ستاره‌های بین دو خط تعداد گل از یک نوع‌اند. پس کافی است از ${fmt(n + k - 1)} جایگاه، جای ${fmt(k - 1)} خط را انتخاب کنیم. این همان تعداد جواب‌های **نامنفی** $x_1+\\dots+x_${k}=${n}$ است.`
          }
        />
      </div>
    </WidgetFrame>
  );
}

type Grid = number[][];
const cyclic = (n: number): Grid => Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => ((c - r + n) % n) + 1));
const PAIRS: Record<number, [Grid, Grid]> = {
  3: [
    [
      [1, 2, 3],
      [2, 3, 1],
      [3, 1, 2],
    ],
    [
      [1, 2, 3],
      [3, 1, 2],
      [2, 3, 1],
    ],
  ],
  4: [
    [
      [2, 3, 4, 1],
      [3, 2, 1, 4],
      [4, 1, 2, 3],
      [1, 4, 3, 2],
    ],
    [
      [2, 3, 4, 1],
      [4, 1, 2, 3],
      [1, 4, 3, 2],
      [3, 2, 1, 4],
    ],
  ],
  5: [
    [
      [1, 4, 2, 5, 3],
      [4, 2, 5, 3, 1],
      [2, 5, 3, 1, 4],
      [5, 3, 1, 4, 2],
      [3, 1, 4, 2, 5],
    ],
    [
      [3, 1, 4, 2, 5],
      [5, 3, 1, 4, 2],
      [2, 5, 3, 1, 4],
      [4, 2, 5, 3, 1],
      [1, 4, 2, 5, 3],
    ],
  ],
};

/** Cells that repeat a value in their row or column. */
function clashes(g: Grid): Set<string> {
  const bad = new Set<string>();
  const n = g.length;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      for (let c2 = 0; c2 < n; c2++) {
        if (c2 !== c && g[r][c] === g[r][c2]) bad.add(`${r},${c}`);
        if (c2 !== r && g[r][c] === g[c2][c]) bad.add(`${r},${c}`);
      }
  return bad;
}

/**
 * Latin squares: tap a cell to change its number; repeats in a row or column turn red. In «متعامد» mode a second square
 * B is laid next to A and the pairs (a, b) are shown; a repeated pair means A and B are not orthogonal.
 */
export function LatinLab({ mode: initial = 'single' }: { mode?: 'single' | 'pair' }) {
  const [mode, setMode] = useState<'single' | 'pair'>(initial);
  const [n, setN] = useState(initial === 'pair' ? 3 : 4);
  const [A, setA] = useState<Grid>(() => (initial === 'pair' ? PAIRS[3][0] : cyclic(4)));
  const [B, setB] = useState<Grid>(() => PAIRS[3][1]);
  const load = (m: number, md = mode) => {
    setN(m);
    if (md === 'pair') {
      setA(PAIRS[m][0].map((r) => [...r]));
      setB(PAIRS[m][1].map((r) => [...r]));
    } else setA(cyclic(m));
  };
  const bump = (g: Grid, set: (x: Grid) => void, r: number, c: number) => set(g.map((row, i) => row.map((v, j) => (i === r && j === c ? (v % n) + 1 : v))));
  const badA = clashes(A);
  const badB = clashes(B);
  const latinA = badA.size === 0;
  const latinB = badB.size === 0;
  const pairCount = new Map<string, number>();
  if (mode === 'pair') A.forEach((row, r) => row.forEach((a, c) => pairCount.set(`${a}${B[r][c]}`, (pairCount.get(`${a}${B[r][c]}`) ?? 0) + 1)));
  const repeated = [...pairCount.entries()].filter(([, v]) => v > 1).map(([k]) => k);
  const orth = mode === 'pair' && latinA && latinB && repeated.length === 0;

  const grid = (g: Grid, bad: Set<string>, set: (x: Grid) => void, label: string) => (
    <div className="latin-wrap">
      <div className="latin-label">{label}</div>
      <div className="latin" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }} dir="ltr">
        {g.map((row, r) =>
          row.map((v, c) => (
            <button key={`${r}${c}`} className={`latin-cell${bad.has(`${r},${c}`) ? ' bad' : ''}`} onClick={() => bump(g, set, r, c)} aria-label={`سطر ${r + 1} ستون ${c + 1}: ${v}`}>
              {fmt(v)}
            </button>
          )),
        )}
      </div>
    </div>
  );

  return (
    <WidgetFrame title={mode === 'pair' ? 'مربع‌های لاتین متعامد' : 'مربع لاتین'} icon="grid">
      <Seg
        value={mode}
        onChange={(m) => (setMode(m), load(m === 'pair' ? 3 : 4, m))}
        options={[
          { v: 'single', label: 'یک مربع' },
          { v: 'pair', label: 'دو مربع (متعامد؟)' },
        ]}
      />
      <div className="graph-tools">
        {[3, 4, 5].map((m) => (
          <button key={m} onClick={() => load(m)} aria-pressed={m === n}>
            {fmt(m)}×{fmt(m)}
          </button>
        ))}
        {mode === 'single' && (
          <>
            <button onClick={() => setA((g) => [g[1], g[0], ...g.slice(2)])}>جابه‌جایی سطر ۱ و ۲</button>
            <button onClick={() => setA((g) => g.map((row) => row.map((v) => (v % n) + 1)))}>جایگشت اعداد</button>
          </>
        )}
        <button onClick={() => load(n)}>از نو</button>
      </div>
      <div className="latin-row">
        {grid(A, badA, setA, 'A')}
        {mode === 'pair' && grid(B, badB, setB, 'B')}
      </div>
      {mode === 'pair' && (
        <div className="latin-wrap">
          <div className="latin-label">درایه‌های نظیر کنار هم</div>
          <div className="latin pairs" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }} dir="ltr">
            {A.map((row, r) =>
              row.map((a, c) => {
                const key = `${a}${B[r][c]}`;
                return (
                  <span key={`${r}${c}`} className={`latin-cell pair${repeated.includes(key) ? ' bad' : ''}`}>
                    {fmt(a)}
                    {fmt(B[r][c])}
                  </span>
                );
              }),
            )}
          </div>
        </div>
      )}
      <div className="widget-note">
        <Rich
          text={
            mode === 'single'
              ? latinA
                ? 'این یک **مربع لاتین** است: در هیچ سطر و هیچ ستونی عدد تکراری نیست. جابه‌جایی دو سطر یا جایگشت روی اعداد را امتحان کن؛ باز هم لاتین می‌ماند. روی خانه‌ها بزن تا عددشان عوض شود.'
                : 'خانه‌های قرمز در سطر یا ستونشان تکراری‌اند؛ پس این جدول مربع لاتین نیست.'
              : !latinA || !latinB
                ? 'اول هر دو جدول باید مربع لاتین باشند (خانهٔ قرمز یعنی تکرار در سطر یا ستون).'
                : orth
                  ? `هر ${fmt(n * n)} عدد دورقمی متمایزند؛ پس A و B **متعامدند**. هر خانه را عوض کنی، ممکن است تعامد از بین برود.`
                  : `زوج‌های تکراری قرمزند (${repeated.map((k) => fmt(Number(k))).join('، ')})؛ پس A و B متعامد نیستند.`
          }
        />
      </div>
    </WidgetFrame>
  );
}
