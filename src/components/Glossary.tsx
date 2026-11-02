import { AnimatePresence, motion } from 'motion/react';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Term } from '../content/glossary';
import type { Field } from '../content/types';
import { useBack } from '../lib/back';
import { Icon } from './Icon';

/** The subject of the screen; formulas only explain their symbols inside a subject (lessons, practice, tests). */
export const SubjectContext = createContext<Field | undefined>(undefined);
export const useSubject = () => useContext(SubjectContext);

type Open = { rect: DOMRect; terms: Term[]; heading?: string } | null;
let open: Open = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Show the glossary card next to `el`. */
export function openGlossary(el: Element, terms: Term[], heading?: string): void {
  if (!terms.length) return;
  open = { rect: el.getBoundingClientRect(), terms, heading };
  emit();
}
export function closeGlossary(): void {
  if (!open) return;
  open = null;
  emit();
}

function useOpen(): Open {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => open,
  );
}

/** One card for the whole app: a short meaning first, «بیشتر بدان» for the full explanation and examples. */
export function GlossaryHost({ render }: { render: (text: string) => React.ReactNode }) {
  const o = useOpen();
  const card = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean; arrow: number } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // the phone's back button closes the card
  useBack(Boolean(o), closeGlossary);

  useEffect(() => {
    setExpanded(null);
    if (!o) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeGlossary();
    // Close when the page itself scrolls away (not for scrolling inside the card, nor tiny touch jitters).
    const y0 = window.scrollY;
    const onScroll = (e: Event) => {
      if (card.current && e.target instanceof Node && card.current.contains(e.target)) return;
      if (Math.abs(window.scrollY - y0) > 60) closeGlossary();
    };
    const onResize = () => closeGlossary();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onResize);
    };
  }, [o]);

  useLayoutEffect(() => {
    if (!o || !card.current) return;
    const w = card.current.offsetWidth;
    const h = card.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = o.rect.left + o.rect.width / 2;
    const left = Math.min(Math.max(12, cx - w / 2), vw - w - 12);
    const spaceAbove = o.rect.top - 12;
    const below = spaceAbove < h + 14 && vh - o.rect.bottom > spaceAbove;
    const top = below ? Math.min(o.rect.bottom + 12, vh - h - 8) : Math.max(8, o.rect.top - h - 12);
    setPos({ left, top, below, arrow: Math.min(Math.max(18, cx - left), w - 18) });
  }, [o, expanded]);

  return (
    <AnimatePresence>
      {o && (
        <>
          <motion.div className="gl-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeGlossary} />
          <motion.div
            ref={card}
            className={`gl-card${pos?.below ? ' below' : ''}`}
            role="dialog"
            aria-label={o.heading ?? o.terms[0].title}
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, ['--ax' as string]: `${pos?.arrow ?? 40}px` }}
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            <div className="gl-head">
              <span className="gl-ico">
                <Icon name="bulb" size={18} />
              </span>
              <b>{o.heading ?? o.terms[0].title}</b>
              <button className="gl-x" onClick={closeGlossary} aria-label="بستن">
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="gl-list">
              {o.terms.map((t) => {
                const isOpen = expanded === t.id;
                return (
                  <div key={t.id} className={`gl-item${isOpen ? ' open' : ''}`}>
                    <div className="gl-row">
                      {t.tex && (o.heading || o.terms.length > 1) && <span className="gl-sym">{render(`$${t.tex}$`)}</span>}
                      <div className="grow">
                        {(o.heading || o.terms.length > 1) && <b className="gl-title">{t.title}</b>}
                        <div className="gl-short">{render(t.short)}</div>
                      </div>
                    </div>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div className="gl-more" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                          <div className="gl-long">{render(t.long)}</div>
                          {t.examples?.length ? (
                            <div className="gl-ex">
                              <span>مثال</span>
                              <ul>
                                {t.examples.map((ex) => (
                                  <li key={ex}>{render(ex)}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button className="gl-toggle" onClick={() => setExpanded(isOpen ? null : t.id)} aria-expanded={isOpen}>
                      {isOpen ? 'کمتر' : 'بیشتر بدان'}
                      <Icon name={isOpen ? 'minus' : 'plus'} size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
