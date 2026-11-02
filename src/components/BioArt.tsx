import { motion, type TargetAndTransition, type Transition } from 'motion/react';
import { useId } from 'react';

export type Mood = 'idle' | 'happy' | 'cheer' | 'wave' | 'think' | 'wow' | 'oops' | 'wink' | 'calm';

const VB = { transformBox: 'view-box' as const };
const loop = (duration: number, extra: Transition = {}): Transition => ({ duration, repeat: Infinity, ease: 'easeInOut', ...extra });

type Pose = { left: number | number[]; right: number | number[]; arms: Transition };

/** Arm angles in degrees from hanging straight down (left arm: + swings out, right arm: − swings out). */
function poseFor(mood: Mood): Pose {
  switch (mood) {
    case 'wave':
      return { left: 16, right: [-150, -116, -150], arms: loop(0.55, { repeatType: 'mirror' }) };
    case 'cheer':
      return { left: [152, 134, 152], right: [-152, -134, -152], arms: loop(0.6, { repeatType: 'mirror' }) };
    case 'think':
      return { left: 14, right: 66, arms: { duration: 0.4 } };
    case 'wow':
      return { left: 64, right: -64, arms: { type: 'spring', stiffness: 260, damping: 10 } };
    case 'oops':
      return { left: 6, right: -6, arms: { duration: 0.5 } };
    case 'happy':
    case 'wink':
      return { left: [24, 34, 24], right: [-24, -34, -24], arms: loop(1.2) };
    default:
      return { left: [18, 23, 18], right: [-18, -23, -18], arms: loop(3) };
  }
}

/**
 * «بیو», Biomana's mascot: a friendly ivory bone with knobby ends for a head and feet, a coral
 * sports headband (it is a physio's bone), little bone arms and a soft teal halo that brightens
 * when something clicks. Pure SVG + motion; still for reduced motion.
 */
export function BioArt({ mood = 'idle', size = 96, className, glow = true }: { mood?: Mood; size?: number; className?: string; glow?: boolean }) {
  const u = useId().replace(/:/g, '');
  const id = (n: string) => `${n}${u}`;
  const m: Mood = mood === 'calm' ? 'idle' : mood;
  const happy = m === 'happy' || m === 'cheer' || m === 'wink' || m === 'wave';
  const lit = m === 'cheer' || m === 'wow' || m === 'happy';
  const pose = poseFor(m);
  const ink = '#10292f';
  const edge = '#d6c29b';
  const bone = `url(#${id('bone')})`;

  const body: TargetAndTransition =
    m === 'cheer'
      ? { y: [0, -16, 0], scaleY: [1, 1.04, 0.96, 1], transition: loop(0.62, { ease: 'easeOut', repeatDelay: 0.1 }) }
      : m === 'oops'
        ? { y: 3, rotate: -5, scaleY: 0.98, transition: { duration: 0.5 } }
        : m === 'wow'
          ? { y: [0, -8, 0], transition: { duration: 0.35 } }
          : happy
            ? { y: [0, -5, 0], rotate: m === 'wave' ? [0, 2, 0] : 0, transition: loop(0.9) }
            : { y: [0, -2.5, 0], scaleY: [1, 1.015, 1], transition: loop(3.2) };

  const look = m === 'think' ? { x: 2.2, y: -3 } : m === 'oops' ? { x: -1.5, y: 2 } : { x: 0, y: 0 };
  const eyeR = m === 'wow' ? 7.4 : 6.6;
  const eyeRy = m === 'wow' ? 9 : 8;

  // The bone outline: two knobs on top, a shaft with a gentle waist, two knobs at the bottom.
  const shaft = 'M35 30C39 52 39 90 35 112H85C81 90 81 52 85 30Z';
  const knobs: [number, number, number][] = [
    [44, 24, 15],
    [76, 24, 15],
    [44, 117, 14],
    [76, 117, 14],
  ];

  return (
    <motion.svg
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      className={className}
      role="img"
      aria-label="بیو، دستیار بیومانا"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id={id('glow')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#2ec4b6" stopOpacity="0.45" />
          <stop offset="1" stopColor="#2ec4b6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('bone')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="0.6" stopColor="#f8efdc" />
          <stop offset="1" stopColor="#ecdcbb" />
        </linearGradient>
        <linearGradient id={id('band')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9273" />
          <stop offset="1" stopColor="#e85a3c" />
        </linearGradient>
        <radialGradient id={id('iris')} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#1f6f6a" />
          <stop offset="1" stopColor="#0b2427" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <motion.ellipse
        cx="60"
        cy="137"
        rx="32"
        ry="4.5"
        fill="rgba(16,41,47,.18)"
        style={{ transformBox: 'fill-box', originX: 0.5 }}
        animate={m === 'cheer' ? { scaleX: [1, 0.7, 1], opacity: [1, 0.6, 1] } : { scaleX: 1, opacity: 1 }}
        transition={m === 'cheer' ? loop(0.62, { ease: 'easeOut', repeatDelay: 0.1 }) : { duration: 0.3 }}
      />

      <motion.g style={{ ...VB, originX: '60px', originY: '134px' }} animate={body}>
        {/* the halo: brighter when an idea clicks */}
        {glow && (
          <motion.circle
            cx="60"
            cy="66"
            r="60"
            fill={`url(#${id('glow')})`}
            style={{ ...VB, originX: '60px', originY: '66px' }}
            animate={lit ? { opacity: [0.75, 1, 0.75], scale: [1, 1.08, 1] } : { opacity: [0.4, 0.55, 0.4], scale: 1 }}
            transition={loop(lit ? 1.1 : 3)}
          />
        )}

        {/* little force arrows when it clicks */}
        {(m === 'cheer' || m === 'wow') && (
          <motion.g
            stroke="#0f8a83"
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            style={{ ...VB, originX: '60px', originY: '60px' }}
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.94, 1.05, 0.94] }}
            transition={loop(0.9)}
          >
            <path d="M60 2v-12m-4 4 4-4 4 4" />
            <path d="M18 14l-8-8m0 6v-6h6" />
            <path d="M102 14l8-8m0 6v-6h-6" />
          </motion.g>
        )}

        {/* bone: outline layer first, then the fill on top so the knobs and shaft read as one shape */}
        <g fill={edge} stroke={edge} strokeWidth="5" strokeLinejoin="round">
          <path d={shaft} />
          {knobs.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} />
          ))}
        </g>
        <g fill={bone}>
          <path d={shaft} />
          {knobs.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} />
          ))}
        </g>
        {/* shine and a hint of the joint line between the bottom knobs */}
        <ellipse cx="40" cy="18" rx="7" ry="4.5" fill="#fff" opacity="0.85" transform="rotate(-30 40 18)" />
        <path d="M41 50c-1 14-1 30 0 44" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" opacity="0.7" fill="none" />
        <path d="M60 122v8" stroke={edge} strokeWidth="2.2" strokeLinecap="round" />

        {/* coral sports headband */}
        <rect x="31" y="31" width="58" height="9" rx="4.5" fill={`url(#${id('band')})`} />
        <path d="M33 35.5h54" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
        <motion.path
          d="M88 34c7-1 11 2 14 6-5 0-9-1-13-3"
          fill="#e85a3c"
          style={{ ...VB, originX: '88px', originY: '35px' }}
          animate={{ rotate: happy ? [0, 10, 0] : [0, 4, 0] }}
          transition={loop(happy ? 0.6 : 2.4)}
        />

        {/* face */}
        <ellipse cx="42" cy="74" rx="5" ry="4" fill="#ff8f7a" opacity={happy ? 0.6 : 0.38} />
        <ellipse cx="78" cy="74" rx="5" ry="4" fill="#ff8f7a" opacity={happy ? 0.6 : 0.38} />

        {m === 'cheer' || m === 'happy' ? (
          <g stroke={ink} strokeWidth="4.2" strokeLinecap="round" fill="none">
            <path d="M43 61q6-8 12 0" />
            <path d="M65 61q6-8 12 0" />
          </g>
        ) : (
          <motion.g style={{ ...VB, originY: '59px' }} animate={{ scaleY: [1, 1, 0.08, 1] }} transition={{ duration: 4.2, times: [0, 0.93, 0.965, 1], repeat: Infinity }}>
            {m === 'wink' ? (
              <path d="M65 60q6 6 12 0" stroke={ink} strokeWidth="4.2" strokeLinecap="round" fill="none" />
            ) : (
              <ellipse cx="71" cy="59" rx={eyeR} ry={eyeRy} fill="#fff" stroke="#e6d6b4" strokeWidth="1" />
            )}
            <ellipse cx="49" cy="59" rx={eyeR} ry={eyeRy} fill="#fff" stroke="#e6d6b4" strokeWidth="1" />
            <motion.g animate={look} transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
              <circle cx="49.5" cy="60" r={m === 'wow' ? 4.2 : 4.8} fill={`url(#${id('iris')})`} />
              <circle cx="48" cy="57.8" r="1.7" fill="#fff" />
              {m !== 'wink' && (
                <>
                  <circle cx="70.5" cy="60" r={m === 'wow' ? 4.2 : 4.8} fill={`url(#${id('iris')})`} />
                  <circle cx="69" cy="57.8" r="1.7" fill="#fff" />
                </>
              )}
            </motion.g>
          </motion.g>
        )}

        {/* brows */}
        <g stroke={ink} strokeWidth="3.2" strokeLinecap="round" fill="none">
          {m === 'oops' ? (
            <>
              <path d="M42 49l11-3.5" />
              <path d="M78 49l-11-3.5" />
            </>
          ) : m === 'think' ? (
            <>
              <path d="M42 48q6-3 12 0" />
              <path d="M66 45q6-4 12-1" />
            </>
          ) : m === 'wow' ? (
            <>
              <path d="M42 46q6-4 12-1" />
              <path d="M66 45q6-3 12 1" />
            </>
          ) : null}
        </g>

        {/* mouth */}
        {m === 'cheer' ? (
          <g>
            <path d="M48 74q12 0 24 0q-2 13-12 13t-12-13z" fill={ink} />
            <path d="M54 83q6 4 12 0q-3 3.4-6 3.4t-6-3.4z" fill="#ff8f7a" />
          </g>
        ) : m === 'happy' || m === 'wink' || m === 'wave' ? (
          <path d="M51 76q9 9 18 0" stroke={ink} strokeWidth="4.2" strokeLinecap="round" fill="none" />
        ) : m === 'wow' ? (
          <ellipse cx="60" cy="80" rx="5" ry="6" fill={ink} />
        ) : m === 'oops' ? (
          <path d="M54 81q6-4.5 12 0" stroke={ink} strokeWidth="3.8" strokeLinecap="round" fill="none" />
        ) : m === 'think' ? (
          <path d="M54 79q6-3 12 0" stroke={ink} strokeWidth="3.8" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M52 77q8 6 16 0" stroke={ink} strokeWidth="4.2" strokeLinecap="round" fill="none" />
        )}

        {/* sweat drop */}
        {m === 'oops' && (
          <motion.path
            d="M92 46c0 0-4 6-4 9a4 4 0 0 0 8 0c0-3-4-9-4-9z"
            fill="#7fd6ec"
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: [0, 12], opacity: [0, 1, 0] }}
            transition={loop(1.8, { ease: 'easeIn' })}
          />
        )}

        {/* thinking dots */}
        {m === 'think' &&
          [0, 1, 2].map((i) => (
            <motion.circle
              key={i}
              cx={100 + i * 7}
              cy={20 - i * 6}
              r={2 + i}
              fill="#5fd4ca"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={loop(1.2, { delay: i * 0.2 })}
            />
          ))}

        {/* arms: little bones with round knob hands (drawn last so gestures sit in front) */}
        <motion.g style={{ ...VB, originX: '37px', originY: '82px' }} animate={{ rotate: pose.left }} transition={pose.arms}>
          <rect x="33" y="80" width="8" height="20" rx="4" fill={bone} stroke={edge} strokeWidth="1.6" />
          <circle cx="37" cy="103" r="6.6" fill={bone} stroke={edge} strokeWidth="1.6" />
          <circle cx="35" cy="101" r="1.8" fill="#fff" />
        </motion.g>
        <motion.g style={{ ...VB, originX: '83px', originY: '82px' }} animate={{ rotate: pose.right }} transition={pose.arms}>
          <rect x="79" y="80" width="8" height="20" rx="4" fill={bone} stroke={edge} strokeWidth="1.6" />
          <circle cx="83" cy="103" r="6.6" fill={bone} stroke={edge} strokeWidth="1.6" />
          <circle cx="81" cy="101" r="1.8" fill="#fff" />
        </motion.g>

        {/* celebration sparkles */}
        {m === 'cheer' &&
          [
            [6, 34, 0],
            [116, 28, 0.2],
            [8, 100, 0.4],
            [114, 96, 0.1],
          ].map(([x, y, d], i) => (
            <motion.path
              key={i}
              d={`M${x} ${y - 6} C${x + 1} ${y - 2} ${x + 2} ${y - 1} ${x + 6} ${y} C${x + 2} ${y + 1} ${x + 1} ${y + 2} ${x} ${y + 6} C${x - 1} ${y + 2} ${x - 2} ${y + 1} ${x - 6} ${y} C${x - 2} ${y - 1} ${x - 1} ${y - 2} ${x} ${y - 6} Z`}
              fill={i % 2 ? '#ff7d5c' : '#2ec4b6'}
              style={{ transformBox: 'fill-box', originX: 0.5, originY: 0.5 }}
              animate={{ scale: [0, 1.2, 0], rotate: [0, 90] }}
              transition={loop(1.1, { delay: d })}
            />
          ))}
      </motion.g>
    </motion.svg>
  );
}
