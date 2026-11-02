import { motion, type TargetAndTransition, type Transition } from "motion/react";
import { useId } from "react";

type Mood = "idle" | "happy" | "cheer" | "sad" | "think" | "wave" | "wow";

const VB = { transformBox: "view-box" as const };
const loop = (duration: number, extra: Transition = {}): Transition => ({ duration, repeat: Infinity, ease: "easeInOut", ...extra });

type Pose = { left: number | number[]; right: number | number[]; arms: Transition };

function poseFor(mood: Mood): Pose {
  switch (mood) {
    case "wave":
      return { left: 14, right: [-150, -118, -150], arms: loop(0.55, { repeatType: "mirror" }) };
    case "cheer":
      return { left: [150, 135, 150], right: [-150, -135, -150], arms: loop(0.6, { repeatType: "mirror" }) };
    case "think":
      return { left: 12, right: 64, arms: { duration: 0.4 } };
    case "sad":
      return { left: 4, right: -4, arms: { duration: 0.5 } };
    case "wow":
      return { left: 60, right: -60, arms: { type: "spring", stiffness: 260, damping: 10 } };
    case "happy":
      return { left: [22, 30, 22], right: [-22, -30, -22], arms: loop(1.2) };
    default:
      return { left: [16, 20, 16], right: [-16, -20, -16], arms: loop(3) };
  }
}

/**
 * «کاوی», Kavyad's mascot: a friendly brushed-steel ingot in an orange hard hat and a hi-vis band,
 * with a small molten core on its chest. Pure SVG + motion; every pose respects reduced motion via MotionConfig.
 */
export function KaviMascot({ mood = "idle", size = 120, className }: { mood?: Mood; size?: number; className?: string }) {
  const u = useId().replace(/:/g, "");
  const id = (n: string) => `${n}${u}`;
  const happy = mood === "happy" || mood === "cheer";
  const pose = poseFor(mood);

  const body: TargetAndTransition =
    mood === "cheer"
      ? { y: [0, -18, 0], scaleY: [1, 1.04, 0.96, 1], transition: loop(0.62, { ease: "easeOut", repeatDelay: 0.12 }) }
      : mood === "sad"
        ? { y: 4, rotate: -4, scaleY: 0.97, transition: { duration: 0.5 } }
        : mood === "wow"
          ? { y: [0, -8, 0], transition: { duration: 0.35 } }
          : mood === "happy"
            ? { y: [0, -6, 0], transition: loop(0.9) }
            : { y: [0, -2.5, 0], scaleY: [1, 1.015, 1], transition: loop(3.2) };

  const look = mood === "think" ? { x: -2.5, y: -4 } : mood === "sad" ? { x: 0, y: 3 } : { x: 0, y: 0 };

  return (
    <motion.svg
      viewBox="0 0 160 172"
      width={size}
      height={size * (172 / 160)}
      className={className}
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={id("steel")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e3eaf1" />
          <stop offset="0.45" stopColor="#a9b8c7" />
          <stop offset="1" stopColor="#6a7d90" />
        </linearGradient>
        <linearGradient id={id("steelSide")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7b8ea1" />
          <stop offset="1" stopColor="#4b5c6e" />
        </linearGradient>
        <linearGradient id={id("hat")} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#ffb257" />
          <stop offset="0.55" stopColor="#f76707" />
          <stop offset="1" stopColor="#d9480f" />
        </linearGradient>
        <linearGradient id={id("brim")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f76707" />
          <stop offset="1" stopColor="#b83a0b" />
        </linearGradient>
        <linearGradient id={id("vest")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset="1" stopColor="#f5b400" />
        </linearGradient>
        <linearGradient id={id("limb")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9aabbc" />
          <stop offset="1" stopColor="#5b6d80" />
        </linearGradient>
        <radialGradient id={id("hand")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffc078" />
          <stop offset="1" stopColor="#e8590c" />
        </radialGradient>
        <radialGradient id={id("iris")} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#3b5878" />
          <stop offset="1" stopColor="#0c1a2c" />
        </radialGradient>
        <radialGradient id={id("core")} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#fff4c2" />
          <stop offset="0.45" stopColor="#ffb02e" />
          <stop offset="1" stopColor="#f0560a" />
        </radialGradient>
        <radialGradient id={id("glow")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff9d2e" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ff9d2e" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <motion.ellipse
        cx="80" cy="162" rx="44" ry="6" fill="rgba(12,26,44,.18)"
        style={{ transformBox: "fill-box", originX: 0.5 }}
        animate={mood === "cheer" ? { scaleX: [1, 0.7, 1], opacity: [1, 0.6, 1] } : { scaleX: 1, opacity: 1 }}
        transition={mood === "cheer" ? loop(0.62, { ease: "easeOut", repeatDelay: 0.12 }) : { duration: 0.3 }}
      />

      <motion.g style={{ ...VB, originX: "80px", originY: "160px" }} animate={body}>
        {/* floating ember (a spark from the furnace) */}
        <motion.g animate={{ y: [0, -6, 0], opacity: [0.9, 1, 0.9] }} transition={loop(2.4)}>
          <circle cx="132" cy="22" r="13" fill={`url(#${id("glow")})`} />
          <motion.path
            d="M132 13 C133 19 135 21 141 22 C135 23 133 25 132 31 C131 25 129 23 123 22 C129 21 131 19 132 13 Z"
            fill={`url(#${id("core")})`}
            style={{ ...VB, originX: "132px", originY: "22px" }}
            animate={{ rotate: [0, 14, -8, 0], scale: happy || mood === "wow" ? [1, 1.3, 1] : [1, 1.08, 1] }}
            transition={loop(happy ? 0.8 : 2.8)}
          />
        </motion.g>

        {/* boots */}
        <rect x="44" y="140" width="32" height="15" rx="7.5" fill="#26303b" />
        <rect x="84" y="140" width="32" height="15" rx="7.5" fill="#26303b" />
        <rect x="44" y="140" width="12" height="15" rx="6" fill="#f76707" opacity="0.9" />
        <rect x="104" y="140" width="12" height="15" rx="6" fill="#f76707" opacity="0.9" />

        {/* ingot body: side bevel, then the brushed front */}
        <path d="M34 52 Q34 44 42 44 L128 44 Q136 44 136 52 L136 136 Q136 146 126 146 L40 146 Q34 146 34 140 Z" fill={`url(#${id("steelSide")})`} />
        <rect x="26" y="48" width="104" height="98" rx="24" fill={`url(#${id("steel")})`} />
        <g stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.2">
          <path d="M36 66 H120" /><path d="M34 74 H122" />
        </g>
        <path d="M38 62 C40 55 46 52 56 52" stroke="rgba(255,255,255,.75)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        {/* rivets */}
        {[[36, 62], [120, 62], [36, 120], [120, 120]].map(([x, y]) => (
          <g key={`${x}${y}`}><circle cx={x} cy={y} r="2.6" fill="#5b6d80" /><circle cx={x - 0.7} cy={y - 0.7} r="1" fill="#fff" opacity="0.7" /></g>
        ))}

        {/* hi-vis band with reflective stripe and the molten core emblem */}
        <rect x="26" y="127" width="104" height="14" fill={`url(#${id("vest")})`} />
        <rect x="26" y="132" width="104" height="4" fill="#e9eef3" opacity="0.9" />
        <circle cx="78" cy="134" r="8.5" fill="#2a3542" />
        <motion.circle cx="78" cy="134" r="5.6" fill={`url(#${id("core")})`} animate={{ opacity: [0.85, 1, 0.85], scale: happy ? [1, 1.18, 1] : [1, 1.06, 1] }} style={{ ...VB, originX: "78px", originY: "134px" }} transition={loop(happy ? 0.7 : 2)} />

        {/* hard hat */}
        <path d="M30 52 Q31 18 78 16 Q125 18 126 52 Z" fill={`url(#${id("hat")})`} />
        <path d="M70 17.5 Q78 16 86 17.5 L86 50 L70 50 Z" fill="#ffa94d" opacity="0.55" />
        <path d="M44 34 Q50 24 62 21" stroke="rgba(255,255,255,.6)" strokeWidth="4" strokeLinecap="round" fill="none" />
        <rect x="18" y="47" width="120" height="10" rx="5" fill={`url(#${id("brim")})`} />
        <rect x="24" y="48" width="60" height="2.4" rx="1.2" fill="#fff" opacity="0.35" />
        <path d="M97 30 L104 42 H90 Z" fill="#fff" opacity="0.92" />
        <path d="M97 35 L100 40 H94 Z" fill="#f76707" />

        <g transform="translate(0 5)">
        {/* cheeks */}
        <ellipse cx="40" cy="104" rx="9" ry="5" fill="#ff9a76" opacity={happy ? 0.8 : 0.5} />
        <ellipse cx="104" cy="104" rx="9" ry="5" fill="#ff9a76" opacity={happy ? 0.8 : 0.5} />

        {/* eyes */}
        {happy ? (
          <g stroke="#14202e" strokeWidth="5" strokeLinecap="round" fill="none">
            <path d="M44 86 Q55 73 66 86" />
            <path d="M78 86 Q89 73 100 86" />
          </g>
        ) : (
          <motion.g style={{ ...VB, originY: "84px" }} animate={{ scaleY: [1, 1, 0.08, 1] }} transition={{ duration: 4.2, times: [0, 0.93, 0.965, 1], repeat: Infinity }}>
            <ellipse cx="55" cy="84" rx="13" ry={mood === "wow" ? 16.5 : 15} fill="#fff" />
            <ellipse cx="89" cy="84" rx="13" ry={mood === "wow" ? 16.5 : 15} fill="#fff" />
            <motion.g animate={look} transition={{ type: "spring", stiffness: 120, damping: 14 }}>
              <circle cx="56" cy="86" r={mood === "wow" ? 8 : 9} fill={`url(#${id("iris")})`} />
              <circle cx="88" cy="86" r={mood === "wow" ? 8 : 9} fill={`url(#${id("iris")})`} />
              <circle cx="56" cy="86" r="4.6" fill="#050b1c" />
              <circle cx="88" cy="86" r="4.6" fill="#050b1c" />
              <circle cx="52.6" cy="82" r="3.4" fill="#fff" />
              <circle cx="84.6" cy="82" r="3.4" fill="#fff" />
              <circle cx="59" cy="89.5" r="1.5" fill="#fff" opacity="0.9" />
              <circle cx="91" cy="89.5" r="1.5" fill="#fff" opacity="0.9" />
            </motion.g>
          </motion.g>
        )}

        {/* brows */}
        <g stroke="#14202e" strokeWidth="3.6" strokeLinecap="round" fill="none">
          {mood === "sad" ? (
            <>
              <path d="M44 66 Q52 68 62 63" />
              <path d="M100 66 Q92 68 82 63" />
            </>
          ) : mood === "think" ? (
            <>
              <path d="M45 66 Q54 60 64 64" />
              <path d="M81 61 Q90 57 99 61" />
            </>
          ) : mood === "wow" ? (
            <>
              <path d="M45 61 Q54 55 63 59" />
              <path d="M81 59 Q90 55 99 61" />
            </>
          ) : !happy ? (
            <>
              <path d="M46 65 Q54 61 62 64" />
              <path d="M82 64 Q90 61 98 65" />
            </>
          ) : null}
        </g>

        {/* mouth */}
        {happy ? (
          <g>
            <path d="M60 104 Q72 104 84 104 Q83 120 72 120 Q61 120 60 104 Z" fill="#14202e" />
            <path d="M65 114 Q72 109 79 114 Q76 119 72 119 Q68 119 65 114 Z" fill="#ff6b8a" />
          </g>
        ) : mood === "sad" ? (
          <path d="M63 112 Q72 104 81 112" stroke="#14202e" strokeWidth="4" fill="none" strokeLinecap="round" />
        ) : mood === "wow" ? (
          <ellipse cx="72" cy="110" rx="6" ry="7.5" fill="#14202e" />
        ) : mood === "think" ? (
          <path d="M66 110 Q73 107 80 109" stroke="#14202e" strokeWidth="4" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M62 105 Q72 115 82 105" stroke="#14202e" strokeWidth="4" fill="none" strokeLinecap="round" />
        )}

        {/* tear */}
        {mood === "sad" && (
          <motion.path
            d="M44 96 C44 96 40 102 40 105 C40 107.5 42 109 44 109 C46 109 48 107.5 48 105 C48 102 44 96 44 96 Z"
            fill="#7cc4ff"
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: [0, 14], opacity: [0, 1, 0] }}
            transition={loop(1.8, { ease: "easeIn" })}
          />
        )}

        </g>

        {/* arms (drawn last so gestures sit in front of the cover) */}
        <motion.g style={{ ...VB, originX: "28px", originY: "100px" }} animate={{ rotate: pose.left }} transition={pose.arms}>
          <rect x="21" y="98" width="14" height="30" rx="7" fill={`url(#${id("limb")})`} />
          <circle cx="28" cy="130" r="9.5" fill={`url(#${id("hand")})`} />
          <circle cx="25" cy="127" r="2.6" fill="#fff" opacity="0.45" />
        </motion.g>
        <motion.g style={{ ...VB, originX: "116px", originY: "100px" }} animate={{ rotate: pose.right }} transition={pose.arms}>
          <rect x="109" y="98" width="14" height="30" rx="7" fill={`url(#${id("limb")})`} />
          <circle cx="116" cy="130" r="9.5" fill={`url(#${id("hand")})`} />
          <circle cx="113" cy="127" r="2.6" fill="#fff" opacity="0.45" />
        </motion.g>

        {/* celebration sparkles */}
        {mood === "cheer" &&
          [
            [12, 40, 0],
            [146, 34, 0.2],
            [18, 120, 0.4],
            [150, 112, 0.1],
          ].map(([x, y, d], i) => (
            <motion.path
              key={i}
              d={`M${x} ${y - 7} C${x + 1} ${y - 2} ${x + 2} ${y - 1} ${x + 7} ${y} C${x + 2} ${y + 1} ${x + 1} ${y + 2} ${x} ${y + 7} C${x - 1} ${y + 2} ${x - 2} ${y + 1} ${x - 7} ${y} C${x - 2} ${y - 1} ${x - 1} ${y - 2} ${x} ${y - 7} Z`}
              fill={i % 2 ? "#ffb02e" : "#ffd43b"}
              style={{ transformBox: "fill-box", originX: 0.5, originY: 0.5 }}
              animate={{ scale: [0, 1.2, 0], rotate: [0, 90] }}
              transition={loop(1.1, { delay: d })}
            />
          ))}
      </motion.g>
    </motion.svg>
  );
}
