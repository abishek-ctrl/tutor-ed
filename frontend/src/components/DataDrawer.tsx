import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import UploadZone from './UploadZone'
import { listUserDocs, uploadDocs } from '../services/api'

type Props = {
  open: boolean
  onClose: () => void
  email: string
}

export default function DataDrawer({ open, onClose, email }: Props) {
  const [docs, setDocs] = useState<any[]>([])
  const [queue, setQueue] = useState<File[]>([])
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setBusy(true)
    try {
      const d = await listUserDocs(email)
      setDocs(d)
    } catch (e: any) {
      alert('Failed to refresh documents: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { if (open) refresh() }, [open])

  async function doUpload() {
    if (!queue.length) return
    setBusy(true)
    try {
      await uploadDocs(email, queue)
      setQueue([])
      await refresh()
      alert('Uploaded and indexed successfully.')
    } catch (e: any) {
      alert('Upload failed: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur" onClick={onClose} />

          <motion.div
            className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-slate-900 text-white shadow-2xl p-6 overflow-y-auto"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">My Data</h3>
              <button onClick={onClose} className="btn-ghost">Close</button>
            </div>

            <div className="mb-6">
              <div className="text-sm mb-2">Upload more</div>
              <UploadZone onFiles={(f) => setQueue(prev => [...prev, ...f])} />
              {queue.length > 0 && (
                <div className="mt-2 text-xs text-white/70">
                  Selected: {queue.map((f, i) => <span key={i} className="mr-2">{f.name}</span>)}
                </div>
              )}
              <button
                onClick={doUpload}
                disabled={busy || queue.length === 0}
                className="mt-3 btn-primary disabled:opacity-50"
              >
                {busy ? 'Indexing…' : 'Upload & Index'}
              </button>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Indexed documents</h4>
                <button onClick={refresh} className="btn-ghost text-xs">Refresh</button>
              </div>
              {busy && <div className="text-sm text-white/70">Loading…</div>}
              {!busy && docs.length === 0 && <div className="text-sm text-white/60">No documents yet.</div>}
              <ul className="space-y-2 mt-2">
                {docs.map((d: any, i: number) => (
                  <li key={i} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-sm font-mono">{d.source}</div>
                    {d.snippet && <div className="text-xs text-white/70 mt-1">{d.snippet}</div>}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
