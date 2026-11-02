/*
 * Content reports («گزارش اشکال»): a learner flags a question whose answer looks wrong, whose
 * explanation is unclear or that does not display right. One KV write per report, kept 90 days.
 *   POST   /api/report          anyone on this site or in the phone apps (guests too), rate-limited per IP and per account
 *   GET    /api/reports         list, for accounts whose email is in ADMIN_EMAILS
 *   DELETE /api/reports?id=…    mark one handled (delete it), admins only
 */
import { windowLimiter } from '../server/limit';
import { appOrigin, fromThisSite, isAdmin, json, readSession, type Env } from './lib';

export const REPORT_REASONS = ['wrong-answer', 'unclear', 'display', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

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

const PREFIX = 'report:';
const TTL_SECONDS = 90 * 86400;
const MAX_BODY = 4000;
export const MAX_NOTE = 500;
const HOUR = 3600_000;
const ID_RE = /^[A-Za-z0-9._:-]{1,80}$/;
const KEY_ID_RE = /^\d{16}-[0-9a-f]{8}$/;

/** 10 reports an hour per IP and per account; 300 a day per Worker instance guards the KV write budget. */
const perIp = windowLimiter(10, HOUR);
const perAccount = windowLimiter(10, HOUR);
const overall = windowLimiter(300, 24 * HOUR);

export function resetReportLimits(): void {
  perIp.reset();
  perAccount.reset();
  overall.reset();
}

/** Check and tidy a report sent by the app; null when it is not a valid report. */
export function parseReport(raw: unknown): Pick<ReportRecord, 'lessonId' | 'questionId' | 'reason' | 'note'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const questionId = typeof r.questionId === 'string' ? r.questionId.trim() : '';
  if (!ID_RE.test(questionId)) return null;
  let lessonId: string | null = null;
  if (r.lessonId !== undefined && r.lessonId !== null && r.lessonId !== '') {
    if (typeof r.lessonId !== 'string' || !ID_RE.test(r.lessonId.trim())) return null;
    lessonId = r.lessonId.trim();
  }
  if (typeof r.reason !== 'string' || !(REPORT_REASONS as readonly string[]).includes(r.reason)) return null;
  let note = '';
  if (r.note !== undefined && r.note !== null) {
    if (typeof r.note !== 'string') return null;
    // Drop control characters except new lines and tabs.
    note = r.note.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
    if (note.length > MAX_NOTE) return null;
  }
  return { lessonId, questionId, reason: r.reason as ReportReason, note };
}

async function postReport(request: Request, env: Env): Promise<Response> {
  // the phone apps send reports too (their CORS headers come from worker/index.ts)
  if (!appOrigin(request) && !fromThisSite(request)) return json({ error: 'forbidden' }, { status: 403 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return json({ error: 'too-large' }, { status: 413 });
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'too-large' }, { status: 413 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json({ error: 'bad-request' }, { status: 400 });
  }
  const report = parseReport(parsed);
  if (!report) return json({ error: 'bad-request' }, { status: 400 });

  const s = await readSession(request, env);
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  // Owners (ADMIN_EMAILS) report as much as they like.
  const limited = isAdmin(s, env) ? 0 : perIp.hit(ip) ? perIp.retryAfter(ip) : s && perAccount.hit(s.sub) ? perAccount.retryAfter(s.sub) : overall.hit('all') ? overall.retryAfter('all') : 0;
  if (limited) return json({ error: 'rate-limited' }, { status: 429, headers: { 'retry-after': String(limited) } });

  const time = Date.now();
  // Newest first in KV's lexicographic listing.
  const id = `${String(9e15 - time).padStart(16, '0')}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
  const record: ReportRecord = {
    id,
    ...report,
    email: s?.email || null,
    ua: (request.headers.get('user-agent') ?? '').slice(0, 200),
    time,
  };
  try {
    await env.BIOMANA_KV.put(PREFIX + id, JSON.stringify(record), {
      expirationTtl: TTL_SECONDS,
      metadata: { questionId: record.questionId, reason: record.reason, time },
    });
  } catch (err) {
    console.error('report put failed', err);
    return json({ error: 'storage-busy' }, { status: 503, headers: { 'retry-after': '600' } });
  }
  return json({ ok: true, id });
}

async function adminReports(request: Request, env: Env): Promise<Response> {
  const s = await readSession(request, env);
  if (!s) return json({ error: 'signed-out' }, { status: 401 });
  if (!isAdmin(s, env)) return json({ error: 'forbidden' }, { status: 403 });
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const cursor = url.searchParams.get('cursor') || undefined;
    const page = await env.BIOMANA_KV.list({ prefix: PREFIX, limit: 50, cursor });
    const records = await Promise.all(page.keys.map((k) => env.BIOMANA_KV.get<ReportRecord>(k.name, 'json')));
    return json({
      reports: records.filter((r): r is ReportRecord => Boolean(r)),
      cursor: page.list_complete ? null : (page.cursor ?? null),
    });
  }
  if (request.method === 'DELETE') {
    if (!fromThisSite(request)) return json({ error: 'forbidden' }, { status: 403 });
    const id = url.searchParams.get('id') ?? '';
    if (!KEY_ID_RE.test(id)) return json({ error: 'bad-request' }, { status: 400 });
    await env.BIOMANA_KV.delete(PREFIX + id);
    return json({ ok: true });
  }
  return json({ error: 'method' }, { status: 405 });
}

export async function reports(request: Request, env: Env, pathname: string): Promise<Response> {
  if (pathname === '/api/report') {
    if (request.method !== 'POST') return json({ error: 'method' }, { status: 405 });
    return postReport(request, env);
  }
  return adminReports(request, env);
}
