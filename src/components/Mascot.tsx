import { useId } from 'react';

/** «بیو», the animated bone mascot (see BioArt), plus the small brand mark. */
export { BioArt as Mascot, type Mood } from './BioArt';

/** Small brand mark (used as the app icon too): a bone turning under a moment arrow. */
export function BrandMark({ size = 40 }: { size?: number }) {
  // Unique gradient ids: a copy of the mark inside a hidden sidebar would otherwise blank every other copy.
  const u = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="brand-mark" aria-hidden="true">
      <defs>
        <linearGradient id={`bm-bg${u}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1bb3a8" />
          <stop offset="1" stopColor="#0a645f" />
        </linearGradient>
        <linearGradient id={`bm-b${u}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="1" stopColor="#efe0c2" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#bm-bg${u})`} />
      <path d="M54.6 28A23 23 0 0 1 38 54.2" fill="none" stroke="#ff8a6a" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M31 55.6l7-6.2 1.2 9.6z" fill="#ff8a6a" stroke="#ff8a6a" strokeWidth="1.6" strokeLinejoin="round" />
      <g transform="rotate(-38 28 31)" fill={`url(#bm-b${u})`}>
        <rect x="13" y="27" width="30" height="8.5" rx="4.2" />
        <circle cx="13" cy="26.6" r="5.4" />
        <circle cx="13" cy="35.6" r="5.4" />
        <circle cx="43" cy="26.6" r="5.4" />
        <circle cx="43" cy="35.6" r="5.4" />
        <circle cx="25.4" cy="31.2" r="1.5" fill="#10292f" />
        <circle cx="30.6" cy="31.2" r="1.5" fill="#10292f" />
      </g>
    </svg>
  );
}
