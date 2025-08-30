import React, { useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';

export type UIEmotion =
  | 'smiling'
  | 'thinking'
  | 'speaking'
  | 'sad'
  | 'celebrate';

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

export default function MascotHead({
  emotion = 'smiling',
  speaking = false,
  className = '',
}: Props) {
  const floatCtrls  = useAnimation();
  const blinkCtrls  = useAnimation();
  const browCtrls   = useAnimation();
  const earCtrls    = useAnimation();
  const jawCtrls    = useAnimation();
  const headBobCtrl = useAnimation();
  const confetti    = useAnimation();

  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

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
        await new Promise((r) =>
          setTimeout(r, Math.random() * 2000 + 2000),
        );
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

  useEffect(() => {
    if (emotion === 'celebrate') {
      confetti.set({ opacity: 1, scale: 0 });
      confetti.start({
        scale: [0, 1.2],
        opacity: [1, 0],
        transition: { duration: 1 },
      });
    }
  }, [emotion, confetti]);

  const mouthFor = (e: UIEmotion) => {
    switch (e) {
      case 'smiling':
        return 'M70 150 Q100 175 130 150';
      case 'thinking':
        return 'M80 152 L120 152';
      case 'sad':
        return 'M70 160 Q100 135 130 160';
      default:
        return 'M70 150 Q100 175 130 150';
    }
  };

  const mouthVariants = {
    static: { d: mouthFor(emotion), transition: { duration: 0.15 } },
    talking: {
      d: [
        'M68 149 Q100 180 132 149',
        'M75 149 Q100 168 125 149',
        'M82 149 Q100 158 118 149',
      ],
      transition: {
        duration: 0.6,
        ease: 'easeInOut',
        repeat: Infinity,
      },
    },
  };

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

          <motion.g animate={jawCtrls}>
            <motion.path
              fill="none"
              stroke={TOKENS.stroke}
              strokeWidth="4"
              strokeLinecap="round"
              variants={mouthVariants}
              animate={
                speaking && emotion === 'speaking' ? 'talking' : 'static'
              }
            />
          </motion.g>

          {emotion === 'sad' && !prefersReducedMotion && (
            <motion.ellipse
              cx="65"
              cy="105"
              rx="3"
              ry="12"
              fill={TOKENS.blue}
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                x: [0, 2, 4],
                y: [0, 15, 30, 42],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                repeatDelay: 1.2,
              }}
            />
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

          {emotion === 'celebrate' && (
            <motion.g animate={confetti}>
              <circle cx="40" cy="40" r="4" fill="#ffcf5c" />
              <circle cx="160" cy="50" r="3" fill="#7be3aa" />
              <circle cx="90" cy="25" r="3" fill="#f78181" />
            </motion.g>
          )}
        </g>
      </motion.svg>
    </motion.div>
  );
}