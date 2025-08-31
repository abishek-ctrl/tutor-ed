import {
  ArrowLeft,
  Bot,
  BookOpen,
  Database,
  MessageCircle,
  Mic,
  SendHorizonal,
  User,
  Volume2,
  VolumeX,
  AlertTriangle,
} from 'lucide-react'
import { useEffect, useRef, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { Session } from '../hooks/useSessions'
import { chat, sttUpload, tts } from '../services/api'
import DataDrawer from './DataDrawer'
import MascotHead, { UIEmotion } from './MascotHead'
import MicButton from './MicButton'
import { useAuth } from '../context/AuthContext'

function mapBackendEmotionToUI(label?: string): UIEmotion {
  const v = (label || '').toLowerCase().trim()
  if (['happy', 'encouraging', 'neutral'].includes(v)) return 'smiling'
  if (['thinking', 'clarifying'].includes(v)) return 'thinking'
  if (v === 'explaining') return 'speaking'
  return 'smiling'
}

type ChatItem = { role: 'user' | 'assistant'; text: string }
type Doc = { source: string; snippet: string }

type SessionUpdater = Partial<Session> | ((session: Session) => Partial<Session>)

type Props = {
  allDocs: Doc[]
  onRefreshDocs: () => Promise<void>
  sessionsApi: {
    sessions: Session[]
    getSession: (id: string) => Session | undefined
    updateSession: (id: string, updater: SessionUpdater) => void
  }
  showToast: (message: string) => void;
}

export default function MascotPage({ allDocs, onRefreshDocs, sessionsApi, showToast }: Props) {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { getSession, updateSession } = sessionsApi
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const session = useMemo(() => (sessionId ? getSession(sessionId) : null), [sessionId, getSession, sessionsApi.sessions])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [emotion, setEmotion] = useState<UIEmotion>('smiling')
  const [muteTTS, setMuteTTS] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem('ai_tutor_mute') === 'true',
  )
  const [busy, setBusy] = useState(false)
  const [chatMode, setChatMode] = useState<'voice' | 'text'>('text')
  const [textInput, setTextInput] = useState('')
  const chatContainerRef = useRef<HTMLDivElement | null>(null)

  const hasMasterDocuments = useMemo(() => allDocs.length > 0, [allDocs]);
  const canChat = useMemo(() => (session?.selectedDocs?.length ?? 0) > 0 && hasMasterDocuments, [session, hasMasterDocuments]);

  useEffect(() => {
    if (!user || (sessionId && !session)) {
      const timer = setTimeout(() => navigate('/dashboard', { replace: true }), 200)
      return () => clearTimeout(timer)
    }
  }, [session, user, sessionId, navigate])

  useEffect(() => {
    localStorage.setItem('ai_tutor_mute', String(muteTTS))
  }, [muteTTS])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [session?.messages])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
        audioRef.current = null
      }
    }
  }, [])

  if (!session || !user) {
    return <div className="h-screen w-screen bg-slate-900" />
  }

  const onSessionUpdate = (updater: SessionUpdater) => {
    if (sessionId) {
      updateSession(sessionId, updater)
    }
  }

  const pushMessage = (m: ChatItem) => {
    onSessionUpdate((prevSession) => ({
      messages: [...(prevSession.messages || []), m],
    }))
  }

  async function getAssistantResponse(message: string) {
    setBusy(true)
    setEmotion('thinking')

    if (audioRef.current) {
      audioRef.current.pause()
      URL.revokeObjectURL(audioRef.current.src)
    }

    try {
      const res = await chat(message, session!.id, user!.name, user!.email, session!.selectedDocs)
      const text: string = res.text || ''
      const mapped = mapBackendEmotionToUI(res.emotion)
      setEmotion(mapped)

      if (!muteTTS && text) {
        const buf = await tts(text)
        pushMessage({ role: 'assistant', text })

        const audio = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })))
        audioRef.current = audio

        audio.onplay = () => { setEmotion('speaking'); setSpeaking(true) }
        audio.onended = () => {
          setSpeaking(false)
          setEmotion('smiling')
          if (audioRef.current) {
            URL.revokeObjectURL(audioRef.current.src)
            audioRef.current = null
          }
        }
        audio.onerror = () => {
          setSpeaking(false)
          setEmotion('sad')
          if (audioRef.current) {
            URL.revokeObjectURL(audioRef.current.src)
            audioRef.current = null
          }
        }
        await audio.play()
      } else {
        pushMessage({ role: 'assistant', text })
      }
    } catch (e: any) {
      setEmotion('sad')
      pushMessage({ role: 'assistant', text: "I'm sorry, I ran into an error. Please try again." })
      console.error('Chat failed:', e)
    } finally {
      setBusy(false)
      if (muteTTS) setEmotion('smiling')
    }
  }
  
  const handleAttemptChat = (action: () => void) => {
    if (!hasMasterDocuments) {
        alert("You have no documents in your knowledge base. Please upload a document from the dashboard to start a new conversation.");
        return;
    }
    if (!canChat) {
        alert("Please select a source document for this session to begin chatting.");
        return;
    }
    action();
  }

  async function handleTextInput() {
    handleAttemptChat(() => {
        const message = textInput.trim();
        if (!message || busy) return;
        setTextInput('');
        pushMessage({ role: 'user', text: message });
        getAssistantResponse(message);
    });
  }

  async function handleUtterance(blob: Blob) {
    handleAttemptChat(async () => {
        if (busy) return;
        setBusy(true);
        setEmotion('thinking');
        try {
            const transcript = await sttUpload(blob, user!.email);
            if (transcript) {
                pushMessage({ role: 'user', text: transcript });
                await getAssistantResponse(transcript);
            } else {
                setBusy(false);
                setEmotion('sad');
            }
        } catch (e: any) {
            setBusy(false);
            setEmotion('sad');
        }
    });
  }

  const getPlaceholderText = () => {
    if (!hasMasterDocuments) return "No documents found. Please upload a document.";
    if (!canChat) return "Please select a source document to begin.";
    return "Type your message...";
  }

  return (
    <div className="h-screen w-screen flex flex-row bg-slate-900 text-zinc-200 font-sans">
      <aside className="w-96 flex-shrink-0 hidden lg:flex flex-col items-center justify-center bg-gray-900/80 p-6 border-r border-white/10">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
          <MascotHead emotion={emotion} speaking={speaking} />
        </motion.div>
        <p className="text-zinc-400 min-h-[2rem] text-center mt-4 text-lg font-display">
          {{
            thinking: 'Let me think...',
            speaking: 'Here is what I found!',
            sad: 'Oops, something went wrong.',
          }[emotion] || 'How can I help you learn?'}
        </p>
        <div className="mt-8 flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setChatMode('text')} className={`px-4 py-2 text-sm rounded-md flex items-center gap-2 ${chatMode === 'text' ? 'bg-brand-500 text-white' : 'bg-white/10'}`}>
            <MessageCircle className="w-4 h-4" /> Text
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setChatMode('voice')} className={`px-4 py-2 text-sm rounded-md flex items-center gap-2 ${chatMode === 'voice' ? 'bg-brand-500 text-white' : 'bg-white/10'}`}>
            <Mic className="w-4 h-4" /> Voice
          </motion.button>
        </div>
        <motion.button whileTap={{ scale: 0.98 }} whileHover={{ y: -1 }} onClick={() => setDrawerOpen(true)} className="mt-12 w-full max-w-xs btn-ghost justify-center text-base">
          <Database className="w-4 h-4 mr-2" />
          Manage Sources
        </motion.button>
      </aside>
      
      <main className="flex-1 flex flex-col h-screen">
        <header className="p-4 border-b border-white/10 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="icon-btn"> <ArrowLeft size={18} /> </button>
            <div>
              <h2 className="text-lg font-display leading-tight">{session.name}</h2>
              <p className="text-xs text-zinc-400">{session.selectedDocs.length} of {allDocs.length} sources selected</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400 hidden sm:inline">Hi, {user.name.split(' ')[0]}</span>
            <button onClick={() => setMuteTTS((m) => !m)} className="icon-btn" title={muteTTS ? 'Unmute' : 'Mute'}>
              {muteTTS ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        </header>

        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {session.messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <BookOpen size={48} className="text-zinc-600 mb-4" />
                <h3 className="font-display text-lg">Your session is ready.</h3>
                <p>Ask me anything about your selected documents!</p>
              </motion.div>
            </div>
          )}
          {(session.messages || []).map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-brand-500/50 grid place-items-center flex-shrink-0">
                  <Bot size={18} />
                </div>
              )}
              <div className={`${m.role === 'user' ? 'bubble-user' : 'bubble-ai'} max-w-xl`}>{m.text}</div>
              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-white/10 grid place-items-center flex-shrink-0">
                  <User size={18} />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="p-4 border-t border-white/5">
          {chatMode === 'voice' ? (
            <div className="flex flex-col items-center justify-center h-24">
              {!canChat ? (
                 <div className="flex items-center gap-2 text-yellow-400 text-sm p-4 text-center">
                   <AlertTriangle size={16} /> 
                   {hasMasterDocuments ? "Please select a source document to start chatting." : "Please upload a document to begin."}
                 </div>
              ) : (
                <>
                  <p className="text-sm text-zinc-400 mb-4">{busy ? 'Processing...' : 'Click the mic and start talking'}</p>
                  <MicButton onUtterance={handleUtterance} disabled={!canChat}/>
                </>
              )}
            </div>
          ) : (
            <div className="flex gap-3">
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTextInput()}
                placeholder={getPlaceholderText()}
                disabled={busy || !canChat}
                className="flex-1 h-12 px-4 rounded-xl bg-gray-900/80 border border-white/10 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <motion.button whileTap={{ scale: 0.95 }} onClick={handleTextInput} className="btn-primary w-24 disabled:opacity-50" disabled={busy || !textInput.trim() || !canChat}>
                <SendHorizonal className="w-5 h-5" />
              </motion.button>
            </div>
          )}
        </div>
      </main>

      <DataDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        email={user.email}
        selectedDocs={session.selectedDocs}
        onSelectionChange={(newSelection) => onSessionUpdate({ selectedDocs: newSelection })}
        allDocs={allDocs}
        onRefresh={onRefreshDocs}
        showToast={showToast}
      />
    </div>
  )
}