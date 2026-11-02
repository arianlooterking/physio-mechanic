import { useMemo, useState } from 'react';
import { fmt } from '../../lib/digits';
import { M, Rich } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (...xs: number[]) => xs.reduce((a, b) => (a * b) / gcd(a, b));

/** Region counts of a three-set Venn diagram: only A, only B, only C, AB, AC, BC (exactly two), ABC, none. */
type Regions = { a: number; b: number; c: number; ab: number; ac: number; bc: number; abc: number; none: number };

function VennSvg({ r, three, names }: { r: Regions; three: boolean; names: [string, string, string] }) {
  const A = three ? { x: 118, y: 92 } : { x: 120, y: 105 };
  const B = three ? { x: 182, y: 92 } : { x: 190, y: 105 };
  const C = { x: 150, y: 148 };
  const R = three ? 56 : 66;
  const t = (x: number, y: number, v: number, key: string) => (
    <text key={key} x={x} y={y} fontSize={14} fontWeight={800} textAnchor="middle" fill="var(--ink)">
      {fmt(v)}
    </text>
  );
  return (
    <svg viewBox="0 0 300 220" className="plot" role="img" aria-label="نمودار ون با تعداد عضوهای هر ناحیه">
      <rect x={4} y={4} width={292} height={212} rx={14} fill="none" stroke="var(--line)" strokeWidth={2} />
      <text x={20} y={26} fontSize={13} fontWeight={800} fill="var(--ink-3)">
        S
      </text>
      <circle cx={A.x} cy={A.y} r={R} fill="var(--math)" fillOpacity={0.14} stroke="var(--math)" strokeWidth={2.5} />
      <circle cx={B.x} cy={B.y} r={R} fill="var(--bad)" fillOpacity={0.12} stroke="var(--bad)" strokeWidth={2.5} />
      {three && <circle cx={C.x} cy={C.y} r={R} fill="var(--ok)" fillOpacity={0.12} stroke="var(--ok)" strokeWidth={2.5} />}
      <text x={A.x - R + 6} y={A.y - R + 18} fontSize={13} fontWeight={800} fill="var(--math)">
        {names[0]}
      </text>
      <text x={B.x + R - 18} y={B.y - R + 18} fontSize={13} fontWeight={800} fill="var(--bad)">
        {names[1]}
      </text>
      {three && (
        <text x={C.x + R - 14} y={C.y + R - 4} fontSize={13} fontWeight={800} fill="var(--ok)">
          {names[2]}
        </text>
      )}
      {three
        ? [
            t(92, 80, r.a, 'a'),
            t(208, 80, r.b, 'b'),
            t(150, 182, r.c, 'c'),
            t(150, 70, r.ab, 'ab'),
            t(120, 138, r.ac, 'ac'),
            t(180, 138, r.bc, 'bc'),
            t(150, 112, r.abc, 'abc'),
          ]
        : [t(90, 110, r.a, 'a'), t(155, 110, r.ab, 'ab'), t(220, 110, r.b, 'b')]}
      {t(270, 205, r.none, 'none')}
    </svg>
  );
}

/**
 * Inclusion–exclusion two ways: the book's sports class (two sets, choose the counts) and «which of 1…N are divisible by
 * none of a, b, c» (three sets, counted with [N / lcm]).
 */
export function InclusionLab({ mode: initial = 'sport' }: { mode?: 'sport' | 'divis' }) {
  const [mode, setMode] = useState<'sport' | 'divis'>(initial);
  const [S, setS] = useState(25);
  const [nA, setA] = useState(15);
  const [nB, setB] = useState(14);
  const [nAB, setAB] = useState(9);
  const [N, setN] = useState(400);
  const [d, setD] = useState<[number, number, number]>([3, 4, 5]);

  const ab = Math.min(nAB, nA, nB);
  const union2 = nA + nB - ab;
  const sportOk = union2 <= S;
  const sportR: Regions = { a: nA - ab, b: nB - ab, c: 0, ab, ac: 0, bc: 0, abc: 0, none: S - union2 };

  const div = useMemo(() => {
    const [p, q, s] = d;
    const f = (k: number) => Math.floor(N / k);
    const cA = f(p);
    const cB = f(q);
    const cC = f(s);
    const cAB = f(lcm(p, q));
    const cAC = f(lcm(p, s));
    const cBC = f(lcm(q, s));
    const cABC = f(lcm(p, q, s));
    const union = cA + cB + cC - cAB - cAC - cBC + cABC;
    const reg: Regions = {
      abc: cABC,
      ab: cAB - cABC,
      ac: cAC - cABC,
      bc: cBC - cABC,
      a: cA - cAB - cAC + cABC,
      b: cB - cAB - cBC + cABC,
      c: cC - cAC - cBC + cABC,
      none: N - union,
    };
    return { cA, cB, cC, cAB, cAC, cBC, cABC, union, reg };
  }, [N, d]);

  const setDiv = (i: number, v: number) => setD((old) => old.map((x, j) => (j === i ? v : x)) as [number, number, number]);

  return (
    <WidgetFrame title="اصل شمول و عدم شمول" icon="grid">
      <Seg
        value={mode}
        onChange={setMode}
        options={[
          { v: 'sport', label: 'دو مجموعه (ورزش)' },
          { v: 'divis', label: 'سه مجموعه (بخش‌پذیری)' },
        ]}
      />
      {mode === 'sport' ? (
        <>
          <VennSvg r={sportR} three={false} names={['F', 'V', '']} />
          <Slider label="کل کلاس |S|" value={S} min={10} max={40} step={1} onChange={setS} />
          <Slider label="فوتبال |F|" value={nA} min={0} max={S} step={1} onChange={setA} />
          <Slider label="والیبال |V|" value={nB} min={0} max={S} step={1} onChange={setB} />
          <Slider label="هر دو |F∩V|" value={ab} min={0} max={Math.min(nA, nB)} step={1} onChange={setAB} />
          <div className="widget-formula">
            <M tex={`|F\\cup V|=${nA}+${nB}-${ab}=${union2}`} />
            <div className="widget-sub">
              <M tex={`|S|-|F\\cup V|=${S}-${union2}=${S - union2}`} />
            </div>
          </div>
          <div className="widget-note">
            <Rich
              text={
                sportOk
                  ? `افرادی که هر دو رشته را بازی می‌کنند در $|F|$ و در $|V|$ دو بار شمرده شده‌اند؛ برای همین یک بار کمشان می‌کنیم. ${fmt(S - union2)} نفر نه فوتبال بازی می‌کنند نه والیبال.`
                  : `این عددها با هم جور نیستند: $|F\\cup V|$ از کل کلاس بیشتر شده است. «هر دو» را بیشتر کن.`
              }
            />
          </div>
        </>
      ) : (
        <>
          <VennSvg r={div.reg} three names={[`÷${d[0]}`, `÷${d[1]}`, `÷${d[2]}`]} />
          <Slider label="تا عدد N" value={N} min={30} max={1000} step={10} onChange={setN} />
          <div className="graph-tools">
            {[0, 1, 2].map((i) => (
              <span key={i} className="div-pick">
                <button onClick={() => setDiv(i, Math.max(2, d[i] - 1))} aria-label="کمتر">
                  −
                </button>
                <b>{fmt(d[i])}</b>
                <button onClick={() => setDiv(i, Math.min(12, d[i] + 1))} aria-label="بیشتر">
                  +
                </button>
              </span>
            ))}
          </div>
          <div className="widget-formula">
            <M tex={`|A\\cup B\\cup C|=${div.union}`} />
            <div className="widget-sub">
              <M tex={`${div.cA}+${div.cB}+${div.cC}-${div.cAB}-${div.cAC}-${div.cBC}+${div.cABC}`} />
            </div>
            <div className="widget-sub">
              <M tex={`${N}-${div.union}=${N - div.union}`} />
            </div>
          </div>
          <div className="widget-note">
            <Rich
              text={`از ۱ تا ${fmt(N)}، تعداد مضرب‌های $k$ برابر $\\left[\\tfrac{${N}}{k}\\right]$ است و بخش‌پذیری هم‌زمان بر دو عدد یعنی بخش‌پذیری بر ک‌م‌م آن‌ها (مثلاً $[${d[0]},${d[1]}]=${lcm(d[0], d[1])}$). **${fmt(N - div.union)}** عدد بر هیچ‌کدام از ${fmt(d[0])}، ${fmt(d[1])} و ${fmt(d[2])} بخش‌پذیر نیستند (عدد گوشهٔ پایین).`}
            />
          </div>
        </>
      )}
    </WidgetFrame>
  );
}

/**
 * Pigeonhole: drop pigeons into holes. «بدترین حالت» spreads them as evenly as possible, so the fullest hole has exactly
 * ⌈m / n⌉ pigeons; «تصادفی» shows any other placement only makes the fullest hole fuller.
 */
export function PigeonLab() {
  const [n, setN] = useState(4);
  const [m, setM] = useState(9);
  const [seed, setSeed] = useState(0);
  const holes = useMemo(() => {
    const h = Array(n).fill(0);
    if (seed === 0) for (let i = 0; i < m; i++) h[i % n]++;
    else {
      let s = seed;
      for (let i = 0; i < m; i++) {
        s = (s * 1103515245 + 12345) % 2147483648;
        h[s % n]++;
      }
    }
    return h;
  }, [n, m, seed]);
  const max = Math.max(...holes);
  const need = Math.ceil(m / n);
  const k = Math.floor((m - 1) / n);
  return (
    <WidgetFrame title="اصل لانه‌کبوتری" icon="grid">
      <div className="pigeon-holes">
        {holes.map((c, i) => (
          <div key={i} className={`pigeon-hole${c === max ? ' full' : ''}`}>
            <div className="pigeon-stack">
              {Array.from({ length: c }, (_, j) => (
                <span key={j} className="pigeon" />
              ))}
            </div>
            <span className="pigeon-count">{fmt(c)}</span>
          </div>
        ))}
      </div>
      <Slider label="لانه‌ها (n)" value={n} min={2} max={12} step={1} onChange={setN} />
      <Slider label="کبوترها (m)" value={m} min={1} max={40} step={1} onChange={setM} />
      <div className="graph-tools">
        <button onClick={() => setSeed(0)} aria-pressed={seed === 0}>
          بدترین حالت (پخش یکنواخت)
        </button>
        <button onClick={() => setSeed(Math.floor(Math.random() * 1e6) + 1)} aria-pressed={seed !== 0}>
          چیدن تصادفی
        </button>
      </div>
      <div className="widget-formula">
        <M tex={`${m}=${k}\\times${n}+${m - k * n}`} />
        <div className="widget-sub" dir="rtl">
          <Rich text={`پس لانه‌ای با دست‌کم **${fmt(k + 1)}** کبوتر هست.`} />
        </div>
      </div>
      <div className="widget-note">
        <Rich
          text={`حتی اگر کبوترها را تا جای ممکن یکنواخت پخش کنیم، پرترین لانه $\\left\\lceil\\tfrac{${m}}{${n}}\\right\\rceil=${need}$ کبوتر دارد. ${seed ? `در این چیدن تصادفی پرترین لانه ${fmt(max)} کبوتر دارد که از ${fmt(need)} کمتر نیست.` : ''} ${m > n ? '' : 'وقتی کبوترها از لانه‌ها بیشتر نباشند، ممکن است هر کبوتر لانهٔ خودش را داشته باشد.'}`}
        />
      </div>
    </WidgetFrame>
  );
}
