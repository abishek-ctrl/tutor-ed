import {
  Trash2,
  Database,
  LogOut,
  MessageCircle,
  Mic,
  SendHorizonal,
  VolumeX,
  Volume2,
  Book,
  User,
  Bot,
} from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

import MascotHead, { UIEmotion } from './MascotHead';
import MicButton from './MicButton';
import DataDrawer from './DataDrawer';
import { chat, sttUpload, tts, deleteUserDocs } from '../services/api';

function mapBackendEmotionToUI(label?: string): UIEmotion {
  const v = (label || '').toLowerCase().trim();
  if (['happy', 'encouraging', 'neutral'].includes(v)) return 'smiling';
  if (['thinking', 'clarifying'].includes(v)) return 'thinking';
  if (v === 'explaining') return 'speaking';
  if (v === 'celebrate') return 'celebrate';
  return 'smiling';
}

type ChatItem = { role: 'user' | 'assistant'; text: string };

export default function MascotPage({ user }: { user: { name: string; email: string } }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [emotion, setEmotion] = useState<UIEmotion>('smiling');
  const [muteTTS, setMuteTTS] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem('ai_tutor_mute') === 'true',
  );
  const [busy, setBusy] = useState(false);
  const [chatMode, setChatMode] = useState<'voice' | 'text'>('text');
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const sessionId = useMemo(() => uuid(), []);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('ai_tutor_mute', String(muteTTS));
    }
  }, [muteTTS]);

  useEffect(() => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);


  const pushMessage = (m: ChatItem) => setMessages((p) => [...p, m]);

  async function handleUtterance(blob: Blob) {
    if (busy) return;
    setBusy(true);
    setEmotion('thinking');

    try {
      const transcript = await sttUpload(blob, user.email);
      if (transcript) {
        pushMessage({ role: 'user', text: transcript });
        await handleChat(transcript);
      } else {
        throw new Error('No speech detected');
      }
    } catch (e: any) {
      sadTemp();
      alert('Voice recognition failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleChat(message: string) {
    if (!message.trim()) return;
    if (chatMode === 'text') pushMessage({ role: 'user', text: message });

    setBusy(true);
    setTextInput('');
    setEmotion('thinking');

    try {
      const res = await chat(message, sessionId, user.name, user.email);
      const text: string = res.text || '';
      pushMessage({ role: 'assistant', text });

      const mapped = mapBackendEmotionToUI(res.emotion);
      setEmotion(mapped);

      if (muteTTS) {
        setSpeaking(true);
        await new Promise((r) => setTimeout(r, Math.min(3000, text.split(' ').length * 70)));
        setSpeaking(false);
        setEmotion('smiling');
        return;
      }

      const buf = await tts(text);
      const audio = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));

      audio.onplay = () => {
        setEmotion('speaking');
        setSpeaking(true);
      };
      audio.onended = () => {
        setSpeaking(false);
        setEmotion('smiling');
        URL.revokeObjectURL(audio.src);
      };
      audio.onerror = sadTemp;
      await audio.play();
    } catch (e: any) {
      sadTemp();
      alert('Chat failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  function sadTemp() {
    setSpeaking(true);
    setEmotion('sad');
    setTimeout(() => {
      setSpeaking(false);
      setEmotion('smiling');
    }, 1500);
  }

  function handleLogout() {
    localStorage.removeItem('ai_tutor_user');
    window.location.reload();
  }
  async function handleDeleteData() {
    if (!confirm('Delete all your indexed data? This action cannot be undone.')) return;
    try {
      await deleteUserDocs(user.email);
      alert('All data removed.');
      window.location.reload();
    } catch (e: any) {
      alert('Deletion failed: ' + e.message);
    }
  }

  return (
    <div className="h-screen w-screen flex bg-slate-900 text-zinc-200 font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-gray-900/80 p-6 flex flex-col justify-between border-r border-white/10">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <Book className="text-brand-500" />
            <h1 className="text-2xl font-display font-bold text-white">AI Tutor</h1>
          </div>

          <div className="flex flex-col items-center text-center">
            <MascotHead emotion={emotion} speaking={speaking} className="mb-4" />
            <p className="text-zinc-400 min-h-[2rem] text-sm">
              {{
                thinking: 'Let me think...',
                speaking: 'Here is what I found!',
                sad: 'Oops, something went wrong.',
                celebrate: 'Awesome job! 🎉',
              }[emotion] || 'I am ready to help!'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
            <button onClick={() => setDrawerOpen(true)} className="w-full btn-ghost justify-start">
                <Database className="w-4 h-4 mr-2" />
                Manage My Data
            </button>
            <button onClick={handleDeleteData} className="w-full btn-ghost justify-start text-red-400 hover:bg-red-500/10">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All Data
            </button>
            <button onClick={handleLogout} className="w-full btn-ghost justify-start">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
            </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col">
        <header className="p-4 border-b border-white/10 flex justify-between items-center">
            <div className='flex items-center'>
                <h2 className="text-lg font-semibold">Conversation</h2>
                <div className='ml-4 flex items-center gap-2'>
                    <button onClick={() => setChatMode('text')} className={`px-3 py-1 text-xs rounded-md ${chatMode === 'text' ? 'bg-brand-500 text-white' : 'bg-white/10'}`}>
                        <MessageCircle className="w-4 h-4 inline mr-1" /> Text
                    </button>
                    <button onClick={() => setChatMode('voice')} className={`px-3 py-1 text-xs rounded-md ${chatMode === 'voice' ? 'bg-brand-500 text-white' : 'bg-white/10'}`}>
                        <Mic className="w-4 h-4 inline mr-1" /> Voice
                    </button>
                </div>
            </div>
            
            <div className='flex items-center gap-2'>
                <span className="text-sm text-zinc-400">
                    Hi, {user.name.split(' ')[0]}
                </span>
                <button
                    onClick={() => setMuteTTS((m) => !m)}
                    className="icon-btn"
                    title={muteTTS ? 'Unmute' : 'Mute'}
                >
                    {muteTTS ? <VolumeX size={18}/> : <Volume2 size={18} />}
                </button>
            </div>
        </header>

        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
            {messages.length === 0 && (
              <div className="h-full flex items-center justify-center text-center text-zinc-500">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="text-6xl mb-3">📚</div>
                  Ask me anything about your documents!
                </motion.div>
              </div>
            )}

            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-brand-500/50 grid place-items-center flex-shrink-0"><Bot size={18}/></div>}
                <div className={`${m.role === 'user' ? 'bubble-user' : 'bubble-ai'} max-w-xl`}>
                  {m.text}
                </div>
                {m.role === 'user' && <div className="w-8 h-8 rounded-full bg-white/10 grid place-items-center flex-shrink-0"><User size={18}/></div>}
              </motion.div>
            ))}
        </div>

        <div className="p-4 border-t border-white/5">
            {chatMode === 'voice' ? (
              <div className="flex flex-col items-center justify-center">
                <p className="text-sm text-zinc-400 mb-4">
                  {busy ? 'Processing your voice...' : 'Click the mic and start talking'}
                </p>
                <MicButton onUtterance={handleUtterance} />
              </div>
            ) : (
              <div className="flex gap-3">
                <input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && !busy && textInput.trim() && handleChat(textInput)
                  }
                  placeholder="Type your message, or ask about your documents..."
                  disabled={busy}
                  className="flex-1 h-12 px-4 rounded-xl bg-gray-900/80 border border-white/10 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                />
                <button
                  onClick={() => handleChat(textInput)}
                  className="btn-primary w-24 disabled:opacity-50"
                  disabled={busy || !textInput.trim()}
                >
                  <SendHorizonal className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
      </main>

      <DataDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} email={user.email} />
    </div>
  );
}