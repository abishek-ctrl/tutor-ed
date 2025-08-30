import { motion } from 'framer-motion'
import { useState } from 'react'
import { Sparkles } from 'lucide-react'

export default function EntryScreen({ onSubmit }: { onSubmit: (u: {name:string; email:string}) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const canGo = name.trim().length > 1 && /.+@.+\..+/.test(email)

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-zinc-900 text-zinc-200 font-sans">
      <div className="relative z-10 h-full flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="bg-zinc-800 rounded-2xl w-full max-w-md p-10"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <Sparkles className="text-brand-500" />
            <h1 className="text-4xl font-serif font-bold text-white">Meet Your AI Tutor</h1>
          </div>

          <label className="block text-sm font-medium text-zinc-400 mb-2">Your name</label>
          <input
            className="w-full mb-4 rounded-xl px-4 py-3 bg-zinc-700 border border-zinc-600 text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Ada Lovelace"
            value={name}
            onChange={(e)=>setName(e.target.value)}
          />

          <label className="block text-sm font-medium text-zinc-400 mb-2">Email</label>
          <input
            className="w-full rounded-xl px-4 py-3 bg-zinc-700 border border-zinc-600 text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
            className="mt-8 w-full btn-primary disabled:opacity-50"
          >
            Step Inside
          </motion.button>
        </motion.div>
      </div>
    </div>
  )
}