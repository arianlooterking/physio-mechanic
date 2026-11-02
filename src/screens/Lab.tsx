import { useMemo, useState } from 'react';
import type { PlotCurve, PlotSpec } from '../content/types';
import { Icon } from '../components/Icon';
import { Plot } from '../components/Plot';
import { M, Rich } from '../components/Rich';
import { Seg, Slider } from '../components/widgets/common';
import { fmt, texOf, toEn } from '../lib/digits';
import { go, type LabTab } from '../lib/nav';
import { AverageMassLab, DensityLab, IsotopeLab, MagnitudeLab, PrecisionLab, RightTriangleLab, ShellsLab, UnitCircleLab, UnitsLab } from '../components/widgets/Grade10Labs';
import { SigFigLab } from '../components/widgets/SigFigLab';
import { BalanceLab } from './BalanceLab';
import { ProbLab } from './ProbLab';
import { SeqLab } from './SeqLab';
import { compile, ExprError, extrema, roots, slope, tidy, type Compiled, type Scope } from '../lib/expr';

/**
 * «آزمایشگاه آزاد»: a closed sandbox. The student types any function (or a plain calculation), sees its
 * graph, moves a, b, c, and asks questions (value, roots, turning points, intersections, tangent).
 * Everything runs in the browser; nothing is sent anywhere and no AI is involved.
 */

const COLORS: PlotCurve['color'][] = ['main', 'alt', 'ok'];
const DOT = ['var(--plot-main)', 'var(--plot-alt)', 'var(--ok)'];
const NAMES = ['f', 'g', 'h'];

const EXAMPLES: { label: string; fns: string[]; ask?: Ask }[] = [
  { label: 'سهمی', fns: ['x^2 - 2x - 3'], ask: 'roots' },
  { label: 'درجه سوم', fns: ['x^3 - 3x'], ask: 'ext' },
  { label: 'انتقال نمودار', fns: ['x^2', 'a(x - b)^2 + c'] },
  { label: 'قدرمطلق', fns: ['|x - 2| + 1', '-|x| + 3'], ask: 'cross' },
  { label: 'رادیکال', fns: ['sqrt(x + 4)'] },
  { label: 'سینوس', fns: ['2sin(x)', 'sin(2x)'] },
  { label: 'نمایی و لگاریتم', fns: ['2^x', 'log(x)'] },
  { label: 'جزء صحیح', fns: ['[x]'] },
  { label: 'خط مماس', fns: ['x^2 / 4'], ask: 'tangent' },
  { label: 'تابع گویا', fns: ['(x^2 - 1)/(x - 1)'] },
];

const WINDOWS = { s: 5, m: 10, l: 20 } as const;
type Win = keyof typeof WINDOWS;
type Ask = 'value' | 'roots' | 'ext' | 'cross' | 'tangent';

function tryCompile(src: string): Compiled | ExprError | null {
  if (!src.trim()) return null;
  try {
    const c = compile(src);
    if (c.vars.has('n')) return new ExprError('در نمودار تابع، متغیر x است. برای n به بخش «دنباله» برو.');
    return c;
  } catch (e) {
    return e instanceof ExprError ? e : new ExprError('این عبارت را نفهمیدم');
  }
}

const n = (v: number) => `$${texOf(tidy(v), 3)}$`;
const pt = (x: number, y: number) => `$(${texOf(tidy(x), 3)}\\,,\\,${texOf(tidy(y), 3)})$`;

type Tab = 'fn' | LabTab;

const SUBS: Record<Tab, string> = {
  fn: 'هر تابعی را بنویس، نمودارش را ببین و از آن سؤال بپرس.',
  seq: 'یک دنباله بساز یا جملهٔ عمومی‌اش را بنویس؛ جمله‌ها، نمودار، نوعش و مجموعش را ببین.',
  prob: 'سکه بینداز، تاس بریز یا از کیسه مهره بیرون بیاور؛ احتمال را بشمر و با هزار بار آزمایش مقایسه کن.',
  units: 'یکاها را با زنجیرهٔ ضریب تبدیل کن، مرتبهٔ بزرگی را تخمین بزن، با خط‌کش و کولیس اندازه بگیر، رقم‌های بامعنا را بشمار و چگالی را ببین.',
  atom: 'هسته بساز و ایزوتوپ‌ها را ببین، جرم اتمی میانگین را حساب کن و الکترون‌ها را در لایه‌ها بچین.',
  trig: 'زاویه را بچرخان؛ نسبت‌های مثلثاتی را در مثلث قائم‌الزاویه و روی دایرهٔ مثلثاتی ببین.',
  balance: 'ضریب‌ها را کم و زیاد کن تا اتم‌های هر عنصر در دو طرف واکنش برابر شود؛ بیست واکنش کتاب‌های شیمی، از آسان تا سخت.',
};

/** The grade-10 sandboxes: several labs of one subject on one page. */
function LabStack({ tab }: { tab: 'units' | 'atom' | 'trig' }) {
  if (tab === 'units')
    return (
      <div className="stack">
        <UnitsLab />
        <MagnitudeLab />
        <PrecisionLab />
        <SigFigLab />
        <DensityLab />
      </div>
    );
  if (tab === 'atom')
    return (
      <div className="stack">
        <IsotopeLab />
        <AverageMassLab />
        <ShellsLab />
      </div>
    );
  return (
    <div className="stack">
      <RightTriangleLab />
      <UnitCircleLab />
    </div>
  );
}

export function Lab({ tab }: { tab?: LabTab }) {
  const t: Tab = tab ?? 'fn';
  return (
    <div className="stack lab">
      <div>
        <h1 className="page-title">آزمایشگاه آزاد</h1>
        <p className="page-sub">
          {SUBS[t]} همه‌چیز همین‌جا روی گوشی حساب می‌شود.
        </p>
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Seg<Tab>
          value={t}
          onChange={(v) => go(v === 'fn' ? { name: 'lab' } : { name: 'lab', tab: v }, true)}
          options={[
            { v: 'fn', label: 'تابع و نمودار' },
            { v: 'seq', label: 'دنباله' },
            { v: 'prob', label: 'احتمال' },
            { v: 'trig', label: 'مثلثات' },
            { v: 'units', label: 'یکا و اندازه' },
            { v: 'atom', label: 'اتم' },
            { v: 'balance', label: 'موازنهٔ واکنش' },
          ]}
        />
      </div>
      {t === 'seq' ? (
        <SeqLab />
      ) : t === 'prob' ? (
        <ProbLab />
      ) : t === 'fn' ? (
        <FnLab />
      ) : t === 'balance' ? (
        <BalanceLab />
      ) : (
        <LabStack tab={t} />
      )}
    </div>
  );
}

function FnLab() {
  const [srcs, setSrcs] = useState<string[]>(['x^2 - 2x - 3']);
  const [scope, setScope] = useState<Required<Omit<Scope, 'x' | 'n'>>>({ a: 1, b: 0, c: 0 });
  const [win, setWin] = useState<Win>('m');
  const [ask, setAsk] = useState<Ask>('roots');
  const [atRaw, setAtRaw] = useState('1');

  const compiled = useMemo(() => srcs.map(tryCompile), [srcs]);
  const fns = compiled.map((c) => (c && !(c instanceof ExprError) ? c : null));
  const live = fns.map((c, i) => (c ? { i, f: (x: number) => c.fn(x, scope) } : null)).filter((x): x is { i: number; f: (x: number) => number } => x !== null);
  const params = new Set(fns.flatMap((c) => (c ? [...c.vars].filter((v) => v !== 'x') : [])));
  const R = WINDOWS[win];
  const at = Number(toEn(atRaw).replace('٫', '.').replace(/[−–]/g, '-'));
  const atOk = atRaw.trim() !== '' && Number.isFinite(at);

  // The answer to the chosen question: a sentence and the points to mark on the graph.
  const answer = useMemo((): { lines: string[]; marks: [number, number][]; extra: PlotCurve[] } => {
    const marks: [number, number][] = [];
    const extra: PlotCurve[] = [];
    if (live.length === 0) return { lines: [], marks, extra };
    const lines: string[] = [];
    const first = live[0];
    const name = (i: number) => NAMES[i];
    switch (ask) {
      case 'value': {
        if (!atOk) return { lines: ['یک عدد برای $x$ بنویس.'], marks, extra };
        for (const { i, f } of live) {
          const y = f(at);
          if (Number.isFinite(y)) {
            lines.push(`$${name(i)}(${texOf(at, 3)}) = ${texOf(tidy(y), 4)}$`);
            marks.push([at, y]);
          } else lines.push(`$${name(i)}$ در $x = ${texOf(at, 3)}$ تعریف نشده است (این نقطه در دامنه نیست).`);
        }
        break;
      }
      case 'roots': {
        for (const { i, f } of live) {
          const rs = roots(f, -R, R);
          if (rs.length === 0) lines.push(`نمودار $${name(i)}$ در این پنجره محور $x$ها را قطع نمی‌کند.`);
          else {
            lines.push(`ریشه‌های $${name(i)}$: ${rs.map(n).join('، ')}`);
            rs.forEach((r) => marks.push([r, 0]));
          }
        }
        lines.push('ریشه یعنی جایی که $y = 0$ است، یعنی نمودار به محور $x$ها می‌رسد.');
        break;
      }
      case 'ext': {
        for (const { i, f } of live) {
          const es = extrema(f, -R, R);
          if (es.length === 0) lines.push(`$${name(i)}$ در این پنجره نقطهٔ بازگشت ندارد (همه‌جا فقط بالا می‌رود یا فقط پایین).`);
          else
            for (const e of es) {
              lines.push(`${e.type === 'max' ? 'ماکزیمم نسبی' : 'مینیمم نسبی'} $${name(i)}$ در ${pt(e.x, e.y)}`);
              marks.push([e.x, e.y]);
            }
        }
        break;
      }
      case 'cross': {
        if (live.length < 2) return { lines: ['برای پیدا کردن محل برخورد، دو تابع بنویس.'], marks, extra };
        const [p, q] = live;
        const d = (x: number) => p.f(x) - q.f(x);
        const xs = roots(d, -R, R);
        if (xs.length === 0) lines.push(`نمودارهای $${name(p.i)}$ و $${name(q.i)}$ در این پنجره به هم نمی‌رسند.`);
        else {
          lines.push(`نمودارهای $${name(p.i)}$ و $${name(q.i)}$ در ${xs.map((x) => pt(x, p.f(x))).join('، ')} به هم می‌رسند.`);
          xs.forEach((x) => marks.push([x, p.f(x)]));
        }
        lines.push(`محل برخورد یعنی جایی که $${name(p.i)}(x) = ${name(q.i)}(x)$؛ یعنی ریشه‌های $${name(p.i)}(x) - ${name(q.i)}(x)$.`);
        break;
      }
      case 'tangent': {
        if (!atOk) return { lines: ['یک عدد برای $x$ بنویس.'], marks, extra };
        const y0 = first.f(at);
        const m = slope(first.f, at);
        if (!Number.isFinite(y0)) lines.push(`$${name(first.i)}$ در $x = ${texOf(at, 3)}$ تعریف نشده است.`);
        else if (!Number.isFinite(m)) {
          lines.push(`در $x = ${texOf(at, 3)}$ نمودار شکستگی یا پرش دارد؛ آن‌جا خط مماس یکتا نیست و مشتق وجود ندارد.`);
          marks.push([at, y0]);
        } else {
          const b = tidy(y0 - m * at);
          const sign = b < 0 ? '-' : '+';
          lines.push(`شیب خط مماس (مشتق) در این نقطه: $${name(first.i)}'(${texOf(at, 3)}) = ${texOf(m, 4)}$`);
          const mx = m === 0 ? '' : m === 1 ? 'x' : m === -1 ? '-x' : `${texOf(m, 3)}x`;
          const bt = m === 0 ? texOf(b, 3) : b === 0 ? '' : ` ${sign} ${texOf(Math.abs(b), 3)}`;
          lines.push(`معادلهٔ خط مماس: $y = ${mx}${bt}$`);
          marks.push([at, y0]);
          extra.push({ fn: (x) => m * (x - at) + y0, color: 'bad', dashed: true, width: 2.2 });
        }
        break;
      }
    }
    return { lines, marks, extra };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcs, scope, ask, atRaw, win]);

  const spec: PlotSpec = useMemo(
    () => ({
      x: [-R, R],
      y: [-R, R],
      step: R / 5,
      height: 340,
      curves: [
        ...live.map(({ i, f }) => ({ fn: f, color: COLORS[i], width: 3 }) as PlotCurve),
        ...answer.extra,
        ...(answer.marks.length ? [{ pts: [] as [number, number][], marks: answer.marks.filter(([x, y]) => Math.abs(x) <= R && Math.abs(y) <= R) } as PlotCurve] : []),
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [srcs, scope, win, answer],
  );

  const setSrc = (i: number, v: string) => setSrcs((s) => s.map((x, j) => (j === i ? v : x)));
  const needsAt = ask === 'value' || ask === 'tangent';
  const calc = fns[0] && fns[0].vars.size === 0 ? fns[0].fn(0) : null;

  return (
    <>
      <div className="card stack" style={{ gap: 10 }}>
        {srcs.map((src, i) => {
          const c = compiled[i];
          return (
            <div key={i} className="lab-fn">
              <div className="row" style={{ gap: 8 }}>
                <span className="lab-dot" style={{ background: DOT[i] }} aria-hidden />
                <label className="lab-name" htmlFor={`fn-${i}`} dir="ltr">
                  {NAMES[i]}(x) =
                </label>
                <input
                  id={`fn-${i}`}
                  className="text-input lab-input"
                  dir="ltr"
                  inputMode="text"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={src}
                  placeholder="x^2 - 3x + 2"
                  onChange={(e) => setSrc(i, e.target.value)}
                />
                {srcs.length > 1 && (
                  <button className="icon-btn" aria-label={`حذف ${NAMES[i]}`} onClick={() => setSrcs((s) => s.filter((_, j) => j !== i))}>
                    <Icon name="close" size={18} />
                  </button>
                )}
              </div>
              <div className="lab-read" aria-live="polite">
                {c instanceof ExprError ? (
                  <span className="lab-err">{c.message}</span>
                ) : c ? (
                  <span dir="ltr">
                    <M tex={`${NAMES[i]}(x) = ${c.tex}`} />
                    {i === 0 && calc !== null && Number.isFinite(calc) && <M tex={`\\;=\\; ${texOf(tidy(calc), 6)}`} />}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {srcs.length < 3 && (
            <button className="btn sm ghost" onClick={() => setSrcs((s) => [...s, ''])}>
              <Icon name="plus" size={18} /> تابع دیگر
            </button>
          )}
          <span className="tiny muted grow">
            مثال‌ها: <span dir="ltr" style={{ display: 'inline-block' }}>2x+1 · x^2 · sqrt(x) · |x| · [x] · sin(x) · 2^x</span>
          </span>
        </div>
      </div>

      {params.size > 0 && (
        <div className="card stack" style={{ gap: 6 }}>
          <b className="small">پارامترها را حرکت بده و ببین نمودار چه می‌کند</b>
          {(['a', 'b', 'c'] as const)
            .filter((p) => params.has(p))
            .map((p) => (
              <Slider key={p} label={<M tex={p} />} value={scope[p]} min={-5} max={5} step={0.5} onChange={(v) => setScope((s) => ({ ...s, [p]: v }))} />
            ))}
        </div>
      )}

      <div className="card lab-plot">
        <Plot spec={spec} label="نمودار تابع‌هایی که نوشتی" />
        <div className="row" style={{ justifyContent: 'center', marginTop: 6 }}>
          <Seg<Win>
            value={win}
            onChange={setWin}
            options={[
              { v: 's', label: 'نزدیک' },
              { v: 'm', label: 'معمولی' },
              { v: 'l', label: 'دور' },
            ]}
          />
        </div>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <b>از نمودار بپرس</b>
        <div className="lab-asks" role="group" aria-label="سؤال">
          {(
            [
              ['value', 'مقدار در یک نقطه'],
              ['roots', 'ریشه‌ها'],
              ['ext', 'ماکزیمم و مینیمم'],
              ['cross', 'محل برخورد'],
              ['tangent', 'شیب و خط مماس'],
            ] as [Ask, string][]
          ).map(([k, label]) => (
            <button key={k} className={`chip${ask === k ? ' primary' : ''}`} aria-pressed={ask === k} onClick={() => setAsk(k)}>
              {label}
            </button>
          ))}
        </div>
        {needsAt && (
          <label className="row" style={{ gap: 8 }}>
            <span className="small bold">
              <M tex="x =" />
            </span>
            <input className="text-input lab-input" dir="ltr" inputMode="decimal" value={atRaw} onChange={(e) => setAtRaw(e.target.value)} style={{ maxWidth: 140 }} />
          </label>
        )}
        <div className="lab-answer" aria-live="polite">
          {answer.lines.length === 0 ? <span className="small muted">اول یک تابع درست بنویس.</span> : answer.lines.map((l, i) => (
                <div key={i}>
                  <Rich text={l} />
                </div>
              ))}
        </div>
        <p className="tiny muted">جواب‌ها عددی و تا چند رقم اعشار حساب می‌شوند و فقط در پنجرهٔ نمودار (از {fmt(-R)} تا {fmt(R)}) جست‌وجو می‌شوند.</p>
      </div>

      <div className="card stack" style={{ gap: 8 }}>
        <b>چند نمونه برای شروع</b>
        <div className="lab-asks">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              className="chip"
              onClick={() => {
                setSrcs(ex.fns);
                if (ex.ask) setAsk(ex.ask);
                if (ex.fns.some((f) => /[abc]/.test(f.replace(/abs|cbrt|cos|tan|ctg/g, '')))) setScope({ a: 1, b: 0, c: 0 });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
