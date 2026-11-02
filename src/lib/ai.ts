import { authHeaders } from './api';
import { isApp, SITE } from './platform';
import { buildSystem, buildTurns, type TutorRequest } from './tutorPrompt';

/*
 * The AI tutor has three ways to reach Claude, tried in this order:
 *  1. «artifact»: the app is open as a claude.ai artifact → the viewer's own Claude (sample capability).
 *  2. «server»:   a tutor endpoint is reachable (./api/tutor, or the URL in <meta name="biomana-ai-endpoint">).
 *  3. «offline»:  no AI; the app relies on its built-in explanations.
 */

export type TutorProvider = 'artifact' | 'server' | 'offline';

export interface TutorResult {
  ok: boolean;
  text: string;
  /** Machine-readable reason when ok is false. */
  code?: string;
}

type SampleFn = ((input: string | { role: 'user' | 'assistant'; content: string }[], opts?: Record<string, unknown>) => Promise<{
  text: string;
  truncated: boolean;
}>) & { json?: unknown };

declare global {
  interface Window {
    claude?: { use: (name: string) => Promise<unknown> };
  }
}

let detecting: Promise<TutorProvider> | null = null;
let sample: SampleFn | null = null;
let endpoint = '';
let provider: TutorProvider = 'offline';
let artifactDenied = false;
const listeners = new Set<(p: TutorProvider) => void>();

function configuredEndpoint(): string {
  const meta = document.querySelector('meta[name="biomana-ai-endpoint"]')?.getAttribute('content')?.trim();
  return meta || (isApp ? `${SITE}/api/tutor` : './api/tutor');
}

async function probeServer(url: string): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(url, { method: 'GET', signal: ctl.signal, headers: { accept: 'application/json' } });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return data?.ok === true;
  } catch {
    return false;
  }
}

async function probeArtifact(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof window.claude?.use !== 'function') return false;
  try {
    const fn = (await window.claude.use('sample')) as SampleFn | null;
    if (typeof fn === 'function') {
      sample = fn;
      return true;
    }
  } catch {
    /* not available */
  }
  return false;
}

function setProvider(p: TutorProvider) {
  provider = p;
  listeners.forEach((l) => l(p));
}

/** Find out which provider works. Cached after the first call. */
export function detectTutor(): Promise<TutorProvider> {
  if (!detecting) {
    detecting = (async () => {
      if (await probeArtifact()) {
        setProvider('artifact');
        return provider;
      }
      endpoint = configuredEndpoint();
      if (await probeServer(endpoint)) {
        setProvider('server');
        return provider;
      }
      setProvider('offline');
      return provider;
    })();
  }
  return detecting;
}

export function tutorProvider(): TutorProvider {
  return provider;
}

export function onTutorProvider(l: (p: TutorProvider) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

const MESSAGES: Record<string, string> = {
  offline: 'بیو الان به هوش مصنوعی وصل نیست. ولی نگران نباش؛ توضیح‌های آمادهٔ همین درس همه در دسترس‌اند.',
  not_granted: 'اجازهٔ استفاده از Claude داده نشد، برای همین بیو در این صفحه خاموش است.',
  rate_limited: 'الان درخواست‌ها زیاد شده. چند دقیقهٔ دیگر دوباره امتحان کن.',
  refused: 'بیو نتوانست به این پیام جواب بدهد. سؤالت را کمی متفاوت بپرس.',
  cancelled: '',
  network: 'ارتباط با بیو برقرار نشد. اینترنت را بررسی کن و دوباره امتحان کن.',
  error: 'یک مشکل موقت پیش آمد. لطفاً دوباره امتحان کن.',
  sign_in: 'برای گفت‌وگو با فهمی، با حساب گوگل وارد شو. ورود رایگان است و پیشرفتت هم در حسابت ذخیره می‌شود. همهٔ توضیح‌های آمادهٔ درس بدون ورود هم در دسترس‌اند.',
  session_ended: 'نشست حسابت روی این دستگاه تمام شده است. از صفحهٔ «من» دوباره وارد شو تا بیو جواب بدهد.',
};

export function tutorMessage(code: string): string {
  return MESSAGES[code] ?? MESSAGES.error;
}

/**
 * Ask the tutor. `onText` receives the whole answer so far while it streams (artifact provider);
 * the server provider delivers the answer in one piece.
 */
export async function askTutor(
  req: TutorRequest,
  opts: { signal?: AbortSignal; onText?: (text: string) => void } = {},
): Promise<TutorResult> {
  const p = await detectTutor();
  if (p === 'offline') return { ok: false, text: '', code: 'offline' };

  if (p === 'artifact' && sample && !artifactDenied) {
    const system = buildSystem(req);
    const turns = buildTurns(req);
    const input = [{ role: 'user' as const, content: `${system}\n\n---\n\n(دستورالعمل بالا را رعایت کن.)` }, ...turns];
    try {
      const res = await sample(input, {
        cache: false,
        signal: opts.signal,
        modelTier: 'default',
        onText: ({ text }: { text: string }) => opts.onText?.(text),
      });
      return { ok: true, text: res.text };
    } catch (e) {
      const code = (e as { code?: string })?.code ?? 'error';
      if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled') {
        artifactDenied = true;
        setProvider('offline');
        return { ok: false, text: '', code: 'not_granted' };
      }
      return { ok: false, text: (e as { text?: string })?.text ?? '', code: code === 'cancelled' ? 'cancelled' : code === 'rate_limited' ? 'rate_limited' : code === 'refused' ? 'refused' : 'error' };
    }
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify(req),
      signal: opts.signal,
      // The tutor answers only a signed-in account: the session cookie on the site, the app's token in the apps.
      credentials: isApp ? 'omit' : 'same-origin',
    });
    const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
    if (res.ok && data.text) {
      opts.onText?.(data.text);
      return { ok: true, text: data.text };
    }
    const code =
      res.status === 401
        ? 'sign_in'
        : res.status === 429
          ? 'rate_limited'
          : data.error === 'refused'
            ? 'refused'
            : data.error === 'not_configured'
              ? 'offline'
              : 'error';
    if (code === 'offline') setProvider('offline');
    return { ok: false, text: '', code };
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return { ok: false, text: '', code: 'cancelled' };
    return { ok: false, text: '', code: 'network' };
  }
}
