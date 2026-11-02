import { useEffect, useMemo, useRef, useState } from 'react';
import type { SubjectId } from '../content/types';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { Rich, TeX } from '../components/Rich';
import { SessionTop } from '../components/session';
import { Confetti } from '../components/ui';
import { awardBadges, type BadgeDef } from '../lib/badges';
import { fmt } from '../lib/digits';
import { exitTo, go } from '../lib/nav';
import { sfx } from '../lib/sound';
import { addStudyTime, awardXp, reviewCard, type CardState } from '../lib/state';
import { getState, update, useAppState } from '../lib/store';
import { bookName, wordBooks, wordDeck, wordsMet, type WordCard } from '../lib/words';

/** «هنوز نه» puts a card back this many places later in the deck, at most twice a sitting. */
const AGAIN_GAP = 3;
const AGAIN_MAX = 2;
/** How far a card must be dragged to count as a swipe. */
const SWIPE_PX = 70;

const back = () => exitTo({ name: 'review' });

/** «کارت واژه»: the terms and formula symbols of the lessons started, «بلدم» / «هنوز نه», with Leitner boxes. */
export function WordCards({ subject }: { subject?: string }) {
  const s = useAppState();
  const books = useMemo(() => wordBooks(s), [s]);
  const book = books.some((b) => b.id === subject) ? (subject as SubjectId) : undefined;
  const [all, setAll] = useState(false);
  // The deck is dealt once per book choice, so rating a card does not reshuffle it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deck = useMemo(() => (all ? wordsMet(getState(), book).slice(0, 40) : wordDeck(getState(), book)), [book, all]);
  const pick = (id?: SubjectId) => go({ name: 'words', subject: id }, true);

  const chips =
    books.length > 1 ? (
      <div className="seg wc-books" role="group" aria-label="کدام کتاب">
        <button aria-pressed={!book} onClick={() => pick()}>
          همه
        </button>
        {books.map((b) => (
          <button key={b.id} aria-pressed={book === b.id} onClick={() => pick(b.id)}>
            {b.title} ({fmt(b.count)})
          </button>
        ))}
      </div>
    ) : null;

  if (!deck.length) {
    const none = books.length === 0;
    return (
      <div className="onb">
        <div className="onb-body center">
          <Mascot mood={none ? 'think' : 'cheer'} size={120} />
          <h1>{none ? 'هنوز واژه‌ای نداری' : 'امروز واژه‌ای برای مرور نمانده'}</h1>
          <p className="lead">
            {none
              ? 'هر درسی که شروع کنی، واژه‌ها و نمادهای فرمول‌هایش اینجا کارت می‌شوند.'
              : 'هر واژه‌ای که بلد باشی دیرتر برمی‌گردد. اگر بخواهی، همین الان همه را یک دور ببین.'}
          </p>
          {chips}
          {!none && (
            <button className="btn lg" onClick={() => setAll(true)}>
              مرور همهٔ واژه‌ها
            </button>
          )}
          <button className="btn ghost" onClick={back}>
            بازگشت
          </button>
        </div>
      </div>
    );
  }
  return <Deck key={`${book ?? 'all'}:${all}`} cards={deck} chips={chips} />;
}

interface Step {
  queue: WordCard[];
  pos: number;
  stats: { know: number; notYet: number };
  returns: Record<string, number>;
  id: string;
  prev: CardState | undefined;
}

function Deck({ cards, chips }: { cards: WordCard[]; chips: React.ReactNode }) {
  const state = useAppState();
  const [queue, setQueue] = useState(cards);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ know: 0, notYet: 0 });
  const [returns, setReturns] = useState<Record<string, number>>({});
  const [last, setLast] = useState<Step | null>(null);
  const [done, setDone] = useState<{ xp: number; badges: BadgeDef[] } | null>(null);
  const [drag, setDrag] = useState(0);
  const startX = useRef<number | null>(null);
  const startedAt = useRef(Date.now());
  const card = queue[pos];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!flipped) flip();
      } else if (flipped && (e.key === '1' || e.key === '۱')) rate(false);
      else if (flipped && (e.key === '2' || e.key === '۲')) rate(true);
      else if (e.key === 'Backspace' && last) undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function flip() {
    sfx.flip();
    setFlipped(true);
  }

  function rate(know: boolean) {
    if (!card) return;
    const prev = getState().cards[card.id];
    setLast({ queue, pos, stats, returns, id: card.id, prev: prev && { ...prev } });
    update((s) => {
      reviewCard(s, card.id, know ? 'good' : 'again');
    });
    setStats((st) => (know ? { ...st, know: st.know + 1 } : { ...st, notYet: st.notYet + 1 }));
    let q = queue;
    const n = returns[card.id] ?? 0;
    if (!know && n < AGAIN_MAX) {
      q = [...queue];
      q.splice(Math.min(q.length, pos + 1 + AGAIN_GAP), 0, card);
      setQueue(q);
      setReturns({ ...returns, [card.id]: n + 1 });
    }
    setFlipped(false);
    setDrag(0);
    if (pos + 1 >= q.length) finish(q);
    else setPos(pos + 1);
  }

  /** Take back the last rating: the card's box, the deck and the counts go back to how they were. */
  function undo() {
    if (!last) return;
    update((s) => {
      if (last.prev) s.cards[last.id] = last.prev;
      else delete s.cards[last.id];
      s.counters.cardsReviewed = Math.max(0, s.counters.cardsReviewed - 1);
    });
    setQueue(last.queue);
    setPos(last.pos);
    setStats(last.stats);
    setReturns(last.returns);
    setFlipped(true);
    setLast(null);
  }

  function finish(q: WordCard[]) {
    const distinct = new Set(q.map((c) => c.id)).size;
    const xp = Math.max(3, Math.round(distinct / 2));
    let badges: BadgeDef[] = [];
    update((s) => {
      awardXp(s, xp);
      addStudyTime(s, Date.now() - startedAt.current);
      s.counters.sessions += 1;
      badges = awardBadges(s);
    });
    sfx.complete();
    setDone({ xp, badges });
  }

  // Swipe a turned card: towards the right for «بلدم», towards the left for «هنوز نه».
  const pointer = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!flipped) return;
      startX.current = e.clientX;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (startX.current !== null) setDrag(e.clientX - startX.current);
    },
    onPointerUp: () => {
      const dx = drag;
      startX.current = null;
      if (Math.abs(dx) >= SWIPE_PX) rate(dx > 0);
      else setDrag(0);
    },
    onPointerCancel: () => {
      startX.current = null;
      setDrag(0);
    },
  };

  if (done) {
    return (
      <div className="session">
        <Confetti />
        <div className="session-body">
          <div className="result">
            <Mascot mood="cheer" size={120} className="pop" />
            <h1>مرور واژه‌ها تمام شد!</h1>
            <div className="result-stats">
              <div className="rstat" style={{ ['--rs' as string]: 'var(--ok)' }}>
                <div className="rs-h">بلد بودم</div>
                <div className="rs-v">{fmt(stats.know)}</div>
              </div>
              <div className="rstat" style={{ ['--rs' as string]: 'var(--bad)' }}>
                <div className="rs-h">هنوز نه</div>
                <div className="rs-v">{fmt(stats.notYet)}</div>
              </div>
            </div>
            <p className="small muted">
              امتیاز: <bdi dir="ltr">+{fmt(done.xp)}</bdi>. واژه‌ای که بلد بودی دیرتر برمی‌گردد و آنکه هنوز نه، فردا دوباره می‌آید.
            </p>
            {done.badges.map((b) => (
              <div key={b.id} className="card pop row" style={{ width: '100%' }}>
                <span style={{ fontSize: 34 }}>{b.emoji}</span>
                <div className="grow" style={{ textAlign: 'start' }}>
                  <b>نشان جدید: {b.title}</b>
                  <div className="small muted">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="session-foot">
          <div className="session-foot-in">
            <button className="btn lg" onClick={back}>
              ادامه
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!card) return null;
  const box = state.cards[card.id]?.box ?? 0;
  const { term } = card;
  const example = term.examples?.[0];

  return (
    <div className="session">
      <SessionTop onClose={back} progress={pos / queue.length} color="var(--accent)" right={<span className="chip">{fmt(pos + 1)}/{fmt(queue.length)}</span>} />
      <div className="session-body">
        {pos === 0 && !flipped && chips}
        <div
          className={`fc-stage wc-stage${drag > 20 ? ' yes' : drag < -20 ? ' no' : ''}`}
          style={drag ? { transform: `translateX(${drag}px) rotate(${drag / 30}deg)` } : undefined}
          {...pointer}
        >
          <div className={`fc${flipped ? ' flipped' : ''}`} onClick={() => (flipped ? undefined : flip())} role="button" tabIndex={0} aria-label={flipped ? 'پشت کارت' : 'برای دیدن معنی لمس کن'}>
            <div className="fc-face front" aria-hidden={flipped}>
              <span className="fc-tag">
                {bookName(card.subject)} · {box ? `جعبهٔ ${fmt(box)}` : 'تازه'}
              </span>
              <div className="wc-term">{term.title}</div>
              {term.tex && <TeX tex={term.tex} />}
              <span className="fc-hint">معنی‌اش چیست؟ کارت را لمس کن</span>
            </div>
            <div className="fc-face back" aria-hidden={!flipped}>
              <div className="wc-term sm">{term.title}</div>
              <div>
                <Rich text={term.short} />
              </div>
              {example && (
                <div className="small muted wc-example">
                  <Rich text={example} />
                </div>
              )}
            </div>
          </div>
        </div>
        {flipped && <p className="tiny muted center">کارت را به راست بکش یعنی بلدم، به چپ یعنی هنوز نه.</p>}
        {last && (
          <button className="link-btn wc-undo" onClick={undo}>
            <Icon name="back" size={18} /> برگرد به کارت قبل
          </button>
        )}
      </div>
      <div className="session-foot">
        <div className="session-foot-in">
          {!flipped ? (
            <button className="btn lg" onClick={flip}>
              <Icon name="refresh" /> نشانم بده
            </button>
          ) : (
            <>
              <button className="btn bad" onClick={() => rate(false)}>
                هنوز نه
              </button>
              <button className="btn ok" onClick={() => rate(true)}>
                بلدم
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
