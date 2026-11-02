import { Fragment, useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { M, Rich, TeX } from '../components/Rich';
import { Seg } from '../components/widgets/common';
import {
  allSpecies,
  check,
  ELEMENT_NAMES,
  equationTex,
  LEVEL_NAMES,
  MAX_COEF,
  MIN_COEF,
  nextReveal,
  REACTIONS,
  stateHint,
  strategyHint,
  tally,
  type Reaction,
  type Verdict,
} from '../lib/balance';
import { fmt } from '../lib/digits';
import { sfx } from '../lib/sound';

/**
 * «موازنهٔ واکنش»: a closed set of twenty reactions from the شیمی books, easy to hard. The learner raises and
 * lowers each coefficient, watches the atoms of every element on both sides (a little scale per element), and
 * asks «بررسی» whether it balances with the smallest whole numbers. Hints follow the inspection method.
 * Every step can be undone. Runs in the browser; no AI.
 */

const SOLVED_KEY = 'biomana:lab:balance';

function loadSolved(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(SOLVED_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveSolved(ids: string[]) {
  try {
    localStorage.setItem(SOLVED_KEY, JSON.stringify(ids));
  } catch {
    /* private window: progress lives for this visit only */
  }
}

type Level = '1' | '2' | '3';

export function BalanceLab() {
  const [id, setId] = useState(REACTIONS[0].id);
  const r = REACTIONS.find((x) => x.id === id) ?? REACTIONS[0];
  const [solved, setSolved] = useState<string[]>(loadSolved);

  const pick = (rid: string) => setId(rid);
  const pickLevel = (l: Level) => {
    const L = Number(l);
    const inLevel = REACTIONS.filter((x) => x.level === L);
    setId((inLevel.find((x) => !solved.includes(x.id)) ?? inLevel[0]).id);
  };
  const markSolved = () =>
    setSolved((s) => {
      if (s.includes(r.id)) return s;
      const next = [...s, r.id];
      saveSolved(next);
      return next;
    });
  const next = () => {
    const i = REACTIONS.findIndex((x) => x.id === r.id);
    const after = [...REACTIONS.slice(i + 1), ...REACTIONS.slice(0, i)];
    setId((after.find((x) => !solved.includes(x.id)) ?? after[0]).id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Seg<Level>
            value={String(r.level) as Level}
            onChange={pickLevel}
            options={(['1', '2', '3'] as Level[]).map((l) => ({ v: l, label: LEVEL_NAMES[Number(l) as 1 | 2 | 3] }))}
          />
        </div>
        <div className="lab-asks" role="group" aria-label="واکنش">
          {REACTIONS.filter((x) => x.level === r.level).map((x) => {
            const done = solved.includes(x.id);
            return (
              <button key={x.id} className={`chip${done ? ' done' : ''}`} aria-pressed={x.id === r.id} onClick={() => pick(x.id)}>
                {done && <Icon name="check" size={14} stroke={3} />}
                {x.name}
              </button>
            );
          })}
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>
          موازنه کرده‌ای: {fmt(solved.length)} از {fmt(REACTIONS.length)} واکنش
        </p>
      </div>
      <Bench key={r.id} r={r} onSolved={markSolved} onNext={next} />
    </div>
  );
}

/**
 * A + or − button: tap (or Enter) for one step, hold to keep going; a whole hold is one step for «برگرد».
 * Nothing happens until the press is a tap or a hold, so a finger that starts a scroll here changes nothing.
 */
function StepBtn({ up, label, disabled, onStep }: { up: boolean; label: string; disabled: boolean; onStep: (record: boolean) => boolean }) {
  const t = useRef<{ delay?: number; rep?: number; held?: boolean }>({});
  const stop = () => {
    window.clearTimeout(t.current.delay);
    window.clearInterval(t.current.rep);
    t.current.delay = t.current.rep = undefined;
  };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      className="bl-step"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        stop();
        t.current.held = false;
        t.current.delay = window.setTimeout(() => {
          if (!onStep(true)) return;
          sfx.tap();
          t.current.held = true;
          t.current.rep = window.setInterval(() => {
            if (!onStep(false)) stop();
          }, 90);
        }, 400);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onClick={() => {
        // The click that ends a hold is not another step.
        if (t.current.held) {
          t.current.held = false;
          return;
        }
        if (onStep(true)) sfx.tap();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Icon name={up ? 'plus' : 'minus'} size={18} stroke={2.8} />
    </button>
  );
}

/** One scale per element: the pan with more atoms goes down; level and green when equal. */
function Beam({ left, right }: { left: number; right: number }) {
  const tilt = right > left ? 11 : right < left ? -11 : 0;
  return (
    <svg viewBox="0 0 64 30" className="bl-beam" aria-hidden="true">
      <polygon points="32,14 25,28 39,28" className="bl-fulcrum" />
      <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: '32px 14px', transition: 'transform 0.3s ease' }}>
        <rect x="5" y="11" width="54" height="4" rx="2" className="bl-bar" />
        <rect x="2" y="4" width="13" height="7" rx="2" className="bl-pan" />
        <rect x="49" y="4" width="13" height="7" rx="2" className="bl-pan" />
      </g>
    </svg>
  );
}

const partsTex = (ps: [number, number][]) => ps.map(([c, k]) => `${c}\\times${k}`).join('+');
const elList = (els: string[]) => {
  const xs = els.map((e) => `$\\ce{${e}}$`);
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join('، ')} و ${xs[xs.length - 1]}`;
};

function Bench({ r, onSolved, onNext }: { r: Reaction; onSolved: () => void; onNext: () => void }) {
  const species = allSpecies(r);
  const ones = species.map(() => 1);
  const [coefs, setCoefsState] = useState<number[]>(ones);
  const live = useRef(coefs);
  const [past, setPast] = useState<number[][]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [hints, setHints] = useState(0);
  const [revealed, setRevealed] = useState<number[]>([]);

  const commit = (next: number[], record: boolean): boolean => {
    const cur = live.current;
    if (next.every((v, i) => v === cur[i])) return false;
    if (record) setPast((p) => [...p, cur]);
    live.current = next;
    setCoefsState(next);
    setVerdict(null);
    return true;
  };
  const bump = (i: number, d: 1 | -1, record: boolean) => {
    const cur = live.current;
    const v = Math.min(MAX_COEF, Math.max(MIN_COEF, cur[i] + d));
    return commit(
      cur.map((x, j) => (j === i ? v : x)),
      record,
    );
  };
  const undo = () => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setPast(past.slice(0, -1));
    live.current = prev;
    setCoefsState(prev);
    setVerdict(null);
  };
  const canDouble = coefs.every((c) => c * 2 <= MAX_COEF);
  const double = () => canDouble && commit(coefs.map((c) => c * 2), true);
  const reset = () => {
    commit(ones, true);
    setVerdict(null);
    setHints(0);
    setRevealed([]);
  };
  const doCheck = () => {
    const v = check(r, coefs);
    setVerdict(v);
    if (v.kind === 'ok') {
      sfx.correct();
      onSolved();
    } else if (v.kind === 'unbalanced') sfx.wrong();
    else sfx.tap();
  };
  const reveal = nextReveal(r, coefs, revealed);
  const moreHints = hints < 2 || reveal !== null;
  const askHint = () => {
    if (hints >= 2) {
      if (reveal === null) return;
      setRevealed([...revealed, reveal]);
    }
    setHints(hints + 1);
  };

  const rows = tally(r, coefs);
  const nL = r.left.length;
  const tile = (i: number) => {
    const s = species[i];
    const c = coefs[i];
    return (
      <div className={`bl-sp${revealed.includes(i) ? ' hinted' : ''}`}>
        <StepBtn up label={`ضریب ${s.f} یکی بیشتر`} disabled={c >= MAX_COEF} onStep={(rec) => bump(i, 1, rec)} />
        <output className="bl-coef" aria-label={`ضریب ${s.f}`}>
          {fmt(c)}
        </output>
        <StepBtn up={false} label={`ضریب ${s.f} یکی کمتر`} disabled={c <= MIN_COEF} onStep={(rec) => bump(i, -1, rec)} />
        <span className="bl-f">
          <M tex={`\\ce{${s.f}}`} />
        </span>
      </div>
    );
  };
  const eq = equationTex(r, coefs, true);
  const [lhs, rhs] = eq.split(' -> ');

  return (
    <>
      <div className="card stack" style={{ gap: 8 }}>
        <div className="spread">
          <b className="bl-title">{r.name}</b>
          <span className="chip">{LEVEL_NAMES[r.level]}</span>
        </div>
        <p className="small bl-note">
          <Icon name="bulb" size={18} />
          <span>
            <Rich text={r.note} />
          </span>
        </p>
      </div>

      <div className="card stack" style={{ gap: 14 }}>
        {/* Two groups, so a long equation breaks before the arrow, as it is written on paper. */}
        <div className="bl-eq" dir="ltr">
          <div className="bl-side">
            {r.left.map((_, i) => (
              <Fragment key={i}>
                {i > 0 && <span className="bl-plus">+</span>}
                {tile(i)}
              </Fragment>
            ))}
          </div>
          <div className="bl-side">
            <span className="bl-arrow" aria-label="تولید می‌کند">
              →
            </span>
            {r.right.map((_, i) => (
              <Fragment key={i}>
                {i > 0 && <span className="bl-plus">+</span>}
                {tile(nL + i)}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="row wrap bl-tools">
          <button className="btn sm ghost" onClick={undo} disabled={!past.length}>
            <Icon name="back" size={16} /> برگرد
          </button>
          <button className="btn sm ghost" onClick={double} disabled={!canDouble}>
            همه × ۲
          </button>
          <button className="btn sm ghost" onClick={reset} disabled={coefs.every((c) => c === 1) && hints === 0}>
            <Icon name="refresh" size={16} /> از نو
          </button>
        </div>

        <div className="bl-table" dir="ltr" role="table" aria-label="شمار اتم‌های هر عنصر در دو طرف">
          <div className="bl-tr bl-th" role="row">
            <span role="columnheader">واکنش‌دهنده‌ها</span>
            <span role="columnheader">عنصر</span>
            <span role="columnheader">فراورده‌ها</span>
          </div>
          {rows.map((t) => (
            <div key={t.el} className={`bl-tr ${t.left === t.right ? 'eq' : 'neq'}`} role="row">
              <span className="bl-cnt" role="cell">
                <b>{fmt(t.left)}</b>
                <small>
                  <M tex={partsTex(t.leftParts)} />
                </small>
              </span>
              <span className="bl-mid" role="cell">
                <Beam left={t.left} right={t.right} />
                <span className="bl-el">
                  <M tex={`\\ce{${t.el}}`} />
                  <span className="tiny">{ELEMENT_NAMES[t.el] ?? ''}</span>
                </span>
              </span>
              <span className="bl-cnt" role="cell">
                <b>{fmt(t.right)}</b>
                <small>
                  <M tex={partsTex(t.rightParts)} />
                </small>
              </span>
            </div>
          ))}
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button className="btn ok grow" onClick={doCheck}>
            بررسی
          </button>
          <button className="btn ghost" onClick={askHint} disabled={!moreHints}>
            <Icon name="bulb" size={18} /> راهنمایی
          </button>
        </div>

        {verdict && (
          <div className={`lab-verdict ${verdict.kind}`} aria-live="polite">
            {verdict.kind === 'ok' ? (
              <>
                <b>
                  <Icon name="check" size={18} stroke={3} /> آفرین، موازنه شد!
                </b>
                <TeX tex={eq.length <= 30 ? `\\ce{${eq}}` : `\\begin{aligned}&\\ce{${lhs}}\\\\&\\ce{-> ${rhs}}\\end{aligned}`} />
                <span className="small">
                  <Rich text="همهٔ اتم‌ها در دو طرف برابرند و ضریب‌ها کوچک‌ترین عددهای درست‌اند. حالت‌ها: $\mathrm{(s)}$ جامد، $\mathrm{(l)}$ مایع، $\mathrm{(g)}$ گاز و $\mathrm{(aq)}$ محلول در آب." />
                </span>
                <button className="btn sm" onClick={onNext} style={{ alignSelf: 'flex-start' }}>
                  واکنش بعدی <Icon name="next" size={16} />
                </button>
              </>
            ) : verdict.kind === 'notSimplest' ? (
              <span>
                <b>موازنه است، ولی ساده‌ترین نسبت نیست.</b> همهٔ ضریب‌ها بر {fmt(verdict.by)} بخش‌پذیرند؛ همه را بر {fmt(verdict.by)} تقسیم کن تا کوچک‌ترین
                عددهای درست به دست بیاید.
              </span>
            ) : (
              <span>
                <Rich text={`**هنوز موازنه نیست.** تعداد اتم‌های ${elList(verdict.off)} در دو طرف یکی نیست؛ ردیف‌های قرمز جدول را ببین.`} />
              </span>
            )}
          </div>
        )}

        {hints > 0 && (
          <ol className="bl-hints" aria-live="polite">
            <li>
              <Icon name="bulb" size={18} />
              <span>
                <Rich text={strategyHint(r)} />
              </span>
            </li>
            {hints > 1 && (
              <li>
                <Icon name="target" size={18} />
                <span>
                  <Rich text={stateHint(r, coefs)} />
                </span>
              </li>
            )}
            {revealed.map((k) => (
              <li key={k}>
                <Icon name="eye" size={18} />
                <span>
                  <Rich text={`در جواب نهایی، ضریب $\\ce{${species[k].f}}$ برابر ${fmt(r.answer[k])} است.`} />
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
