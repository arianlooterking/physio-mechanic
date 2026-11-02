import { useState } from 'react';
import { M, Rich } from '../Rich';
import { Seg, WidgetFrame } from './common';

type Op = 'and' | 'or' | 'imp' | 'iff';

const OPS: Record<Op, { tex: string; name: string; fn: (p: boolean, q: boolean) => boolean; why: (p: boolean, q: boolean) => string }> = {
  and: {
    tex: 'p\\wedge q',
    name: 'عطفی («و»)',
    fn: (p, q) => p && q,
    why: (p, q) => (p && q ? 'هر دو درست‌اند؛ پس «و» درست است.' : 'دست‌کم یکی نادرست است؛ «و» فقط وقتی درست است که هر دو درست باشند.'),
  },
  or: {
    tex: 'p\\vee q',
    name: 'فصلی («یا»)',
    fn: (p, q) => p || q,
    why: (p, q) => (p || q ? 'دست‌کم یکی درست است؛ پس «یا» درست است.' : 'هر دو نادرست‌اند؛ «یا» فقط در این حالت نادرست است.'),
  },
  imp: {
    tex: 'p\\Rightarrow q',
    name: 'شرطی («اگر... آن‌گاه»)',
    fn: (p, q) => !p || q,
    why: (p, q) =>
      !p ? 'مقدم (p) نادرست است؛ گزارهٔ شرطی «به انتفای مقدم» درست است.' : q ? 'مقدم و تالی هر دو درست‌اند؛ قول عملی شد.' : 'مقدم درست و تالی نادرست: تنها حالتی که شرطی نادرست است (قول شکسته شد!).',
  },
  iff: {
    tex: 'p\\Leftrightarrow q',
    name: 'دوشرطی («اگر و تنها اگر»)',
    fn: (p, q) => p === q,
    why: (p, q) => (p === q ? 'هر دو هم‌ارزش‌اند؛ دوشرطی درست است.' : 'ارزش‌ها فرق دارند؛ دوشرطی نادرست است.'),
  },
};

const V = (b: boolean) => (b ? 'د' : 'ن');

/** Toggle p and q, pick a connective, and see its whole truth table with the current row lit. */
export function TruthLab() {
  const [op, setOp] = useState<Op>('imp');
  const [p, setP] = useState(true);
  const [q, setQ] = useState(false);
  const o = OPS[op];
  const rows: [boolean, boolean][] = [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ];
  const toggle = (val: boolean, set: (b: boolean) => void, label: string) => (
    <button className={`truth-switch ${val ? 'on' : 'off'}`} aria-pressed={val} onClick={() => set(!val)}>
      <M tex={label} /> <b>{val ? 'درست (د)' : 'نادرست (ن)'}</b>
    </button>
  );
  return (
    <WidgetFrame title="جدول ارزش زنده" icon="eye">
      <Seg
        value={op}
        onChange={setOp}
        options={(Object.keys(OPS) as Op[]).map((k) => ({ v: k, label: <M tex={OPS[k].tex.replace(/[pq]/g, '').trim() || OPS[k].tex} /> }))}
      />
      <div className="row" style={{ gap: 8, justifyContent: 'center', margin: '10px 0' }}>
        {toggle(p, setP, 'p')}
        {toggle(q, setQ, 'q')}
      </div>
      <table className="mini-table truth-table">
        <thead>
          <tr>
            <th>
              <M tex="p" />
            </th>
            <th>
              <M tex="q" />
            </th>
            <th>
              <M tex={o.tex} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b]) => {
            const cur = a === p && b === q;
            const val = o.fn(a, b);
            return (
              <tr key={`${a}${b}`} className={cur ? 'cur' : ''} onClick={() => (setP(a), setQ(b))} style={{ cursor: 'pointer' }}>
                <td>{V(a)}</td>
                <td>{V(b)}</td>
                <td className={val ? 'yes' : 'no'}>{V(val)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="widget-note">
        <Rich text={`ترکیب ${o.name}: $${o.tex}$ ${o.fn(p, q) ? '**درست**' : '**نادرست**'} است. ${o.why(p, q)}`} />
      </div>
    </WidgetFrame>
  );
}
