import { useEffect, useMemo, useState } from 'react';
import { GRADES, SUBJECTS } from '../content';
import type { Flashcard } from '../content/types';
import { Icon } from '../components/Icon';
import { KonkurTips } from '../components/KonkurTips';
import { Mascot } from '../components/Mascot';
import { Rich, TeX } from '../components/Rich';
import { fmt } from '../lib/digits';
import { go } from '../lib/nav';
import { isApp } from '../lib/platform';
import { buildSheet } from '../lib/sheet';

/** «برگهٔ خلاصه» (#/sheet/<subject>): a book's summaries, key notes and cards on one page, ready to print. */
export function SummarySheet({ subject, lessonId }: { subject: string; lessonId?: string }) {
  const sub = SUBJECTS.find((x) => x.id === subject && x.lessons.length);
  const sheet = useMemo(() => (sub ? buildSheet(sub) : null), [sub]);
  const [notes, setNotes] = useState(true);
  const [cards, setCards] = useState(true);

  useEffect(() => {
    if (!lessonId) return;
    const el = document.getElementById(`sheet-${lessonId}`);
    // After the hash change has scrolled to the top.
    const t = setTimeout(() => el?.scrollIntoView({ block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [lessonId]);

  if (!sub || !sheet) {
    return (
      <div className="center stack" style={{ paddingTop: 40, alignItems: 'center' }}>
        <Mascot mood="oops" />
        <b>این کتاب پیدا نشد.</b>
        <button className="btn" onClick={() => go({ name: 'home' })}>
          خانه
        </button>
      </div>
    );
  }
  const grade = GRADES.find((g) => g.id === sub.grade)?.title;
  const { counts } = sheet;

  return (
    <article className="sumsheet" style={{ ['--sc' as string]: `var(--${sub.color})` }} aria-labelledby="sheet-title">
      <div className="ss-tools no-print">
        <button className="link-btn" onClick={() => go(lessonId ? { name: 'lesson', lessonId } : { name: 'home' })}>
          <Icon name="back" size={18} /> {lessonId ? 'جزئیات درس' : 'مسیر یادگیری'}
        </button>
        <div className="ss-actions">
          <div className="seg" role="group" aria-label="چه چیزهایی در برگه باشد">
            <button aria-pressed={notes} onClick={() => setNotes((v) => !v)}>
              نکته‌ها
            </button>
            <button aria-pressed={cards} onClick={() => setCards((v) => !v)}>
              کارت‌ها
            </button>
          </div>
          {!isApp && (
            <button className="btn sm" onClick={() => window.print()}>
              <Icon name="print" size={18} /> چاپ
            </button>
          )}
        </div>
      </div>
      {isApp && <p className="tiny muted no-print ss-app-note">برای چاپ یا گرفتن PDF، این برگه را در سایت بیومانا باز کن.</p>}

      <header className="ss-head">
        <div className="ss-brand">بیومانا · برگهٔ خلاصه</div>
        <h1 id="sheet-title">{sub.title}</h1>
        <p className="small muted">
          پایهٔ {grade} · {fmt(counts.lessons)} درس · {fmt(counts.concepts)} مفهوم · {fmt(counts.cards)} کارت
        </p>
      </header>

      {sheet.chapters.map(({ chapter, lessons }) => (
        <section key={chapter} className="ss-chapter">
          <h2 className="ss-ch">
            <Rich text={chapter} />
          </h2>
          {lessons.map((l) => (
            <section key={l.id} id={`sheet-${l.id}`} className="ss-lesson">
              <h3 className="ss-lh">
                <span className="ss-label">{l.label}</span>
                <span className="grow">
                  <Rich text={l.title} />
                </span>
                <span className="ss-pages">
                  صفحهٔ {fmt(l.pages[0])} تا {fmt(l.pages[1])}
                </span>
              </h3>
              {l.concepts.map((c) => (
                <div key={c.id} className="ss-concept">
                  <h4>
                    <Rich text={c.title} />
                  </h4>
                  <ul className="ss-sum">
                    {c.summary.map((x, k) => (
                      <li key={k}>
                        <Rich text={x} />
                      </li>
                    ))}
                  </ul>
                  {notes &&
                    c.notes.map((n, k) => (
                      <p key={k} className={`ss-note ${n.tone}`}>
                        <b>{n.title ? <Rich text={n.title} /> : n.tone === 'exam' ? 'نکتهٔ امتحانی' : 'نکتهٔ کلیدی'}:</b> <Rich text={n.text} />
                      </p>
                    ))}
                  {cards && <Cards cards={c.cards} />}
                </div>
              ))}
              {cards && l.cards.length > 0 && (
                <div className="ss-concept">
                  <Cards cards={l.cards} />
                </div>
              )}
              {notes && l.tips.length > 0 && (
                <div className="ss-concept ss-konkur">
                  <h4>نکته‌های کنکوری</h4>
                  <KonkurTips tips={l.tips} />
                </div>
              )}
            </section>
          ))}
        </section>
      ))}

      <footer className="ss-foot">بیومانا · biomana — این برگه از خلاصه‌ها و کارت‌های درس‌های بیومانا ساخته شده است.</footer>
    </article>
  );
}

function Cards({ cards }: { cards: Flashcard[] }) {
  if (!cards.length) return null;
  return (
    <dl className="ss-cards">
      {cards.map((card) => (
        <div key={card.id} className="ss-card">
          <dt>
            <Rich text={card.front} />
          </dt>
          <dd>
            <Rich text={card.back} />
            {card.tex && <TeX tex={card.tex} />}
          </dd>
        </div>
      ))}
    </dl>
  );
}
