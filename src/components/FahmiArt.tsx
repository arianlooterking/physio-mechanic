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
 * «بیو», Biomana's lightbulb mascot: a friendly bulb with a purple screw base, little arms with round
 * hands and a glow that brightens when something clicks. Pure SVG + motion; still for reduced motion.
 */
export function FahmiArt({ mood = 'idle', size = 96, className, glow = true }: { mood?: Mood; size?: number; className?: string; glow?: boolean }) {
  const u = useId().replace(/:/g, '');
  const id = (n: string) => `${n}${u}`;
  const m: Mood = mood === 'calm' ? 'idle' : mood;
  const happy = m === 'happy' || m === 'cheer' || m === 'wink' || m === 'wave';
  const lit = m === 'cheer' || m === 'wow' || m === 'happy';
  const pose = poseFor(m);
  const ink = '#2a1f5c';

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

  const look = m === 'think' ? { x: 2.5, y: -3.5 } : m === 'oops' ? { x: -1.5, y: 2 } : { x: 0, y: 0 };

  return (
    <motion.svg
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      className={className}
      role="img"
      aria-label="فهمی، دستیار بیومانا"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id={id('glow')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffd84d" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffd84d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('bulb')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe873" />
          <stop offset="0.55" stopColor="#ffc531" />
          <stop offset="1" stopColor="#ffa516" />
        </linearGradient>
        <linearGradient id={id('base')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a5cff" />
          <stop offset="1" stopColor="#4a2bdc" />
        </linearGradient>
        <linearGradient id={id('sleeve')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a70ff" />
          <stop offset="1" stopColor="#5b3df5" />
        </linearGradient>
        <radialGradient id={id('hand')} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e6defc" />
        </radialGradient>
        <radialGradient id={id('iris')} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#4b3a99" />
          <stop offset="1" stopColor="#1a1240" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <motion.ellipse
        cx="60"
        cy="137"
        rx="30"
        ry="4.5"
        fill="rgba(35,20,110,.18)"
        style={{ transformBox: 'fill-box', originX: 0.5 }}
        animate={m === 'cheer' ? { scaleX: [1, 0.7, 1], opacity: [1, 0.6, 1] } : { scaleX: 1, opacity: 1 }}
        transition={m === 'cheer' ? loop(0.62, { ease: 'easeOut', repeatDelay: 0.1 }) : { duration: 0.3 }}
      />

      <motion.g style={{ ...VB, originX: '60px', originY: '134px' }} animate={body}>
        {/* the glow: brighter when an idea clicks */}
        {glow && (
          <motion.circle
            cx="60"
            cy="54"
            r="58"
            fill={`url(#${id('glow')})`}
            style={{ ...VB, originX: '60px', originY: '54px' }}
            animate={lit ? { opacity: [0.75, 1, 0.75], scale: [1, 1.08, 1] } : { opacity: [0.45, 0.6, 0.45], scale: 1 }}
            transition={loop(lit ? 1.1 : 3)}
          />
        )}

        {/* rays when the idea lights up */}
        {(m === 'cheer' || m === 'wow') && (
          <motion.g
            stroke="#ffb51e"
            strokeWidth="4"
            strokeLinecap="round"
            style={{ ...VB, originX: '60px', originY: '52px' }}
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.94, 1.05, 0.94] }}
            transition={loop(0.9)}
          >
            <path d="M60 -6v-8" />
            <path d="M24 6l-6-6" />
            <path d="M96 6l6-6" />
            <path d="M8 40H0" />
            <path d="M112 40h8" />
          </motion.g>
        )}

        {/* bulb */}
        <path
          d="M31 84C18 72 15 48 28 31 41 13 79 13 92 31c13 17 10 41-3 53-6 6-8 11-8 17H39c0-6-2-11-8-17Z"
          fill={`url(#${id('bulb')})`}
          stroke="#e89400"
          strokeWidth="2"
        />
        {/* filament glint */}
        <motion.path
          d="M52 99c0-5 3-7 4-10m12 10c0-5-3-7-4-10"
          stroke="#e89400"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          animate={{ opacity: lit ? [0.5, 1, 0.5] : 0.45 }}
          transition={loop(1)}
        />
        <ellipse cx="44" cy="33" rx="11" ry="7" fill="#fff" opacity="0.6" transform="rotate(-28 44 33)" />
        <circle cx="34" cy="46" r="3" fill="#fff" opacity="0.5" />

        {/* screw base */}
        <rect x="38" y="100" width="44" height="22" rx="7" fill={`url(#${id('base')})`} />
        <path d="M40 107h40M40 114h40" stroke="#a593ff" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M50 122h20l-4 7a3 3 0 0 1-2.6 1.5h-6.8A3 3 0 0 1 54 129z" fill="#3a20b8" />

        {/* face */}
        <ellipse cx="38" cy="70" rx="6.5" ry="5" fill="#ff7aa2" opacity={happy ? 0.6 : 0.4} />
        <ellipse cx="82" cy="70" rx="6.5" ry="5" fill="#ff7aa2" opacity={happy ? 0.6 : 0.4} />

        {m === 'cheer' || m === 'happy' ? (
          <g stroke={ink} strokeWidth="4.5" strokeLinecap="round" fill="none">
            <path d="M39 60q7-9 14 0" />
            <path d="M67 60q7-9 14 0" />
          </g>
        ) : (
          <motion.g style={{ ...VB, originY: '57px' }} animate={{ scaleY: [1, 1, 0.08, 1] }} transition={{ duration: 4.2, times: [0, 0.93, 0.965, 1], repeat: Infinity }}>
            {m === 'wink' ? (
              <path d="M67 59q7 6 14 0" stroke={ink} strokeWidth="4.5" strokeLinecap="round" fill="none" />
            ) : (
              <ellipse cx="74" cy="57" rx={m === 'wow' ? 8.5 : 7.5} ry={m === 'wow' ? 10 : 9} fill="#fff" />
            )}
            <ellipse cx="46" cy="57" rx={m === 'wow' ? 8.5 : 7.5} ry={m === 'wow' ? 10 : 9} fill="#fff" />
            <motion.g animate={look} transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
              <circle cx="46.5" cy="58" r={m === 'wow' ? 4.6 : 5.4} fill={`url(#${id('iris')})`} />
              <circle cx="44.8" cy="55.6" r="1.9" fill="#fff" />
              {m !== 'wink' && (
                <>
                  <circle cx="73.5" cy="58" r={m === 'wow' ? 4.6 : 5.4} fill={`url(#${id('iris')})`} />
                  <circle cx="71.8" cy="55.6" r="1.9" fill="#fff" />
                </>
              )}
            </motion.g>
          </motion.g>
        )}

        {/* brows */}
        <g stroke={ink} strokeWidth="3.4" strokeLinecap="round" fill="none">
          {m === 'oops' ? (
            <>
              <path d="M38 46l12-4" />
              <path d="M82 46l-12-4" />
            </>
          ) : m === 'think' ? (
            <>
              <path d="M38 45q7-3 14 0" />
              <path d="M67 41q7-5 14-1" />
            </>
          ) : m === 'wow' ? (
            <>
              <path d="M38 41q7-5 14-1" />
              <path d="M68 40q7-4 14 1" />
            </>
          ) : null}
        </g>

        {/* mouth */}
        {m === 'cheer' ? (
          <g>
            <path d="M46 70q14 0 28 0q-2 15-14 15t-14-15z" fill={ink} />
            <path d="M53 80q7 5 14 0q-3 4-7 4t-7-4z" fill="#ff7aa2" />
          </g>
        ) : m === 'happy' || m === 'wink' || m === 'wave' ? (
          <path d="M49 72q11 11 22 0" stroke={ink} strokeWidth="4.5" strokeLinecap="round" fill="none" />
        ) : m === 'wow' ? (
          <ellipse cx="60" cy="77" rx="5.5" ry="6.5" fill={ink} />
        ) : m === 'oops' ? (
          <path d="M53 78q7-5 14 0" stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none" />
        ) : m === 'think' ? (
          <path d="M53 76q7-3 14 0" stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M51 73q9 7 18 0" stroke={ink} strokeWidth="4.5" strokeLinecap="round" fill="none" />
        )}

        {/* sweat drop */}
        {m === 'oops' && (
          <motion.path
            d="M92 40c0 0-4 6-4 9a4 4 0 0 0 8 0c0-3-4-9-4-9z"
            fill="#7cc4ff"
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
              cx={98 + i * 7}
              cy={16 - i * 6}
              r={2 + i}
              fill="#a593ff"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={loop(1.2, { delay: i * 0.2 })}
            />
          ))}

        {/* arms (drawn last so gestures sit in front of the bulb) */}
        <motion.g style={{ ...VB, originX: '29px', originY: '76px' }} animate={{ rotate: pose.left }} transition={pose.arms}>
          <rect x="24.5" y="74" width="9" height="22" rx="4.5" fill={`url(#${id('sleeve')})`} />
          <circle cx="29" cy="99" r="7.2" fill={`url(#${id('hand')})`} stroke="#c9bdf7" strokeWidth="1.2" />
          <circle cx="26.6" cy="96.6" r="1.9" fill="#fff" />
        </motion.g>
        <motion.g style={{ ...VB, originX: '91px', originY: '76px' }} animate={{ rotate: pose.right }} transition={pose.arms}>
          <rect x="86.5" y="74" width="9" height="22" rx="4.5" fill={`url(#${id('sleeve')})`} />
          <circle cx="91" cy="99" r="7.2" fill={`url(#${id('hand')})`} stroke="#c9bdf7" strokeWidth="1.2" />
          <circle cx="88.6" cy="96.6" r="1.9" fill="#fff" />
        </motion.g>

        {/* celebration sparkles */}
        {m === 'cheer' &&
          [
            [6, 30, 0],
            [116, 22, 0.2],
            [10, 96, 0.4],
            [114, 92, 0.1],
          ].map(([x, y, d], i) => (
            <motion.path
              key={i}
              d={`M${x} ${y - 6} C${x + 1} ${y - 2} ${x + 2} ${y - 1} ${x + 6} ${y} C${x + 2} ${y + 1} ${x + 1} ${y + 2} ${x} ${y + 6} C${x - 1} ${y + 2} ${x - 2} ${y + 1} ${x - 6} ${y} C${x - 2} ${y - 1} ${x - 1} ${y - 2} ${x} ${y - 6} Z`}
              fill={i % 2 ? '#ffb51e' : '#ffd84d'}
              style={{ transformBox: 'fill-box', originX: 0.5, originY: 0.5 }}
              animate={{ scale: [0, 1.2, 0], rotate: [0, 90] }}
              transition={loop(1.1, { delay: d })}
            />
          ))}
      </motion.g>
    </motion.svg>
  );
}
