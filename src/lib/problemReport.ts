/** «گزارش اشکال»: a learner reports a problem with a question (sent to POST /api/report). */
import { toEn } from './digits';
import { api } from './api';

export type ReportReason = 'wrong-answer' | 'unclear' | 'display' | 'other';

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'wrong-answer', label: 'پاسخ اشتباه است' },
  { id: 'unclear', label: 'توضیح گنگ است' },
  { id: 'display', label: 'مشکل نمایش' },
  { id: 'other', label: 'دیگر' },
];

export const REPORT_NOTE_MAX = 500;

export type PersonalData = 'email' | 'phone' | 'id';

/**
 * Whether a report's note seems to hold personal details, which it must not (reports are read by the writers):
 * an email address, an Iranian mobile number (09…, +98 or 0098, in Persian or Latin digits, with or without
 * spaces or dashes) or a 10-digit number like a national ID. Null when the note looks fine.
 */
export function personalDataIn(note: string): PersonalData | null {
  // A number counts only whole: not touching other digits, nor the decimals of a number like ۳٫۱۴۱۵۹۲۶۵۳۵.
  // (No lookbehind, which older iPhones' Safari can't read: `(?:^|[^\d.٫])` stands in for it.)
  const t = toEn(note);
  if (/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(t)) return 'email';
  if (/(?:^|[^\d.٫])09(?:[ -]?\d){9}(?![.٫]?\d)/.test(t) || /(?:\+ ?|(?:^|[^\d.٫])00)98(?:[ -]?\d){9,10}(?![.٫]?\d)/.test(t)) return 'phone';
  if (/(?:^|[^\d.٫])(?:\d{10}|\d{3}-\d{6}-\d)(?![.٫]?\d)/.test(t)) return 'id';
  return null;
}

export type ReportOutcome = 'ok' | 'rate-limited' | 'offline' | 'error';

export async function sendReport(r: { lessonId?: string; questionId: string; reason: ReportReason; note?: string }): Promise<ReportOutcome> {
  try {
    const res = await api('/api/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lessonId: r.lessonId, questionId: r.questionId, reason: r.reason, note: (r.note ?? '').trim().slice(0, REPORT_NOTE_MAX) }),
    });
    await res.text().catch(() => '');
    if (res.ok) return 'ok';
    return res.status === 429 ? 'rate-limited' : 'error';
  } catch {
    return 'offline';
  }
}

/* ───────────── admin list (/admin/reports) ───────────── */

export type ReportRecord = {
  id: string;
  lessonId: string | null;
  questionId: string;
  reason: ReportReason;
  note: string;
  email: string | null;
  ua: string;
  time: number;
};

export type ReportPage = { ok: true; reports: ReportRecord[]; cursor: string | null } | { ok: false; status: number };

export async function listReports(cursor?: string | null): Promise<ReportPage> {
  try {
    const res = await fetch(`/api/reports${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return { ok: false, status: res.status };
    const data = (await res.json()) as { reports: ReportRecord[]; cursor: string | null };
    return { ok: true, reports: data.reports ?? [], cursor: data.cursor ?? null };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function resolveReport(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/reports?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
    return res.ok;
  } catch {
    return false;
  }
}
