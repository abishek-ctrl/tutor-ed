import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import UploadZone from './UploadZone'
import { listUserDocs, uploadDocs } from '../services/api'

type Props = {
  open: boolean
  onClose: ()=>void
  email: string
}

export default function DataDrawer({ open, onClose, email }: Props) {
  const [docs, setDocs] = useState<any[]>([])
  const [queue, setQueue] = useState<File[]>([])
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const d = await listUserDocs(email)
    setDocs(d)
  }
  useEffect(()=>{ if (open) refresh() }, [open])

  async function doUpload() {
    if (!queue.length) return
    setBusy(true)
    try {
      await uploadDocs(email, queue)
      setQueue([])
      await refresh()
      alert('Uploaded and indexed successfully.')
    } catch (e:any) {
      alert('Upload failed: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
          <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
          <motion.div initial={{x:400}} animate={{x:0}} exit={{x:400}}
            className="absolute right-0 top-0 h-full w-full max-w-md p-6 bg-white dark:bg-zinc-950 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">My Data</h3>
              <button className="btn-ghost" onClick={onClose}>Close</button>
            </div>

            <div className="mb-6">
              <h4 className="font-semibold mb-2">Upload more</h4>
              <UploadZone onFiles={(f)=>setQueue(prev=>[...prev, ...f])} />
              <ul className="text-sm text-zinc-600 dark:text-zinc-300 max-h-32 overflow-auto mt-2">
                {queue.map((f,i)=>(<li key={i} className="truncate py-1">{f.name}</li>))}
              </ul>
              <button disabled={busy || queue.length===0} onClick={doUpload} className="mt-3 btn-primary rounded-2xl disabled:opacity-50">
                {busy ? 'Indexing…' : 'Upload & Index'}
              </button>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold mb-2">Indexed documents</h4>
              <button className="btn-ghost mb-2" onClick={refresh}>Refresh</button>
              <ul className="space-y-2">
                {docs.map((d:any, i:number)=>(
                  <li key={i} className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900">
                    <div className="font-medium">{d.source}</div>
                    {d.snippet && <div className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap">{d.snippet}</div>}
                  </li>
                ))}
                {docs.length===0 && <div className="text-sm text-zinc-500">No documents yet.</div>}
              </ul>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
