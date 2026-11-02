import { Fragment, useMemo, useState } from 'react';
import { fmt } from '../../lib/digits';
import {
  analyse,
  COUNT_PROBLEMS,
  isProduct,
  rawDigits,
  roundedAt,
  ROUND_PROBLEMS,
  RULE_SIG,
  RULE_TEXT,
  SCI_TEXT,
  target,
  writtenTex,
  type Rule,
} from '../../lib/sigfig';
import { sfx } from '../../lib/sound';
import { Icon } from '../Icon';
import { M, Rich } from '../Rich';
import { Seg, WidgetFrame } from './common';

/**
 * Significant figures for فیزیک ۱ فصل ۱: tap the digits that count, then round a calculator result
 * (× and ÷ keep the fewest significant figures, + and − the fewest decimal places).
 */
export function SigFigLab() {
  const [part, setPart] = useState<'count' | 'round'>('count');
  const [ci, setCi] = useState(0);
  const [ri, setRi] = useState(0);
  const wrap = (k: number, n: number) => ((k % n) + n) % n;
  return (
    <WidgetFrame title="رقم‌های بامعنا" icon="grid">
      <Seg
        value={part}
        onChange={setPart}
        options={[
          { v: 'count', label: 'بشمار' },
          { v: 'round', label: 'جواب را گرد کن' },
        ]}
      />
      {part === 'count' ? (
        <CountTask key={ci} idx={ci} onNext={() => setCi(wrap(ci + 1, COUNT_PROBLEMS.length))} />
      ) : (
        <RoundTask key={ri} idx={ri} onNext={() => setRi(wrap(ri + 1, ROUND_PROBLEMS.length))} />
      )}
    </WidgetFrame>
  );
}

const ORDER: Rule[] = ['nonzero', 'between', 'leading', 'trailingPoint', 'trailingWhole'];

function RuleList({ rules, sci }: { rules: Rule[]; sci?: boolean }) {
  return (
    <ul className="sf-rules">
      {rules.map((r) => (
        <li key={r}>
          <span className={`sf-tag ${RULE_SIG[r] ? 'yes' : 'no'}`}>{RULE_SIG[r] ? 'بامعنا' : 'شمرده نمی‌شود'}</span>
          <Rich text={RULE_TEXT[r]} />
        </li>
      ))}
      {sci && (
        <li>
          <span className="sf-tag">×۱۰</span>
          <Rich text={SCI_TEXT} />
        </li>
      )}
    </ul>
  );
}

function Counter({ idx, of }: { idx: number; of: number }) {
  return (
    <span className="small muted" style={{ flex: 'none', whiteSpace: 'nowrap' }}>
      {fmt(idx + 1)} از {fmt(of)}
    </span>
  );
}

function CountTask({ idx, onNext }: { idx: number; onNext: () => void }) {
  const prob = COUNT_PROBLEMS[idx];
  const w = useMemo(() => analyse(prob.n), [prob.n]);
  const [marks, setMarks] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const n = w.digits.filter((d) => d.sig).length;
  const right = w.digits.every((d, k) => d.sig === marks.includes(k));
  const toggle = (k: number) => {
    setChecked(false);
    sfx.tap();
    setMarks((m) => (m.includes(k) ? m.filter((x) => x !== k) : [...m, k]));
  };
  const cls = (sig: boolean, on: boolean) => (!checked ? '' : sig && on ? ' hit' : sig ? ' miss' : on ? ' bad' : ' skip');
  const rules = ORDER.filter((r) => w.digits.some((d) => d.rule === r));

  return (
    <>
      <div className="spread" style={{ gap: 8 }}>
        <span className="small">روی هر رقم بامعنا بزن؛ اگر اشتباه زدی، دوباره بزن.</span>
        <Counter idx={idx} of={COUNT_PROBLEMS.length} />
      </div>
      <div className="sf-num" dir="ltr" role="group" aria-label="رقم‌های عدد">
        {w.digits.map((d, k) => (
          <Fragment key={k}>
            <button className={`sf-d${cls(d.sig, marks.includes(k))}`} aria-pressed={marks.includes(k)} onClick={() => toggle(k)}>
              {fmt(Number(d.ch))}
            </button>
            {w.point === k + 1 && <span className="sf-point">٫</span>}
          </Fragment>
        ))}
        {w.exp !== null && (
          <span className="sf-exp">
            <M tex={`\\times10^{${w.exp}}`} />
          </span>
        )}
        {prob.unit && (
          <span className="sf-unit">
            <M tex={prob.unit} />
          </span>
        )}
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <button
          className="btn sm ok"
          onClick={() => {
            setChecked(true);
            if (right) sfx.correct();
            else sfx.wrong();
          }}
          disabled={checked}
        >
          بررسی
        </button>
        <button
          className="btn sm ghost"
          onClick={() => {
            setMarks([]);
            setChecked(false);
          }}
          disabled={!marks.length}
        >
          <Icon name="refresh" size={16} /> از نو
        </button>
        <button className="btn sm soft" onClick={onNext}>
          عدد بعدی <Icon name="next" size={16} />
        </button>
      </div>
      {checked && (
        <div className={`lab-verdict ${right ? 'ok' : 'unbalanced'}`} aria-live="polite">
          <b>
            {right ? (
              <>
                <Icon name="check" size={18} stroke={3} /> درست است: {fmt(n)} رقم بامعنا.
              </>
            ) : (
              <>نه کاملاً؛ این عدد {fmt(n)} رقم بامعنا دارد.</>
            )}
          </b>
          {!right && <span className="small">رقم‌های سبز بامعنا هستند؛ خط‌چین یعنی جا انداخته‌ای و قرمز یعنی آن رقم شمرده نمی‌شود.</span>}
        </div>
      )}
      {checked && <RuleList rules={rules} sci={w.exp !== null} />}
      <details className="sf-all">
        <summary className="small bold">همهٔ قاعده‌ها</summary>
        <RuleList rules={ORDER} sci />
      </details>
    </>
  );
}

const OP_TEX: Record<string, string> = { '×': '\\times', '÷': '\\div', '+': '+', '−': '-' };

function RoundTask({ idx, onNext }: { idx: number; onNext: () => void }) {
  const p = ROUND_PROBLEMS[idx];
  const t = useMemo(() => target(p), [p]);
  const digits = useMemo(() => rawDigits(p), [p]);
  const [lim, setLim] = useState<number | null>(null);
  const [cut, setCut] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const limOk = lim !== null && t.limiting.includes(lim);
  const cutOk = cut === t.places;
  const right = limOk && cutOk;
  const wt = writtenTex;
  const dp = (k: number) => (k === 0 ? 'بدون رقم اعشار' : `${k} رقم اعشار`);
  const why = isProduct(p.op)
    ? `در ضرب و تقسیم، جواب به اندازهٔ عددی که **کمترین رقم بامعنا** را دارد رقم بامعنا نگه می‌دارد. ${p.terms.map((x, k) => `$${wt(x)}$: ${t.per[k]} رقم`).join('، ')}؛ پس جواب ${t.need} رقم بامعنا دارد: $${wt(t.answer)}$.`
    : `در جمع و تفریق، جواب تا **کمترین تعداد رقم اعشار** گرد می‌شود. ${p.terms.map((x, k) => `$${wt(x)}$: ${dp(t.per[k])}`).join('، ')}؛ پس جواب ${t.need === 0 ? 'تا یکان گرد می‌شود' : `${t.need} رقم اعشار دارد`}: $${wt(t.answer)}$.`;

  return (
    <>
      <div className="spread" style={{ gap: 8, alignItems: 'flex-start' }}>
        <span className="small" style={{ lineHeight: 2 }}>
          <Rich text={`${p.context}.`} />
        </span>
        <Counter idx={idx} of={ROUND_PROBLEMS.length} />
      </div>
      <span className="small bold">۱. کدام عدد دقت جواب را تعیین می‌کند؟</span>
      <div className="sf-terms" dir="ltr" role="group" aria-label="عددها">
        {p.terms.map((x, k) => (
          <Fragment key={k}>
            {k > 0 && <M tex={OP_TEX[p.op]} />}
            <button
              className={`sf-term${checked ? (t.limiting.includes(k) ? ' hit' : lim === k ? ' bad' : '') : ''}`}
              aria-pressed={lim === k}
              onClick={() => {
                setChecked(false);
                setLim(lim === k ? null : k);
              }}
            >
              <M tex={wt(x)} />
            </button>
          </Fragment>
        ))}
      </div>
      <span className="small bold">۲. ماشین‌حساب این را نشان می‌دهد. آخرین رقمی را که نگه می‌داری بزن:</span>
      <div className="sf-num calc" dir="ltr" role="group" aria-label="جواب ماشین‌حساب">
        {digits.map((d, k) => (
          <Fragment key={k}>
            <button
              className={`sf-d${cut === d.place ? ' cut' : cut !== null && d.place > cut ? ' drop' : ''}${checked && d.place === t.places ? ' hit' : checked && cut === d.place ? ' bad' : ''}`}
              aria-pressed={cut === d.place}
              onClick={() => {
                setChecked(false);
                setCut(cut === d.place ? null : d.place);
              }}
            >
              {fmt(Number(d.ch))}
            </button>
            {d.point && <span className="sf-point">٫</span>}
          </Fragment>
        ))}
      </div>
      {cut !== null && (
        <div className="small center">
          <Rich text={`گرد شده: $${wt(roundedAt(p, cut))}$`} />
        </div>
      )}
      <div className="row wrap" style={{ gap: 8 }}>
        <button
          className="btn sm ok"
          onClick={() => {
            setChecked(true);
            if (right) sfx.correct();
            else sfx.wrong();
          }}
          disabled={lim === null || cut === null || checked}
        >
          بررسی
        </button>
        <button
          className="btn sm ghost"
          onClick={() => {
            setLim(null);
            setCut(null);
            setChecked(false);
          }}
          disabled={lim === null && cut === null}
        >
          <Icon name="refresh" size={16} /> از نو
        </button>
        <button className="btn sm soft" onClick={onNext}>
          سؤال بعدی <Icon name="next" size={16} />
        </button>
      </div>
      {checked && (
        <div className={`lab-verdict ${right ? 'ok' : 'unbalanced'}`} aria-live="polite">
          <b>
            {right ? (
              <>
                <Icon name="check" size={18} stroke={3} /> آفرین، درست گرد کردی!
              </>
            ) : !limOk && !cutOk ? (
              'هم عدد تعیین‌کننده و هم جای گرد کردن را دوباره ببین.'
            ) : !limOk ? (
              'جای گرد کردن درست است، ولی عدد تعیین‌کننده نه.'
            ) : (
              'عدد تعیین‌کننده درست است، ولی جای گرد کردن نه.'
            )}
          </b>
          <span className="small">
            <Rich text={why} />
          </span>
        </div>
      )}
    </>
  );
}
