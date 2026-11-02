import { useId, useState } from 'react';
import { fmt } from '../../lib/digits';
import { M, Rich } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

/* ریاضی ۱، فصل ۱: an interval builder on the number line, and a Venn board for set operations. */

type End = 'open' | 'closed' | 'inf';

/** A static number line with intervals [from, to, closedLeft, closedRight]; ±Infinity ends draw an arrow. */
export function NumberLine({ parts, x = [-5, 5] }: { parts: [number, number, boolean, boolean][]; x?: [number, number] }) {
  const W = 320;
  const [x0, x1] = x;
  const X = (v: number) => 20 + ((v - x0) / (x1 - x0)) * (W - 40);
  const ticks = Array.from({ length: x1 - x0 + 1 }, (_, i) => x0 + i);
  return (
    <svg viewBox={`0 0 ${W} 64`} className="set-line numline" role="img" aria-label="بازه روی محور اعداد">
      <line x1={4} y1={30} x2={W - 4} y2={30} className="set-axis" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={X(v)} y1={25} x2={X(v)} y2={35} className="set-axis" />
          <text x={X(v)} y={54} className="set-tick">
            {fmt(v)}
          </text>
        </g>
      ))}
      {parts.map(([a, b, ca, cb], i) => {
        const l = Number.isFinite(a) ? X(a) : 8;
        const r = Number.isFinite(b) ? X(b) : W - 8;
        return (
          <g key={i}>
            <line x1={l} y1={30} x2={r} y2={30} className="set-range" />
            {!Number.isFinite(a) && <path d={`M ${l + 8} 23 L ${l} 30 L ${l + 8} 37`} className="set-arrow" />}
            {!Number.isFinite(b) && <path d={`M ${r - 8} 23 L ${r} 30 L ${r - 8} 37`} className="set-arrow" />}
            {Number.isFinite(a) && <circle cx={l} cy={30} r={6} className={ca ? 'set-dot' : 'set-hole'} />}
            {Number.isFinite(b) && <circle cx={r} cy={30} r={6} className={cb ? 'set-dot' : 'set-hole'} />}
          </g>
        );
      })}
    </svg>
  );
}

/** Pick both ends of an interval (open, closed or infinite) and see it on the line, in all three notations. */
export function IntervalLab() {
  const [a, setA] = useState(-2);
  const [b, setB] = useState(3);
  const [left, setLeft] = useState<End>('closed');
  const [right, setRight] = useState<End>('open');
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const W = 320;
  const X = (v: number) => 20 + ((v + 6) / 12) * (W - 40);
  const x0 = left === 'inf' ? 8 : X(lo);
  const x1 = right === 'inf' ? W - 8 : X(hi);
  const empty = lo === hi && (left === 'open' || right === 'open') && left !== 'inf' && right !== 'inf';
  const point = lo === hi && left === 'closed' && right === 'closed';
  const L = left === 'inf' ? '(-\\infty' : `${left === 'open' ? '(' : '['}${lo}`;
  const R = right === 'inf' ? '+\\infty)' : `${hi}${right === 'open' ? ')' : ']'}`;
  const ineqL = left === 'inf' ? '' : `${lo} ${left === 'open' ? '<' : '\\le'} `;
  const ineqR = right === 'inf' ? '' : ` ${right === 'open' ? '<' : '\\le'} ${hi}`;
  const ineq = left === 'inf' && right === 'inf' ? 'x \\in \\mathbb{R}' : `${ineqL}x${ineqR}`;
  const endBtn = (v: End, set: (e: End) => void, inf: string) => (
    <Seg<End>
      value={v}
      onChange={set}
      options={[
        { v: 'closed', label: 'بسته' },
        { v: 'open', label: 'باز' },
        { v: 'inf', label: <M tex={inf} /> },
      ]}
    />
  );
  return (
    <WidgetFrame title="بازه‌ساز روی محور" icon="eye">
      <svg viewBox={`0 0 ${W} 64`} className="set-line" role="img" aria-label="بازه روی محور اعداد">
        <line x1={4} y1={36} x2={W - 4} y2={36} className="set-axis" />
        {Array.from({ length: 13 }, (_, i) => i - 6).map((v) => (
          <g key={v}>
            <line x1={X(v)} y1={31} x2={X(v)} y2={41} className="set-axis" />
            <text x={X(v)} y={58} className="set-tick">
              {fmt(v)}
            </text>
          </g>
        ))}
        {!empty && <line x1={x0} y1={36} x2={x1} y2={36} className="set-range" />}
        {left === 'inf' && !empty && <path d={`M ${x0 + 8} 29 L ${x0} 36 L ${x0 + 8} 43`} className="set-arrow" />}
        {right === 'inf' && !empty && <path d={`M ${x1 - 8} 29 L ${x1} 36 L ${x1 - 8} 43`} className="set-arrow" />}
        {left !== 'inf' && <circle cx={X(lo)} cy={36} r={6} className={left === 'closed' && !empty ? 'set-dot' : 'set-hole'} />}
        {right !== 'inf' && !(point && lo === hi) && <circle cx={X(hi)} cy={36} r={6} className={right === 'closed' && !empty ? 'set-dot' : 'set-hole'} />}
      </svg>
      <div className="stack" style={{ gap: 6 }}>
        <div className="row small" style={{ gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span className="bold">سر چپ</span>
          {endBtn(left, setLeft, '-\\infty')}
        </div>
        {left !== 'inf' && <Slider label="از" value={a} min={-6} max={6} step={1} onChange={setA} />}
        <div className="row small" style={{ gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span className="bold">سر راست</span>
          {endBtn(right, setRight, '+\\infty')}
        </div>
        {right !== 'inf' && <Slider label="تا" value={b} min={-6} max={6} step={1} onChange={setB} />}
      </div>
      <div className="widget-note">
        {empty ? (
          <Rich text={`با دو سر برابر و یک سرِ باز، هیچ عددی در بازه نیست: مجموعهٔ تهی $\\varnothing$.`} />
        ) : point ? (
          <Rich text={`با دو سر برابر و بسته، فقط یک عدد می‌ماند: $[${lo},${hi}]=\\{${lo}\\}$؛ مجموعه‌ای متناهی با یک عضو.`} />
        ) : (
          <>
            <div dir="ltr" className="center">
              <M tex={`${L},\\ ${R}`} />
              <span className="muted"> &nbsp;·&nbsp; </span>
              <M tex={`\\{x \\in \\mathbb{R} \\mid ${ineq}\\}`} />
            </div>
            <Rich
              text={`نقطهٔ توپُر یعنی آن سر جزو بازه است (کروشه) و نقطهٔ توخالی یعنی نیست (پرانتز). کنار $\\infty$ همیشه پرانتز می‌گذاریم، چون بی‌نهایت عدد نیست. این بازه بی‌شمار عضو دارد؛ پس ==نامتناهی== است.`}
            />
          </>
        )}
      </div>
    </WidgetFrame>
  );
}

/* ---------------- Venn board ---------------- */

type Region = 'a' | 'ab' | 'b' | 'n';
const OPS: { tex: string; regions: Region[]; say: string }[] = [
  { tex: "A\\cup B", regions: ['a', 'ab', 'b'], say: 'هر عضوی که دست‌کم در یکی از دو مجموعه باشد.' },
  { tex: "A\\cap B", regions: ['ab'], say: 'فقط عضوهای مشترک.' },
  { tex: 'A-B', regions: ['a'], say: 'عضوهای $A$ که در $B$ نیستند؛ همان $A\\cap B\'$.' },
  { tex: 'B-A', regions: ['b'], say: 'عضوهای $B$ که در $A$ نیستند. ترتیب مهم است: $A-B\\ne B-A$.' },
  { tex: "A'", regions: ['b', 'n'], say: 'هر چیزی از مرجع $U$ که در $A$ نیست: $A\'=U-A$.' },
  { tex: "(A\\cup B)'", regions: ['n'], say: 'بیرون هر دو دایره. دمورگان: با $A\'\\cap B\'$ یکی است.' },
  { tex: "A'\\cap B'", regions: ['n'], say: 'نه در $A$، نه در $B$. دقیقاً همان $(A\\cup B)\'$.' },
  { tex: "(A\\cap B)'", regions: ['a', 'b', 'n'], say: 'همه‌جا جز بخش مشترک. دمورگان: با $A\'\\cup B\'$ یکی است.' },
];
const ELEMS: Record<Region, number[]> = { a: [1, 2, 3], ab: [4, 5, 6], b: [7, 8], n: [9, 10] };

/** U = {1..10}, A = {1..6}, B = {4..8}: tap an operation and see its region shaded and its members listed. */
export function VennLab() {
  const [i, setI] = useState(0);
  const id = useId().replace(/:/g, '');
  const op = OPS[i];
  const on = (r: Region) => op.regions.includes(r);
  const members = (['a', 'ab', 'b', 'n'] as Region[]).filter(on).flatMap((r) => ELEMS[r]).sort((x, y) => x - y);
  const A = { cx: 120, cy: 85, r: 58 };
  const B = { cx: 196, cy: 85, r: 58 };
  const pos: Record<Region, [number, number][]> = {
    a: [[88, 70], [100, 100], [76, 98]],
    ab: [[158, 62], [158, 88], [158, 114]],
    b: [[222, 72], [228, 102]],
    n: [[28, 28], [292, 150]],
  };
  return (
    <WidgetFrame title="نمودار ون زنده" icon="eye">
      <div className="lab-asks" role="group" aria-label="عمل روی مجموعه‌ها" style={{ justifyContent: 'center' }}>
        {OPS.map((o, k) => (
          <button key={o.tex} className={`chip${k === i ? ' primary' : ''}`} aria-pressed={k === i} onClick={() => setI(k)} dir="ltr">
            <M tex={o.tex} />
          </button>
        ))}
      </div>
      <svg viewBox="0 0 316 172" className="venn" role="img" aria-label={`ناحیهٔ ${op.tex}`}>
        <defs>
          <mask id={`${id}-noB`}>
            <rect width="316" height="172" fill="#fff" />
            <circle {...B} fill="#000" />
          </mask>
          <mask id={`${id}-noA`}>
            <rect width="316" height="172" fill="#fff" />
            <circle {...A} fill="#000" />
          </mask>
          <mask id={`${id}-out`}>
            <rect width="316" height="172" fill="#fff" />
            <circle {...A} fill="#000" />
            <circle {...B} fill="#000" />
          </mask>
          <clipPath id={`${id}-inB`}>
            <circle {...B} />
          </clipPath>
        </defs>
        <rect x={4} y={4} width={308} height={164} rx={14} className={`venn-u${on('n') ? ' on' : ''}`} mask={`url(#${id}-out)`} />
        <rect x={4} y={4} width={308} height={164} rx={14} className="venn-edge" />
        <circle {...A} className={`venn-r${on('a') ? ' on' : ''}`} mask={`url(#${id}-noB)`} />
        <circle {...B} className={`venn-r${on('b') ? ' on' : ''}`} mask={`url(#${id}-noA)`} />
        <circle {...A} className={`venn-r${on('ab') ? ' on' : ''}`} clipPath={`url(#${id}-inB)`} />
        <circle {...A} className="venn-edge" />
        <circle {...B} className="venn-edge" />
        <text x={70} y={40} className="venn-name">A</text>
        <text x={246} y={40} className="venn-name">B</text>
        <text x={290} y={24} className="venn-name small">U</text>
        {(Object.keys(pos) as Region[]).flatMap((r) =>
          ELEMS[r].map((v, k) => (
            <text key={v} x={pos[r][k][0]} y={pos[r][k][1]} className={`venn-el${on(r) ? ' on' : ''}`}>
              {fmt(v)}
            </text>
          )),
        )}
      </svg>
      <div className="widget-note">
        <div dir="ltr" className="center">
          <M tex={`${op.tex} = ${members.length ? `\\{${members.join(',\\ ')}\\}` : '\\varnothing'}`} />
        </div>
        <Rich text={op.say} />
        <div className="tiny muted">
          <Rich text={`مرجع $U=\\{1,\\dots,10\\}$، $A=\\{1,\\dots,6\\}$ و $B=\\{4,\\dots,8\\}$.`} />
        </div>
      </div>
    </WidgetFrame>
  );
}
