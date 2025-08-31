import { motion } from 'framer-motion'
import { useState } from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function EntryScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const { login } = useAuth()

  const canGo = name.trim().length > 1 && /.+@.+\..+/.test(email)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (canGo) {
      login({ name, email })
    }
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-900 text-zinc-200 font-sans flex items-center justify-center p-6">
      {/* Animated background */}
      <div className="absolute inset-0 z-0 opacity-50">
        <div className="absolute inset-0 bg-gradient-to-tr from-brand-900 via-slate-900 to-brand-800 animate-gradient-move" />
      </div>

      <div className="relative z-10 h-full flex items-center justify-center">
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-2xl w-full max-w-md p-10 shadow-2xl"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-brand-500/20 grid place-items-center">
                <Sparkles className="text-brand-400" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white">Meet Your AI Tutor, Momo</h1>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-400 mb-2">Your name</label>
                <motion.input
                    whileFocus={{ scale: 1.02, transition: { duration: 0.1 } }}
                    className="w-full rounded-xl px-4 py-3 bg-zinc-900/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Ada Lovelace"
                    value={name}
                    onChange={(e)=>setName(e.target.value)}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Email</label>
                <motion.input
                    whileFocus={{ scale: 1.02, transition: { duration: 0.1 } }}
                    className="w-full rounded-xl px-4 py-3 bg-zinc-900/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="ada@analytical.engine"
                    type="email"
                    value={email}
                    onChange={(e)=>setEmail(e.target.value)}
                />
            </div>
            <motion.button
                whileTap={{ scale: 0.98 }}
                whileHover={{ y: -2 }}
                type="submit"
                disabled={!canGo}
                className="mt-8 w-full btn-primary disabled:opacity-50 group"
            >
                Step Inside
                <ArrowRight className="w-5 h-5 ml-2 transform transition-transform group-hover:translate-x-1" />
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  )
}