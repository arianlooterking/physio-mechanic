import { useEffect, useMemo, useRef, useState } from 'react';
import { cardById, LESSONS, lessonById } from '../content';
import type { Flashcard } from '../content/types';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { Rich, TeX } from '../components/Rich';
import { SessionTop } from '../components/session';
import { Confetti } from '../components/ui';
import { awardBadges, type BadgeDef } from '../lib/badges';
import { fmt } from '../lib/digits';
import { boxCounts, dueCards, trackFinish } from '../lib/learner';
import { exitTo } from '../lib/nav';
import { sfx } from '../lib/sound';
import { addStudyTime, awardXp, isDue, LEITNER_DAYS, reviewCard, type CardRating } from '../lib/state';
import { getState, update, useAppState } from '../lib/store';
import { dayKey } from '../lib/time';

const MAX_NEW = 20;

function buildQueue(scope: string, all: boolean): Flashcard[] {
  const s = getState();
  const today = dayKey();
  if (scope === 'due') return dueCards(s).slice(0, 30);
  const lesson = lessonById(scope);
  if (!lesson) return [];
  if (all) return lesson.cards.slice();
  return lesson.cards.filter((c) => isDue(s.cards[c.id], today)).slice(0, MAX_NEW);
}

export function CardsSession({ scope }: { scope: string }) {
  const lesson = scope === 'due' ? undefined : lessonById(scope);
  const [all, setAll] = useState(false);
  const initial = useMemo(() => buildQueue(scope, all), [scope, all]);
  if (scope !== 'due' && !lesson) {
    return (
      <div className="onb">
        <div className="onb-body center">
          <Mascot mood="oops" />
          <h1>این دسته کارت پیدا نشد</h1>
          <button className="btn" onClick={() => exitTo()}>
            بازگشت
          </button>
        </div>
      </div>
    );
  }
  if (!initial.length) {
    return (
      <div className="onb">
        <div className="onb-body center">
          <Mascot mood="cheer" size={120} />
          <h1>{scope === 'due' ? 'امروز کارتی برای مرور نداری' : 'کارت‌های این درس فعلاً مرور شده‌اند'}</h1>
          <p className="lead">
            {scope === 'due'
              ? 'کارت‌های هر مفهوم بعد از یاد گرفتنش وارد جعبه‌های مرور می‌شوند و سر وقتشان برمی‌گردند.'
              : 'جعبهٔ لایتنر هر کارت را سر وقت خودش برمی‌گرداند. اگر بخواهی، می‌توانی همین الان همه را یک دور ببینی.'}
          </p>
          {scope !== 'due' && (
            <button className="btn lg" onClick={() => setAll(true)}>
              مرور همهٔ کارت‌های این درس
            </button>
          )}
          <button className="btn ghost" onClick={() => exitTo(scope === 'due' ? { name: 'review' } : { name: 'home' })}>
            بازگشت
          </button>
        </div>
      </div>
    );
  }
  return <Deck key={`${scope}:${all}`} cards={initial} scope={scope} />;
}

function Deck({ cards, scope }: { cards: Flashcard[]; scope: string }) {
  const state = useAppState();
  const [queue, setQueue] = useState(cards);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ good: 0, hard: 0, again: 0 });
  const [doneInfo, setDoneInfo] = useState<{ xp: number; badges: BadgeDef[] } | null>(null);
  const startedAt = useRef(Date.now());
  const againOnce = useRef(new Set<string>());

  const card = queue[pos];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (doneInfo) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!flipped) flip();
      } else if (flipped && (e.key === '1' || e.key === '۱')) rate('again');
      else if (flipped && (e.key === '2' || e.key === '۲')) rate('hard');
      else if (flipped && (e.key === '3' || e.key === '۳')) rate('good');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function flip() {
    sfx.flip();
    setFlipped(true);
  }

  function rate(r: CardRating) {
    if (!card) return;
    update((s) => {
      trackFinish(s, cardById(card.id)?.lesson.id, () => reviewCard(s, card.id, r));
    });
    setStats((st) => ({ ...st, [r]: st[r] + 1 }));
    let q = queue;
    if (r === 'again' && !againOnce.current.has(card.id)) {
      againOnce.current.add(card.id);
      q = [...queue, card];
      setQueue(q);
    }
    setFlipped(false);
    if (pos + 1 >= q.length) finish();
    else setTimeout(() => setPos(pos + 1), 120);
  }

  function finish() {
    const xp = Math.max(3, Math.round(cards.length / 2));
    let badges: BadgeDef[] = [];
    update((s) => {
      awardXp(s, xp);
      addStudyTime(s, Date.now() - startedAt.current);
      s.counters.sessions += 1;
      badges = awardBadges(s);
    });
    sfx.complete();
    setDoneInfo({ xp, badges });
  }

  const lessons = scope === 'due' ? LESSONS : [lessonById(scope)!];
  const boxes = boxCounts(state, lessons);
  const back = () => exitTo(scope === 'due' ? { name: 'review' } : { name: 'home' });

  if (doneInfo) {
    return (
      <div className="session">
        <Confetti />
        <div className="session-body">
          <div className="result">
            <Mascot mood="cheer" size={120} className="pop" />
            <h1>مرور کارت‌ها تمام شد!</h1>
            <div className="result-stats">
              <div className="rstat" style={{ ['--rs' as string]: 'var(--ok)' }}>
                <div className="rs-h">بلد بودم</div>
                <div className="rs-v">{stats.good}</div>
              </div>
              <div className="rstat" style={{ ['--rs' as string]: 'var(--accent)' }}>
                <div className="rs-h">سخت بود</div>
                <div className="rs-v">{stats.hard}</div>
              </div>
              <div className="rstat" style={{ ['--rs' as string]: 'var(--bad)' }}>
                <div className="rs-h">یادم نبود</div>
                <div className="rs-v">{stats.again}</div>
              </div>
            </div>
            <LeitnerBoxes counts={boxes} />
            <p className="small muted">امتیاز: <bdi dir="ltr">+{doneInfo.xp}</bdi>. کارت‌ها سر وقت خودشان برمی‌گردند؛ جعبهٔ بالاتر یعنی فاصلهٔ مرور طولانی‌تر.</p>
            {doneInfo.badges.map((b) => (
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
  const from = cardById(card.id)?.lesson;
  const st = state.cards[card.id];

  return (
    <div className="session">
      <SessionTop onClose={back} progress={pos / queue.length} color="var(--accent)" right={<span className="chip">{fmt(pos + 1)}/{fmt(queue.length)}</span>} />
      <div className="session-body">
        <div className="fc-stage">
          <div
            className={`fc${flipped ? ' flipped' : ''}`}
            onClick={() => (flipped ? undefined : flip())}
            role="button"
            tabIndex={0}
            aria-label={flipped ? 'پشت کارت' : 'برای دیدن جواب لمس کن'}
          >
            <div className="fc-face front" aria-hidden={flipped}>
              <span className="fc-tag">
                {from?.title} · جعبهٔ {fmt(st?.box ?? 0)}
              </span>
              <div>
                <Rich text={card.front} />
              </div>
              <span className="fc-hint">برای دیدن جواب، کارت را لمس کن</span>
            </div>
            <div className="fc-face back" aria-hidden={!flipped}>
              <div>
                <Rich text={card.back} />
              </div>
              {card.tex && <TeX tex={card.tex} />}
            </div>
          </div>
        </div>
        <LeitnerBoxes counts={boxes} />
      </div>
      <div className="session-foot">
        <div className="session-foot-in">
          {!flipped ? (
            <button className="btn lg" onClick={flip}>
              <Icon name="refresh" /> نشانم بده
            </button>
          ) : (
            <>
              <button className="btn bad" onClick={() => rate('again')}>
                یادم نبود
              </button>
              <button className="btn accent" onClick={() => rate('hard')}>
                سخت بود
              </button>
              <button className="btn ok" onClick={() => rate('good')}>
                بلد بودم
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function LeitnerBoxes({ counts }: { counts: number[] }) {
  return (
    <div style={{ width: '100%' }}>
      <div className="small bold muted" style={{ margin: '4px 2px 8px' }}>
        جعبه‌های لایتنر (کارت‌های جدید: {fmt(counts[0])})
      </div>
      <div className="boxes">
        {[1, 2, 3, 4, 5].map((b) => (
          <div key={b} className="lbox" title={`مرور هر ${LEITNER_DAYS[b]} روز`}>
            <b>{fmt(counts[b])}</b>
            جعبهٔ {fmt(b)}
          </div>
        ))}
      </div>
    </div>
  );
}
