import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { subjectById } from '../content';
import type { Subject, SubjectId } from '../content/types';
import { useBack } from '../lib/back';
import { onToast } from '../lib/nav';
import { Icon, type IconName } from './Icon';

export function Bar({ value, color, thin, label }: { value: number; color?: string; thin?: boolean; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className={`bar${thin ? ' thin' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-label={label}
      style={color ? ({ ['--bc' as string]: color } as CSSProperties) : undefined}
    >
      <span style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Ring({ value, size = 44, stroke = 5, color = 'var(--primary)', track = 'var(--surface-3)', children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-grid', placeItems: 'center', flex: 'none' }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span style={{ position: 'relative', fontSize: size * 0.28, fontWeight: 900 }}>{children}</span>
    </span>
  );
}

const SUBJECT_ICON: Record<Subject['icon'], IconName> = { calc: 'calc', atom: 'atomic', flask: 'flask', geo: 'geo', dice: 'dice', nodes: 'nodes', abc: 'abc', ayn: 'ayn', leaf: 'leaf' };

export function SubjectIcon({ id, size = 20 }: { id: SubjectId; size?: number }) {
  return <Icon name={SUBJECT_ICON[subjectById(id).icon]} size={size} />;
}

export function Sheet({ title, onClose, children, footer, wide }: { title?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // the phone's back button closes the sheet, like Escape
  useBack(true, onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={ref}
        style={wide ? { maxWidth: 680 } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="بستن">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ title, text, yes, no, onYes, onNo, danger }: { title: string; text: ReactNode; yes: string; no: string; onYes: () => void; onNo: () => void; danger?: boolean }) {
  return (
    <Sheet
      title={title}
      onClose={onNo}
      footer={
        <>
          <button className="btn ghost" onClick={onNo}>
            {no}
          </button>
          <button className={`btn ${danger ? 'bad' : ''}`} onClick={onYes}>
            {yes}
          </button>
        </>
      }
    >
      <div style={{ color: 'var(--ink-2)' }}>{text}</div>
    </Sheet>
  );
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => onToast(setMsg), []);
  if (!msg) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {msg}
    </div>
  );
}

/** Lightweight confetti burst on a canvas. */
export function Confetti({ run = true }: { run?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#5b3df5', '#ffb51e', '#17a85a', '#ec3e63', '#0b93d8', '#ff7a1a'];
    const parts = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3,
      y: H * 0.35,
      vx: (Math.random() - 0.5) * 13,
      vy: -Math.random() * 13 - 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - t / 2600);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t < 2600) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run]);
  return <canvas ref={ref} className="confetti" style={{ width: '100%', height: '100%' }} aria-hidden="true" />;
}
