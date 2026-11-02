import type { KonkurTip } from '../content/types';
import { Rich } from './Rich';

const KIND: Record<KonkurTip['kind'], { label: string; cls: string }> = {
  trap: { label: 'تله', cls: 'kt-trap' },
  shortcut: { label: 'میان‌بر', cls: 'kt-short' },
  frequent: { label: 'پرتکرار', cls: 'kt-freq' },
};

/** «نکته‌های کنکوری» of a lesson: each one marked as a trap, a shortcut or a point the konkur keeps asking. */
export function KonkurTips({ tips }: { tips: KonkurTip[] }) {
  return (
    <ul className="kt-list">
      {tips.map((t, i) => (
        <li key={i} className={`kt ${KIND[t.kind].cls}`}>
          <span className="kt-kind">{KIND[t.kind].label}</span>
          <span className="kt-text">
            <Rich text={t.text} />
          </span>
        </li>
      ))}
    </ul>
  );
}
