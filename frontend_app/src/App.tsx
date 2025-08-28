import React, { useEffect, useState, useRef } from 'react'
import { uploadStt, chat, tts, uploadDoc, listDocs } from './lib/api'
import MicButton from './components/MicButton'
import ChatWindow from './components/ChatWindow'
import Mascot from './components/Mascot'
import AudioPlayer from './components/AudioPlayer'
import RAGPanel from './components/RAGPanel'
import { v4 as uuidv4 } from 'uuid'

type ChatTurn = { role: 'user'|'assistant', text: string, citations?: any[] }

export default function App() {
  const [sessionId, setSessionId] = useState<string>(() => {
    const existing = localStorage.getItem('session_id')
    if (existing) return existing
    const id = uuidv4()
    localStorage.setItem('session_id', id)
    return id
  })
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([])
  const [isListening, setIsListening] = useState(false)
  const [listeningError, setListeningError] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const audioPlayerRef = useRef<any>(null)
  const mascotRef = useRef<any>(null)
  const [docs, setDocs] = useState<any[]>([])

  useEffect(() => { fetchDocs() }, [])

  async function fetchDocs() {
    try {
      const d = await listDocs()
      setDocs(d.docs || [])
    } catch (err) {
      console.warn('Failed to list docs', err)
    }
  }

  async function handleUpload(file: File) {
    try {
      await uploadDoc(file)
      await fetchDocs()
      alert('Uploaded and indexed: ' + file.name)
    } catch (err: any) {
      console.error(err)
      alert('Upload failed: ' + (err.message||String(err)))
    }
  }

  async function handleRecorded(blob: Blob) {
    try {
      setListeningError(null)
      const transcript = await uploadStt(blob)
      setChatHistory(h => [...h, { role: 'user', text: transcript }])
      // send to chat
      const resp = await chat(transcript, sessionId)
      const assistantText: string = resp.text
      // force short answers: backend prompt updated to prefer short answers
      const emotion: string = 'happy' // enforce happy while teaching per request
      const citations = resp.citations || []
      setChatHistory(h => [...h, { role: 'assistant', text: assistantText, citations }])
      // TTS
      setIsSpeaking(true)
      const audioBuffer = await tts(assistantText)
      if (audioPlayerRef.current) {
        await audioPlayerRef.current.playAudioBuffer(audioBuffer, emotion)
      }
      setIsSpeaking(false)
    } catch (err: any) {
      console.error(err)
      setListeningError(err.message || String(err))
    }
  }

  return (
    <div className="app-v2">
      <div className="left-column">
        <h2>Documents (RAG)</h2>
        <RAGPanel docs={docs} onUpload={handleUpload} />
      </div>
      <div className="center-column">
        <h2>AI Tutor</h2>
        <ChatWindow chatHistory={chatHistory} />
        <div className="controls">
          <MicButton onRecorded={handleRecorded} setIsListening={setIsListening} />
          {listeningError && <div className="error">{listeningError}</div>}
        </div>
      </div>
      <div className="right-column">
        <Mascot ref={mascotRef} />
        <AudioPlayer ref={audioPlayerRef} mascotRef={mascotRef} />
      </div>
    </div>
  )
}
