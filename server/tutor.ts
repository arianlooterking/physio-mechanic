/*
 * Tutor endpoint logic, used by the Cloudflare Worker (worker/index.ts, which also serves it in
 * `npm run dev` through the Cloudflare Vite plugin) and by the older Vercel function (api/tutor.ts).
 * Needs ANTHROPIC_API_KEY in the environment; without it GET reports {ok:false} and the app stays offline.
 *
 * Every POST costs real money, so it is only answered for a signed-in account (the caller passes
 * the account id it verified from the session cookie) and is rate-limited per IP and per account.
 */
import Anthropic from '@anthropic-ai/sdk';
import { buildSystem, buildTurns, sanitizeRequest } from '../src/lib/tutorPrompt';
import { windowLimiter } from './limit';

const MODEL = 'claude-opus-5-5';
const TEN_MINUTES = 10 * 60 * 1000;

/** Per IP: 30 questions in 10 minutes (a classroom can share one address). */
const perIp = windowLimiter(30, TEN_MINUTES);
/** Per account: 20 questions in 10 minutes and 150 a day. */
const perAccount = windowLimiter(20, TEN_MINUTES);
const perAccountDaily = windowLimiter(150, 24 * 60 * 60 * 1000);

export interface HttpIn {
  method: string;
  origin: string | null;
  host: string | null;
  ip: string;
  body: string;
  /**
   * The signed-in account making the request (verified by the caller from its session), or null
   * for a guest. POST is refused without one.
   */
  account: string | null;
  /** The account is an owner (ADMIN_EMAILS, verified by the caller): no per-IP, per-account or daily caps. */
  owner?: boolean;
}

export interface HttpOut {
  status: number;
  headers: Record<string, string>;
  json: unknown;
}

/** Forget all rate-limit counts (tests). */
export function resetTutorLimits(): void {
  perIp.reset();
  perAccount.reset();
  perAccountDaily.reset();
}

// the Android app (https) and the iOS app (capacitor) load their files from app.biomana.com
const APP_ORIGINS = ['https://app.biomana.com', 'capacitor://app.biomana.com'];

function allowedOrigin(origin: string | null, host: string | null): string | null | false {
  if (!origin) return null; // same-origin navigation or server-to-server
  try {
    const o = new URL(origin);
    if (host && o.host === host) return origin;
  } catch {
    return false;
  }
  if (APP_ORIGINS.includes(origin)) return origin;
  const list = (process.env.TUTOR_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(origin) ? origin : false;
}

function hasKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function handleTutorHttp(input: HttpIn): Promise<HttpOut> {
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
  };
  const origin = allowedOrigin(input.origin, input.host);
  if (origin === false) return { status: 403, headers, json: { error: 'origin_not_allowed' } };
  if (origin) {
    headers['access-control-allow-origin'] = origin;
    headers['vary'] = 'Origin';
    headers['access-control-allow-methods'] = 'GET, POST, OPTIONS';
    headers['access-control-allow-headers'] = 'content-type';
  }

  if (input.method === 'OPTIONS') return { status: 204, headers, json: null };
  if (input.method === 'GET') return { status: 200, headers, json: { ok: hasKey(), model: hasKey() ? MODEL : null } };
  if (input.method !== 'POST') return { status: 405, headers, json: { error: 'method_not_allowed' } };
  if (!hasKey()) return { status: 503, headers, json: { error: 'not_configured' } };
  if (!input.account) return { status: 401, headers, json: { error: 'sign_in_required' } };
  const ipOver = !input.owner && perIp.hit(input.ip);
  const accountOver = !input.owner && perAccount.hit(input.account);
  const dailyOver = !input.owner && perAccountDaily.hit(input.account);
  if (ipOver || accountOver || dailyOver) {
    const wait = dailyOver ? perAccountDaily.retryAfter(input.account) : accountOver ? perAccount.retryAfter(input.account) : perIp.retryAfter(input.ip);
    return { status: 429, headers: { ...headers, 'retry-after': String(wait) }, json: { error: 'rate_limited' } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    return { status: 400, headers, json: { error: 'bad_json' } };
  }
  const req = sanitizeRequest(parsed);
  if (!req) return { status: 400, headers, json: { error: 'bad_request' } };

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [
        {
          type: 'text',
          text: `${buildSystem(req)}\n\nLatency-sensitive; begin your visible answer immediately.`,
        },
      ],
      messages: buildTurns(req).map((t) => ({ role: t.role, content: t.content })),
    });

    if (response.stop_reason === 'refusal') {
      return { status: 200, headers, json: { error: 'refused' } };
    }
    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();
    if (!text) return { status: 502, headers, json: { error: 'empty' } };
    return { status: 200, headers, json: { text, truncated: response.stop_reason === 'max_tokens' } };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return { status: 429, headers, json: { error: 'rate_limited' } };
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      return { status: 503, headers, json: { error: 'not_configured' } };
    }
    if (err instanceof Anthropic.BadRequestError) return { status: 400, headers, json: { error: 'upstream_bad_request' } };
    if (err instanceof Anthropic.APIConnectionError) return { status: 502, headers, json: { error: 'upstream_unreachable' } };
    if (err instanceof Anthropic.APIError) return { status: 502, headers, json: { error: 'upstream_error', status: err.status } };
    return { status: 500, headers, json: { error: 'server_error' } };
  }
}
