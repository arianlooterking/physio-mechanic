import { useState } from 'react';
import { fmt, texOf } from '../../lib/digits';
import { M, Rich } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

/* ریاضی ۱، فصل ۱: a growing pattern of matchsticks and dots, and arithmetic vs geometric growth as bars. */

type Pattern = 'sticks' | 'tri' | 'square';

const PATTERNS: Record<Pattern, { name: string; rule: (n: number) => number; tex: string; why: string }> = {
  sticks: {
    name: 'چوب‌کبریت',
    rule: (n) => 3 * n + 2,
    tex: '3n+2',
    why: 'مثل کتاب: شکل اول ۵ چوب دارد و هر شکل تازه یک میله و یک ستونِ دوچوبی، یعنی ۳ چوب اضافه می‌کند: $5,\\ 8,\\ 11,\\ \\dots$ آیدا می‌گوید $a_n=3n+2$ (ستون اول ۲ چوب، بعد هر بار ۳ تا). آیسا افقی‌ها و عمودی‌ها را جدا می‌شمارد: $a_n=n+2(n+1)$؛ که ساده‌اش همان $3n+2$ است.',
  },
  tri: {
    name: 'عددهای مثلثی',
    rule: (n) => (n * (n + 1)) / 2,
    tex: '\\dfrac{n(n+1)}{2}',
    why: 'ردیف $k$ام $k$ نقطه دارد. دو تا از این مثلث‌ها کنار هم یک مستطیل $n\\times(n+1)$ می‌سازند؛ پس هر مثلث نصف آن است. فاصله‌ها ثابت نیست ($2,\\ 3,\\ 4,\\ \\dots$)، پس دنبالهٔ حسابی نیست.',
  },
  square: {
    name: 'عددهای مربعی',
    rule: (n) => n * n,
    tex: 'n^2',
    why: 'شکل $n$ام یک مربع $n\\times n$ از نقطه‌هاست. هر بار یک «گوشه» به شکل L اضافه می‌شود که $2n-1$ نقطه دارد: $1+3+5+\\dots+(2n-1)=n^2$.',
  },
};

function Figure({ p, n }: { p: Pattern; n: number }) {
  if (p === 'sticks') {
    // A chain of «H»s: n + 1 posts of two matches each, joined by n bars at mid-height.
    const s = 22;
    const w = n * s + 8;
    return (
      <svg viewBox={`0 0 ${w} ${2 * s + 8}`} className="pat-fig" style={{ width: Math.min(w * 1.3, 300) }} aria-hidden>
        {Array.from({ length: n + 1 }, (_, i) => (
          <g key={`v${i}`}>
            <line x1={4 + i * s} y1={5} x2={4 + i * s} y2={2 + s} className="pat-stick" />
            <line x1={4 + i * s} y1={6 + s} x2={4 + i * s} y2={3 + 2 * s} className="pat-stick" />
          </g>
        ))}
        {Array.from({ length: n }, (_, i) => (
          <line key={`h${i}`} x1={7 + i * s} y1={4 + s} x2={1 + (i + 1) * s} y2={4 + s} className="pat-stick" />
        ))}
      </svg>
    );
  }
  const g = 12;
  const pts: [number, number][] = [];
  if (p === 'tri') for (let r = 0; r < n; r++) for (let c = 0; c <= r; c++) pts.push([c * g + ((n - 1 - r) * g) / 2, r * g]);
  else for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) pts.push([c * g, r * g]);
  const w = n * g + 4;
  return (
    <svg viewBox={`-6 -6 ${w + 4} ${n * g + 4}`} className="pat-fig" style={{ width: Math.min(w * 1.4, 220) }} aria-hidden>
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4} className="pat-dot" />
      ))}
    </svg>
  );
}

/** Pick a pattern and the step n; see shape n, the first terms and the general term. */
export function PatternLab() {
  const [p, setP] = useState<Pattern>('sticks');
  const [n, setN] = useState(3);
  const pat = PATTERNS[p];
  const terms = Array.from({ length: 6 }, (_, i) => pat.rule(i + 1));
  return (
    <WidgetFrame title="الگو را بساز" icon="eye">
      <Seg<Pattern> value={p} onChange={setP} options={(Object.keys(PATTERNS) as Pattern[]).map((k) => ({ v: k, label: PATTERNS[k].name }))} />
      <div className="pat-stage">
        <Figure p={p} n={n} />
      </div>
      <Slider label={<span>شکل شمارهٔ</span>} value={n} min={1} max={8} step={1} onChange={setN} />
      <div className="widget-note">
        <div className="center">
          <Rich text={`شکل ${fmt(n)}ام: **${fmt(pat.rule(n))}** ${p === 'sticks' ? 'چوب' : 'نقطه'}`} />
        </div>
        <div dir="ltr" className="center">
          <M tex={`${terms.map((t) => texOf(t)).join(',\\ ')},\\ \\dots`} />
        </div>
        <div dir="ltr" className="center">
          <M tex={`a_n = ${pat.tex}`} />
        </div>
        <Rich text={pat.why} />
      </div>
    </WidgetFrame>
  );
}

/** Same start, two ways to grow: add d each step (arithmetic) or multiply by q (geometric). */
export function GrowLab() {
  const [kind, setKind] = useState<'arith' | 'geo'>('arith');
  const [a1, setA1] = useState(2);
  const [d, setD] = useState(3);
  const [r, setR] = useState(2);
  const terms = Array.from({ length: 7 }, (_, i) => (kind === 'arith' ? a1 + i * d : a1 * Math.pow(r, i)));
  const max = Math.max(1, ...terms.map(Math.abs));
  return (
    <WidgetFrame title="رشد جمع‌شونده یا ضرب‌شونده؟" icon="eye">
      <Seg
        value={kind}
        onChange={setKind}
        options={[
          { v: 'arith', label: 'حسابی (+d)' },
          { v: 'geo', label: 'هندسی (×r)' },
        ]}
      />
      <Slider label={<M tex="t_1" />} value={a1} min={-5} max={10} step={1} onChange={setA1} />
      {kind === 'arith' ? (
        <Slider label={<M tex="d" />} value={d} min={-4} max={6} step={1} onChange={setD} />
      ) : (
        <Slider label={<M tex="r" />} value={r} min={-3} max={3} step={0.5} onChange={setR} />
      )}
      <div className="grow-bars" aria-label="جمله‌های دنباله">
        {terms.map((t, i) => (
          <div key={i} className="grow-col">
            <span className="grow-val">{fmt(Math.round(t * 100) / 100)}</span>
            <div className="grow-track">
              <div className={`grow-bar${t < 0 ? ' neg' : ''}`} style={{ height: `${(Math.abs(t) / max) * 100}%` }} />
            </div>
            <span className="grow-n">
              <M tex={`t_${i + 1}`} />
            </span>
          </div>
        ))}
      </div>
      <div className="widget-note">
        {kind === 'arith' ? (
          <Rich text={`هر ستون از قبلی $${texOf(d)}$ واحد ${d >= 0 ? 'بلندتر' : 'کوتاه‌تر'} است؛ رشد **خطی**. جملهٔ عمومی: $t_n=t_1+(n-1)d=${texOf(a1)}+(n-1)(${texOf(d)})$.`} />
        ) : (
          <Rich
            text={`${r === 0 ? 'قدر نسبت دنبالهٔ هندسی نباید صفر باشد؛ با $r=0$ از جملهٔ دوم همه صفر می‌شوند. ' : ''}هر ستون $${texOf(r)}$ برابرِ قبلی است؛ ${Math.abs(r) > 1 ? 'رشد **نمایی**: اول آرام، بعد انفجاری.' : Math.abs(r) < 1 ? 'با $|r|<1$ جمله‌ها به صفر نزدیک می‌شوند.' : 'با $|r|=1$ اندازه‌ها ثابت می‌ماند.'}${r < 0 ? ' چون $r$ منفی است، علامت‌ها یکی‌درمیان عوض می‌شوند.' : ''} جملهٔ عمومی: $t_n=t_1r^{\\,n-1}$.`}
          />
        )}
      </div>
    </WidgetFrame>
  );
}
