import { motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function EntryScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const { login } = useAuth()

  const canGo = name.trim().length > 1 && /.+@.+\..+/.test(email)

  function handleSubmit() {
    if (canGo) {
      login({ name, email })
      // Navigation is now handled by the effect in App.tsx
    }
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-zinc-900 text-zinc-200 font-sans">
      <div className="relative z-10 h-full flex items-center justify-center p-6">
        <motion.div
          className="bg-zinc-800 rounded-2xl w-full max-w-md p-10"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <Sparkles className="text-brand-500" />
            <h1 className="text-4xl font-display font-bold text-white">Meet Your AI Tutor, Momo</h1>
          </div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Your name</label>
          <motion.input
            whileFocus={{ scale: 1.02, transition: { duration: 0.1 } }}
            className="w-full mb-4 rounded-xl px-4 py-3 bg-zinc-700 border border-zinc-600 text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Ada Lovelace"
            value={name}
            onChange={(e)=>setName(e.target.value)}
          />
          <label className="block text-sm font-medium text-zinc-400 mb-2">Email</label>
          <motion.input
            whileFocus={{ scale: 1.02, transition: { duration: 0.1 } }}
            className="w-full rounded-xl px-4 py-3 bg-zinc-700 border border-zinc-600 text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="ada@analytical.engine"
            type="email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ y: -2 }}
            onClick={handleSubmit}
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