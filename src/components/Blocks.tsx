import { useMemo, useState } from 'react';
import type { Block, Tone } from '../content/types';
import { hashString, shuffled } from '../lib/grade';
import { ErrorBoundary } from './ErrorBoundary';
import { Icon, type IconName } from './Icon';
import { Plot } from './Plot';
import { Rich, TeX } from './Rich';
import { Widget } from './widgets';

const TONE_ICON: Record<Tone, IconName> = {
  tip: 'bulb',
  key: 'starf',
  warn: 'info',
  exam: 'target',
  info: 'info',
};

const TONE_TITLE: Record<Tone, string> = {
  tip: 'نکته',
  key: 'قانون اصلی',
  warn: 'حواست باشد!',
  exam: 'نکتهٔ امتحانی',
  info: 'بدان',
};

export function Blocks({ blocks, bookLink }: { blocks: Block[]; bookLink?: (page: number) => string }) {
  return (
    <div className="blocks">
      {blocks.map((b, i) => (
        <BlockView key={i} b={b} bookLink={bookLink} />
      ))}
    </div>
  );
}

function BlockView({ b, bookLink }: { b: Block; bookLink?: (page: number) => string }) {
  switch (b.t) {
    case 'p':
      return (
        <p>
          <Rich text={b.text} />
        </p>
      );
    case 'h':
      return (
        <h4>
          <Rich text={b.text} />
        </h4>
      );
    case 'math':
      return (
        <figure className="figure">
          <TeX tex={b.tex} />
          {b.caption && (
            <figcaption>
              <Rich text={b.caption} />
            </figcaption>
          )}
        </figure>
      );
    case 'note':
      return (
        <div className={`note ${b.tone}`}>
          <Icon name={TONE_ICON[b.tone]} className="n-ic" size={20} />
          <div>
            <span className="n-title">{b.title ?? TONE_TITLE[b.tone]}</span>
            <Rich text={b.text} />
          </div>
        </div>
      );
    case 'list': {
      const L = b.ordered ? 'ol' : 'ul';
      return (
        <L>
          {b.items.map((it, i) => (
            <li key={i}>
              <Rich text={it} />
            </li>
          ))}
        </L>
      );
    }
    case 'steps':
      return (
        <ol className="steps">
          {b.items.map((s, i) => (
            <li key={i}>
              <div className="s-body">
                <Rich text={s.text} />
                {s.tex && <TeX tex={s.tex} />}
              </div>
            </li>
          ))}
        </ol>
      );
    case 'example':
      return <ExampleBlock b={b} bookLink={bookLink} />;
    case 'table':
      return (
        <figure className="figure">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {b.head.map((h, i) => (
                    <th key={i}>
                      <Rich text={h} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>
                        <Rich text={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {b.caption && (
            <figcaption>
              <Rich text={b.caption} />
            </figcaption>
          )}
        </figure>
      );
    case 'compare':
      return (
        <div className="compare">
          {b.items.map((it, i) => (
            <div key={i} className={it.tone ?? (i === 1 ? 'b' : i === 2 ? 'c' : '')}>
              <h5>
                <Rich text={it.title} />
              </h5>
              <ul>
                {it.points.map((p, j) => (
                  <li key={j}>
                    <Rich text={p} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    case 'plot':
      return (
        <figure className="figure">
          <Plot spec={b.plot} />
          {b.caption && (
            <figcaption>
              <Rich text={b.caption} />
            </figcaption>
          )}
        </figure>
      );
    case 'widget':
      return (
        <figure className="figure">
          <ErrorBoundary inline>
            <Widget name={b.name} props={b.props} />
          </ErrorBoundary>
          {b.caption && (
            <figcaption>
              <Rich text={b.caption} />
            </figcaption>
          )}
        </figure>
      );
    case 'book':
      return bookLink ? (
        <a className="book-ref" href={bookLink(b.page)} target="_blank" rel="noopener noreferrer">
          <Icon name="book" size={20} />
          <span className="grow">{b.text ?? `این قسمت در کتاب درسی، صفحهٔ ${b.page}`}</span>
          <Icon name="external" size={16} />
        </a>
      ) : null;
    case 'konkur':
      return <KonkurBlock b={b} bookLink={bookLink} />;
  }
}

const KEYS = ['۱', '۲', '۳', '۴'];

/** «تست چالشی»: a worked konkur-level question. Pick an option (or skip), then the full solution opens. */
function KonkurBlock({ b, bookLink }: { b: Extract<Block, { t: 'konkur' }>; bookLink?: (page: number) => string }) {
  const [pick, setPick] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  // Authors always write the right option first; show them in a stable shuffled order.
  const order = useMemo(() => shuffled(b.options.length, hashString(b.problem)), [b.problem, b.options.length]);
  const right = order.indexOf(b.answer);
  const shown = open || pick !== null;
  return (
    <div className="example konkur">
      <div className="example-head">
        <span className="tag">{b.tag ?? 'تست چالشی'}</span>
        <span>
          <Rich text={b.problem} />
        </span>
      </div>
      <div className="example-body">
        <div className="konkur-opts" role="radiogroup">
          {order.map((oi, i) => {
            const o = b.options[oi];
            const cls = pick === null ? 'opt' : i === right ? 'opt right' : i === pick ? 'opt wrong' : 'opt dim';
            return (
              <button key={i} className={cls} role="radio" aria-checked={pick === i} disabled={pick !== null} onClick={() => setPick(i)}>
                <span className="key">{KEYS[i]}</span>
                <span className="opt-body">
                  <Rich text={o} />
                </span>
              </button>
            );
          })}
        </div>
        {shown ? (
          <div className="konkur-sol">
            <div className="konkur-head">
              {pick !== null && (
                <div className={`konkur-verdict ${pick === right ? 'ok' : 'bad'}`}>
                  <Icon name={pick === right ? 'checkf' : 'xf'} size={20} />
                  {pick === right ? 'آفرین! درست زدی. راه‌حل کامل را هم ببین:' : `گزینهٔ درست ${KEYS[right]} است. ببین تله کجا بود:`}
                </div>
              )}
              <button className="link-btn" onClick={() => (setPick(null), setOpen(false))}>
                <Icon name="refresh" size={16} /> از نو
              </button>
            </div>
            <Blocks blocks={b.solution} bookLink={bookLink} />
          </div>
        ) : (
          <button className="reveal-btn" onClick={() => setOpen(true)}>
            بلد نیستم؛ راه‌حل را نشانم بده
          </button>
        )}
      </div>
    </div>
  );
}

function ExampleBlock({ b, bookLink }: { b: Extract<Block, { t: 'example' }>; bookLink?: (page: number) => string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="example">
      <div className="example-head">
        <span className="tag">{b.title ?? 'مثال'}</span>
        <span>
          <Rich text={b.problem} />
        </span>
      </div>
      <div className="example-body">
        {open ? (
          <Blocks blocks={b.solution} bookLink={bookLink} />
        ) : (
          <button className="reveal-btn" onClick={() => setOpen(true)}>
            اول خودت فکر کن… بعد پاسخ را ببین
          </button>
        )}
      </div>
    </div>
  );
}
