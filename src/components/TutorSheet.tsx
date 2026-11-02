import { useEffect, useRef, useState } from 'react';
import { getAccount, useAccount } from '../lib/account';
import { askTutor, detectTutor, tutorMessage, type TutorProvider } from '../lib/ai';
import { go } from '../lib/nav';
import { awardXp } from '../lib/state';
import { getState, update } from '../lib/store';
import { parseTeachbackScore, type TutorMode, type TutorRequest, type TutorTurn } from '../lib/tutorPrompt';
import { Icon } from './Icon';
import { Mascot } from './Mascot';
import { RichText } from './Rich';
import { Sheet } from './ui';

export interface TutorContext {
  subject: string;
  lesson: string;
  concept: string;
  summary: string[];
  tried: string[];
  confusion?: string;
}

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
  /** Synthetic request turns are sent to the model but not shown. */
  hidden?: boolean;
}

const SUGGEST = ['یک مثال دیگر بزن', 'ساده‌ترش را بگو', 'چرا این‌طوری است؟', 'یک سؤال تمرینی از من بپرس'];

export function TutorSheet({ ctx, mode: initialMode, onClose, onTeachbackScore }: { ctx: TutorContext; mode: TutorMode; onClose: () => void; onTeachbackScore?: (n: number) => void }) {
  const [provider, setProvider] = useState<TutorProvider | null>(null);
  const [mode, setMode] = useState<TutorMode>(initialMode);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const ctl = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const { account } = useAccount();
  // The tutor server answers only signed-in accounts (each answer costs money); guests are asked to sign in.
  const needsSignIn = provider === 'server' && !account;

  useEffect(() => {
    void detectTutor().then(setProvider);
    return () => ctl.current?.abort();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, busy]);

  const base = (m: TutorMode, turns?: TutorTurn[]): TutorRequest => ({
    mode: m,
    subject: ctx.subject,
    lesson: ctx.lesson,
    concept: ctx.concept,
    summary: ctx.summary,
    tried: ctx.tried,
    confusion: ctx.confusion,
    turns,
    name: getState().profile.name || undefined,
  });

  async function run(req: TutorRequest, history: Msg[]) {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setBusy(true);
    const idx = history.length;
    setMsgs([...history, { role: 'assistant', content: '' }]);
    const res = await askTutor(req, {
      signal: c.signal,
      onText: (text) =>
        setMsgs((prev) => {
          const next = prev.slice();
          next[idx] = { role: 'assistant', content: text };
          return next;
        }),
    });
    if (c.signal.aborted) return;
    setBusy(false);
    if (res.ok) {
      setMsgs((prev) => {
        const next = prev.slice();
        next[idx] = { role: 'assistant', content: res.text };
        return next;
      });
      update((s) => {
        s.counters.aiAsks += 1;
      });
      if (req.mode === 'teachback') {
        const score = parseTeachbackScore(res.text);
        if (score !== null) {
          onTeachbackScore?.(score);
          if (score >= 2) update((s) => awardXp(s, score === 3 ? 10 : 5));
        }
      }
    } else if (res.code === 'cancelled') {
      setMsgs(history);
    } else {
      if (res.code === 'offline' || res.code === 'not_granted') setProvider('offline');
      setMsgs((prev) => {
        const next = prev.slice();
        const code = res.code === 'sign_in' && getAccount() ? 'session_ended' : (res.code ?? 'error');
        next[idx] = { role: 'assistant', content: res.text || tutorMessage(code), error: !res.text };
        return next;
      });
    }
  }

  // explain mode asks right away
  useEffect(() => {
    if (provider && provider !== 'offline' && !needsSignIn && initialMode === 'explain' && !started.current) {
      started.current = true;
      const hiddenAsk: Msg = { role: 'user', content: `لطفاً «${ctx.concept}» را یک جور دیگر برایم توضیح بده.`, hidden: true };
      void run(base('explain'), [hiddenAsk]);
    }
    // run once the provider is known
  }, [provider, needsSignIn]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput('');
    const history: Msg[] = [...msgs.filter((m) => !m.error), { role: 'user', content: t }];
    const turns: TutorTurn[] = history.map((m) => ({ role: m.role, content: m.content }));
    const m: TutorMode = mode === 'teachback' && msgs.filter((x) => x.role === 'user' && !x.hidden).length === 0 ? 'teachback' : 'chat';
    if (mode === 'teachback' && m === 'chat') setMode('chat');
    void run(base(m, turns), history);
  };

  const visible = msgs.filter((m) => !m.hidden);
  const offline = provider === 'offline';
  const canChat = Boolean(provider) && !offline && !needsSignIn;
  const title = mode === 'teachback' ? 'به بیو درس بده' : 'از بیو بپرس';

  return (
    <Sheet title={title} onClose={onClose} wide>
      <div className="chat" aria-live="polite">
        <div className="mascot-row">
          <Mascot mood={offline ? 'oops' : busy ? 'think' : needsSignIn ? 'wave' : 'happy'} size={64} />
          <div className="speech small">
            {provider === null
              ? 'یک لحظه صبر کن، دارم وصل می‌شوم…'
              : offline
                ? tutorMessage('offline')
                : needsSignIn
                  ? tutorMessage('sign_in')
                  : mode === 'teachback'
                  ? `«${ctx.concept}» را با زبان خودت توضیح بده؛ انگار داری به یک دوست یاد می‌دهی. من می‌خوانم و می‌گویم کجایش درست است و کجا را باید دقیق‌تر کنی.`
                  : initialMode === 'explain'
                    ? 'این بار از یک زاویهٔ تازه توضیح می‌دهم.'
                    : `هر سؤالی دربارهٔ «${ctx.concept}» داری بپرس.`}
          </div>
        </div>
        {visible.map((m, i) => (
          <div key={i} className={`bubble ${m.role === 'user' ? 'me' : 'ai'}${m.error ? ' err' : ''}`}>
            <span className="who">{m.role === 'user' ? 'تو' : 'بیو'}</span>
            {m.content ? (
              <RichText text={m.content} />
            ) : (
              <span className="typing" aria-label="در حال نوشتن">
                <i />
                <i />
                <i />
              </span>
            )}
          </div>
        ))}
        {needsSignIn && (
          <div className="row" style={{ justifyContent: 'center', marginTop: 4 }}>
            <button
              className="btn"
              onClick={() => {
                onClose();
                go({ name: 'login' });
              }}
            >
              <Icon name="user" size={18} /> ورود با گوگل
            </button>
          </div>
        )}
        {canChat && !busy && mode !== 'teachback' && (
          <div className="suggest">
            {SUGGEST.map((s) => (
              <button key={s} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
      {canChat && (
        <div className="chat-input" style={{ margin: '0 -18px -18px' }}>
          <textarea
            value={input}
            rows={mode === 'teachback' && visible.length === 0 ? 4 : 1}
            placeholder={mode === 'teachback' && visible.length === 0 ? 'توضیح خودت را بنویس…' : 'سؤالت را بنویس…'}
            onChange={(e) => setInput(e.target.value.slice(0, 1400))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            aria-label="پیام برای بیو"
          />
          {busy ? (
            <button className="btn sm ghost" onClick={() => ctl.current?.abort()} aria-label="توقف">
              توقف
            </button>
          ) : (
            <button className="btn sm" onClick={() => send(input)} disabled={!input.trim()} aria-label="ارسال">
              <Icon name="send" size={18} />
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
