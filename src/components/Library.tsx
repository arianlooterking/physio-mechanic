import { useState } from 'react';
import { booksFor, GRADES, MAJOR_INFO, pdfLink, SUBJECTS } from '../content';
import type { Book, Grade, Major, SubjectId } from '../content/types';
import { go } from '../lib/nav';
import { update, useAppState } from '../lib/store';
import { setStudy, viewGrade } from '../lib/study';
import { Icon } from './Icon';

/**
 * «کتابخانهٔ بیومانا»: every textbook of grades 10–12 for the three majors. Books with lessons open them;
 * the rest link to their PDF. Starts on the learner's own grade and major.
 */
export function Library({ compact = false }: { compact?: boolean }) {
  const s = useAppState();
  const [grade, setGrade] = useState<Grade>(() => viewGrade(s));
  const [major, setMajor] = useState<Major>(s.profile.major);
  const books = booksFor(grade, major);
  const specialized = books.filter((b) => b.group === 'specialized');
  const general = books.filter((b) => b.group === 'general');

  const open = (b: Book) => {
    if (!b.subject) return;
    const sub = SUBJECTS.find((x) => x.id === b.subject);
    if (!sub) return;
    update((st) => {
      // Home shows the learner's grade and major, so opening another grade's or major's book switches to it.
      setStudy(st, b.grade, b.majors.includes(st.profile.major) ? st.profile.major : major);
      st.profile.focus = sub.id as SubjectId;
    });
    go({ name: 'home' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="library" aria-labelledby="lib-title">
      <div className="lib-head">
        <div>
          <h2 id="lib-title" className="section-title" style={{ margin: 0 }}>
            کتابخانهٔ بیومانا
          </h2>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            چهار بخش کتاب «بیومکانیک پایهٔ دستگاه اسکلتی‌ـ‌عضلانی»؛ بخش‌های آماده و بخش‌هایی که در راه‌اند.
          </p>
        </div>
        <span className="lib-weekly">
          <Icon name="sparkles" size={16} /> همیشه به‌روز
        </span>
      </div>

      <div className="lib-filters">
        <div className="seg" role="group" aria-label="پایه">
          {GRADES.map((g) => (
            <button key={g.id} aria-pressed={grade === g.id} onClick={() => setGrade(g.id)}>
              {g.title}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="رشته">
          {MAJOR_INFO.map((m) => (
            <button key={m.id} aria-pressed={major === m.id} onClick={() => setMajor(m.id)}>
              {m.short}
            </button>
          ))}
        </div>
      </div>

      <Shelf title={`درس‌های اختصاصی ${MAJOR_INFO.find((m) => m.id === major)!.title}`} books={specialized} onOpen={open} />
      {!compact && <Shelf title="درس‌های عمومی" books={general} onOpen={open} />}
    </section>
  );
}

function Shelf({ title, books, onOpen }: { title: string; books: Book[]; onOpen: (b: Book) => void }) {
  if (!books.length) return null;
  return (
    <>
      <h3 className="lib-shelf">{title}</h3>
      <div className="lib-grid">
        {books.map((b) =>
          b.available ? (
            <div key={b.id} className="lib-book ready">
              <span className="lib-spine" aria-hidden="true" />
              <button className="lib-open" onClick={() => onOpen(b)}>
                <b>{b.title}</b>
                <small>
                  <Icon name="play" size={14} /> شروع درس
                </small>
              </button>
              {b.subject && (
                <button className="lib-sheet" onClick={() => go({ name: 'sheet', subject: b.subject! })} aria-label={`برگهٔ خلاصهٔ ${b.title}`}>
                  <Icon name="doc" size={14} /> خلاصه
                </button>
              )}
            </div>
          ) : (
            <a key={b.id} className="lib-book" href={pdfLink(b)} target="_blank" rel="noopener noreferrer">
              <span className="lib-spine" aria-hidden="true" />
              <b>{b.title}</b>
              <small>
                <Icon name="book" size={14} /> {b.pdf ? 'PDF کتاب' : 'صفحهٔ دانلود'}
              </small>
            </a>
          ),
        )}
      </div>
    </>
  );
}
