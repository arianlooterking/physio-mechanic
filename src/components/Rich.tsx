import katex from 'katex';
import 'katex/contrib/mhchem';
import { Fragment, memo, useLayoutEffect, useMemo, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { findTerm, symbolsIn, type Term } from '../content/glossary';
import { openGlossary, useSubject } from './Glossary';

const cache = new Map<string, string>();

export function renderTex(tex: string, display: boolean): string {
  const key = (display ? 'D:' : 'I:') + tex;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let html: string;
  try {
    html = katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: 'ignore',
      output: 'html',
      trust: false,
      macros: {
        '\\dec': '{\\char"066B}',
        '\\R': '\\mathbb{R}',
      },
    });
  } catch {
    html = `<span class="math-err">${tex.replace(/[<>&]/g, '')}</span>`;
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, html);
  return html;
}

/* An inline formula wider than its line gets its own line and scrolls sideways (class `wide`),
   so a phone never shows half a formula. Re-measured when the window size changes. */
const inline = new Set<HTMLElement>();
function fit(el: HTMLElement) {
  el.classList.remove('wide');
  const glue = el.parentElement?.classList.contains('mi-glue') ? el.parentElement : null;
  glue?.classList.remove('loose');
  const room = (glue ? glue.parentElement : el.parentElement)?.clientWidth ?? 0;
  if (room > 0 && el.scrollWidth > room + 1) el.classList.add('wide');
  // The formula fits but not with its brackets: let them break away rather than overflow.
  else if (glue && room > 0 && glue.getBoundingClientRect().width > room + 1) glue.classList.add('loose');
}
/* A display formula wider than its box shrinks to fit (down to MIN_SCALE of its size) before it has to
   scroll: notes and steps leave a phone only about 230px. Re-measured with the inline ones. */
const displays = new Set<HTMLElement>();
const MIN_SCALE = 0.72;
function fitDisplay(el: HTMLElement) {
  el.style.removeProperty('--fit');
  const k = el.querySelector<HTMLElement>('.katex');
  const style = getComputedStyle(el);
  const room = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const need = k?.scrollWidth ?? 0;
  if (room > 0 && need > room + 1) el.style.setProperty('--fit', String(Math.max(MIN_SCALE, Math.floor((room / need) * 100) / 100)));
}
if (typeof window !== 'undefined') {
  let raf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      inline.forEach(fit);
      displays.forEach(fitDisplay);
    });
  });
}

/** Click/Enter on a formula or term opens the glossary card for it. */
function tapProps(terms: Term[], heading?: string) {
  if (!terms.length) return {};
  const go = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    openGlossary(e.currentTarget as Element, terms, heading);
  };
  return {
    role: 'button',
    tabIndex: 0,
    title: 'برای دیدن معنی بزن',
    onClick: go,
    onKeyDown: (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go(e)),
  };
}
const SYM_HEADING = 'این نمادها یعنی چه؟';

/** Inline formula. Inside a lesson, a formula with symbols worth explaining can be tapped. */
export const M = memo(function M({ tex }: { tex: string }) {
  const subject = useSubject();
  const terms = useMemo(() => (subject ? symbolsIn(tex, subject) : []), [tex, subject]);
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    inline.add(el);
    fit(el);
    // Fonts can arrive after the first layout.
    void document.fonts?.ready.then(() => fit(el));
    return () => {
      inline.delete(el);
    };
  }, [tex]);
  return <span ref={ref} className={`mi${terms.length ? ' sym' : ''}`} {...tapProps(terms, SYM_HEADING)} dangerouslySetInnerHTML={{ __html: renderTex(tex, false) }} />;
});

/** Display (centered) formula. */
export const TeX = memo(function TeX({ tex }: { tex: string }) {
  const subject = useSubject();
  const terms = useMemo(() => (subject ? symbolsIn(tex, subject) : []), [tex, subject]);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    displays.add(el);
    fitDisplay(el);
    void document.fonts?.ready.then(() => fitDisplay(el));
    return () => {
      displays.delete(el);
    };
  }, [tex]);
  if (!terms.length) return <div ref={ref} className="math-display" dangerouslySetInnerHTML={{ __html: renderTex(tex, true) }} />;
  return (
    <div ref={ref} className="math-display sym" {...tapProps(terms, SYM_HEADING)}>
      <span dangerouslySetInnerHTML={{ __html: renderTex(tex, true) }} />
      <i className="sym-badge" aria-hidden="true">؟</i>
    </div>
  );
});

/** A marked term; when the glossary knows it, tapping shows its meaning. */
function TermMark({ text }: { text: string }) {
  const term = findTerm(text, useSubject());
  if (!term) return <mark className="term">{renderTokens(tokenize(text))}</mark>;
  return (
    <mark className="term tap" {...tapProps([term])}>
      {renderTokens(tokenize(text))}
    </mark>
  );
}

type Token =
  | { k: 'text'; v: string }
  | { k: 'math'; v: string }
  | { k: 'dmath'; v: string }
  | { k: 'bold'; v: string }
  | { k: 'mark'; v: string }
  | { k: 'en'; v: string }
  | { k: 'br' }
  | { k: 'glued'; pre: string; v: string; post: string };

/** Split our tiny markup into tokens. `$` inside math must not appear; use \$ for a literal dollar. */
export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf) out.push({ k: 'text', v: buf });
    buf = '';
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '\\' && src[i + 1] === '$') {
      buf += '$';
      i += 2;
      continue;
    }
    if (c === '$' && src[i + 1] === '$') {
      const end = src.indexOf('$$', i + 2);
      if (end > -1) {
        flush();
        out.push({ k: 'dmath', v: src.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (c === '$') {
      const end = src.indexOf('$', i + 1);
      if (end > -1) {
        flush();
        out.push({ k: 'math', v: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (c === '*' && src[i + 1] === '*') {
      const end = src.indexOf('**', i + 2);
      if (end > -1) {
        flush();
        out.push({ k: 'bold', v: src.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (c === '=' && src[i + 1] === '=') {
      const end = src.indexOf('==', i + 2);
      if (end > -1) {
        flush();
        out.push({ k: 'mark', v: src.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (c === '<' && src[i + 1] === '<') {
      const end = src.indexOf('>>', i + 2);
      if (end > -1) {
        flush();
        out.push({ k: 'en', v: src.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (c === '\n') {
      flush();
      out.push({ k: 'br' });
      i += 1;
      continue;
    }
    buf += c;
    i += 1;
  }
  flush();
  return out;
}

/* A bracket or punctuation mark touching an inline formula stays on the formula's line, so a phone
   never ends one line with «(» and starts the next with its formula. */
const OPEN = /[(\[«]+$/;
const CLOSE = /^[)\]»،؛.:!؟]+/;
function glue(tokens: Token[]): Token[] {
  const ts = tokens.map((t) => ({ ...t }));
  const out: Token[] = [];
  ts.forEach((t, i) => {
    if (t.k !== 'math') return void out.push(t);
    const prev = out[out.length - 1];
    const next = ts[i + 1];
    const pre = prev?.k === 'text' ? (prev.v.match(OPEN)?.[0] ?? '') : '';
    const post = next?.k === 'text' ? (next.v.match(CLOSE)?.[0] ?? '') : '';
    if (!pre && !post) return void out.push(t);
    if (prev?.k === 'text' && pre) {
      prev.v = prev.v.slice(0, -pre.length);
      if (!prev.v) out.pop();
    }
    if (next?.k === 'text' && post) next.v = next.v.slice(post.length);
    out.push({ k: 'glued', pre, v: t.v, post });
  });
  return out.filter((t) => t.k !== 'text' || t.v);
}

function renderTokens(tokens: Token[]): ReactNode[] {
  return glue(tokens).map((t, i) => {
    switch (t.k) {
      case 'text':
        return <Fragment key={i}>{t.v}</Fragment>;
      case 'math':
        return <M key={i} tex={t.v} />;
      case 'glued':
        return (
          <span key={i} className="mi-glue">
            {t.pre}
            <M tex={t.v} />
            {t.post}
          </span>
        );
      case 'dmath':
        return <TeX key={i} tex={t.v} />;
      case 'bold':
        return <strong key={i}>{renderTokens(tokenize(t.v))}</strong>;
      case 'mark':
        return <TermMark key={i} text={t.v} />;
      case 'en':
        return (
          <bdi key={i} dir="ltr" lang="en" className="en">
            {renderTokens(tokenize(t.v))}
          </bdi>
        );
      case 'br':
        return <br key={i} />;
    }
  });
}

/** Persian text with inline markup ($math$, **bold**, ==term==). */
export const Rich = memo(function Rich({ text }: { text: string }) {
  return <>{renderTokens(tokenize(text))}</>;
});

/**
 * Multi-paragraph text (used for AI answers): blank lines split paragraphs,
 * lines starting with «- » or «1. » become list items.
 */
export function RichText({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, '').trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        const isList = lines.every((l) => /^\s*([-•*]|\d+[.)])\s+/.test(l));
        if (isList) {
          const ordered = /^\s*\d/.test(lines[0]);
          const items = lines.map((l) => l.replace(/^\s*([-•*]|\d+[.)])\s+/, ''));
          const L = ordered ? 'ol' : 'ul';
          return (
            <L key={i} style={{ margin: '4px 0', paddingInlineStart: 20 }}>
              {items.map((it, j) => (
                <li key={j}>
                  <Rich text={it} />
                </li>
              ))}
            </L>
          );
        }
        const cleaned = b.replace(/^#{1,6}\s+/gm, '');
        return (
          <p key={i} style={{ margin: i ? '8px 0 0' : 0 }}>
            <Rich text={cleaned} />
          </p>
        );
      })}
    </>
  );
}
