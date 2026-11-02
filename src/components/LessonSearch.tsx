import { useMemo, useState } from 'react';
import { subjectById } from '../content';
import { fmt } from '../lib/digits';
import { go } from '../lib/nav';
import { normalizeFa, searchLessons } from '../lib/search';
import { Icon } from './Icon';
import { Rich } from './Rich';
import { SubjectIcon } from './ui';

const WHY: Record<string, string> = { chapter: 'فصل', book: 'کتاب', concept: 'مفهوم', term: 'اصطلاح' };

/** Find a lesson by its title, chapter, book or a term it teaches. */
export function LessonSearch() {
  const [q, setQ] = useState('');
  const hits = useMemo(() => searchLessons(q, 10), [q]);
  const active = normalizeFa(q).replace(/ /g, '').length >= 2;
  return (
    <div className="lsearch" role="search">
      <div className="lsearch-box">
        <Icon name="search" size={20} />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 60))}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQ('');
          }}
          placeholder="جست‌وجوی درس، فصل یا اصطلاح…"
          aria-label="جست‌وجوی درس"
          enterKeyHint="search"
          autoComplete="off"
        />
        {q && (
          <button className="icon-btn" onClick={() => setQ('')} aria-label="پاک کردن جست‌وجو">
            <Icon name="x" size={18} />
          </button>
        )}
      </div>
      {active && (
        <div className="lsearch-results" aria-live="polite">
          {hits.length ? (
            <>
              <div className="tiny muted lsearch-count">{fmt(hits.length)} درس پیدا شد</div>
              {hits.map((h) => {
                const subj = subjectById(h.lesson.subject);
                return (
                  <button key={h.lesson.id} className="lsearch-hit" onClick={() => go({ name: 'lesson', lessonId: h.lesson.id })}>
                    <span className="lsearch-ic" style={{ ['--sc' as string]: `var(--${subj.color})` }}>
                      <SubjectIcon id={subj.id} size={18} />
                    </span>
                    <span className="grow">
                      <b className="lsearch-title">
                        <Rich text={h.lesson.title} />
                      </b>
                      <span className="tiny muted lsearch-where">
                        {subj.title} · {h.lesson.label}
                      </span>
                      {h.field !== 'title' && (
                        <span className="chip lsearch-why">
                          {WHY[h.field]}: <Rich text={h.term ?? (h.field === 'chapter' ? h.lesson.chapter : subj.title)} />
                        </span>
                      )}
                    </span>
                    <Icon name="next" size={18} />
                  </button>
                );
              })}
            </>
          ) : (
            <p className="small muted lsearch-none">
              درسی با «{q.trim()}» پیدا نکردم. اسم فصل یا یک اصطلاح دیگر را امتحان کن.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
