import { useEffect, useMemo, useState } from 'react'
import { Moon, Sun, Trash2, Database, LogOut, MessageCircle, Mic, SendHorizonal, VolumeX, Volume2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import MascotHead, { UIEmotion } from './MascotHead'
import MicButton from './MicButton'
import DataDrawer from './DataDrawer'
import { chat, sttUpload, tts, deleteUserDocs } from '../services/api'

type Props = { user: { name: string; email: string } }
type ChatItem = { role: 'user' | 'assistant'; text: string }

function mapBackendEmotionToUI(label?: string): UIEmotion {
  const v = (label || '').toLowerCase().trim()
  if (v === 'happy' || v === 'encouraging' || v === 'neutral') return 'smiling'
  if (v === 'thinking' || v === 'clarifying') return 'thinking'
  if (v === 'explaining') return 'thinking'
  return 'smiling'
}

export default function MascotPage({ user }: Props) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [emotion, setEmotion] = useState<UIEmotion>('smiling')
  const sessionId = useMemo(() => uuid(), [])
  const [chatMode, setChatMode] = useState<'voice' | 'text'>('voice')
  const [textInput, setTextInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [muteTTS, setMuteTTS] = useState<boolean>(() => localStorage.getItem('ai_tutor_mute') === 'true')
  const [messages, setMessages] = useState<ChatItem[]>([])

  useEffect(() => { 
    document.documentElement.classList.toggle('dark', dark) 
  }, [dark])
  
  useEffect(() => { 
    localStorage.setItem('ai_tutor_mute', String(muteTTS)) 
  }, [muteTTS])

  const pushMessage = (m: ChatItem) => setMessages(prev => [...prev, m])

  async function handleUtterance(blob: Blob) {
    if (busy) return
    setBusy(true)
    setEmotion('thinking')
    
    try {
      const transcript = await sttUpload(blob, user.email)
      if (transcript) {
        pushMessage({ role: 'user', text: transcript })
        await handleChat(transcript)
      } else {
        setSpeaking(true)
        setEmotion('sad')
        setTimeout(() => { 
          setSpeaking(false)
          setEmotion('smiling') 
        }, 1500)
      }
    } catch (e: any) {
      setSpeaking(true)
      setEmotion('sad')
      setTimeout(() => { 
        setSpeaking(false)
        setEmotion('smiling') 
      }, 1500)
      alert('Voice recognition failed: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleChat(message: string) {
    if (!message.trim()) return
    if (chatMode === 'text') pushMessage({ role: 'user', text: message })

    setBusy(true)
    setTextInput('')
    setEmotion('thinking')

    try {
      const res = await chat(message, sessionId, user.name, user.email)
      const text: string = res.text || ''
      pushMessage({ role: 'assistant', text })

      const mapped = mapBackendEmotionToUI(res.emotion)
      
      if (!res.emotion || !text) {
        setSpeaking(true)
        setEmotion('sad')
        setTimeout(() => { 
          setSpeaking(false)
          setEmotion('smiling') 
        }, 1500)
        return
      }

      setEmotion(mapped)

      if (muteTTS) {
        setEmotion('speaking')
        setSpeaking(true)
        const duration = Math.min(2500, Math.max(1000, text.split(' ').length * 70))
        await new Promise(r => setTimeout(r, duration))
        setSpeaking(false)
        setEmotion('smiling')
        return
      }

      const buf = await tts(text)
      const blob = new Blob([buf], { type: 'audio/wav' })
      const audio = new Audio(URL.createObjectURL(blob))

      audio.onplay = () => { 
        setEmotion('speaking')
        setSpeaking(true) 
      }
      
      audio.onended = () => { 
        setSpeaking(false)
        setEmotion('smiling')
        URL.revokeObjectURL(audio.src)
      }
      
      audio.onerror = () => { 
        setSpeaking(false)
        setEmotion('sad')
        setTimeout(() => setEmotion('smiling'), 1500)
      }

      await audio.play()
    } catch (e: any) {
      setSpeaking(true)
      setEmotion('sad')
      setTimeout(() => { 
        setSpeaking(false)
        setEmotion('smiling') 
      }, 1500)
      alert('Chat failed: ' + e.message)
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
      setEmotion('sad')
      setSpeaking(true)
      alert('All your data has been removed.')
      setTimeout(() => { 
        setSpeaking(false)
        setEmotion('smiling')
        setMessages([]) 
      }, 2000)
    } catch (e: any) {
      setEmotion('sad')
      setSpeaking(true)
      alert('Deletion failed: ' + e.message)
      setTimeout(() => { 
        setSpeaking(false)
        setEmotion('smiling') 
      }, 1500)
    }
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      dark 
        ? 'bg-[oklch(0.13_0.01_240)]' // Very dark neutral
        : 'bg-[oklch(0.98_0.005_240)]' // Very light neutral
    }`}>
      {/* Header */}
      <header className={`border-b ${
        dark 
          ? 'border-[oklch(0.25_0.01_240)] bg-[oklch(0.15_0.01_240)]' 
          : 'border-[oklch(0.88_0.005_240)] bg-[oklch(0.99_0.002_240)]'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className={`text-xl font-medium ${
                dark ? 'text-[oklch(0.95_0.005_240)]' : 'text-[oklch(0.15_0.01_240)]'
              }`}>
                AI Tutor
              </h1>
              <div className={`text-sm ${
                dark ? 'text-[oklch(0.7_0.01_240)]' : 'text-[oklch(0.45_0.01_240)]'
              }`}>
                Welcome, {user.name.split(' ')[0]}
              </div>
            </div>
            
            {/* Header Actions - 8pt aligned */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setMuteTTS(m => !m)} 
                className={`h-9 px-3 rounded-lg transition-all duration-150 inline-flex items-center justify-center
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.6_0.15_240)]
                  ${muteTTS 
                    ? `${dark ? 'text-[oklch(0.65_0.15_0)]' : 'text-[oklch(0.55_0.15_0)]'} ${dark ? 'hover:bg-[oklch(0.2_0.01_240)]' : 'hover:bg-[oklch(0.92_0.005_240)]'}` 
                    : `${dark ? 'text-[oklch(0.65_0.12_150)]' : 'text-[oklch(0.55_0.12_150)]'} ${dark ? 'hover:bg-[oklch(0.2_0.01_240)]' : 'hover:bg-[oklch(0.92_0.005_240)]'}`
                  }`}
                title={muteTTS ? 'Enable Audio' : 'Disable Audio'}
              >
                {muteTTS ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              
              <button 
                onClick={() => setDark(prev => !prev)} 
                className={`h-9 px-3 rounded-lg transition-all duration-150 inline-flex items-center justify-center
                  ${dark ? 'text-[oklch(0.8_0.01_240)] hover:bg-[oklch(0.2_0.01_240)]' : 'text-[oklch(0.35_0.01_240)] hover:bg-[oklch(0.92_0.005_240)]'}
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.6_0.15_240)]`}
              >
                {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              <button 
                onClick={() => setDrawerOpen(true)} 
                className={`h-9 px-3 rounded-lg transition-all duration-150 inline-flex items-center gap-2
                  ${dark ? 'text-[oklch(0.8_0.01_240)] hover:bg-[oklch(0.2_0.01_240)]' : 'text-[oklch(0.35_0.01_240)] hover:bg-[oklch(0.92_0.005_240)]'}
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.6_0.15_240)]`}
              >
                <Database className="w-4 h-4" />
                <span className="text-sm font-medium">My Data</span>
              </button>
              
              <button 
                onClick={handleDeleteData} 
                className={`h-9 px-3 rounded-lg transition-all duration-150 inline-flex items-center gap-2
                  text-[oklch(0.55_0.15_0)] hover:bg-[oklch(0.95_0.08_0)] dark:hover:bg-[oklch(0.2_0.08_0)]
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.6_0.15_0)]`}
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm font-medium">Delete Data</span>
              </button>
              
              <button 
                onClick={handleLogout} 
                className={`h-9 px-3 rounded-lg transition-all duration-150 inline-flex items-center gap-2
                  ${dark ? 'text-[oklch(0.8_0.01_240)] hover:bg-[oklch(0.2_0.01_240)]' : 'text-[oklch(0.35_0.01_240)] hover:bg-[oklch(0.92_0.005_240)]'}
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.6_0.15_240)]`}
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content - 8pt grid */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Panda Panel */}
          <section className={`rounded-2xl border transition-all duration-200 ${
            dark 
              ? 'bg-[oklch(0.18_0.01_240)] border-[oklch(0.25_0.01_240)]' 
              : 'bg-[oklch(0.99_0.002_240)] border-[oklch(0.88_0.005_240)]'
          }`}>
            <div className="p-8 text-center">
              <h2 className={`text-2xl font-medium mb-3 ${
                dark ? 'text-[oklch(0.95_0.005_240)]' : 'text-[oklch(0.15_0.01_240)]'
              }`}>
                Your AI Panda Tutor
              </h2>
              
              <p className={`text-base mb-8 leading-relaxed ${
                dark ? 'text-[oklch(0.65_0.01_240)]' : 'text-[oklch(0.45_0.01_240)]'
              }`}>
                {emotion === 'thinking' ? 'Thinking about your question...' :
                 emotion === 'speaking' ? 'Explaining the answer!' :
                 emotion === 'sad' ? 'Something went wrong, but I\'m here to help!' :
                 'Ready to help you learn!'}
              </p>
              
              <MascotHead 
                emotion={emotion} 
                speaking={speaking} 
                className="mx-auto mb-6" 
              />
              
              {busy && (
                <div className={`text-sm ${
                  dark ? 'text-[oklch(0.6_0.12_240)]' : 'text-[oklch(0.5_0.12_240)]'
                }`}>
                  Processing...
                </div>
              )}
            </div>
          </section>

          {/* Chat Panel */}
          <section className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
            dark 
              ? 'bg-[oklch(0.18_0.01_240)] border-[oklch(0.25_0.01_240)]' 
              : 'bg-[oklch(0.99_0.002_240)] border-[oklch(0.88_0.005_240)]'
          }`}>
            {/* Mode selector - Segmented Control */}
            <div className={`p-6 border-b ${
              dark ? 'border-[oklch(0.25_0.01_240)]' : 'border-[oklch(0.88_0.005_240)]'
            }`}>
              <div className="flex items-center justify-between">
                <div className={`inline-flex rounded-xl border overflow-hidden ${
                  dark ? 'border-[oklch(0.3_0.01_240)]' : 'border-[oklch(0.85_0.005_240)]'
                }`}>
                  {(['voice', 'text'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setChatMode(mode)}
                      className={`h-10 px-4 text-sm font-medium inline-flex items-center gap-2 transition-all duration-150
                        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.6_0.15_240)]
                        ${chatMode === mode
                          ? dark
                            ? 'bg-[oklch(0.25_0.01_240)] text-[oklch(0.95_0.005_240)]'
                            : 'bg-[oklch(0.92_0.005_240)] text-[oklch(0.15_0.01_240)]'
                          : dark
                            ? 'bg-transparent text-[oklch(0.7_0.01_240)] hover:bg-[oklch(0.22_0.01_240)]'
                            : 'bg-transparent text-[oklch(0.5_0.01_240)] hover:bg-[oklch(0.95_0.005_240)]'
                        }`}
                      aria-pressed={chatMode === mode}
                    >
                      {mode === 'voice' ? <Mic className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                      {mode === 'voice' ? 'Voice' : 'Text'}
                    </button>
                  ))}
                </div>
                
                <div className={`text-xs ${
                  dark ? 'text-[oklch(0.55_0.01_240)]' : 'text-[oklch(0.5_0.01_240)]'
                }`}>
                  Audio: {muteTTS ? 'Off' : 'On'}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="h-96 overflow-y-auto p-6">
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-xl border ${
                      m.role === 'user' 
                        ? dark
                          ? 'bg-[oklch(0.25_0.01_240)] text-[oklch(0.95_0.005_240)] border-[oklch(0.3_0.01_240)]'
                          : 'bg-[oklch(0.92_0.005_240)] text-[oklch(0.15_0.01_240)] border-[oklch(0.85_0.005_240)]'
                        : dark
                          ? 'bg-[oklch(0.22_0.01_240)] text-[oklch(0.85_0.01_240)] border-[oklch(0.28_0.01_240)]'
                          : 'bg-[oklch(0.96_0.005_240)] text-[oklch(0.25_0.01_240)] border-[oklch(0.9_0.005_240)]'
                    }`}>
                      <div className="text-xs opacity-75 mb-2 font-medium">
                        {m.role === 'user' ? 'You' : 'Panda'}
                      </div>
                      <div className="text-sm leading-relaxed">{m.text}</div>
                    </div>
                  </div>
                ))}
                
                {messages.length === 0 && (
                  <div className="h-full flex items-center justify-center text-center">
                    <div>
                      <div className="text-5xl mb-4">🐼</div>
                      <div className={`text-lg ${
                        dark ? 'text-[oklch(0.6_0.01_240)]' : 'text-[oklch(0.5_0.01_240)]'
                      }`}>
                        Ask me anything!
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input */}
            <div className={`p-6 border-t ${
              dark ? 'border-[oklch(0.25_0.01_240)]' : 'border-[oklch(0.88_0.005_240)]'
            }`}>
              {chatMode === 'voice' ? (
                <div className="text-center">
                  <div className={`text-sm mb-6 ${
                    dark ? 'text-[oklch(0.65_0.01_240)]' : 'text-[oklch(0.45_0.01_240)]'
                  }`}>
                    {busy ? 'Processing...' : 'Click to talk'}
                  </div>
                  <MicButton onUtterance={handleUtterance} disabled={busy} />
                </div>
              ) : (
                <div className="flex gap-3">
                  <input
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => { 
                      if (e.key === 'Enter' && !busy && textInput.trim()) {
                        handleChat(textInput) 
                      }
                    }}
                    className={`flex-1 h-11 px-4 rounded-xl border bg-transparent transition-all duration-150
                      focus:outline-none focus:ring-2 focus:ring-[oklch(0.6_0.15_240)] focus:ring-offset-2
                      ${dark 
                        ? 'border-[oklch(0.3_0.01_240)] text-[oklch(0.9_0.01_240)] placeholder-[oklch(0.55_0.01_240)] focus:ring-offset-[oklch(0.18_0.01_240)]'
                        : 'border-[oklch(0.8_0.005_240)] text-[oklch(0.2_0.01_240)] placeholder-[oklch(0.5_0.01_240)] focus:ring-offset-[oklch(0.99_0.002_240)]'
                      }`}
                    placeholder="Type your message..."
                    disabled={busy}
                  />
                  <button
                    onClick={() => handleChat(textInput)}
                    className={`h-11 px-4 rounded-xl transition-all duration-150 inline-flex items-center justify-center
                      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.6_0.15_240)]
                      ${busy || !textInput.trim()
                        ? dark 
                          ? 'bg-[oklch(0.25_0.01_240)] text-[oklch(0.45_0.01_240)] cursor-not-allowed'
                          : 'bg-[oklch(0.9_0.005_240)] text-[oklch(0.55_0.01_240)] cursor-not-allowed'
                        : 'bg-[oklch(0.6_0.15_240)] text-[oklch(0.98_0.005_240)] hover:bg-[oklch(0.55_0.15_240)]'
                      }`}
                    disabled={busy || !textInput.trim()}
                  >
                    <SendHorizonal className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <DataDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} email={user.email} />
    </div>
  )
}
