import { useMemo, useState } from 'react';
import type { PlotSpec } from '../content/types';
import { Plot } from '../components/Plot';
import { M, Rich } from '../components/Rich';
import { Seg, Slider } from '../components/widgets/common';
import { fmt, texOf } from '../lib/digits';
import { countTex, eventsFor, exact, playable, sampleSpace, trial, type Exp, type Outcome } from '../lib/prob';

/**
 * «آزمایشگاه احتمال»: the student picks a textbook experiment (coins, dice, a bag of marbles) and an event,
 * sees its probability by counting equally likely outcomes, then repeats the experiment 1 to 1000 times at a
 * go and watches the relative frequency settle near that probability. Runs in the browser; no AI.
 */

type Kind = Exp['kind'];
const MAX_TRIALS = 10_000;

const EXAMPLES: { label: string; exp: Exp; ev: string }[] = [
  { label: 'مجموع ۷ با دو تاس', exp: { kind: 'die', count: 2 }, ev: 'sum7' },
  { label: 'دست‌کم یک رو با سه سکه', exp: { kind: 'coin', count: 3 }, ev: 'some' },
  { label: 'دو مهرهٔ قرمز از ۳ قرمز و ۵ آبی', exp: { kind: 'urn', red: 3, blue: 5, draws: 2, replace: false }, ev: 'both' },
  { label: 'همان، با جای‌گذاری', exp: { kind: 'urn', red: 3, blue: 5, draws: 2, replace: true }, ev: 'both' },
  { label: 'عدد اول با یک تاس', exp: { kind: 'die', count: 1 }, ev: 'prime' },
  { label: 'دو عدد برابر با دو تاس', exp: { kind: 'die', count: 2 }, ev: 'double' },
];

const p3 = (v: number) => texOf(v, 3);

function Face({ e, o, hit }: { e: Exp; o: Outcome; hit?: boolean }) {
  return (
    <span className={`pl-face${hit ? ' hit' : ''}`}>
      {o.map((v, i) =>
        e.kind === 'coin' ? (
          <span key={i} className={`pl-coin${v ? ' up' : ''}`}>
            {v ? 'ر' : 'پ'}
          </span>
        ) : e.kind === 'die' ? (
          <span key={i} className="pl-die">
            {fmt(v)}
          </span>
        ) : (
          <span key={i} className={`pl-marble${v ? ' red' : ' blue'}`} aria-label={v ? 'قرمز' : 'آبی'} />
        ),
      )}
    </span>
  );
}

export function ProbLab() {
  const [kind, setKind] = useState<Kind>('die');
  const [coins, setCoins] = useState<1 | 2 | 3>(2);
  const [dice, setDice] = useState<1 | 2>(2);
  const [red, setRed] = useState(3);
  const [blue, setBlue] = useState(5);
  const [draws, setDraws] = useState<1 | 2>(2);
  const [replace, setReplace] = useState(false);
  const [evId, setEvId] = useState('sum7');

  const exp: Exp = kind === 'coin' ? { kind, count: coins } : kind === 'die' ? { kind, count: dice } : { kind, red, blue, draws, replace };
  const events = eventsFor(exp);
  const ev = events.find((x) => x.id === evId) ?? events[0];
  const ok = playable(exp);
  const key = `${JSON.stringify(exp)}|${ev.id}`;
  const ex = ok ? exact(exp, ev) : null;

  // Cumulative number of times the event happened after each trial, for this experiment and event only.
  const [runs, setRuns] = useState<{ key: string; hits: number[]; last: Outcome | null }>({ key, hits: [], last: null });
  const cur = runs.key === key ? runs : { key, hits: [], last: null };
  const n = cur.hits.length;
  const k = n ? cur.hits[n - 1] : 0;

  const run = (times: number) => {
    if (!ok) return;
    const hits = cur.hits.slice();
    let last: Outcome | null = cur.last;
    let c = k;
    for (let i = 0; i < times && hits.length < MAX_TRIALS; i++) {
      last = trial(exp);
      if (ev.test(last)) c += 1;
      hits.push(c);
    }
    setRuns({ key, hits, last });
  };

  const apply = (x: (typeof EXAMPLES)[number]) => {
    const e = x.exp;
    setKind(e.kind);
    if (e.kind === 'coin') setCoins(e.count);
    else if (e.kind === 'die') setDice(e.count);
    else {
      setRed(e.red);
      setBlue(e.blue);
      setDraws(e.draws);
      setReplace(e.replace);
    }
    setEvId(x.ev);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const spec = useMemo((): PlotSpec | null => {
    if (!ex || n === 0) return null;
    const xMax = Math.max(10, n);
    const every = Math.max(1, Math.ceil(n / 300));
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i += every) pts.push([i + 1, (100 * cur.hits[i]) / (i + 1)]);
    if (pts[pts.length - 1][0] !== n) pts.push([n, (100 * k) / n]);
    const raw = xMax / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const xStep = (raw / mag <= 2 ? 2 : raw / mag <= 5 ? 5 : 10) * mag;
    return {
      x: [0, xMax],
      y: [0, 100],
      xStep,
      yStep: 25,
      height: 240,
      axisNames: ['n', '٪'],
      curves: [
        { pts: [[0, 100 * ex.p], [xMax, 100 * ex.p]], color: 'alt', dashed: true },
        { pts, color: 'main', width: 2.5 },
      ],
    };
  }, [cur.hits, n, k, ex]);

  // The whole sample space, with the outcomes in the event marked, when it is small enough to read.
  const space = ok && exp.kind !== 'urn' ? sampleSpace(exp) : null;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Seg<Kind>
            value={kind}
            onChange={setKind}
            options={[
              { v: 'coin', label: 'سکه' },
              { v: 'die', label: 'تاس' },
              { v: 'urn', label: 'کیسهٔ مهره' },
            ]}
          />
        </div>
        {kind === 'coin' && <Slider label="تعداد سکه‌ها" value={coins} min={1} max={3} step={1} onChange={(v) => setCoins(v as 1 | 2 | 3)} />}
        {kind === 'die' && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <Seg<'1' | '2'>
              value={String(dice) as '1' | '2'}
              onChange={(v) => setDice(Number(v) as 1 | 2)}
              options={[
                { v: '1', label: 'یک تاس' },
                { v: '2', label: 'دو تاس' },
              ]}
            />
          </div>
        )}
        {kind === 'urn' && (
          <div className="stack" style={{ gap: 6 }}>
            <Slider label="مهرهٔ قرمز" value={red} min={0} max={8} step={1} onChange={setRed} />
            <Slider label="مهرهٔ آبی" value={blue} min={0} max={8} step={1} onChange={setBlue} />
            <div className="pl-bag" aria-label={`${fmt(red)} مهرهٔ قرمز و ${fmt(blue)} مهرهٔ آبی`}>
              {Array.from({ length: red }, (_, i) => (
                <span key={`r${i}`} className="pl-marble red" />
              ))}
              {Array.from({ length: blue }, (_, i) => (
                <span key={`b${i}`} className="pl-marble blue" />
              ))}
            </div>
            <div className="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
              <Seg<'1' | '2'>
                value={String(draws) as '1' | '2'}
                onChange={(v) => setDraws(Number(v) as 1 | 2)}
                options={[
                  { v: '1', label: 'یک مهره' },
                  { v: '2', label: 'دو مهره' },
                ]}
              />
              {draws === 2 && (
                <Seg<'no' | 'yes'>
                  value={replace ? 'yes' : 'no'}
                  onChange={(v) => setReplace(v === 'yes')}
                  options={[
                    { v: 'no', label: 'با هم (بدون جای‌گذاری)' },
                    { v: 'yes', label: 'با جای‌گذاری' },
                  ]}
                />
              )}
            </div>
          </div>
        )}
        <div className="stack" style={{ gap: 6 }}>
          <span className="small bold">
            <Rich text="پیشامد $A$:" />
          </span>
          <div className="lab-asks" role="group" aria-label="پیشامد">
            {events.map((x) => (
              <button key={x.id} className="chip" aria-pressed={x.id === ev.id} onClick={() => setEvId(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!ok ? (
        <div className="card">
          <span className="lab-err">برای این آزمایش به مهرهٔ بیشتری در کیسه نیاز است.</span>
        </div>
      ) : (
        ex && (
          <>
            <div className="card stack" style={{ gap: 10 }}>
              <b>احتمال با شمردن</b>
              <div className="lab-answer" aria-live="polite">
                <div>
                  <Rich text={`همهٔ حالت‌ها هم‌شانس‌اند. فضای نمونه $S$ و پیشامد $A$ را می‌شمریم:`} />
                </div>
                <span dir="ltr" className="pl-tex">
                  <M tex={`${countTex(exp)} ,\\quad n(A) = ${ex.nA}`} />
                </span>
                <span dir="ltr" className="pl-tex">
                  <M tex={`P(A) = \\dfrac{n(A)}{n(S)} = \\dfrac{${ex.nA}}{${ex.nS}}${ex.num !== ex.nA ? ` = \\dfrac{${ex.num}}{${ex.den}}` : ''} \\approx ${p3(ex.p)}`} />
                </span>
              </div>
              {space && space.length <= 36 && (
                <>
                  <div className={`pl-space${exp.kind === 'die' && exp.count === 2 ? ' grid6' : ''}`} aria-label="فضای نمونه">
                    {space.map((o, i) => (
                      <Face key={i} e={exp} o={o} hit={ev.test(o)} />
                    ))}
                  </div>
                  <p className="tiny muted">حالت‌های رنگی همان عضوهای پیشامد A هستند.</p>
                </>
              )}
            </div>

            <div className="card stack" style={{ gap: 10 }}>
              <b>حالا آزمایش کن</b>
              <div className="row wrap" style={{ gap: 8 }}>
                {[1, 10, 100, 1000].map((t) => (
                  <button key={t} className="btn sm" onClick={() => run(t)} disabled={n >= MAX_TRIALS}>
                    {fmt(t)} بار
                  </button>
                ))}
                <button className="btn sm ghost" onClick={() => setRuns({ key, hits: [], last: null })} disabled={n === 0}>
                  از نو
                </button>
              </div>
              {cur.last && (
                <div className="row" style={{ gap: 10 }}>
                  <span className="small muted">آخرین نتیجه:</span>
                  <Face e={exp} o={cur.last} hit={ev.test(cur.last)} />
                  <span className={`small bold ${ev.test(cur.last) ? 'pl-yes' : 'muted'}`}>
                    <Rich text={ev.test(cur.last) ? '$A$ رخ داد' : '$A$ رخ نداد'} />
                  </span>
                </div>
              )}
              <div className="lab-answer" aria-live="polite">
                {n === 0 ? (
                  <span className="small muted">یکی از دکمه‌ها را بزن. هر بار آزمایش واقعاً با شانس انجام می‌شود.</span>
                ) : (
                  <>
                    <div>
                      <Rich text={`در ${fmt(n)} بار آزمایش، پیشامد $A$ ${fmt(k)} بار رخ داد.`} />
                    </div>
                    <div>
                      <Rich text={`فراوانی نسبی: $\\dfrac{${k}}{${n}} \\approx ${p3(k / n)}$`} />
                    </div>
                    <div>
                      <Rich text={`فاصله تا احتمال: $${p3(Math.abs(k / n - ex.p))}$`} />
                    </div>
                  </>
                )}
              </div>
              {spec && (
                <div className="lab-plot">
                  <Plot spec={spec} label="فراوانی نسبی پیشامد بر حسب تعداد آزمایش‌ها، و خط‌چین احتمال" />
                  <p className="tiny muted center">خط پررنگ: فراوانی نسبی به درصد. خط‌چین: احتمالی که با شمردن به دست آمد.</p>
                </div>
              )}
              <p className="tiny muted">
                هرچه آزمایش را بیشتر تکرار کنی، فراوانی نسبی معمولاً به احتمال نزدیک‌تر می‌شود (قانون اعداد بزرگ). ولی در چند آزمایش کم، هر نتیجه‌ای ممکن
                است؛ احتمال نمی‌گوید بار بعد چه می‌شود.
              </p>
            </div>
          </>
        )
      )}

      <div className="card stack" style={{ gap: 8 }}>
        <b>چند نمونه از مسئله‌های کتاب</b>
        <div className="lab-asks">
          {EXAMPLES.map((x) => (
            <button key={x.label} className="chip" onClick={() => apply(x)}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
