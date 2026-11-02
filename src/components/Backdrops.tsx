import type { CSSProperties } from 'react';
import { subjectColor } from '../content';
import { fieldOf } from '../content/fields';
import type { Field, SubjectId } from '../content/types';
import { M } from './Rich';

/** Backdrop paper and pieces per field (the CSS classes keep the original subject names). */
const KIND: Record<Field, 'hesaban' | 'physics' | 'chemistry' | 'language' | 'biology'> = { math: 'hesaban', physics: 'physics', chemistry: 'chemistry', language: 'language', biology: 'biology' };
const TINT = (subject?: SubjectId) => (subject ? subjectColor(subject).c : 'var(--primary)');

/**
 * Behind the main tabs: slow drifting colour fields and a faint field of school symbols, tinted by the
 * subject the learner is focused on. Pure decoration: hidden from screen readers, never clickable.
 */
export function AppBackdrop({ subject }: { subject?: SubjectId }) {
  return (
    <div className="app-bg" aria-hidden="true" style={{ '--tint': TINT(subject) } as CSSProperties}>
      <div className="ab-blob b1" />
      <div className="ab-blob b2" />
      <div className="ab-blob b3" />
      <div className="ab-symbols">
        {SYMBOLS.map(([ch, x, y, s, d], i) => (
          <span key={i} style={{ left: `${x}%`, top: `${y}%`, fontSize: `${s}px`, animationDelay: `${d}s` } as CSSProperties}>
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}

const SYMBOLS: [string, number, number, number, number][] = [
  ['σ', 6, 14, 30, -2],
  ['ε', 90, 10, 32, -6],
  ['τ', 14, 62, 28, -4],
  ['M', 84, 48, 28, -9],
  ['Δℓ', 4, 88, 24, -1],
  ['F', 94, 80, 32, -7],
  ['θ', 48, 6, 24, -3],
  ['ω', 70, 92, 26, -5],
  ['E', 30, 34, 22, -8],
  ['N', 62, 26, 20, -10],
]

/**
 * Behind a lesson, practice, test or card session: a wash in the subject colour, the subject's own paper
 * (graph paper for calculus, a dot grid for physics, hexagons for chemistry, ruled lines for languages, cells for biology) and a few small drifting
 * pieces of that subject. Still when the learner asks for reduced motion; mostly hidden on phones. `framed`: on a page
 * with the sidebar and rail (a lesson's overview), it fills only the middle column and its pieces stay faint.
 */
export function LessonBackdrop({ subject, framed }: { subject?: SubjectId; framed?: boolean }) {
  const kind = KIND[fieldOf(subject) ?? 'math'];
  return (
    <div className={`lesson-bg lb-${kind}${framed ? ' lb-framed' : ''}`} aria-hidden="true" style={{ '--u': TINT(subject ?? 'bm1') } as CSSProperties}>
      <div className="lb-wash" />
      {framed && (
        <>
          <div className="lb-glow g1" />
          <div className="lb-glow g2" />
        </>
      )}
      <div className="lb-paper" />
      {kind === 'hesaban' && <MathPieces />}
      {kind === 'physics' && <PhysicsPieces />}
      {kind === 'chemistry' && <ChemPieces />}
      {kind === 'language' && <LanguagePieces subject={subject} />}
      {kind === 'biology' && <BioPieces />}
      <div className="lb-piece lb-badge good">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="lb-piece lb-badge idea">🦴</div>
      <span className="lb-star s1">✦</span>
      <span className="lb-star s2">✦</span>
      <span className="lb-star s3">✦</span>
    </div>
  );
}

function MathPieces() {
  return (
    <>
      <div className="lb-piece lb-plot">
        <svg viewBox="0 0 120 80">
          <path d="M10 70H112M60 76V6" className="ax" />
          <path className="curve" d="M18 8 Q60 140 102 8" />
          <path className="curve two" d="M38 8 Q80 140 122 8" />
        </svg>
      </div>
      <div className="lb-piece lb-chip c1">
        <M tex="f(x-2)" />
      </div>
      <div className="lb-piece lb-chip c2">
        <M tex="x^3-8" />
      </div>
      <div className="lb-piece lb-chip c3">
        <M tex="y=|x|" />
      </div>
    </>
  );
}

/** Words of the book's own language: English, Arabic, دین و زندگی, the social studies, or Persian literature and writing. */
function languageWords(subject?: SubjectId): { words: string[]; lang: 'en' | 'ar' | 'fa' } {
  if (subject?.startsWith('english')) return { words: ['Aa', 'have done', 'which / who'], lang: 'en' };
  if (subject?.startsWith('arabi')) return { words: ['كَتَبَ', 'اِسْمُ الْفاعِل', 'يَكْتُبُ'], lang: 'ar' };
  if (subject?.startsWith('din')) return { words: ['آیه', 'تفکر', 'اختیار'], lang: 'fa' };
  if (subject?.startsWith('jameh')) return { words: ['کنش اجتماعی', 'فرهنگ', 'دانش علمی'], lang: 'fa' };
  if (subject?.startsWith('tarikh')) return { words: ['منبع', 'سند', 'دوره'], lang: 'fa' };
  if (subject?.startsWith('joghrafi')) return { words: ['نقشه', 'ناحیه', 'اقلیم'], lang: 'fa' };
  return { words: ['شعر', 'نثر', 'آرایه'], lang: 'fa' };
}

function LanguagePieces({ subject }: { subject?: SubjectId }) {
  const { words, lang } = languageWords(subject);
  return (
    <>
      {words.map((w, i) => (
        <div key={w} className={`lb-piece lb-chip c${i + 1}`} dir={lang === 'en' ? 'ltr' : 'rtl'} lang={lang}>
          {w}
        </div>
      ))}
    </>
  );
}

/** Tissues: a bone, a sarcomere and the numbers that describe how tissue carries load. */
function BioPieces() {
  return (
    <>
      <div className="lb-piece lb-atom lb-bone">
        <svg viewBox="0 0 80 80">
          <path d="M28 36 44 52M36 28l16 16" />
          <path d="M27.4 36.6a7 7 0 1 1-8.6-8.6 7 7 0 1 1 8.6-8.6l6.8 6.8-6.8 10.4zM52.6 43.4a7 7 0 1 1 8.6 8.6 7 7 0 1 1-8.6 8.6l-6.8-6.8 6.8-10.4z" className="nuc" />
        </svg>
      </div>
      <div className="lb-piece lb-pendulum lb-sarc">
        <svg viewBox="0 0 60 90">
          <path d="M8 10v70M52 10v70" className="bar" />
          <g className="slide">
            <path d="M8 30h18M8 60h18M34 30h18M34 60h18" className="rod" />
          </g>
          <path d="M22 45h16" className="myo" />
        </svg>
      </div>
      <div className="lb-piece lb-chip c1">
        <M tex="\sigma=E\,\varepsilon" />
      </div>
      <div className="lb-piece lb-chip c2" dir="ltr">
        Wolff
      </div>
      <div className="lb-piece lb-chip c3">
        <M tex="F=k\,\Delta\ell" />
      </div>
    </>
  );
}

/** Mechanics: a forearm lever on its fulcrum, a stress–strain curve and a force arrow. */
function PhysicsPieces() {
  return (
    <>
      <div className="lb-piece lb-plot">
        <svg viewBox="0 0 120 80">
          <path d="M10 72H112M12 76V6" className="ax" />
          <path className="curve" d="M14 70 52 22" />
          <path className="curve two" d="M14 70 46 28c6-8 16-12 26-8l20 10 12 4" />
        </svg>
      </div>
      <div className="lb-piece lb-pendulum lb-lever">
        <svg viewBox="0 0 90 60">
          <path d="M38 54h14l-7-16z" className="bob" />
          <g className="tilt">
            <path d="M6 38h78" className="rod" />
            <rect x="70" y="24" width="12" height="12" rx="3" className="bob" />
            <path d="M18 38V14M12 20l6-6 6 6" className="bar" />
          </g>
        </svg>
      </div>
      <div className="lb-piece lb-chip c1">
        <M tex="\Sigma M=0" />
      </div>
      <div className="lb-piece lb-arrow">
        <svg viewBox="0 0 120 30">
          <path d="M6 15H104" />
          <path d="M96 6l12 9-12 9" />
        </svg>
        <span>
          <M tex="\vec F" />
        </span>
      </div>
    </>
  );
}

function ChemPieces() {
  return (
    <>
      <div className="lb-piece lb-flask">
        <svg viewBox="0 0 70 90">
          <path d="M26 6h18M30 6v26L10 74a8 8 0 0 0 7 12h36a8 8 0 0 0 7-12L40 32V6" className="glass" />
          <path d="M18 62h34l7 12a6 6 0 0 1-5 9H16a6 6 0 0 1-5-9z" className="liquid" />
          <circle cx="28" cy="70" r="3" className="bub b1" />
          <circle cx="40" cy="74" r="2.4" className="bub b2" />
          <circle cx="34" cy="66" r="2" className="bub b3" />
        </svg>
      </div>
      <div className="lb-piece lb-hex">
        <svg viewBox="0 0 80 80">
          <path d="M40 8 68 24v32L40 72 12 56V24z" />
          <path d="M40 18 59 29v22L40 62 21 51V29z" className="inner" />
          <circle cx="40" cy="8" r="4" />
          <circle cx="68" cy="56" r="4" />
          <circle cx="12" cy="56" r="4" />
        </svg>
      </div>
      <div className="lb-piece lb-chip c1">
        <M tex="\ce{H2O}" />
      </div>
      <div className="lb-piece lb-chip c2">
        <M tex="\mathrm{pH}=7" />
      </div>
    </>
  );
}
