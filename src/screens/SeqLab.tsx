import { useMemo, useState } from 'react';
import type { PlotSpec } from '../content/types';
import { Plot } from '../components/Plot';
import { M, Rich } from '../components/Rich';
import { Seg, Slider } from '../components/widgets/common';
import { fmt, texOf, toEn } from '../lib/digits';
import { ExprError, tidy } from '../lib/expr';
import { compileRule, diffsOf, generalTex, indexOf, kindOf, ratiosOf, sumOf, termsOf, type Rule } from '../lib/seq';

/**
 * «آزمایشگاه دنباله»: the student types a general term in n (or builds an arithmetic or geometric sequence
 * with sliders) and sees the terms, their graph, the differences and ratios, the verdict, the sum, and can
 * ask for any term or find which term equals a number. Runs in the browser; no AI.
 */

type Mode = 'rule' | 'arith' | 'geo';

const EXAMPLES: { label: string; rule: string }[] = [
  { label: 'عددهای فرد', rule: '2n - 1' },
  { label: 'توان‌های ۲', rule: '2^n' },
  { label: 'مربع‌ها', rule: 'n^2' },
  { label: 'عددهای مثلثی', rule: 'n(n + 1)/2' },
  { label: 'کسرهای واحد', rule: '1/n' },
  { label: 'علامت یکی‌درمیان', rule: '(-1)^n' },
  { label: 'هندسی با ۳', rule: '5 * 3^(n - 1)' },
  { label: 'کاهشی', rule: '20 - 3n' },
];

const num = (v: number) => texOf(tidy(v), 3);

/** A round grid step for a range, so the dot plot stays readable. */
function niceStep(span: number): number {
  const raw = span / 6;
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

const parseNum = (s: string) => {
  const v = Number(toEn(s).replace('٫', '.').replace(/[−–]/g, '-'));
  return s.trim() !== '' && Number.isFinite(v) ? v : null;
};

export function SeqLab() {
  const [mode, setMode] = useState<Mode>('rule');
  const [src, setSrc] = useState('2n - 1');
  const [a1, setA1] = useState(2);
  const [d, setD] = useState(3);
  const [q, setQ] = useState(2);
  const [count, setCount] = useState(8);
  const [kRaw, setKRaw] = useState('20');
  const [mRaw, setMRaw] = useState('');

  const built = useMemo((): { fn: Rule; tex: string } | ExprError => {
    if (mode === 'arith') return { fn: (n) => a1 + (n - 1) * d, tex: `${num(a1)} + (n - 1)${d < 0 ? `\\left(${num(d)}\\right)` : `\\times ${num(d)}`}` };
    if (mode === 'geo') return { fn: (n) => a1 * Math.pow(q, n - 1), tex: `${num(a1)} \\times ${q < 0 ? `\\left(${num(q)}\\right)` : num(q)}^{\\,n-1}` };
    try {
      return compileRule(src);
    } catch (e) {
      return e instanceof ExprError ? e : new ExprError('این عبارت را نفهمیدم');
    }
  }, [mode, src, a1, d, q]);

  const ok = !(built instanceof ExprError);
  const terms = useMemo(() => (ok ? termsOf(built.fn, count) : []), [built, ok, count]);
  const kind = useMemo(() => kindOf(terms), [terms]);
  const diffs = diffsOf(terms);
  const ratios = ratiosOf(terms);
  const k = parseNum(kRaw);
  const m = parseNum(mRaw);
  const kth = ok && k !== null && Number.isInteger(k) && k >= 1 ? tidy(built.fn(k)) : null;
  const where = ok && m !== null ? indexOf(built.fn, m) : null;

  const spec = useMemo((): PlotSpec | null => {
    const pts = terms.map((v, i) => [i + 1, v] as [number, number]).filter(([, v]) => Number.isFinite(v));
    if (pts.length === 0) return null;
    const ys = pts.map(([, v]) => v);
    let lo = Math.min(0, ...ys);
    let hi = Math.max(0, ...ys);
    if (hi - lo < 1e-9) hi = lo + 1;
    const pad = (hi - lo) * 0.1;
    lo -= pad;
    hi += pad;
    const yStep = niceStep(hi - lo);
    return {
      x: [0, count + 1],
      y: [Math.floor(lo / yStep) * yStep, Math.ceil(hi / yStep) * yStep],
      xStep: count > 10 ? 2 : 1,
      yStep,
      height: 280,
      axisNames: ['n', 'a_n'],
      curves: [{ pts: [], marks: pts }],
    };
  }, [terms, count]);

  const verdict = (() => {
    const first = terms[0];
    switch (kind.type) {
      case 'const':
        return `همهٔ جمله‌ها برابر $${num(kind.value)}$اند: دنبالهٔ ثابت. هم ==دنبالهٔ حسابی== است (قدر نسبت $0$) و${kind.value !== 0 ? ' هم ==دنبالهٔ هندسی== (قدر نسبت $1$).' : ' چون جمله‌ها صفرند، هندسی حسابش نمی‌کنیم.'}`;
      case 'arith':
        return `فاصلهٔ هر دو جملهٔ پشت سر هم همیشه $${num(kind.d)}$ است؛ پس ==دنبالهٔ حسابی== با جملهٔ اول $${num(first)}$ و ==قدر نسبت== $d = ${num(kind.d)}$ است.`;
      case 'geo':
        return `هر جمله $${num(kind.q)}$ برابرِ جملهٔ قبلی است؛ پس ==دنبالهٔ هندسی== با جملهٔ اول $${num(first)}$ و ==قدر نسبت== $r = ${num(kind.q)}$ است.`;
      default:
        return `${kind.why} پس این دنباله نه حسابی است و نه هندسی.`;
    }
  })();
  const general = ok && terms.length ? generalTex(kind, terms[0], num) : null;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Seg<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { v: 'rule', label: 'جملهٔ عمومی' },
              { v: 'arith', label: 'حسابی' },
              { v: 'geo', label: 'هندسی' },
            ]}
          />
        </div>
        {mode === 'rule' ? (
          <div className="lab-fn">
            <div className="row" style={{ gap: 8 }}>
              <span className="lab-dot" style={{ background: 'var(--plot-main)' }} aria-hidden />
              <label className="lab-name" htmlFor="seq-rule" dir="ltr">
                a(n) =
              </label>
              <input
                id="seq-rule"
                className="text-input lab-input"
                dir="ltr"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={src}
                placeholder="2n + 1"
                onChange={(e) => setSrc(e.target.value)}
              />
            </div>
            <div className="lab-read" aria-live="polite">
              {built instanceof ExprError ? (
                <span className="lab-err">{built.message}</span>
              ) : (
                <span dir="ltr">
                  <M tex={`a_n = ${built.tex}`} />
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="stack" style={{ gap: 4 }}>
            <Slider label={<M tex="a_1" />} value={a1} min={-10} max={10} step={1} onChange={setA1} />
            {mode === 'arith' ? (
              <Slider label={<M tex="d" />} value={d} min={-5} max={5} step={0.5} onChange={setD} />
            ) : (
              <Slider label={<M tex="r" />} value={q} min={-3} max={3} step={0.5} skipZero onChange={setQ} />
            )}
            {ok && (
              <div className="lab-read" dir="ltr">
                <M tex={`a_n = ${built.tex}`} />
              </div>
            )}
          </div>
        )}
        <Slider label="تعداد جمله‌ها" value={count} min={4} max={15} step={1} onChange={setCount} />
      </div>

      {ok && terms.length > 0 && (
        <>
          <div className="card stack" style={{ gap: 10 }}>
            <b>جمله‌ها</b>
            <div className="seq-table" role="table" aria-label="جمله‌های دنباله">
              <div className="seq-row" role="row">
                <span className="seq-h" role="rowheader">
                  <M tex="n" />
                </span>
                {terms.map((_, i) => (
                  <span key={i} className="seq-c muted" role="cell">
                    {fmt(i + 1)}
                  </span>
                ))}
              </div>
              <div className="seq-row" role="row">
                <span className="seq-h" role="rowheader">
                  <M tex="a_n" />
                </span>
                {terms.map((v, i) => (
                  <span key={i} className="seq-c bold" role="cell">
                    {Number.isFinite(v) ? <M tex={num(v)} /> : '—'}
                  </span>
                ))}
              </div>
              <div className="seq-row" role="row">
                <span className="seq-h" role="rowheader">
                  تفاضل
                </span>
                {diffs.map((v, i) => (
                  <span key={i} className={`seq-c seq-gap${kind.type === 'arith' ? ' hit' : ''}`} role="cell">
                    {Number.isFinite(v) ? <M tex={num(v)} /> : '—'}
                  </span>
                ))}
              </div>
              <div className="seq-row" role="row">
                <span className="seq-h" role="rowheader">
                  نسبت
                </span>
                {ratios.map((v, i) => (
                  <span key={i} className={`seq-c seq-gap${kind.type === 'geo' ? ' hit' : ''}`} role="cell">
                    {Number.isFinite(v) ? <M tex={num(v)} /> : '—'}
                  </span>
                ))}
              </div>
            </div>
            <p className="tiny muted">«تفاضل» یعنی هر جمله منهای جملهٔ قبلی و «نسبت» یعنی هر جمله تقسیم بر جملهٔ قبلی.</p>
          </div>

          {spec && (
            <div className="card lab-plot">
              <Plot spec={spec} label="نمودار نقطه‌ای جمله‌های دنباله" />
              <p className="tiny muted center">
                <Rich text="نمودار دنباله فقط چند نقطهٔ جداست، نه یک خط پیوسته؛ چون $n$ فقط عدد طبیعی است." />
              </p>
            </div>
          )}

          <div className="card stack" style={{ gap: 10 }}>
            <b>نتیجه</b>
            <div className="lab-answer" aria-live="polite">
              <div>
                <Rich text={verdict} />
              </div>
              {general && mode === 'rule' && (kind.type === 'arith' || kind.type === 'geo') && (
                <div>
                  <Rich text={`جملهٔ عمومی به شکل کتاب: $${general}$`} />
                </div>
              )}
              <div>
                <Rich text={`مجموع ${fmt(count)} جملهٔ اول: $S_{${count}} = ${num(sumOf(terms))}$`} />
              </div>
            </div>
          </div>

          <div className="card stack" style={{ gap: 10 }}>
            <b>از دنباله بپرس</b>
            <label className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className="small bold">جملهٔ چندم را می‌خواهی؟</span>
              <input className="text-input lab-input" dir="ltr" inputMode="numeric" value={kRaw} onChange={(e) => setKRaw(e.target.value)} style={{ maxWidth: 110 }} />
            </label>
            <div className="lab-answer" aria-live="polite">
              {k === null || !Number.isInteger(k) || k < 1 ? (
                <span className="small muted">یک عدد طبیعی بنویس؛ مثلاً ۲۰ یا ۱۰۰.</span>
              ) : kth !== null && Number.isFinite(kth) ? (
                <Rich text={`$a_{${k}} = ${num(kth)}$`} />
              ) : (
                <Rich text={`جملهٔ $${k}$ام تعریف نشده است.`} />
              )}
            </div>
            <label className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className="small bold">کدام جمله برابر این عدد است؟</span>
              <input className="text-input lab-input" dir="ltr" inputMode="decimal" value={mRaw} placeholder="99" onChange={(e) => setMRaw(e.target.value)} style={{ maxWidth: 110 }} />
            </label>
            {m !== null && (
              <div className="lab-answer" aria-live="polite">
                {where !== null ? (
                  <Rich text={`$a_{${where}} = ${num(m)}$؛ یعنی جملهٔ ${fmt(where)}ام.`} />
                ) : (
                  <Rich text={`هیچ‌کدام از ${fmt(2000)} جملهٔ اول برابر $${num(m)}$ نیست. یعنی معادلهٔ $a_n = ${num(m)}$ در این بازه جواب طبیعی ندارد.`} />
                )}
              </div>
            )}
          </div>
        </>
      )}

      {mode === 'rule' && (
        <div className="card stack" style={{ gap: 8 }}>
          <b>چند نمونه برای شروع</b>
          <div className="lab-asks">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                className="chip"
                onClick={() => {
                  setSrc(ex.rule);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
