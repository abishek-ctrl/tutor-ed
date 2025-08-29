import { motion } from 'framer-motion'
import { useState } from 'react'
import { Sparkles } from 'lucide-react'

export default function EntryScreen({ onSubmit }: { onSubmit: (u: {name:string; email:string}) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const canGo = name.trim().length > 1 && /.+@.+\..+/.test(email)

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-200 via-purple-200 to-pink-200 dark:from-zinc-900 dark:via-black dark:to-zinc-900" />
      <div className="absolute inset-0 backdrop-blur-2xl bg-white/10 dark:bg-black/30" />
      <div className="relative z-10 h-full flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="glass rounded-3xl w-full max-w-xl p-10"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <Sparkles className="text-purple-600 dark:text-purple-400" />
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Meet Your AI Tutor</h1>
          </div>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Your name</label>
          <input
            className="w-full mb-4 rounded-2xl px-4 py-3 bg-white/70 dark:bg-zinc-900/60 border border-white/40 dark:border-white/10 outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="Ada Lovelace"
            value={name}
            onChange={(e)=>setName(e.target.value)}
          />

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Email</label>
          <input
            className="w-full rounded-2xl px-4 py-3 bg-white/70 dark:bg-zinc-900/60 border border-white/40 dark:border-white/10 outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="ada@analytical.engine"
            type="email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
          />

          <motion.button
            whileTap={{ scale: 0.98 }}
            whileHover={{ y: -1 }}
            onClick={()=> canGo && onSubmit({ name, email })}
            disabled={!canGo}
            className="mt-8 w-full btn-primary rounded-2xl disabled:opacity-50"
          >
            Step Inside
          </motion.button>
        </motion.div>
      </div>
    </div>
  )
}
