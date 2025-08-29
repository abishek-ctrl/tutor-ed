import { useState } from 'react'
import { motion } from 'framer-motion'
import UploadZone from './UploadZone'
import { uploadDocs } from '../services/api'

type Props = { user: { name:string; email:string }, onComplete: ()=>void }

export default function RagInit({ user, onComplete }: Props) {
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)

  async function doUpload() {
    if (files.length === 0) return
    setBusy(true)
    try {
      await uploadDocs(user.email, files)
      onComplete()
    } catch (e) {
      alert('Upload failed: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-blue-100 via-violet-100 to-fuchsia-100 dark:from-zinc-900 dark:via-zinc-950 dark:to-black p-6">
      <motion.h2 initial={{opacity:0, y:10}} animate={{opacity:1,y:0}} className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
        Hello {user.name.split(' ')[0]}, let’s build your knowledge base
      </motion.h2>
      <UploadZone onFiles={(f)=>setFiles(prev=>[...prev, ...f])} />
      <div className="w-full max-w-2xl">
        <ul className="text-sm text-zinc-600 dark:text-zinc-300 max-h-40 overflow-auto">
          {files.map((f,i)=>(<li key={i} className="truncate py-1">{f.name}</li>))}
        </ul>
      </div>
      <motion.button whileTap={{scale:0.98}} whileHover={{y:-1}} onClick={doUpload}
        disabled={busy || files.length===0}
        className="btn-primary rounded-2xl disabled:opacity-50">
        {busy ? 'Uploading & Indexing…' : 'Upload & Index'}
      </motion.button>
    </div>
  )
}
