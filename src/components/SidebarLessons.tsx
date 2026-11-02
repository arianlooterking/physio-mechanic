import { useEffect, useRef, useState } from 'react';
import { GRADES, MAJOR_INFO } from '../content';
import type { Grade, Lesson, Major, Subject } from '../content/types';
import { fmt } from '../lib/digits';
import { buildPath, currentIndex, lastActivity, lessonProgress } from '../lib/learner';
import { go, openPathNode, type Route } from '../lib/nav';
import type { AppState } from '../lib/state';
import { update, useAppState } from '../lib/store';
import { setStudy, studySubjects, viewGrade } from '../lib/study';
import { Icon } from './Icon';
import { Ring, SubjectIcon } from './ui';

/**
 * Desktop sidebar: the learner's lessons, under the main menu. Kept quiet: one line for the grade and major (the
 * choices open under it), one for the book, then the lessons, each a progress ring and a title. The next lesson
 * says شروع or ادامه; a finished one opens its overview for review; the «details» button shows on hover. The pick is
 * the same as Home's (setStudy, profile.focus), so Home follows it.
 */
export function SidebarLessons({ route }: { route: Route }) {
  const s = useAppState();
  const grade = viewGrade(s);
  const major = s.profile.major;
  const books = studySubjects(grade, major);
  const book = books.find((b) => b.id === s.profile.focus) ?? books[0];
  const here = 'lessonId' in route ? route.lessonId : undefined;
  // The lesson to keep in view: the one open now, else the first one not finished.
  const target = book && (book.lessons.find((l) => l.id === here) ?? book.lessons.find((l) => lessonProgress(s, l) < 1) ?? book.lessons[0]).id;
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    list.current?.querySelector('[data-target="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [book?.id, target]);

  return (
    <section className="side-lessons" aria-label="درس‌های من">
      <ScopePicker grade={grade} major={major} />
      {book ? (
        <>
          <BookPicker s={s} books={books} book={book} />
          <ul className="sl-list" ref={list}>
            {book.lessons.map((l, i) => (
              <LessonRow key={l.id} s={s} lesson={l} index={i} color={book.color} open={l.id === here} target={l.id === target} />
            ))}
          </ul>
        </>
      ) : (
        <p className="small muted" style={{ margin: '4px 8px' }}>
          درس‌های این پایه و رشته در راه است. پایه یا رشتهٔ دیگری را امتحان کن.
        </p>
      )}
    </section>
  );
}

/** «پایهٔ دوازدهم · ریاضی»: one line; tapping it opens the grade and major choices right under it. */
function ScopePicker({ grade, major }: { grade: Grade; major: Major }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sl-scope">
      <button className="sl-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="graduation" size={17} />
        <span className="sl-head-name">
          پایهٔ {GRADES.find((g) => g.id === grade)?.title} · {MAJOR_INFO.find((m) => m.id === major)?.short}
        </span>
        <Icon name="down" size={14} className="sl-chev" />
      </button>
      {open && (
        <div className="sl-scope-body">
          <div className="sl-tabs" role="group" aria-label="پایه">
            {GRADES.map((g) => (
              <button key={g.id} aria-pressed={g.id === grade} onClick={() => update((st) => setStudy(st, g.id, major))}>
                {g.title}
              </button>
            ))}
          </div>
          <div className="sl-tabs" role="group" aria-label="رشته">
            {MAJOR_INFO.map((m) => (
              <button key={m.id} aria-pressed={m.id === major} onClick={() => update((st) => setStudy(st, grade, m.id))}>
                {m.short}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The book switch: the open book on one line, and a list of every book under it when tapped. Our own list, not a
 * native <select>, whose option names turn unreadable in dark mode on some browsers.
 */
function BookPicker({ s, books, book }: { s: AppState; books: Subject[]; book: Subject }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="sl-picker" ref={box} style={{ ['--sc' as string]: `var(--${book.color})` }}>
      <button className="sl-head sl-book" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <SubjectIcon id={book.id} size={18} />
        <span className="sl-head-name">{book.title}</span>
        <span className="sl-count">{doneCount(s, book)}</span>
        <Icon name="down" size={14} className="sl-chev" />
      </button>
      {open && (
        <div className="sl-menu" role="listbox" aria-label="کتاب‌ها">
          {books.map((b) => (
            <button
              key={b.id}
              role="option"
              aria-selected={b.id === book.id}
              style={{ ['--sc' as string]: `var(--${b.color})` }}
              onClick={() => {
                update((st) => void (st.profile.focus = b.id));
                setOpen(false);
              }}
            >
              <SubjectIcon id={b.id} size={18} />
              <span className="sl-head-name">{b.title}</span>
              <span className="sl-count">{doneCount(s, b)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** «۳/۱۲»: finished lessons of a book. */
function doneCount(s: AppState, b: Subject): string {
  return `${fmt(b.lessons.filter((l) => lessonProgress(s, l) >= 1).length)}/${fmt(b.lessons.length)}`;
}

function LessonRow({ s, lesson, index, color, open, target }: { s: AppState; lesson: Lesson; index: number; color: string; open: boolean; target: boolean }) {
  const p = lessonProgress(s, lesson);
  const done = p >= 1;
  const verb = done ? 'مرور' : p > 0 || lastActivity(s, lesson) > 0 ? 'ادامه' : 'شروع';
  const start = () => {
    // A finished lesson opens its overview, where any part can be reviewed; the others open the next step.
    if (done) return go({ name: 'lesson', lessonId: lesson.id });
    const nodes = buildPath(lesson);
    openPathNode(lesson.id, nodes[Math.min(currentIndex(s, lesson, nodes), nodes.length - 1)]);
  };
  return (
    <li className={`sl-lesson${done ? ' done' : ''}${open ? ' open' : ''}`}>
      <button className="sl-main" onClick={start} data-target={target} aria-current={open ? 'page' : undefined} aria-label={`${verb} ${lesson.title}`} title={lesson.label}>
        <Ring value={p} size={28} stroke={3} color={done ? 'var(--ok)' : `var(--${color})`} track="var(--line)">
          <span className="sl-num">{done ? <Icon name="check" size={13} stroke={3.4} /> : fmt(index + 1)}</span>
        </Ring>
        <span className="sl-title">{lesson.title}</span>
        {target && !done && <span className="sl-go">{verb}</span>}
      </button>
      <button className="sl-more" onClick={() => go({ name: 'lesson', lessonId: lesson.id })} aria-label={`جزئیات ${lesson.title}`} title="جزئیات درس">
        <Icon name="grid" size={16} />
      </button>
    </li>
  );
}
