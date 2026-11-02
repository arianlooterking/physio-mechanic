import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { subjectById } from '../content';
import type { Subject, SubjectId } from '../content/types';
import { renderTex } from './Rich';

/*
 * The decorations that give the home path its life: the dotted trail between nodes, the small
 * formulas and shapes that float beside it, and the illustration in each unit's header.
 * Everything here is decorative (aria-hidden) and themed by the unit's subject colour (--uc).
 */

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const SHAPES: Record<string, ReactNode> = {
  parabola: (
    <svg viewBox="0 0 48 48" {...S}>
      <path d="M6 40V8M6 40h36" strokeWidth={2} opacity={0.6} />
      <path d="M12 10q12 40 24 0" />
    </svg>
  ),
  cubic: (
    <svg viewBox="0 0 48 48" {...S}>
      <path d="M24 4v40M4 24h40" strokeWidth={2} opacity={0.6} />
      <path d="M8 42c8-2 10-18 16-18s8-16 16-18" />
    </svg>
  ),
  wave: (
    <svg viewBox="0 0 48 48" {...S}>
      <path d="M4 24c5-12 9-12 14 0s9 12 14 0 9-12 12-4" />
    </svg>
  ),
  vector: (
    <svg viewBox="0 0 48 48" {...S}>
      <path d="M8 38 38 10M24 10h14v14" />
      <circle cx="8" cy="38" r="3" fill="currentColor" />
    </svg>
  ),
  orbit: (
    <svg viewBox="0 0 48 48" {...S} strokeWidth={2.4}>
      <ellipse cx="24" cy="24" rx="20" ry="8" />
      <ellipse cx="24" cy="24" rx="20" ry="8" transform="rotate(60 24 24)" />
      <ellipse cx="24" cy="24" rx="20" ry="8" transform="rotate(-60 24 24)" />
      <circle cx="24" cy="24" r="3.5" fill="currentColor" />
    </svg>
  ),
  xt: (
    <svg viewBox="0 0 48 48" {...S}>
      <path d="M6 42V6M6 42h36" strokeWidth={2} opacity={0.6} />
      <path d="M10 36 22 22h8l10-12" />
    </svg>
  ),
  beaker: (
    <svg viewBox="0 0 48 48" {...S}>
      <path d="M18 6v14L8 40a3 3 0 0 0 3 4h26a3 3 0 0 0 3-4L30 20V6M15 6h18" />
      <path d="M13 32h22" strokeWidth={2} opacity={0.6} />
      <circle cx="21" cy="37" r="2" fill="currentColor" />
      <circle cx="28" cy="35" r="1.5" fill="currentColor" />
    </svg>
  ),
  hexagon: (
    <svg viewBox="0 0 48 48" {...S}>
      <path d="m24 6 15 9v18l-15 9-15-9V15z" />
      <path d="m24 12 10 6M14 30l10 6" strokeWidth={2} opacity={0.6} />
    </svg>
  ),
  bubbles: (
    <svg viewBox="0 0 48 48" {...S} strokeWidth={2.6}>
      <circle cx="17" cy="30" r="9" />
      <circle cx="33" cy="16" r="6" />
      <circle cx="36" cy="35" r="3.5" />
    </svg>
  ),
  sparkle: (
    <svg viewBox="0 0 48 48" fill="currentColor">
      <path d="M24 4c2 11 6 15 18 18-12 3-16 7-18 18-2-11-6-15-18-18 12-3 16-7 18-18Z" />
    </svg>
  ),
  ring: (
    <svg viewBox="0 0 48 48" {...S} strokeWidth={5}>
      <circle cx="24" cy="24" r="14" />
    </svg>
  ),
  triangle: (
    <svg viewBox="0 0 48 48" {...S} strokeWidth={4}>
      <path d="m24 8 17 30H7z" />
    </svg>
  ),
  chord: (
    <svg viewBox="0 0 48 48" {...S}>
      <circle cx="24" cy="24" r="17" />
      <path d="M11 34 37 14M11 34l26 6" strokeWidth={2.4} />
      <circle cx="11" cy="34" r="2.5" fill="currentColor" />
    </svg>
  ),
  angle: (
    <svg viewBox="0 0 48 48" {...S}>
      <path d="M8 40h32M8 40 34 12" />
      <path d="M20 40a12 12 0 0 0-4-9" strokeWidth={2.4} />
    </svg>
  ),
  compass: (
    <svg viewBox="0 0 48 48" {...S}>
      <path d="m24 6-12 36M24 6l12 36M17 26h14" />
      <circle cx="24" cy="6" r="2.5" fill="currentColor" />
    </svg>
  ),
  dice: (
    <svg viewBox="0 0 48 48" {...S}>
      <rect x="9" y="9" width="30" height="30" rx="7" />
      <circle cx="18" cy="18" r="2.6" fill="currentColor" />
      <circle cx="24" cy="24" r="2.6" fill="currentColor" />
      <circle cx="30" cy="30" r="2.6" fill="currentColor" />
    </svg>
  ),
  bars: (
    <svg viewBox="0 0 48 48" {...S}>
      <path d="M8 40h32" strokeWidth={2.4} />
      <path d="M13 40V28M21 40V16M29 40V22M37 40V32" strokeWidth={5} />
    </svg>
  ),
  venn: (
    <svg viewBox="0 0 48 48" {...S} strokeWidth={2.6}>
      <circle cx="19" cy="24" r="12" />
      <circle cx="29" cy="24" r="12" />
    </svg>
  ),
  nodes: (
    <svg viewBox="0 0 48 48" {...S} strokeWidth={2.4}>
      <path d="M12 14 34 12 36 34 14 36zM12 14l24 20" />
      <circle cx="12" cy="14" r="4" fill="currentColor" />
      <circle cx="34" cy="12" r="4" fill="currentColor" />
      <circle cx="36" cy="34" r="4" fill="currentColor" />
      <circle cx="14" cy="36" r="4" fill="currentColor" />
    </svg>
  ),
  matrix: (
    <svg viewBox="0 0 48 48" {...S} strokeWidth={2.6}>
      <path d="M14 8H9v32h5M34 8h5v32h-5" />
      <circle cx="19" cy="17" r="2" fill="currentColor" />
      <circle cx="29" cy="17" r="2" fill="currentColor" />
      <circle cx="19" cy="31" r="2" fill="currentColor" />
      <circle cx="29" cy="31" r="2" fill="currentColor" />
    </svg>
  ),
  charge: (
    <svg viewBox="0 0 48 48" {...S} strokeWidth={2.6}>
      <circle cx="15" cy="24" r="8" />
      <circle cx="35" cy="24" r="8" />
      <path d="M11 24h8M15 20v8M31 24h8" />
    </svg>
  ),
};

type Deco = { tex: string } | { txt: string } | { shape: keyof typeof SHAPES };

type Art = Subject['icon'];

const SETS: Record<Art, Deco[]> = {
  calc: [
    { tex: 'f(x)' },
    { shape: 'parabola' },
    { tex: 'x^3' },
    { shape: 'sparkle' },
    { tex: 'y=x^2' },
    { shape: 'cubic' },
    { shape: 'ring' },
    { tex: 'f^{-1}' },
    { shape: 'wave' },
    { shape: 'triangle' },
  ],
  atom: [
    { tex: '\\Delta x' },
    { shape: 'vector' },
    { tex: '\\vec v' },
    { shape: 'sparkle' },
    { shape: 'orbit' },
    { tex: '\\Delta t' },
    { shape: 'xt' },
    { shape: 'ring' },
    { tex: 'a' },
    { shape: 'triangle' },
  ],
  flask: [
    { tex: '\\ce{H2O}' },
    { shape: 'beaker' },
    { tex: '\\mathrm{pH}' },
    { shape: 'sparkle' },
    { shape: 'hexagon' },
    { tex: '\\ce{OH-}' },
    { shape: 'bubbles' },
    { shape: 'ring' },
    { tex: '\\ce{H+}' },
    { shape: 'triangle' },
  ],
  geo: [
    { shape: 'chord' },
    { tex: '\\widehat{AB}' },
    { shape: 'compass' },
    { shape: 'sparkle' },
    { tex: '\\angle A' },
    { shape: 'angle' },
    { shape: 'ring' },
    { tex: 'R' },
    { shape: 'triangle' },
    { shape: 'matrix' },
  ],
  dice: [
    { shape: 'dice' },
    { tex: 'p\\Rightarrow q' },
    { shape: 'venn' },
    { shape: 'sparkle' },
    { tex: 'P(A)' },
    { shape: 'bars' },
    { shape: 'ring' },
    { tex: '\\sim p' },
    { shape: 'triangle' },
    { tex: 'S_n' },
  ],
  nodes: [
    { shape: 'nodes' },
    { tex: 'a\\mid b' },
    { shape: 'matrix' },
    { shape: 'sparkle' },
    { tex: '\\equiv' },
    { shape: 'venn' },
    { shape: 'ring' },
    { tex: '\\exists' },
    { shape: 'triangle' },
    { tex: '\\forall' },
  ],
  abc: [
    { txt: 'Aa' },
    { shape: 'sparkle' },
    { txt: 'ing' },
    { shape: 'ring' },
    { txt: 'who' },
    { shape: 'triangle' },
    { txt: '-ed' },
    { shape: 'sparkle' },
    { txt: 'if' },
    { shape: 'ring' },
  ],
  leaf: [
    { txt: 'DNA' },
    { shape: 'sparkle' },
    { txt: 'A–T' },
    { shape: 'ring' },
    { txt: 'G–C' },
    { shape: 'triangle' },
    { txt: 'ATP' },
    { shape: 'sparkle' },
    { txt: 'RNA' },
    { shape: 'ring' },
  ],
  ayn: [
    { txt: 'ع' },
    { shape: 'sparkle' },
    { txt: 'فَعَلَ' },
    { shape: 'ring' },
    { txt: 'ـَ ـُ ـِ' },
    { shape: 'triangle' },
    { txt: 'لا' },
    { shape: 'sparkle' },
    { txt: 'إِنَّ' },
    { shape: 'ring' },
  ],
};

/** One floating decoration beside path node `i`, on the side away from the node (`side` px from the node's centre). */
export function PathDeco({ subject, i, side }: { subject: SubjectId; i: number; side: number }) {
  const art = subjectById(subject).icon;
  const set = SETS[art];
  const d = set[i % set.length];
  const style = {
    ['--ddx' as string]: `${side}px`,
    ['--dl' as string]: `${(i % 5) * -1.3}s`,
  };
  if ('tex' in d) return <span className="deco deco-tex" aria-hidden="true" style={style} dangerouslySetInnerHTML={{ __html: renderTex(d.tex, false) }} />;
  if ('txt' in d)
    return (
      <span className="deco deco-tex" aria-hidden="true" style={style}>
        {d.txt}
      </span>
    );
  return (
    <span className={`deco deco-shape${d.shape === 'sparkle' ? ' twinkle' : ''}`} aria-hidden="true" style={style}>
      {SHAPES[d.shape]}
    </span>
  );
}

/** The trail behind the nodes: dotted ahead, gold through what is done. Measured from the laid-out nodes. */
type Pt = { x: number; y: number; out: number };

/** Rendered as the first child of `.path`; it measures its parent (a parent's ref is not attached yet when a child's layout effect runs). */
export function PathTrail({ upto, version }: { upto: number; version: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const [geo, setGeo] = useState<{ w: number; h: number; pts: Pt[] } | null>(null);

  useLayoutEffect(() => {
    const el = svg.current?.parentElement;
    if (!el) return;
    const measure = () => {
      const pts = [...el.querySelectorAll<HTMLElement>(':scope > .node-wrap')].map((w): Pt => {
        const n = w.querySelector<HTMLElement>('.node-base');
        const label = w.querySelector<HTMLElement>('.node-label');
        const dx = parseFloat(w.style.getPropertyValue('--dx')) || 0;
        const y = w.offsetTop + (n ? n.offsetTop + n.offsetHeight / 2 : 0);
        return { x: w.offsetLeft + w.offsetWidth / 2 + dx, y, out: label ? w.offsetTop + label.offsetTop + label.offsetHeight + 6 : y };
      });
      setGeo((g) => {
        const same = g && g.w === el.offsetWidth && g.h === el.offsetHeight && g.pts.length === pts.length && g.pts.every((p, k) => p.x === pts[k].x && p.y === pts[k].y && p.out === pts[k].out);
        return same ? g : { w: el.offsetWidth, h: el.offsetHeight, pts };
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [version]);

  if (!geo || geo.pts.length < 2) return <svg ref={svg} className="trail" width={0} height={0} aria-hidden="true" />;
  // Each step leaves from under the node's label (so it never crosses text) and lands on the next node.
  const path = (to: number) => {
    const p = geo.pts;
    let d = '';
    for (let k = 1; k <= Math.min(to, p.length - 1); k++) {
      const a = p[k - 1];
      const b = p[k];
      const m = (b.y - a.out) / 2;
      d += `M${a.x} ${a.out}C${a.x} ${a.out + m} ${b.x} ${b.y - m} ${b.x} ${b.y}`;
    }
    return d;
  };
  return (
    <svg ref={svg} className="trail" width={geo.w} height={geo.h} aria-hidden="true">
      <path className="trail-base" d={path(geo.pts.length - 1)} />
      {upto > 0 && <path className="trail-done" d={path(upto)} />}
    </svg>
  );
}

/** The large illustration on the end side of a unit header. */
export function UnitArt({ subject }: { subject: SubjectId }) {
  const art = subjectById(subject).icon;
  return (
    <div className="unit-art" aria-hidden="true">
      <svg viewBox="0 0 140 140" {...S} strokeWidth={4}>
        {art === 'calc' && (
          <>
            <path d="M20 120V16M20 120h108" strokeWidth={3} opacity={0.55} />
            <path d="M32 24q30 120 60 0" />
            <path d="M24 112c22-4 26-44 46-44s26-40 52-46" opacity={0.7} strokeDasharray="2 9" />
            <circle cx="62" cy="96" r="5" fill="currentColor" />
          </>
        )}
        {art === 'atom' && (
          <>
            <ellipse cx="70" cy="70" rx="58" ry="22" />
            <ellipse cx="70" cy="70" rx="58" ry="22" transform="rotate(60 70 70)" />
            <ellipse cx="70" cy="70" rx="58" ry="22" transform="rotate(-60 70 70)" />
            <circle cx="70" cy="70" r="10" fill="currentColor" />
            <circle r="6" fill="currentColor" stroke="none">
              <animateMotion dur="5s" repeatCount="indefinite" path="M12 70a58 22 0 1 0 116 0a58 22 0 1 0 -116 0" />
            </circle>
          </>
        )}
        {art === 'flask' && (
          <>
            <path d="M54 14v40L24 112a8 8 0 0 0 7 12h78a8 8 0 0 0 7-12L86 54V14M46 14h48" />
            <path d="M36 92h68" strokeWidth={3} opacity={0.55} />
            <circle className="ua-bubble" cx="62" cy="106" r="6" fill="currentColor" />
            <circle className="ua-bubble b2" cx="80" cy="100" r="4" fill="currentColor" />
            <circle className="ua-bubble b3" cx="72" cy="112" r="3" fill="currentColor" />
          </>
        )}
        {art === 'geo' && (
          <>
            <circle cx="70" cy="70" r="54" />
            <path d="M22 96 104 30 118 86z" strokeWidth={3} />
            <circle cx="22" cy="96" r="5" fill="currentColor" />
            <circle cx="104" cy="30" r="5" fill="currentColor" />
            <circle cx="118" cy="86" r="5" fill="currentColor" />
            <circle cx="70" cy="70" r="4" fill="currentColor" />
          </>
        )}
        {art === 'dice' && (
          <>
            <path d="M16 118h112" strokeWidth={3} opacity={0.55} />
            <path d="M18 116c20 0 26-88 52-88s32 88 52 88" />
            <rect x="34" y="62" width="30" height="30" rx="7" transform="rotate(-12 49 77)" />
            <circle cx="44" cy="72" r="3" fill="currentColor" />
            <circle cx="54" cy="82" r="3" fill="currentColor" />
          </>
        )}
        {(art === 'abc' || art === 'ayn') && (
          <>
            <path d="M18 22h104v72H62l-26 22V94H18z" />
            <path d="M34 106h88" strokeWidth={3} opacity={0.55} />
            <text x="70" y="72" textAnchor="middle" fontSize={art === 'abc' ? 40 : 52} fontWeight="800" fill="currentColor" stroke="none" fontFamily="inherit">
              {art === 'abc' ? 'Aa' : 'ع'}
            </text>
          </>
        )}
        {art === 'leaf' && (
          <>
            <path d="M44 16c0 36 52 36 52 72s-52 36-52 36M96 16c0 36-52 36-52 72s52 36 52 36" />
            <path d="M52 34h36M60 52h20M52 70h36M52 106h36M60 88h20" strokeWidth={3} opacity={0.6} />
          </>
        )}
        {art === 'nodes' && (
          <>
            <path d="M28 34 104 26 112 100 36 110zM28 34l84 66M104 26 36 110" strokeWidth={3} />
            <circle cx="28" cy="34" r="9" fill="currentColor" />
            <circle cx="104" cy="26" r="9" fill="currentColor" />
            <circle cx="112" cy="100" r="9" fill="currentColor" />
            <circle cx="36" cy="110" r="9" fill="currentColor" />
          </>
        )}
      </svg>
      <i className="ua-dot d1" />
      <i className="ua-dot d2" />
      <i className="ua-dot d3" />
    </div>
  );
}
