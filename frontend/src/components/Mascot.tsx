import { motion, useAnimation } from 'framer-motion'
import { useEffect } from 'react'

export default function Mascot({ emotion='happy', speaking=false }: { emotion?: 'happy'|'thinking'|'explaining'; speaking?: boolean }) {
  const controls = useAnimation()

  useEffect(()=>{
    controls.start({
      scale: speaking ? [1, 1.02, 1] : 1,
      transition: speaking ? { repeat: Infinity, duration: 1.2 } : { duration: 0.2 }
    })
  }, [speaking])

  // basic face with animated mouth for "speaking"
  const mouthHeight = speaking ? 14 : (emotion==='happy' ? 8 : 4)

  return (
    <motion.div animate={controls} className="relative w-72 h-72 rounded-full glass flex items-center justify-center">
      <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/60 to-white/30 dark:from-zinc-800/60 dark:to-zinc-900/30" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex gap-10 mb-6">
          <div className="w-8 h-8 rounded-full bg-black/80 dark:bg-white/90" />
          <div className="w-8 h-8 rounded-full bg-black/80 dark:bg-white/90" />
        </div>
        <div className="w-24 rounded-full bg-black/80 dark:bg-white/90" style={{ height: mouthHeight, transition: 'height 120ms' }} />
        <div className="mt-4 text-xs text-zinc-600 dark:text-zinc-300">I’m {emotion}!</div>
      </div>
    </motion.div>
  )
}
