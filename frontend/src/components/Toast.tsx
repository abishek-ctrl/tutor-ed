import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
  message: string
}

export default function Toast({ isOpen, onClose, message }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed bottom-10 left-1/2 z-50"
          initial={{ opacity: 0, y: 20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 20, x: '-50%' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="flex items-center gap-3 rounded-full bg-green-500/90 backdrop-blur-sm border border-white/20 px-6 py-3 shadow-2xl">
            <CheckCircle className="h-6 w-6 text-white" />
            <p className="text-white font-medium">{message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}