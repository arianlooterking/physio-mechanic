import { useState } from 'react';
import { LESSONS, subjectById } from '../content';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { Plot } from '../components/Plot';
import { Rich } from '../components/Rich';
import { fmt } from '../lib/digits';
import { rightAnswerText } from '../lib/grade';
import { boxCounts, dueCards, findQuestion, reviewAvailable } from '../lib/learner';
import { go } from '../lib/nav';
import { isDue, openMistakes } from '../lib/state';
import { wordStats } from '../lib/words';
import { update, useAppState } from '../lib/store';
import { dayKey } from '../lib/time';
import { LeitnerBoxes } from './CardsSession';

export function Review() {
  const s = useAppState();
  const due = dueCards(s).length;
  const words = wordStats(s);
  const mistakes = reviewAvailable(s);
  const today = dayKey();
  const lastExam = s.exams?.[s.exams.length - 1];
  const [open, setOpen] = useState<string | null>(null);
  const notebook = openMistakes(s)
    .map((id) => findQuestion(id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">مرور</h1>
        <p className="page-sub">چیزی که مرور نشود فراموش می‌شود. بیومانا خودش حساب می‌کند هر چیز را کِی مرور کنی.</p>
      </div>

      <div className="card row" style={{ gap: 14 }}>
        <span style={{ width: 54, height: 54, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'var(--bad-soft)', color: 'var(--bad)' }}>
          <Icon name="refresh" size={28} />
        </span>
        <div className="grow">
          <b>مرور هوشمند اشتباه‌ها</b>
          <div className="small muted">
            {mistakes > 0 ? `${fmt(mistakes)} سؤال که قبلاً اشتباه زدی، به‌علاوهٔ مفهوم‌های ضعیف‌تر` : 'اشتباه بازی نداری؛ مرور روی مفهوم‌های ضعیف‌تر تمرکز می‌کند.'}
          </div>
        </div>
        <button className="btn sm" onClick={() => go({ name: 'mistakes' })}>
          شروع
        </button>
      </div>

      <div className="card row" style={{ gap: 14 }}>
        <span style={{ width: 54, height: 54, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent-dark)' }}>
          <Icon name="cards" size={28} />
        </span>
        <div className="grow">
          <b>کارت‌های امروز</b>
          <div className="small muted">{due > 0 ? `${fmt(due)} کارت آمادهٔ مرور است` : 'امروز کارت آماده‌ای نداری.'}</div>
        </div>
        <button className="btn sm accent" onClick={() => go({ name: 'cards', scope: 'due' })} disabled={due === 0}>
          مرور
        </button>
      </div>

      <div className="card row" style={{ gap: 14 }}>
        <span style={{ width: 54, height: 54, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'var(--ok-soft)', color: 'var(--ok)', flex: 'none' }}>
          <Icon name="book" size={28} />
        </span>
        <div className="grow">
          <b>کارت واژه</b>
          <div className="small muted">
            {words.met === 0
              ? 'واژه‌ها و نمادهای فرمول درس‌هایی که شروع کنی، اینجا کارت می‌شوند.'
              : `${fmt(words.ready)} واژه آمادهٔ مرور · ${fmt(words.learned)} از ${fmt(words.met)} واژه تثبیت‌شده`}
          </div>
        </div>
        <button className="btn sm ok" onClick={() => go({ name: 'words' })} disabled={words.met === 0}>
          مرور
        </button>
      </div>

      <div className="card row mock-entry" style={{ gap: 14 }}>
        <span style={{ width: 54, height: 54, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', color: 'var(--primary)', flex: 'none' }}>
          <Icon name="trophy" size={28} />
        </span>
        <div className="grow">
          <b>آزمون جامع</b>
          <div className="small muted">
            {lastExam
              ? `آخرین بار: ${fmt(lastExam.score, 1)}٪ در ${fmt(lastExam.total)} سؤال ${subjectById(lastExam.subject)?.title ?? ''}`
              : '۱۰، ۲۰ یا ۳۰ سؤال از چند درس، زمان‌دار مثل امتحان'}
          </div>
        </div>
        <button className="btn sm" onClick={() => go({ name: 'mock' })}>
          شروع
        </button>
      </div>

      <div className="card">
        <LeitnerBoxes counts={boxCounts(s)} />
        <p className="tiny muted" style={{ marginTop: 8 }}>
          هر کارتی که بلد باشی یک جعبه جلو می‌رود و دیرتر برمی‌گردد (۱، ۲، ۴، ۸ و ۱۶ روز). کارتی که یادت نباشد به جعبهٔ ۱ برمی‌گردد.
        </p>
      </div>

      <h2 className="section-title">دسته کارت‌های هر درس</h2>
      <div className="stack" style={{ gap: 10 }}>
        {LESSONS.map((l) => {
          const subj = subjectById(l.subject);
          const d = l.cards.filter((c) => isDue(s.cards[c.id], today)).length;
          const learned = l.cards.filter((c) => (s.cards[c.id]?.box ?? 0) >= 3).length;
          return (
            <button key={l.id} className="card row" style={{ textAlign: 'start' }} onClick={() => go({ name: 'cards', scope: l.id })}>
              <span className="chip" style={{ background: `var(--${subj.color}-soft)`, color: `var(--${subj.color})` }}>
                {subj.title}
              </span>
              <div className="grow">
                <b>{l.title}</b>
                <div className="small muted">
                  {fmt(l.cards.length)} کارت · {fmt(learned)} تثبیت‌شده · {fmt(d)} آمادهٔ مرور
                </div>
              </div>
              <Icon name="next" />
            </button>
          );
        })}
      </div>

      <h2 className="section-title">دفتر اشتباه‌ها</h2>
      {notebook.length === 0 ? (
        <div className="card row">
          <Mascot mood="happy" size={56} glow={false} />
          <p className="small muted grow">دفترت خالی است. هر سؤالی که اشتباه بزنی با جواب و توضیحش اینجا ثبت می‌شود تا قبل از امتحان مرورش کنی.</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {notebook.map(({ q, lesson }) => {
            const isOpen = open === q.id;
            return (
              <div key={q.id} className="card">
                <button className="spread" style={{ width: '100%', textAlign: 'start' }} onClick={() => setOpen(isOpen ? null : q.id)} aria-expanded={isOpen}>
                  <span className="grow">
                    <span className="small muted">{lesson.title}</span>
                    <div className="bold">
                      <Rich text={q.prompt} />
                    </div>
                  </span>
                  <Icon name={isOpen ? 'minus' : 'plus'} />
                </button>
                {isOpen && (
                  <div className="stack" style={{ marginTop: 10, gap: 10 }}>
                    {q.plot && (
                      <div style={{ maxWidth: 340 }}>
                        <Plot spec={q.plot} />
                      </div>
                    )}
                    {q.type !== 'match' && q.type !== 'graph' && (
                      <div className="note tip">
                        <Icon name="check" className="n-ic" size={20} />
                        <div>
                          <span className="n-title">جواب درست</span>
                          <Rich text={rightAnswerText(q)} />
                        </div>
                      </div>
                    )}
                    <div className="note info">
                      <Icon name="bulb" className="n-ic" size={20} />
                      <div>
                        <Rich text={q.explain} />
                      </div>
                    </div>
                    <div className="row">
                      <button
                        className="btn sm ghost"
                        onClick={() =>
                          update((st) => {
                            const m = st.mistakes[q.id];
                            if (m) m.resolved = true;
                          })
                        }
                      >
                        یاد گرفتم، از دفتر حذف شود
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
