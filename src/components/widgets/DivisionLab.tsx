import { useMemo, useState } from 'react';
import { fmt } from '../../lib/digits';
import { polyEval, polyTex, texNum } from '../../lib/fns';
import { M, Rich } from '../Rich';
import { Seg, Slider, WidgetFrame } from './common';

type Key = 'a' | 'b' | 'c' | 'd';

const PRESETS: Record<Key, number[]> = {
  a: [1, 0, 1, -2], // x³ + x − 2
  b: [1, 0, 0, 2], // x³ + 2
  c: [2, -3, -3, 2], // 2x³ − 3x² − 3x + 2
  d: [1, 0, 0, 0, -16], // x⁴ − 16
};

function fracTex(n: number): string {
  // show simple fractions nicely
  for (const den of [1, 2, 3, 4, 6, 8, 9, 27]) {
    const num = n * den;
    if (Math.abs(num - Math.round(num)) < 1e-9) {
      const r = Math.round(num);
      if (den === 1) return String(r);
      return `${r < 0 ? '-' : ''}\\frac{${Math.abs(r)}}{${den}}`;
    }
  }
  return texNum(n);
}

function polyTexFrac(c: number[]): string {
  const n = c.length - 1;
  let s = '';
  c.forEach((k, i) => {
    const p = n - i;
    if (Math.abs(k) < 1e-12) return;
    const sign = k < 0 ? '-' : s ? '+' : '';
    const abs = Math.abs(k);
    const coef = abs === 1 && p > 0 ? '' : fracTex(abs);
    const pow = p === 0 ? '' : p === 1 ? 'x' : `x^{${p}}`;
    s += `${sign}${coef}${pow}`;
  });
  return s || '0';
}

export function DivisionLab() {
  const [key, setKey] = useState<Key>('a');
  const [a, setA] = useState(2);
  const [b, setB] = useState(1);
  const f = PRESETS[key];

  const { steps, q, r } = useMemo(() => {
    const work = f.slice();
    const quotient: number[] = [];
    const st: { term: string; sub: string; rem: string }[] = [];
    for (let i = 0; i <= work.length - 2; i++) {
      const coef = work[i] / a;
      quotient.push(coef);
      const deg = work.length - 2 - i;
      const termTex = polyTexFrac([coef, ...Array(deg).fill(0)]);
      const prod = [coef * a, coef * b];
      work[i] -= prod[0];
      work[i + 1] -= prod[1];
      const remPoly = work.slice(i + 1);
      st.push({
        term: termTex,
        sub: `(${polyTexFrac(prod.concat(Array(deg).fill(0)))})`,
        rem: polyTexFrac(remPoly),
      });
    }
    return { steps: st, q: quotient, r: work[work.length - 1] };
  }, [key, a, b]); // f depends on key

  const root = -b / a;
  const fRoot = polyEval(f, root);
  const divisor = polyTex([a, b]);

  return (
    <WidgetFrame title="آزمایشگاه تقسیم و قضیهٔ باقی‌مانده" icon="formula">
      <Seg
        value={key}
        onChange={setKey}
        options={(Object.keys(PRESETS) as Key[]).map((k) => ({ v: k, label: <M tex={polyTex(PRESETS[k])} /> }))}
      />
      <Seg
        value={String(a) as '1' | '2' | '3'}
        onChange={(v) => setA(Number(v))}
        options={[
          { v: '1', label: <M tex="a=1" /> },
          { v: '2', label: <M tex="a=2" /> },
          { v: '3', label: <M tex="a=3" /> },
        ]}
      />
      <Slider label={<M tex="b" />} value={b} min={-3} max={3} step={1} onChange={setB} />
      <div className="widget-formula">
        <M tex={`\\dfrac{${polyTex(f)}}{${divisor}}`} />
      </div>
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={i}>
            <div className="s-body small">
              <Rich text={`جملهٔ بعدی خارج‌قسمت: $${s.term}$ ؛ ضرب در مقسوم‌علیه و کم کردن: $-${s.sub}$ ⟵ می‌ماند: $${s.rem}$`} />
            </div>
          </li>
        ))}
      </ol>
      <div className="widget-note">
        <Rich
          text={`$${polyTex(f)}=(${divisor})\\left(${polyTexFrac(q)}\\right)${r < 0 ? '' : '+'}${fracTex(r)}$`}
        />
      </div>
      <div className="widget-note">
        <Rich
          text={`ریشهٔ مقسوم‌علیه: $${divisor}=0 \\Rightarrow x=${fracTex(root)}$ و $f(${fracTex(root)})=${fracTex(fRoot)}$ — دقیقاً همان باقی‌مانده! ${
            Math.abs(r) < 1e-9 ? '✅ باقی‌مانده صفر است، پس f بر مقسوم‌علیه **بخش‌پذیر** است.' : ''
          }`}
        />
      </div>
      <p className="tiny muted center">باقی‌مانده = {fmt(r, 4)}</p>
    </WidgetFrame>
  );
}
