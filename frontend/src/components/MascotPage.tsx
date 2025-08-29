import { useEffect, useMemo, useState } from 'react'
import { Moon, Sun, Trash2, Database, LogOut, MessageCircle, Mic, SendHorizonal } from 'lucide-react'
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
  const [chatMode, setChatMode] = useState<'voice' | 'text'>('voice')
  const [textInput, setTextInput] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(()=>{
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  async function handleUtterance(blob: Blob) {
    setBusy(true)
    try {
      const transcript = await sttUpload(blob, user.email)
      if (transcript) {
        await handleChat(transcript)
      }
    } catch (e:any) {
      alert('Interaction failed: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleChat(message: string) {
    if (!message.trim()) return;
    setBusy(true)
    setTextInput('')
    try {
      const res = await chat(message, sessionId, user.name, user.email)
      const text: string = res.text || ''
      setSpeaking(true)
      const buf = await tts(text)
      const audio = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' })))
      setAudioEl(audio)
      audio.onended = ()=> setSpeaking(false)
      await audio.play()
    } catch (e:any) {
      alert('Interaction failed: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('ai_tutor_user')
    window.location.reload()
  }

  async function handleDeleteData() {
    if (!confirm('Are you sure you want to delete all your indexed data? This cannot be undone.')) return
    try {
      await deleteUserDocs(user.email)
      alert('All your data has been removed.')
      window.location.reload()
    } catch (e:any) {
      alert('Deletion failed: ' + e.message)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-white to-zinc-100 dark:from-black dark:to-zinc-900 p-4">
      {/* Top Left actions */}
      <div className="absolute left-4 top-4 flex gap-3">
        <button onClick={()=>setDark(prev=>!prev)} className="icon-btn">{dark ? <Sun/> : <Moon/>}</button>
        <button onClick={handleLogout} className="icon-btn"><LogOut/></button>
      </div>


      {/* Nav actions */}
      <div className="absolute right-4 top-4 flex gap-3">
        <button className="btn-ghost" onClick={()=>setDrawerOpen(true)}><Database className="mr-2" size={16}/>My Data</button>
        <button className="btn-ghost" onClick={handleDeleteData}><Trash2 className="mr-2" size={16}/>Delete My Data</button>
      </div>

      {/* Center mascot and chat interface */}
      <div className="flex flex-col items-center gap-8 w-full">
        <div className="flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-full p-1">
          <button onClick={() => setChatMode('voice')} className={`px-4 py-2 rounded-full ${chatMode === 'voice' ? 'bg-white dark:bg-zinc-700' : ''}`}><Mic size={16}/></button>
          <button onClick={() => setChatMode('text')} className={`px-4 py-2 rounded-full ${chatMode === 'text' ? 'bg-white dark:bg-zinc-700' : ''}`}><MessageCircle size={16}/></button>
        </div>

        <Mascot emotion="happy" speaking={speaking} />

        {chatMode === 'voice' ? (
          <>
            <MicButton onUtterance={handleUtterance} />
            <div className="text-xs text-zinc-500">Click to talk, click again to send.</div>
          </>
        ) : (
          <div className="w-full max-w-lg mt-4">
            <div className="relative">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter' && !busy) handleChat(textInput) }}
                className="w-full rounded-2xl px-5 py-4 pr-16 bg-white/70 dark:bg-zinc-900/60 border border-white/40 dark:border-white/10 outline-none focus:ring-2 focus:ring-purple-400 transition"
                placeholder="Type your message..."
                disabled={busy}
              />
              <button
                onClick={() => handleChat(textInput)}
                className="absolute right-3 top-1/2 -translate-y-1/2 btn-primary rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-50"
                disabled={busy}
              >
                <SendHorizonal size={20}/>
              </button>
            </div>
          </div>
        )}
      </div>

      <DataDrawer open={drawerOpen} onClose={()=>setDrawerOpen(false)} email={user.email} />
    </div>
  )
}