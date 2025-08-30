// src/components/MascotPage.tsx
import {
  Trash2,
  Database,
  LogOut,
  MessageCircle,
  Mic,
  SendHorizonal,
  VolumeX,
  Volume2,
} from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

import MascotHead, { UIEmotion } from './MascotHead';
import MicButton from './MicButton';
import DataDrawer from './DataDrawer';
import { chat, sttUpload, tts, deleteUserDocs } from '../services/api';

/* ---------- util (unchanged apart from 'celebrate') -------- */
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
  /* ---------- state ---------- */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [emotion, setEmotion] = useState<UIEmotion>('smiling');
  const [muteTTS, setMuteTTS] = useState<boolean>(
    () => localStorage.getItem('ai_tutor_mute') === 'true',
  );
  const [busy, setBusy] = useState(false);
  const [chatMode, setChatMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const sessionId = useMemo(() => uuid(), []);

  /* ---------- effects ---------- */
  useEffect(() => document.documentElement.classList.add('dark'), []);
  useEffect(() => localStorage.setItem('ai_tutor_mute', String(muteTTS)), [muteTTS]);

  const pushMessage = (m: ChatItem) => setMessages((p) => [...p, m]);

  /* ---------- voice + chat handlers (same logic as before) ---------- */
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
        // Fake speaking duration
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

  /* ---------- destructive actions ---------- */
  function handleLogout() {
    localStorage.removeItem('ai_tutor_user');
    window.location.reload();
  }
  async function handleDeleteData() {
    if (!confirm('Delete all your indexed data?')) return;
    try {
      await deleteUserDocs(user.email);
      alert('All data removed.');
      window.location.reload();
    } catch (e: any) {
      alert('Deletion failed: ' + e.message);
    }
  }

  /* ---------- render ---------- */
  return (
    <div className="min-h-screen font-body text-zinc-200 bg-gradient-to-br from-[#0A0F23] via-[#0E1733] to-[#121b3e] selection:bg-brand-500/40">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur bg-black/30 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <h1 className="font-display text-2xl text-white">AI&nbsp;Tutor</h1>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-sm text-zinc-400">
              Hello&nbsp;{user.name.split(' ')[0]}
            </span>

            <button
              onClick={() => setMuteTTS((m) => !m)}
              className="icon-btn"
              title={muteTTS ? 'Enable audio' : 'Disable audio'}
            >
              {muteTTS ? <VolumeX /> : <Volume2 />}
            </button>

            <button onClick={() => setDrawerOpen(true)} className="btn-ghost">
              <Database className="w-4 h-4 mr-1" />
              My&nbsp;Data
            </button>

            <button onClick={handleDeleteData} className="btn-ghost text-red-400">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </button>

            <button onClick={handleLogout} className="btn-ghost">
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main split grid */}
      <main className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-[35%_1fr] gap-8">
        {/* Panda / tips card */}
        <section className="glass-card tilt-2 flex flex-col items-center lg:sticky lg:top-24">
          <MascotHead emotion={emotion} speaking={speaking} className="mb-3" />

          <p className="text-center text-zinc-400 min-h-[2rem]">
            {{
              thinking: 'Thinking…',
              speaking: 'Here we go!',
              sad: 'Hmm, something went wrong.',
              celebrate: 'Great job! 🎉',
            }[emotion] || 'Ask me anything about your documents!'}
          </p>
        </section>

        {/* Chat card */}
        <section className="glass-card flex flex-col overflow-hidden">
          {/* Chat header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-display font-semibold">Conversation</h3>

            <button
              onClick={() => setChatMode((m) => (m === 'voice' ? 'text' : 'voice'))}
              className="btn-ghost text-xs"
            >
              {chatMode === 'voice' ? (
                <>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Switch&nbsp;to&nbsp;Text
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Switch&nbsp;to&nbsp;Voice
                </>
              )}
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
            {messages.length === 0 && (
              <div className="h-full flex items-center justify-center text-center text-zinc-500">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="text-6xl mb-3">🐼</div>
                  Ask me anything!
                </motion.div>
              </div>
            )}

            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={m.role === 'user' ? 'bubble-user' : 'bubble-ai'}>
                  {m.text}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Input bar */}
          <div className="p-4 border-t border-white/5 sticky bottom-0 bg-black/10 backdrop-blur">
            {chatMode === 'voice' ? (
              <div className="text-center">
                <p className="text-sm text-zinc-400 mb-4">
                  {busy ? 'Processing…' : 'Click the mic and start talking'}
                </p>
                <MicButton onUtterance={handleUtterance} disabled={busy} />
              </div>
            ) : (
              <div className="flex gap-3">
                <input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && !busy && textInput.trim() && handleChat(textInput)
                  }
                  placeholder="Type your message…"
                  disabled={busy}
                  className="flex-1 h-12 px-4 rounded-xl border bg-white/10 border-white/10 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                />
                <button
                  onClick={() => handleChat(textInput)}
                  className="btn-primary disabled:opacity-50"
                  disabled={busy || !textInput.trim()}
                >
                  <SendHorizonal className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <DataDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} email={user.email} />
    </div>
  );
}