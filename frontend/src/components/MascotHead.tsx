import React, { useEffect, useMemo, useId } from 'react';
import { motion, useAnimation } from 'framer-motion';

export type UIEmotion =
  | 'smiling'
  | 'thinking'
  | 'speaking'
  | 'sad';

interface Props {
  emotion?: UIEmotion;
  speaking?: boolean;
  className?: string;
}

const TOKENS = {
  black: '#1D2434',
  pink:  '#F7AEC8',
  blue:  '#8FD6FF',
  stroke:'#1D2434',
  white: '#FFFFFF'
};

// Helper: consistent rounded-capsule path with identical commands for morphing
function capsulePath(cx: number, cy: number, rx: number, ry: number) {
  const k = 0.552284749831; // cubic approximation for circles
  const ox = rx * k;
  const oy = ry * k;
  // M + 4 cubic curves + Z (identical command count for all shapes)
  return [
    `M ${cx + rx} ${cy}`,
    `C ${cx + rx} ${cy - oy} ${cx + ox} ${cy - ry} ${cx} ${cy - ry}`,
    `C ${cx - ox} ${cy - ry} ${cx - rx} ${cy - oy} ${cx - rx} ${cy}`,
    `C ${cx - rx} ${cy + oy} ${cx - ox} ${cy + ry} ${cx} ${cy + ry}`,
    `C ${cx + ox} ${cy + ry} ${cx + rx} ${cy + oy} ${cx + rx} ${cy}`,
    'Z',
  ].join(' ');
}

export default function MascotHead({
  emotion = 'smiling',
  speaking = false,
  className = '',
}: Props) {
  const floatCtrls   = useAnimation();
  const blinkCtrls   = useAnimation();
  const browCtrls    = useAnimation();
  const earCtrls     = useAnimation();
  const jawCtrls     = useAnimation();
  const headBobCtrl  = useAnimation();

  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  // Unique, URL-safe clipPath id
  const rawId = useId();
  const clipId = useMemo(() => `mouthClip-${rawId}`, [rawId]);

  // Viseme-like cycle for speaking (rest → U → O → A → E → rest)
  const speakingCycle = useMemo(() => {
    const cx = 100, cy = 152;
    return [
      capsulePath(cx, cy, 12, 6),   // Rest (narrow)
      capsulePath(cx, cy, 9, 10),   // U (tall-narrow)
      capsulePath(cx, cy, 10, 12),  // O (round)
      capsulePath(cx, cy, 14, 9),   // A (wide open)
      capsulePath(cx, cy, 18, 5),   // E (stretched)
      capsulePath(cx, cy, 12, 6),   // Back to rest
    ];
  }, []);

  // Static shapes by emotion
  const staticMouthD = useMemo(() => {
    switch (emotion) {
      case 'sad':
        return capsulePath(100, 154, 9, 5);   // lower & smaller
      case 'thinking':
        return capsulePath(100, 152, 10, 4);  // flatter
      case 'smiling':
      default:
        return capsulePath(100, 150, 12, 5);  // subtle cavity under smile stroke
    }
  }, [emotion]);

  // Variants for the inner mouth path (filled shape)
  const innerMouthVariants = useMemo(
    () => ({
      static: { d: staticMouthD, transition: { duration: 0.18, ease: 'easeOut' } },
      talking: {
        d: speakingCycle,
        transition: { duration: 0.7, ease: 'easeInOut', repeat: Infinity },
      },
    }),
    [staticMouthD, speakingCycle]
  );

  // Subtle teeth/tongue motion while talking
  const oralRepeat = { duration: 0.6, ease: 'easeInOut', repeat: Infinity } as const;

  const getMouthPath = (e: UIEmotion) => {
    switch (e) {
      case 'smiling':
        return 'M75 150 Q100 165 125 150';
      case 'thinking':
        return 'M85 152 L115 152';
      case 'sad':
        return 'M75 160 Q100 145 125 160';
      case 'speaking':
        return 'M75 150 Q100 165 125 150';
      default:
        return 'M75 150 Q100 165 125 150';
    }
  };

  const mouthVariants = {
    static: {
      d: getMouthPath(emotion),
      transition: { duration: 0.2 }
    },
    talking: {
      d: [
        'M75 150 Q100 165 125 150',
        'M73 152 Q100 162 127 152',
        'M77 151 Q100 168 123 151',
        'M75 150 Q100 165 125 150',
      ],
      transition: {
        duration: 0.5,
        ease: 'easeInOut',
        repeat: Infinity,
      },
    },
  };

  useEffect(() => {
    if (!prefersReducedMotion) {
      floatCtrls.start({
        y: [0, -5, 0],
        transition: { duration: 4, ease: 'easeInOut', repeat: Infinity },
      });
    }
  }, [prefersReducedMotion, floatCtrls]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    let live = true;
    (async () => {
      while (live) {
        await new Promise((r) => setTimeout(r, Math.random() * 2000 + 2000));
        if (live && emotion !== 'sad') {
          await blinkCtrls.start({
            scaleY: [1, 0.05, 1],
            transition: { duration: 0.12 },
          });
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [emotion, prefersReducedMotion, blinkCtrls]);

  useEffect(() => {
    browCtrls.start({
      y: emotion === 'thinking' ? -6 : 0,
      transition: { duration: 0.25 },
    });
  }, [emotion, browCtrls]);

  useEffect(() => {
    if (emotion === 'thinking' && !prefersReducedMotion) {
      earCtrls.start({
        rotate: [-3, 3, -3],
        transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
      });
    } else {
      earCtrls.start({ rotate: 0, transition: { duration: 0.25 } });
    }
  }, [emotion, earCtrls, prefersReducedMotion]);

  useEffect(() => {
    if (speaking && emotion === 'speaking' && !prefersReducedMotion) {
      jawCtrls.start({
        y: [0, 6, 0],
        transition: { duration: 0.45, repeat: Infinity, ease: 'easeInOut' },
      });
      headBobCtrl.start({
        rotate: [0, 2, -2, 0],
        transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
      });
    } else {
      jawCtrls.start({ y: 0, transition: { duration: 0.15 } });
      headBobCtrl.start({ rotate: 0, transition: { duration: 0.3 } });
    }
  }, [speaking, emotion, jawCtrls, headBobCtrl, prefersReducedMotion]);

  return (
    <motion.div
      animate={floatCtrls}
      className={className}
      style={{ width: 280, height: 280 }}
    >
      <motion.svg
        viewBox="0 0 200 200"
        width="100%"
        height="100%"
        aria-label="Panda mascot"
        animate={headBobCtrl}
      >
        <defs>
          <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="5"
              floodColor="#000"
              floodOpacity="0.15"
            />
          </filter>
          {/* Define clipPath up-front so it exists before reference */}
          <clipPath id={clipId}>
            <motion.path
              variants={innerMouthVariants}
              animate={
                speaking && emotion === 'speaking' && !prefersReducedMotion
                  ? 'talking'
                  : 'static'
              }
            />
          </clipPath>
        </defs>

        <g filter="url(#s)">
          <ellipse
            cx="100"
            cy="100"
            rx="70"
            ry="66"
            fill={TOKENS.white}
            stroke="#E5E7EB"
            strokeWidth="1"
          />

          <motion.circle
            cx="58"
            cy="45"
            r="26"
            fill={TOKENS.black}
            animate={earCtrls}
          />
          <motion.circle
            cx="142"
            cy="45"
            r="26"
            fill={TOKENS.black}
            animate={earCtrls}
          />
          <circle cx="58" cy="45" r="10" fill={TOKENS.pink} />
          <circle cx="142" cy="45" r="10" fill={TOKENS.pink} />

          <ellipse
            cx="70"
            cy="95"
            rx="20"
            ry="28"
            fill={TOKENS.black}
            transform="rotate(-8 70 95)"
          />
          <ellipse
            cx="130"
            cy="95"
            rx="20"
            ry="28"
            fill={TOKENS.black}
            transform="rotate(8 130 95)"
          />

          <ellipse cx="70" cy="95" rx="13" ry="11" fill={TOKENS.white} />
          <ellipse cx="130" cy="95" rx="13" ry="11" fill={TOKENS.white} />

          <motion.circle
            cx="70"
            cy="97"
            r={emotion === 'sad' ? 4 : 6}
            fill={TOKENS.black}
            animate={blinkCtrls}
          />
          <motion.circle
            cx="130"
            cy="97"
            r={emotion === 'sad' ? 4 : 6}
            fill={TOKENS.black}
            animate={blinkCtrls}
          />

          <circle cx="72" cy="93" r="2" fill={TOKENS.white} opacity="0.9" />
          <circle cx="132" cy="93" r="2" fill={TOKENS.white} opacity="0.9" />

          {emotion === 'thinking' && (
            <motion.g animate={browCtrls}>
              <path
                d="M55 75 Q70 65 85 75"
                stroke={TOKENS.black}
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M115 75 Q130 65 145 75"
                stroke={TOKENS.black}
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
            </motion.g>
          )}

          <path
            d="M96 115 a4 4 0 0 1 8 0 q0 5 -4 8 q-4 -3 -4 -8Z"
            fill={TOKENS.black}
          />

          {/* Mouth rendering - use advanced speaking or simple expressions */}
          {speaking && emotion === 'speaking' ? (
            // Advanced speaking mouth with teeth and tongue
            <motion.g animate={jawCtrls}>
              {/* Inner mouth (cavity) */}
              <motion.path
                fill={TOKENS.black}
                stroke={TOKENS.stroke}
                strokeWidth="2"
                variants={innerMouthVariants}
                animate={
                  !prefersReducedMotion ? 'talking' : 'static'
                }
              />

              {/* Teeth (top bar), clipped to the mouth shape */}
              <motion.rect
                clipPath={`url(#${clipId})`}
                x={80}
                y={142}
                width={40}
                height={8}
                rx={3}
                fill={TOKENS.white}
                initial={{ scaleY: 0.9, y: 142 }}
                animate={
                  !prefersReducedMotion
                    ? { scaleY: [0.9, 1.05, 0.9], y: [142, 141.5, 142], transition: oralRepeat }
                    : { scaleY: 1, y: 142 }
                }
                style={{ transformOrigin: '100px 146px' }}
              />

              {/* Tongue, clipped, with a gentle bounce while talking */}
              <motion.path
                clipPath={`url(#${clipId})`}
                d="M84 158 Q100 170 116 158 Q100 162 84 158 Z"
                fill={TOKENS.pink}
                initial={{ y: 0 }}
                animate={
                  !prefersReducedMotion
                    ? { y: [0, -1.5, 0], transition: oralRepeat }
                    : { y: 0 }
                }
              />
            </motion.g>
          ) : (
            // Simple expression strokes for non-speaking states
            <motion.g animate={jawCtrls}>
              <motion.path
                fill="none"
                stroke={TOKENS.stroke}
                strokeWidth="3"
                strokeLinecap="round"
                variants={mouthVariants}
                animate="static"
              />
            </motion.g>
          )}

          {emotion === 'thinking' && !prefersReducedMotion && (
            <motion.g
              key="think"
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: [0, -5, -10, -15],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 1,
              }}
            >
              <circle cx="155" cy="40" r="3" fill="#6a6a6a" />
              <circle cx="165" cy="30" r="4" fill="#6a6a6a" />
              <circle cx="177" cy="20" r="5" fill="#6a6a6a" />
            </motion.g>
          )}

        </g>
      </motion.svg>
    </motion.div>
  );
}