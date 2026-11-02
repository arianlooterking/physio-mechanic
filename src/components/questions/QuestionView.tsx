import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClozeQ, GraphQ, MatchQ, MCQ, NumericQ, OrderQ, Question, TrueFalse, WrittenQ } from '../../content/types';
import { fmt } from '../../lib/digits';
import { hashString, orderTarget, shuffled, type Answer } from '../../lib/grade';
import { sfx } from '../../lib/sound';
import { Icon } from '../Icon';
import { Plot } from '../Plot';
import { M, Rich, TeX } from '../Rich';

const KEYS = ['۱', '۲', '۳', '۴', '۵', '۶'];
const GRAPH_KEYS = ['الف', 'ب', 'پ', 'ت', 'ث'];

const KICKER: Record<Question['type'], string> = {
  mcq: 'گزینهٔ درست را انتخاب کن',
  tf: 'درست یا نادرست؟',
  num: 'جواب را بنویس',
  order: 'مرحله‌ها را مرتب کن',
  match: 'جفت‌ها را پیدا کن',
  cloze: 'جای خالی را پر کن',
  graph: 'نمودار درست را انتخاب کن',
  written: 'سؤال تشریحی، مثل امتحان نهایی',
};

export interface QuestionViewProps {
  q: Question;
  answer: Answer | null;
  onAnswer: (a: Answer | null) => void;
  /** After «check»: show right/wrong and freeze input. */
  locked: boolean;
  /** Attempt number, so options are shuffled differently on a retry. */
  attempt?: number;
  /** Called when the student presses Enter in an input. */
  onSubmit?: () => void;
  kicker?: string;
}

export function QuestionView(props: QuestionViewProps) {
  const { q, kicker } = props;
  const [showHint, setShowHint] = useState(false);
  useEffect(() => setShowHint(false), [q.id]);
  return (
    <div key={q.id} style={{ animation: 'rise 0.3s ease-out' }}>
      <div className="q-kicker">
        <Icon name="sparkles" size={18} />
        {kicker ?? KICKER[q.type]}
      </div>
      {!(q.type === 'cloze' && /^جای خالی را پر کن\.?$/.test(q.prompt.trim())) && (
        <div className="q-prompt">
          <Rich text={q.prompt} />
        </div>
      )}
      {q.plot && (
        <div style={{ maxWidth: 420, margin: '0 auto 16px' }}>
          <Plot spec={q.plot} />
        </div>
      )}
      <Input {...props} />
      {q.hint && !props.locked && (
        <div className="hint-box">
          {showHint ? (
            <div className="note tip">
              <Icon name="hint" className="n-ic" size={20} />
              <div>
                <span className="n-title">راهنمایی</span>
                <Rich text={q.hint} />
              </div>
            </div>
          ) : (
            <button className="link-btn" onClick={() => setShowHint(true)}>
              <Icon name="hint" size={18} />
              راهنمایی می‌خواهم
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Input(props: QuestionViewProps) {
  switch (props.q.type) {
    case 'mcq':
      return <Choices {...props} q={props.q} />;
    case 'cloze':
      return <Cloze {...props} q={props.q} />;
    case 'tf':
      return <TrueFalseInput {...props} q={props.q} />;
    case 'num':
      return <NumberInput {...props} q={props.q} />;
    case 'order':
      return <OrderInput {...props} q={props.q} />;
    case 'match':
      return <MatchInput {...props} q={props.q} />;
    case 'graph':
      return <GraphChoices {...props} q={props.q} />;
    case 'written':
      return <WrittenInput {...props} q={props.q} />;
  }
}

const SELF_MARKS: { score: number; label: string; icon: 'checkf' | 'star' | 'xf' }[] = [
  { score: 1, label: 'همه را درست نوشتم', icon: 'checkf' },
  { score: 0.5, label: 'بخشی را درست نوشتم', icon: 'star' },
  { score: 0, label: 'بلد نبودم', icon: 'xf' },
];

/** Final-exam style: solve on paper, open the model solution with its mark scheme, then mark yourself honestly. */
function WrittenInput({ q, answer, onAnswer, locked }: QuestionViewProps & { q: WrittenQ }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [q.id]);
  const score = answer?.t === 'written' ? answer.score : undefined;
  const shown = open || locked;
  return (
    <div className="written">
      <div className="written-paper">
        <Icon name="edit" size={20} />
        <span className="grow">روی کاغذ، کامل و مرتب حل کن؛ همان‌طور که سر جلسهٔ امتحان می‌نویسی. بعد پاسخ تشریحی را باز کن و با جوابت مقایسه کن.</span>
        <span className="written-pts">{fmt(q.points)} نمره</span>
      </div>
      {!shown ? (
        <button
          className="btn soft block"
          onClick={() => {
            sfx.tap();
            setOpen(true);
          }}
        >
          <Icon name="eye" size={20} /> نوشتم؛ پاسخ تشریحی و بارم را نشانم بده
        </button>
      ) : (
        <>
          <ol className="written-steps">
            {q.steps.map((st, i) => (
              <li key={i}>
                <div className="grow">
                  <Rich text={st.text} />
                  {st.tex && <TeX tex={st.tex} />}
                </div>
                <span className="written-pts">{fmt(st.pts)}</span>
              </li>
            ))}
          </ol>
          <div className="self-mark" role="radiogroup" aria-label="به جواب خودت چه نمره‌ای می‌دهی؟">
            <span>جواب خودت چطور بود؟</span>
            {SELF_MARKS.map((m) => (
              <button
                key={m.score}
                role="radio"
                aria-checked={score === m.score}
                className={`opt${score === m.score ? ' sel' : ''}`}
                disabled={locked}
                onClick={() => {
                  sfx.tap();
                  onAnswer({ t: 'written', score: m.score });
                }}
              >
                <Icon name={m.icon} size={20} /> {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function useNumberKeys(count: number, enabled: boolean, pick: (i: number) => void) {
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const map: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '۱': 0, '۲': 1, '۳': 2, '۴': 3, '۵': 4 };
      const i = map[e.key];
      if (i !== undefined && i < count) pickRef.current(i);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, enabled]);
}

function optionClass(orig: number, chosen: number | undefined, answer: number, locked: boolean) {
  if (!locked) return chosen === orig ? 'opt sel' : 'opt';
  if (orig === answer) return 'opt right';
  if (orig === chosen) return 'opt wrong';
  return 'opt dim';
}

function Choices({ q, answer, onAnswer, locked, attempt = 0 }: QuestionViewProps & { q: MCQ }) {
  const order = useMemo(() => shuffled(q.options.length, hashString(q.id) + attempt * 7919), [q.id, q.options.length, attempt]);
  const chosen = answer?.t === 'mcq' ? answer.choice : undefined;
  const pick = (orig: number) => {
    if (locked) return;
    sfx.tap();
    onAnswer({ t: 'mcq', choice: orig });
  };
  useNumberKeys(order.length, !locked, (i) => pick(order[i]));
  return (
    <div className="options" role="radiogroup">
      {order.map((orig, i) => (
        <button
          key={orig}
          className={optionClass(orig, chosen, q.answer, locked)}
          role="radio"
          aria-checked={chosen === orig}
          onClick={() => pick(orig)}
          disabled={locked}
        >
          <span className="key">{KEYS[i]}</span>
          <span className="opt-body">
            <Rich text={q.options[orig]} />
          </span>
        </button>
      ))}
    </div>
  );
}

function GraphChoices({ q, answer, onAnswer, locked, attempt = 0 }: QuestionViewProps & { q: GraphQ }) {
  const order = useMemo(() => shuffled(q.graphs.length, hashString(q.id) + attempt * 7919), [q.id, q.graphs.length, attempt]);
  const chosen = answer?.t === 'graph' ? answer.choice : undefined;
  const pick = (orig: number) => {
    if (locked) return;
    sfx.tap();
    onAnswer({ t: 'graph', choice: orig });
  };
  useNumberKeys(order.length, !locked, (i) => pick(order[i]));
  return (
    <div className="graph-opts" role="radiogroup">
      {order.map((orig, i) => (
        <button
          key={orig}
          className={optionClass(orig, chosen, q.answer, locked)}
          role="radio"
          aria-checked={chosen === orig}
          aria-label={`نمودار ${GRAPH_KEYS[i]}`}
          onClick={() => pick(orig)}
          disabled={locked}
        >
          <span className="key">{GRAPH_KEYS[i]}</span>
          <Plot spec={q.graphs[orig]} width={260} compact />
        </button>
      ))}
    </div>
  );
}

function Cloze({ q, answer, onAnswer, locked, attempt = 0 }: QuestionViewProps & { q: ClozeQ }) {
  const order = useMemo(() => shuffled(q.options.length, hashString(q.id) + attempt * 7919), [q.id, q.options.length, attempt]);
  const chosen = answer?.t === 'cloze' ? answer.choice : undefined;
  // A whole English sentence (<<…>>) reads left to right, blank included.
  const en = q.text.startsWith('<<') && q.text.endsWith('>>');
  const [before, after] = (en ? q.text.slice(2, -2) : q.text).split('___');
  const pick = (orig: number) => {
    if (locked) return;
    sfx.tap();
    onAnswer({ t: 'cloze', choice: orig });
  };
  useNumberKeys(order.length, !locked, (i) => pick(order[i]));
  return (
    <>
      <div className="cloze-text" dir={en ? 'ltr' : undefined} lang={en ? 'en' : undefined}>
        <Rich text={before ?? ''} />
        <span className="cloze-blank">{chosen !== undefined ? <Rich text={q.options[chosen]} /> : ' '}</span>
        <Rich text={after ?? ''} />
      </div>
      <div className="cloze-opts">
        {order.map((orig) => (
          <button key={orig} className={optionClass(orig, chosen, q.answer, locked)} onClick={() => pick(orig)} disabled={locked}>
            <Rich text={q.options[orig]} />
          </button>
        ))}
      </div>
    </>
  );
}

function TrueFalseInput({ q, answer, onAnswer, locked }: QuestionViewProps & { q: TrueFalse }) {
  const chosen = answer?.t === 'tf' ? answer.value : undefined;
  const cls = (v: boolean) => {
    if (!locked) return chosen === v ? 'opt sel' : 'opt';
    if (v === q.answer) return 'opt right';
    if (v === chosen) return 'opt wrong';
    return 'opt dim';
  };
  const pick = (v: boolean) => {
    if (locked) return;
    sfx.tap();
    onAnswer({ t: 'tf', value: v });
  };
  useNumberKeys(2, !locked, (i) => pick(i === 0));
  return (
    <div className="tf" role="radiogroup">
      <button className={cls(true)} role="radio" aria-checked={chosen === true} onClick={() => pick(true)} disabled={locked}>
        <Icon name="check" size={24} /> درست
      </button>
      <button className={cls(false)} role="radio" aria-checked={chosen === false} onClick={() => pick(false)} disabled={locked}>
        <Icon name="x" size={24} /> نادرست
      </button>
    </div>
  );
}

function NumberInput({ q, answer, onAnswer, locked, onSubmit }: QuestionViewProps & { q: NumericQ }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!locked) ref.current?.focus({ preventScroll: true });
  }, [q.id, locked]);
  const raw = answer?.t === 'num' ? answer.raw : '';
  return (
    <div className="num-input">
      <input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        dir="ltr"
        value={raw}
        placeholder="…"
        aria-label="جواب عددی"
        disabled={locked}
        onChange={(e) => onAnswer({ t: 'num', raw: e.target.value.slice(0, 24) })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit?.();
        }}
      />
      {q.unit && (
        <span className="unit">
          <M tex={`\\text{${q.unit}}`} />
        </span>
      )}
    </div>
  );
}

function OrderInput({ q, answer, onAnswer, locked, attempt = 0 }: QuestionViewProps & { q: OrderQ }) {
  const pool = useMemo(() => {
    const s = shuffled(q.items.length, hashString(q.id) + attempt * 7919);
    if (s.every((v, i) => v === i) && s.length > 1) [s[0], s[1]] = [s[1], s[0]];
    return s;
  }, [q.id, q.items.length, attempt]);
  const seq = answer?.t === 'order' ? answer.seq : [];
  // After «بررسی», colour each place against the accepted order the learner matched (or the items' own order).
  const target = orderTarget(q, seq) ?? q.items.map((_, i) => i);
  const add = (orig: number) => {
    if (locked) return;
    sfx.tap();
    onAnswer({ t: 'order', seq: [...seq, orig] });
  };
  const remove = (pos: number) => {
    if (locked) return;
    const next = seq.filter((_, i) => i !== pos);
    onAnswer(next.length ? { t: 'order', seq: next } : null);
  };
  return (
    <>
      <div className="order-zone" aria-label="ترتیب انتخاب‌شده">
        {seq.map((orig, pos) => (
          <button
            key={orig}
            className="order-item"
            onClick={() => remove(pos)}
            disabled={locked}
            style={locked ? { borderColor: orig === target[pos] ? 'var(--ok)' : 'var(--bad)', background: orig === target[pos] ? 'var(--ok-soft)' : 'var(--bad-soft)' } : undefined}
          >
            <span className="n">{pos + 1}</span>
            <span className="grow">
              <Rich text={q.items[orig]} />
            </span>
          </button>
        ))}
      </div>
      {!locked && seq.length > 0 && (
        <div className="order-tools">
          <span>برای برگرداندن یک مورد، رویش بزن.</span>
          <button
            className="link-btn"
            onClick={() => {
              sfx.tap();
              onAnswer(null);
            }}
          >
            <Icon name="refresh" size={16} /> از نو
          </button>
        </div>
      )}
      <div className="order-pool" hidden={locked}>
        {pool.map((orig) => (
          <button key={orig} className={`order-item ${seq.includes(orig) ? 'ghosted' : ''}`} onClick={() => add(orig)} disabled={locked || seq.includes(orig)}>
            <Icon name="plus" size={18} />
            <span className="grow">
              <Rich text={q.items[orig]} />
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function MatchInput({ q, answer, onAnswer, locked, attempt = 0 }: QuestionViewProps & { q: MatchQ }) {
  const n = q.pairs.length;
  const leftOrder = useMemo(() => shuffled(n, hashString(q.id) + attempt * 31), [q.id, n, attempt]);
  const rightOrder = useMemo(() => shuffled(n, hashString(q.id) * 3 + 11 + attempt * 17), [q.id, n, attempt]);
  const [left, setLeft] = useState<number | null>(null);
  const [right, setRight] = useState<number | null>(null);
  const [paired, setPaired] = useState<number[]>([]);
  const [flash, setFlash] = useState<[number, number] | null>(null);
  const mistakes = answer?.t === 'match' ? answer.mistakes : 0;

  useEffect(() => {
    setLeft(null);
    setRight(null);
    setPaired([]);
    setFlash(null);
  }, [q.id, attempt]);

  useEffect(() => {
    if (left === null || right === null) return;
    if (left === right) {
      sfx.correct();
      const next = [...paired, left];
      setPaired(next);
      setLeft(null);
      setRight(null);
      onAnswer({ t: 'match', mistakes, done: next.length === n });
    } else {
      sfx.wrong();
      setFlash([left, right]);
      onAnswer({ t: 'match', mistakes: mistakes + 1, done: false });
      const timer = setTimeout(() => {
        setFlash(null);
        setLeft(null);
        setRight(null);
      }, 550);
      return () => clearTimeout(timer);
    }
    // Runs only when both sides of a pair have been picked.
  }, [left, right]);

  const cls = (side: 'l' | 'r', i: number) => {
    if (paired.includes(i)) return 'opt paired';
    if (flash && (side === 'l' ? flash[0] === i : flash[1] === i)) return 'opt wrong';
    if ((side === 'l' ? left : right) === i) return 'opt sel';
    return 'opt';
  };

  return (
    <div className="match">
      <div className="match-col">
        {leftOrder.map((i) => (
          <button key={i} className={cls('l', i)} disabled={locked || paired.includes(i) || flash !== null} onClick={() => setLeft(left === i ? null : i)}>
            <span className="opt-body">
              <Rich text={q.pairs[i][0]} />
            </span>
          </button>
        ))}
      </div>
      <div className="match-col">
        {rightOrder.map((i) => (
          <button key={i} className={cls('r', i)} disabled={locked || paired.includes(i) || flash !== null} onClick={() => setRight(right === i ? null : i)}>
            <span className="opt-body">
              <Rich text={q.pairs[i][1]} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
