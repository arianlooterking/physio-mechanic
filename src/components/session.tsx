import type { ReactNode } from 'react';
import type { ApproachKind } from '../content/types';
import { Icon, type IconName } from './Icon';
import { ReportButton } from './ReportSheet';
import { Rich } from './Rich';
import { Bar } from './ui';

export const KIND_META: Record<ApproachKind, { label: string; icon: IconName; sub: string }> = {
  example: { label: 'با مثال', icon: 'example', sub: 'ساده و با یک مثال آشنا' },
  visual: { label: 'تصویری', icon: 'eye', sub: 'ببین، دست بزن، کشف کن' },
  steps: { label: 'قدم‌به‌قدم', icon: 'steps', sub: 'آرام و مرحله‌به‌مرحله' },
  analogy: { label: 'با تشبیه', icon: 'quote', sub: 'از یک زاویهٔ آشنای دیگر' },
  formal: { label: 'دقیق و امتحانی', icon: 'formula', sub: 'فرمول، دامنه و نکته‌های امتحانی' },
};

export function SessionTop({ onClose, progress, color, right }: { onClose: () => void; progress: number; color?: string; right?: ReactNode }) {
  return (
    <div className="session-top">
      <div className="session-top-in">
        <button className="icon-btn" onClick={onClose} aria-label="خروج">
          <Icon name="close" size={24} />
        </button>
        <Bar value={progress} color={color} label="پیشرفت این جلسه" />
        {right}
      </div>
    </div>
  );
}

/** The verdict after «بررسی». With `questionId`, a small «گزارش اشکال» link lets the learner flag the question. */
export function Feedback({ ok, title, text, extra, questionId }: { ok: boolean; title: string; text?: string; extra?: ReactNode; questionId?: string }) {
  return (
    <div className="feedback" role="status" aria-live="assertive">
      <span className="fb-ic">
        <Icon name={ok ? 'checkf' : 'xf'} size={30} />
      </span>
      <div className="grow">
        <h3>{title}</h3>
        {text && (
          <div className="fb-text">
            <Rich text={text} />
          </div>
        )}
        {extra}
        {questionId && <ReportButton questionId={questionId} />}
      </div>
    </div>
  );
}

const PRAISE = ['آفرین!', 'عالی بود!', 'دقیقاً!', 'درسته!', 'ایول!', 'همینه!'];
const ENCOURAGE = ['اشکالی ندارد!', 'نزدیک بودی!', 'از اشتباه یاد می‌گیریم', 'این یکی را با هم درست کنیم'];

export function praise(seed: number) {
  return PRAISE[Math.abs(seed) % PRAISE.length];
}
export function encourage(seed: number) {
  return ENCOURAGE[Math.abs(seed) % ENCOURAGE.length];
}
