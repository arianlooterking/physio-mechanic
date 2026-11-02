/* Development-only content preview: every explanation, question and card of a lesson on one page. */
import { lessonById, lessonBookLink } from '../content';
import type { Question } from '../content/types';
import { Blocks } from '../components/Blocks';
import { QuestionView } from '../components/questions/QuestionView';
import { Rich, TeX } from '../components/Rich';
import { KIND_META } from '../components/session';
import { testToQuestion, type Answer } from '../lib/grade';

function correctAnswer(q: Question): Answer | null {
  switch (q.type) {
    case 'mcq':
      return { t: 'mcq', choice: q.answer };
    case 'cloze':
      return { t: 'cloze', choice: q.answer };
    case 'graph':
      return { t: 'graph', choice: q.answer };
    case 'tf':
      return { t: 'tf', value: q.answer };
    case 'num':
      return { t: 'num', raw: String(q.answer) };
    case 'order':
      return { t: 'order', seq: q.items.map((_, i) => i) };
    case 'match':
      return { t: 'match', mistakes: 0, done: true };
    case 'written':
      return { t: 'written', score: 1 };
  }
}

export function DevCatalog({ lessonId, part, only }: { lessonId: string; part: string; only?: string }) {
  const lesson = lessonById(lessonId);
  if (!lesson) return <p>no lesson</p>;
  const link = lessonBookLink(lesson);
  const showQ = (q: Question) => (
    <div key={q.id} className="card" id={q.id}>
      <div className="tiny muted">
        {q.id} · {q.type} · L{q.level}
      </div>
      <QuestionView q={q} answer={correctAnswer(q)} onAnswer={() => undefined} locked />
      <div className="note tip" style={{ marginTop: 8 }}>
        <div>
          <Rich text={q.explain} />
        </div>
      </div>
    </div>
  );
  return (
    <div className="main" style={{ paddingBottom: 60 }}>
      <h1 className="page-title">{lesson.title}</h1>
      {(part === 'all' || part === 'learn') &&
        lesson.concepts.filter((c) => !only || c.id === only).map((c) => (
          <section key={c.id} className="stack" style={{ marginBottom: 30 }} id={c.id}>
            <h2 className="section-title">
              {c.id}: <Rich text={c.title} />
            </h2>
            {c.approaches.map((a, i) => (
              <article key={i} className="explain" id={`${c.id}-${i}`}>
                <div className="explain-kind">
                  <b>{KIND_META[a.kind].label}</b> — <Rich text={a.title} />
                </div>
                <Blocks blocks={a.blocks} bookLink={link} />
              </article>
            ))}
            <div className="summary-card">
              <ul>
                {c.summary.map((s, i) => (
                  <li key={i}>
                    <Rich text={s} />
                  </li>
                ))}
              </ul>
            </div>
            {c.checks.map(showQ)}
          </section>
        ))}
      {(part === 'all' || part === 'practice') && (
        <section className="stack">
          <h2 className="section-title">practice</h2>
          {lesson.practice.map(showQ)}
        </section>
      )}
      {(part === 'all' || part === 'test') && (
        <section className="stack">
          <h2 className="section-title">test</h2>
          {lesson.test.map((t) => showQ(testToQuestion(t)))}
        </section>
      )}
      {(part === 'all' || part === 'cards') && (
        <section className="stack">
          <h2 className="section-title">cards</h2>
          {lesson.cards.map((c) => (
            <div key={c.id} className="card">
              <div className="tiny muted">{c.id}</div>
              <b>
                <Rich text={c.front} />
              </b>
              <div>
                <Rich text={c.back} />
              </div>
              {c.tex && <TeX tex={c.tex} />}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
