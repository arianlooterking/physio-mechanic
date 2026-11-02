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
 * «یادی», Yadmana's mascot: a little hardcover book with a spark of an idea.
 * Pure SVG + motion; every pose is animated and respects reduced motion via MotionConfig.
 */
export function YadiMascot({ mood = "idle", size = 120, className }: { mood?: Mood; size?: number; className?: string }) {
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
        <linearGradient id={id("cover")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3d93ff" />
          <stop offset="0.55" stopColor="#0a63f2" />
          <stop offset="1" stopColor="#0041c4" />
        </linearGradient>
        <linearGradient id={id("back")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a3fae" />
          <stop offset="1" stopColor="#062c82" />
        </linearGradient>
        <linearGradient id={id("pages")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff9ec" />
          <stop offset="1" stopColor="#f1dfbd" />
        </linearGradient>
        <linearGradient id={id("limb")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f6ff0" />
          <stop offset="1" stopColor="#0039b8" />
        </linearGradient>
        <radialGradient id={id("hand")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#6fb2ff" />
          <stop offset="1" stopColor="#1d66e6" />
        </radialGradient>
        <radialGradient id={id("iris")} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#3a4f7a" />
          <stop offset="1" stopColor="#0b1631" />
        </radialGradient>
        <radialGradient id={id("spark")} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.6" stopColor="#ffc928" />
          <stop offset="1" stopColor="#f0a000" />
        </radialGradient>
        <radialGradient id={id("glow")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd84d" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffd84d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("ribbon")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff6b86" />
          <stop offset="1" stopColor="#e23a5e" />
        </linearGradient>
      </defs>

      {/* ground shadow */}
      <motion.ellipse
        cx="80" cy="162" rx="44" ry="6" fill="rgba(13,27,54,.16)"
        style={{ transformBox: "fill-box", originX: 0.5 }}
        animate={mood === "cheer" ? { scaleX: [1, 0.7, 1], opacity: [1, 0.6, 1] } : { scaleX: 1, opacity: 1 }}
        transition={mood === "cheer" ? loop(0.62, { ease: "easeOut", repeatDelay: 0.12 }) : { duration: 0.3 }}
      />

      <motion.g style={{ ...VB, originX: "80px", originY: "160px" }} animate={body}>
        {/* idea spark */}
        <motion.g animate={{ y: [0, -5, 0] }} transition={loop(2.4)}>
          <circle cx="80" cy="14" r="20" fill={`url(#${id("glow")})`} />
          <motion.path
            d="M80 0 C81.6 8 84 10.4 92 12 C84 13.6 81.6 16 80 24 C78.4 16 76 13.6 68 12 C76 10.4 78.4 8 80 0 Z"
            fill={`url(#${id("spark")})`}
            style={{ ...VB, originX: "80px", originY: "12px" }}
            animate={{ rotate: [0, 12, -8, 0], scale: happy || mood === "wow" ? [1, 1.25, 1] : [1, 1.08, 1] }}
            transition={loop(happy ? 0.8 : 2.8)}
          />
          <circle cx="76.5" cy="9" r="1.8" fill="#fff" opacity="0.9" />
        </motion.g>

        {/* bookmark ribbon tail */}
        <motion.path
          d="M106 138 L106 158 L111 153 L116 158 L116 138 Z"
          fill={`url(#${id("ribbon")})`}
          style={{ ...VB, originX: "111px", originY: "138px" }}
          animate={{ rotate: mood === "cheer" ? [-14, 14, -14] : [-5, 5, -5] }}
          transition={loop(mood === "cheer" ? 0.6 : 2.6)}
        />

        {/* feet */}
        <ellipse cx="60" cy="150" rx="15" ry="8" fill="#062c82" />
        <ellipse cx="100" cy="150" rx="15" ry="8" fill="#062c82" />
        <ellipse cx="56" cy="147" rx="6" ry="2.4" fill="#2d6fe0" opacity="0.7" />
        <ellipse cx="96" cy="147" rx="6" ry="2.4" fill="#2d6fe0" opacity="0.7" />

        {/* back cover and page block (book thickness) */}
        <rect x="42" y="30" width="94" height="112" rx="24" fill={`url(#${id("back")})`} />
        <rect x="38" y="33" width="92" height="110" rx="23" fill={`url(#${id("pages")})`} />
        <g stroke="#e3cc9f" strokeWidth="1.3" fill="none" opacity="0.9">
          <path d="M126 52 C129 70 129 108 126 126" />
          <path d="M122.5 46 C126 66 126 112 122.5 132" />
          <path d="M70 36.5 C88 34.5 106 34.5 118 37" />
        </g>

        {/* front cover */}
        <rect x="24" y="40" width="96" height="108" rx="26" fill={`url(#${id("cover")})`} />
        <rect x="32" y="48" width="80" height="92" rx="19" fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="2" />
        <path d="M36 58 C38 49 46 44 58 44" stroke="rgba(255,255,255,.55)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <ellipse cx="44" cy="70" rx="5" ry="10" fill="rgba(255,255,255,.12)" transform="rotate(18 44 70)" />
        {/* cover emblem */}
        <path d="M72 128 C72.8 132 74 133.2 78 134 C74 134.8 72.8 136 72 140 C71.2 136 70 134.8 66 134 C70 133.2 71.2 132 72 128 Z" fill="#ffc928" opacity="0.95" />

        {/* cheeks */}
        <ellipse cx="40" cy="104" rx="9" ry="5" fill="#ff8fb1" opacity={happy ? 0.75 : 0.45} />
        <ellipse cx="104" cy="104" rx="9" ry="5" fill="#ff8fb1" opacity={happy ? 0.75 : 0.45} />

        {/* eyes */}
        {happy ? (
          <g stroke="#0d1b36" strokeWidth="5" strokeLinecap="round" fill="none">
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
        <g stroke="#0d1b36" strokeWidth="3.6" strokeLinecap="round" fill="none">
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
            <path d="M60 104 Q72 104 84 104 Q83 120 72 120 Q61 120 60 104 Z" fill="#0d1b36" />
            <path d="M65 114 Q72 109 79 114 Q76 119 72 119 Q68 119 65 114 Z" fill="#ff6b8a" />
          </g>
        ) : mood === "sad" ? (
          <path d="M63 112 Q72 104 81 112" stroke="#0d1b36" strokeWidth="4" fill="none" strokeLinecap="round" />
        ) : mood === "wow" ? (
          <ellipse cx="72" cy="110" rx="6" ry="7.5" fill="#0d1b36" />
        ) : mood === "think" ? (
          <path d="M66 110 Q73 107 80 109" stroke="#0d1b36" strokeWidth="4" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M62 105 Q72 115 82 105" stroke="#0d1b36" strokeWidth="4" fill="none" strokeLinecap="round" />
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
              fill={i % 2 ? "#ffc928" : "#7eb6ff"}
              style={{ transformBox: "fill-box", originX: 0.5, originY: 0.5 }}
              animate={{ scale: [0, 1.2, 0], rotate: [0, 90] }}
              transition={loop(1.1, { delay: d })}
            />
          ))}
      </motion.g>
    </motion.svg>
  );
}
