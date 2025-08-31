import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
}

export default function ConfirmationModal({ isOpen, onClose, onConfirm, title, message }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          {/* Modal Panel */}
          <motion.div
            className="relative w-full max-w-md rounded-2xl bg-slate-800 border border-white/10 p-6 shadow-xl"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="flex items-start gap-4">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20 sm:mx-0">
                <AlertTriangle className="h-6 w-6 text-red-400" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-xl font-display font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{message}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <motion.button
                whileTap={{ scale: 0.98 }} whileHover={{ y: -1 }}
                onClick={onClose}
                className="btn-ghost"
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }} whileHover={{ y: -1 }}
                onClick={() => {
                  onConfirm()
                  onClose()
                }}
                className="btn-primary bg-red-600 hover:bg-red-700"
              >
                Confirm
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}