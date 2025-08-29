import { useEffect, useMemo, useState } from 'react'
import { Moon, Sun, Trash2, Database } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import Mascot from './Mascot'
import MicButton from './MicButton'
import DataDrawer from './DataDrawer'
import { chat, sttUpload, tts, deleteUserDocs } from '../services/api'

type Props = { user: { name:string; email:string } }

export default function MascotPage({ user }: Props) {
  const [dark, setDark] = useState<boolean>(()=>document.documentElement.classList.contains('dark'))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const sessionId = useMemo(()=> uuid(), [])
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)

  useEffect(()=>{
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  async function handleUtterance(blob: Blob) {
    try {
      const transcript = await sttUpload(blob, user.email)
      const res = await chat(transcript, sessionId, user.name, user.email)
      const text: string = res.text || ''
      // Speak result
      setSpeaking(true)
      const buf = await tts(text)
      const audio = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' })))
      setAudioEl(audio)
      audio.onended = ()=> setSpeaking(false)
      await audio.play()
    } catch (e:any) {
      setSpeaking(false)
      alert('Interaction failed: ' + e.message)
    }
  }

  async function handleDeleteData() {
    if (!confirm('Delete all your indexed data? This cannot be undone.')) return
    await deleteUserDocs(user.email)
    alert('All your data has been removed.')
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-white to-zinc-100 dark:from-black dark:to-zinc-900">
      {/* Theme toggle */}
      <div className="absolute left-4 top-4">
        <button onClick={()=>setDark(prev=>!prev)} className="icon-btn">{dark ? <Sun/> : <Moon/>}</button>
      </div>

      {/* Nav actions */}
      <div className="absolute right-4 top-4 flex gap-3">
        <button className="btn-ghost" onClick={()=>setDrawerOpen(true)}><Database className="mr-2" size={16}/>My Data</button>
        <button className="btn-ghost" onClick={handleDeleteData}><Trash2 className="mr-2" size={16}/>Delete My Data</button>
      </div>

      {/* Center mascot */}
      <div className="flex flex-col items-center gap-8">
        <Mascot emotion="happy" speaking={speaking} />
        <MicButton onUtterance={handleUtterance} />
        <div className="text-xs text-zinc-500">Click to talk. Auto-stops after 2s of silence.</div>
      </div>

      <DataDrawer open={drawerOpen} onClose={()=>setDrawerOpen(false)} email={user.email} />
    </div>
  )
}
