/** «بیو», the animated lightbulb mascot (see FahmiArt), plus the small brand mark. */
export { FahmiArt as Mascot, type Mood } from './FahmiArt';

/** Small brand mark (used as the app icon too). */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="brand-mark" aria-hidden="true">
      <defs>
        <linearGradient id="bm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7a5cff" />
          <stop offset="1" stopColor="#4123cf" />
        </linearGradient>
        <linearGradient id="bm-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset="1" stopColor="#ffab1a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#bm-bg)" />
      <circle cx="32" cy="28" r="20" fill="#ffd84d" opacity="0.18" />
      <path d="M22.5 37.5c-4.6-4.3-5.8-12.6-1.2-18.5 4.8-6.3 17.6-6.3 22.4 0 4.6 5.9 3.4 14.2-1.2 18.5-2 2-2.8 3.8-2.8 6H25.3c0-2.2-.8-4-2.8-6Z" fill="url(#bm-b)" />
      <rect x="25" y="44" width="14" height="8" rx="2.6" fill="#fff" />
      <path d="M26 47.5h12" stroke="#7a5cff" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="28" cy="27" rx="2.4" ry="3" fill="#2a1f5c" />
      <ellipse cx="36" cy="27" rx="2.4" ry="3" fill="#2a1f5c" />
      <path d="M28.5 33q3.5 3.2 7 0" stroke="#2a1f5c" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
