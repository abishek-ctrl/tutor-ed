import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'

type ChatItem = { role: 'user' | 'assistant'; text: string }

export type Session = {
  id: string
  name: string
  messages: ChatItem[]
  selectedDocs: string[]
  createdAt: number
}

type SessionUpdater = Partial<Session> | ((session: Session) => Partial<Session>)

export function useSessions(email: string | null) {
  const [sessions, setSessions] = useState<Session[]>([])
  const storageKey = email ? `ai_tutor_sessions_${email}` : null

  // Effect to load sessions from localStorage on initial load
  useEffect(() => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey)
        const parsed = stored ? JSON.parse(stored) : []
        parsed.sort((a: Session, b: Session) => (b.createdAt || 0) - (a.createdAt || 0))
        setSessions(parsed)
      } catch (e) {
        console.error('Failed to load sessions from storage', e)
        setSessions([])
      }
    }
  }, [storageKey])

  const addSession = (session: Omit<Session, 'id' | 'createdAt'>) => {
    const newSession: Session = {
      ...session,
      id: uuid(),
      createdAt: Date.now(),
    }
    // Update state using the previous state
    setSessions(prevSessions => {
      const newSessions = [newSession, ...prevSessions]
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(newSessions))
      }
      return newSessions
    })
    return newSession
  }

  const updateSession = (id: string, updater: SessionUpdater) => {
    // **THE FIX:** Use the functional form of setSessions.
    // This guarantees `currentSessions` is the absolute latest state,
    // preventing the race condition that was causing your message to disappear.
    setSessions(currentSessions => {
      const newSessions = currentSessions.map(s => {
        if (s.id === id) {
          const updates = typeof updater === 'function' ? updater(s) : updater
          return { ...s, ...updates }
        }
        return s
      })
      // Also update localStorage atomically within the same update.
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(newSessions))
      }
      return newSessions
    })
  }

  const deleteSession = (id: string) => {
    setSessions(currentSessions => {
      const newSessions = currentSessions.filter(s => s.id !== id)
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(newSessions))
      }
      return newSessions
    })
  }
  
  const getSession = (id: string) => sessions.find(s => s.id === id)

  return { sessions, addSession, updateSession, deleteSession, getSession }
}