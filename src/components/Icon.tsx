import type { CSSProperties } from 'react';

const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  review: 'M4 4h11a3 3 0 0 1 3 3v13l-4-2.5L10 20V7M8 4v16',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM3.5 21a8.5 8.5 0 0 1 17 0',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5zM4 21.5V5.5M8 7h8M8 11h6',
  check: 'm4.5 12.5 5 5L20 7',
  x: 'M6 6l12 12M18 6 6 18',
  close: 'M6 6l12 12M18 6 6 18',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z',
  play: 'M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3.5 3.5 0 0 0 3.6 4M16 6h3.5a3.5 3.5 0 0 1-3.6 4M12 13v4M8 20h8M9.5 17h5',
  cards: 'M7 4h11a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM3 7v12a2 2 0 0 0 2 2',
  dumbbell: 'M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11',
  sparkles: 'M12 3.5 13.6 8 18 9.6 13.6 11.2 12 15.5l-1.6-4.3L6 9.6 10.4 8zM18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8zM5.5 15.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z',
  chat: 'M4 5h16v11H9l-5 4z',
  send: 'M20 4 3 11l7 2.5L12.5 21z M20 4l-10 9.5',
  sound: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11',
  mute: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  refresh: 'M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4',
  back: 'M9 6l6 6-6 6',
  next: 'M15 6l-6 6 6 6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.5v.5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 12h.01',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  brain: 'M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3 3 0 0 0 7 18a2.5 2.5 0 0 0 5 .5V5.5a1.5 1.5 0 0 0-3-1ZM15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2A3 3 0 0 1 17 18a2.5 2.5 0 0 1-5 .5',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  steps: 'M4 20h5v-5h5v-5h5V5h2',
  quote: 'M9.5 7H5.5v5h4v1.5c0 1.5-1 2.5-2.5 3M18.5 7h-4v5h4v1.5c0 1.5-1 2.5-2.5 3',
  formula: 'M5 6h9M9 6v12M14 12l5 6M19 12l-5 6',
  example: 'M4 4h16v12H4zM8 20h8M12 16v4M8 9h8M8 12h5',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  hint: 'M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3ZM10 21h4',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  wand: 'M5 19 15 9M14 4v3M19 9h-3M17.5 5.5l-2 2M12 6.5l1 1M16.5 11l1 1',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  graduation: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6',
  shield: 'M12 3 4.5 6v6c0 4.5 3.2 8 7.5 9 4.3-1 7.5-4.5 7.5-9V6z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  up: 'M12 19V5M5.5 11.5 12 5l6.5 6.5',
  down: 'M12 5v14M5.5 12.5 12 19l6.5-6.5',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM21 21l-5.2-5.2',
  copy: 'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1ZM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  print: 'M7 9V3h10v6M7 17H4.5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H17M7 14h10v7H7z',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5',
};

const FILLED: Record<string, string> = {
  flame:
    'M12.2 2.3c.4 2.6-.6 4.4-2 6-1.5 1.7-3.4 3.4-3.4 6.4A5.3 5.3 0 0 0 12 20c3.1 0 5.4-2.3 5.4-5.4 0-2.1-.9-3.6-1.9-4.9.1 1.4-.4 2.6-1.4 3.3.4-3.6-.8-7.6-1.9-10.7Z',
  heart: 'M12 20.3s-7.8-4.6-9.2-9.6C2 7.5 4.1 4.6 7.2 4.6c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.1 0 5.2 2.9 4.4 6.1-1.4 5-9.2 9.6-9.2 9.6Z',
  bolt: 'M13.4 2.5 4.8 13.2h6.1L9.8 21.5l9.4-11.4h-6.2z',
  gem: 'M7 3.5h10l4 5.5-9 11.5L3 9z',
  crown: 'M3.5 8l4.5 4 4-7 4 7 4.5-4-2 11h-13z',
  starf: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  checkf: 'M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19Zm-1.4-6.2 6.2-6.2-1.4-1.4-4.8 4.8-2.2-2.2-1.4 1.4z',
  xf: 'M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19Zm-3.4-14.3 3.4 3.4 3.4-3.4 1.4 1.4-3.4 3.4 3.4 3.4-1.4 1.4-3.4-3.4-3.4 3.4-1.4-1.4 3.4-3.4-3.4-3.4z',
  atom: '',
};

export type IconName = keyof typeof P | keyof typeof FILLED | 'calc' | 'atomic' | 'flask' | 'geo' | 'dice' | 'nodes' | 'abc' | 'ayn' | 'leaf';

export function Icon({
  name,
  size = 22,
  stroke = 2.2,
  style,
  className,
  title,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
  className?: string;
  title?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    style,
    className,
    'aria-hidden': title ? undefined : true,
    role: title ? 'img' : undefined,
  } as const;
  if (name === 'calc') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        {title && <title>{title}</title>}
        <path d="M4 18c3-9 5-12 8-12M12 6c2 0 3 4 3.5 6M7 13h7" />
        <path d="M17 15.5l3 3M20 15.5l-3 3" />
      </svg>
    );
  }
  if (name === 'atomic') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={stroke - 0.4} strokeLinecap="round">
        {title && <title>{title}</title>}
        <ellipse cx="12" cy="12" rx="9.5" ry="3.8" />
        <ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(120 12 12)" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      </svg>
    );
  }
  if (name === 'geo') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        {title && <title>{title}</title>}
        <circle cx="12" cy="12" r="9" />
        <path d="M4.5 16.5 17.5 5l2 11z" />
      </svg>
    );
  }
  if (name === 'dice') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        {title && <title>{title}</title>}
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
        <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === 'nodes') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={stroke - 0.2} strokeLinecap="round" strokeLinejoin="round">
        {title && <title>{title}</title>}
        <path d="M6 6.5 18 5.5 18.5 18 5.5 18.5zM6 6.5l12.5 11.5" />
        <circle cx="6" cy="6.5" r="2.2" fill="currentColor" />
        <circle cx="18" cy="5.5" r="2.2" fill="currentColor" />
        <circle cx="18.5" cy="18" r="2.2" fill="currentColor" />
        <circle cx="5.5" cy="18.5" r="2.2" fill="currentColor" />
      </svg>
    );
  }
  if (name === 'abc' || name === 'ayn') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        {title && <title>{title}</title>}
        <path d="M4 5.5h16v10.5H11l-4.5 3.5V16H4z" />
        <text x="12" y="13.6" textAnchor="middle" fontSize={name === 'abc' ? 7.5 : 9} fontWeight="700" fill="currentColor" stroke="none" fontFamily="inherit">
          {name === 'abc' ? 'Aa' : 'ع'}
        </text>
      </svg>
    );
  }
  if (name === 'leaf') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        {title && <title>{title}</title>}
        <path d="M5 19c0-8.5 5.5-14 15-14 0 9.5-5.5 15-14 15" />
        <path d="M5 19 14 10M9 15h4M12 12V8" />
      </svg>
    );
  }
  if (name === 'flask') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        {title && <title>{title}</title>}
        <path d="M9.5 3h5M10.5 3v6.2L5 18.5A1.7 1.7 0 0 0 6.5 21h11a1.7 1.7 0 0 0 1.5-2.5l-5.5-9.3V3" />
        <path d="M7.5 15h9" />
      </svg>
    );
  }
  if (name in FILLED && FILLED[name]) {
    return (
      <svg {...common} fill="currentColor">
        {title && <title>{title}</title>}
        <path d={FILLED[name]} />
      </svg>
    );
  }
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {title && <title>{title}</title>}
      <path d={P[name as keyof typeof P] ?? P.info} />
    </svg>
  );
}
