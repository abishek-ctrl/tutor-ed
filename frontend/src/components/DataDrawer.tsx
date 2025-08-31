import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { uploadDocs } from '../services/api'
import UploadZone from './UploadZone'
import { CheckCircle } from 'lucide-react'

type Doc = { source: string; snippet: string }

type Props = {
  open: boolean
  onClose: () => void
  email: string
  selectedDocs: string[]
  onSelectionChange: (newSelection: string[]) => void
  allDocs: Doc[]
  onRefresh: () => Promise<void>
}

export default function DataDrawer({ open, onClose, email, selectedDocs, onSelectionChange, allDocs, onRefresh }: Props) {
  const [queue, setQueue] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [successMessage, setSuccessMessage] = useState('');

  async function doUpload() {
    if (!queue.length) return
    setBusy(true)
    setSuccessMessage('');
    try {
      await uploadDocs(email, queue)
      const newDocNames = queue.map((f) => f.name)
      await onRefresh()
      setQueue([])
      onSelectionChange([...new Set([...selectedDocs, ...newDocNames])])
      setSuccessMessage('Upload successful!');
      setTimeout(() => setSuccessMessage(''), 4000); // Clear message after 4 seconds
    } catch (e: any) {
      alert('Upload failed: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  function handleToggleDoc(source: string) {
    const newSelection = new Set(selectedDocs)
    if (newSelection.has(source)) {
      newSelection.delete(source)
    } else {
      newSelection.add(source)
    }
    onSelectionChange(Array.from(newSelection))
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur" onClick={onClose} />
          <motion.div
            className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-slate-900 text-white shadow-2xl p-6 overflow-y-auto"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Manage Sources</h3>
              <button onClick={onClose} className="btn-ghost">Close</button>
            </div>
            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Indexed documents for this session</h4>
                <button onClick={onRefresh} className="btn-ghost text-xs" disabled={busy}>Refresh</button>
              </div>
              <p className="text-sm text-zinc-400 mb-4">Select the documents Momo should use in this conversation.</p>
              {allDocs.length === 0 && <div className="text-sm text-white/60">No documents yet.</div>}
              <ul className="space-y-2 mt-2 max-h-64 overflow-y-auto scrollbar-thin pr-2">
                {allDocs.map((d: any) => (
                  <li
                    key={d.source}
                    onClick={() => handleToggleDoc(d.source)}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedDocs.includes(d.source) ? 'border-brand-500 bg-brand-500/10' : 'border-zinc-700 bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-start">
                      <input type="checkbox" checked={selectedDocs.includes(d.source)} readOnly className="mt-1 mr-3 h-4 w-4 rounded border-gray-600 bg-gray-700 text-brand-600 focus:ring-brand-500" />
                      <div>
                        <div className="text-sm font-mono">{d.source}</div>
                        {d.snippet && <div className="text-xs text-white/70 mt-1">{d.snippet}</div>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="my-6 border-t border-white/10 pt-6">
              <div className="text-base font-semibold mb-2">Upload more documents</div>
              <UploadZone onFiles={(f) => setQueue((prev) => [...prev, ...f])} />
              {queue.length > 0 && <div className="mt-2 text-xs text-white/70">Selected: {queue.map((f, i) => (<span key={i} className="mr-2">{f.name}</span>))}</div>}
              <button onClick={doUpload} disabled={busy || queue.length === 0} className="mt-3 btn-primary disabled:opacity-50">
                {busy ? 'Indexing…' : 'Upload & Index'}
              </button>
               <AnimatePresence>
                {successMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2 text-sm text-green-400 mt-3"
                  >
                    <CheckCircle size={16} />
                    <span>{successMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}