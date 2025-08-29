import React, { useEffect } from 'react'
import { motion, useAnimation } from 'framer-motion'

export type UIEmotion = 'smiling' | 'thinking' | 'speaking' | 'sad'

interface Props {
  emotion?: UIEmotion
  speaking?: boolean
  className?: string
}

export default function MascotHead({ emotion = 'smiling', speaking = false, className = "" }: Props) {
  const floatCtrls = useAnimation()
  const blinkCtrls = useAnimation()
  const browCtrls = useAnimation()
  const earCtrls = useAnimation()
  const jawCtrls = useAnimation()

  // Respect reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Floating animation when speaking
  useEffect(() => {
    if (speaking && !prefersReducedMotion) {
      floatCtrls.start({ 
        y: [0, -8, 0], 
        transition: { duration: 2, ease: "easeInOut", repeat: Infinity } 
      })
    } else {
      floatCtrls.start({ y: 0, transition: { duration: 0.3 } })
    }
  }, [speaking, floatCtrls, prefersReducedMotion])

  // Natural blinking
  useEffect(() => {
    if (prefersReducedMotion) return
    
    let live = true
    ;(async () => {
      while (live) {
        await new Promise(r => setTimeout(r, Math.random() * 3000 + 2500))
        if (live && emotion !== 'sad') {
          await blinkCtrls.start({ 
            scaleY: [1, 0.1, 1], 
            transition: { duration: 0.15 } 
          })
        }
      }
    })()
    return () => { live = false }
  }, [blinkCtrls, emotion, prefersReducedMotion])

  // Eyebrow animation for thinking
  useEffect(() => {
    if (emotion === 'thinking' && !prefersReducedMotion) {
      browCtrls.start({ 
        y: -3,
        transition: { duration: 0.25 } 
      })
    } else {
      browCtrls.start({ y: 0, transition: { duration: 0.25 } })
    }
  }, [emotion, browCtrls, prefersReducedMotion])

  // Ear wiggle for thinking
  useEffect(() => {
    if (emotion === 'thinking' && !prefersReducedMotion) {
      earCtrls.start({
        rotate: [-3, 3, -3],
        transition: { duration: 1.4, ease: "easeInOut", repeat: Infinity }
      })
    } else {
      earCtrls.start({ rotate: 0, transition: { duration: 0.3 } })
    }
  }, [emotion, earCtrls, prefersReducedMotion])

  // Jaw movement for speaking
  useEffect(() => {
    if (speaking && emotion === 'speaking' && !prefersReducedMotion) {
      jawCtrls.start({ 
        y: [0, 3, 0], 
        transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" } 
      })
    } else {
      jawCtrls.start({ y: 0, transition: { duration: 0.2 } })
    }
  }, [speaking, emotion, jawCtrls, prefersReducedMotion])

  // Mouth shapes based on emotion - much more pronounced
  const getMouthPath = () => {
    switch (emotion) {
      case 'smiling':
        return "M82 142 Q100 160 118 142"
      case 'thinking':
        return "M90 148 L110 148"
      case 'sad':
        return "M82 155 Q100 142 118 155"
      default:
        return "M82 142 Q100 160 118 142"
    }
  }

  const mouthVariants = {
    static: { 
      d: getMouthPath(),
      transition: { duration: 0.2 }
    },
    talking: { 
      d: [
        "M78 148 Q100 175 122 148", // Wide open
        "M85 145 Q100 165 115 145", // Medium
        "M88 143 Q100 155 112 143", // Small
        "M85 145 Q100 165 115 145", // Medium
      ],
      transition: { duration: 0.5, ease: "easeInOut", repeat: Infinity }
    }
  }

  return (
    <motion.div animate={floatCtrls} className={className}>
      <svg viewBox="0 0 200 200" style={{ width: 280, height: 280 }}>
        {/* Main head - perfect circle */}
        <circle 
          cx="100" 
          cy="100" 
          r="65" 
          fill="#FFFFFF" 
          stroke="#E8E8E8" 
          strokeWidth="1.5"
        />

        {/* Left ear - more natural position and size */}
        <motion.circle 
          cx="68" 
          cy="58" 
          r="22" 
          fill="#1a1a1a"
          animate={earCtrls}
        />
        
        {/* Right ear */}
        <motion.circle 
          cx="132" 
          cy="58" 
          r="22" 
          fill="#1a1a1a"
          animate={earCtrls}
        />

        {/* Inner ears - more subtle pink */}
        <motion.circle 
          cx="68" 
          cy="60" 
          r="9" 
          fill="#F5A5B8"
          animate={earCtrls}
        />
        <motion.circle 
          cx="132" 
          cy="60" 
          r="9" 
          fill="#F5A5B8"
          animate={earCtrls}
        />

        {/* Eye patches - more natural teardrop shapes */}
        <ellipse 
          cx="76" 
          cy="88" 
          rx="19" 
          ry="26" 
          fill="#1a1a1a"
          transform="rotate(-12 76 88)"
        />
        
        <ellipse 
          cx="124" 
          cy="88" 
          rx="19" 
          ry="26" 
          fill="#1a1a1a"
          transform="rotate(12 124 88)"
        />

        {/* Eye whites - slightly larger */}
        <ellipse cx="76" cy="90" rx="13" ry="11" fill="#FFFFFF" />
        <ellipse cx="124" cy="90" rx="13" ry="11" fill="#FFFFFF" />

        {/* Pupils */}
        <motion.circle 
          cx="76" 
          cy="92" 
          r={emotion === 'sad' ? "4.5" : "6.5"} 
          fill="#1a1a1a"
          animate={blinkCtrls}
          style={{ originY: 0.5 }}
        />
        <motion.circle 
          cx="124" 
          cy="92" 
          r={emotion === 'sad' ? "4.5" : "6.5"} 
          fill="#1a1a1a"
          animate={blinkCtrls}
          style={{ originY: 0.5 }}
        />

        {/* Eye highlights */}
        <circle cx="78" cy="89" r="2.5" fill="#FFFFFF" opacity="0.9" />
        <circle cx="126" cy="89" r="2.5" fill="#FFFFFF" opacity="0.9" />

        {/* Eyebrows for thinking */}
        {emotion === 'thinking' && (
          <motion.g animate={browCtrls}>
            <path 
              d="M62 76 Q76 70 90 76" 
              stroke="#4a4a4a" 
              strokeWidth="3" 
              fill="none" 
              strokeLinecap="round"
            />
            <path 
              d="M110 76 Q124 70 138 76" 
              stroke="#4a4a4a" 
              strokeWidth="3" 
              fill="none" 
              strokeLinecap="round"
            />
          </motion.g>
        )}

        {/* Nose - slightly larger and more defined */}
        <path 
          d="M97 112 L103 112 L100 118 Z" 
          fill="#2a2a2a"
        />

        {/* Upper teeth line - stays static for realism */}
        <path 
          d="M85 135 Q100 133 115 135" 
          stroke="#F0F0F0" 
          strokeWidth="2" 
          fill="none" 
        />

        {/* Animated jaw group */}
        <motion.g animate={jawCtrls}>
          {/* Mouth - much more pronounced movement */}
          <motion.path 
            fill="none"
            stroke="#2a2a2a" 
            strokeWidth="3"
            strokeLinecap="round"
            variants={mouthVariants}
            animate={speaking && emotion === 'speaking' ? 'talking' : 'static'}
          />
        </motion.g>

        {/* Subtle cheek definition - no pink blush for more natural look */}
        {(emotion === 'smiling' || emotion === 'speaking') && (
          <>
            <circle 
              cx="52" 
              cy="108" 
              r="6" 
              fill="#F8F8F8" 
              opacity="0.8"
            />
            <circle 
              cx="148" 
              cy="108" 
              r="6" 
              fill="#F8F8F8" 
              opacity="0.8"
            />
          </>
        )}

        {/* Sad tear */}
        {emotion === 'sad' && !prefersReducedMotion && (
          <motion.ellipse 
            cx="68" 
            cy="98" 
            rx="2" 
            ry="12" 
            fill="#87CEEB"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              y: [0, 15, 20, 25]
            }}
            transition={{ 
              duration: 2.5, 
              repeat: Infinity,
              repeatDelay: 1.5
            }}
          />
        )}

        {/* Thinking dots */}
        {emotion === 'thinking' && !prefersReducedMotion && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              y: [0, -8, -12, -18]
            }}
            transition={{ 
              duration: 1.8, 
              repeat: Infinity,
              repeatDelay: 0.8
            }}
          >
            <circle cx="140" cy="48" r="2.5" fill="#666" />
            <circle cx="152" cy="42" r="3.5" fill="#666" />
            <circle cx="164" cy="36" r="4.5" fill="#666" />
          </motion.g>
        )}
      </svg>
    </motion.div>
  )
}
