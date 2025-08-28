import { API_BASE } from './config'

export async function uploadStt(blob: Blob): Promise<string> {
  const form = new FormData()
  form.append('file', blob, 'utterance.webm')
  const res = await fetch(`${API_BASE}/stt`, { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'STT failed')
  }
  const txt = await res.text()
  return txt
}

export async function chat(message: string, sessionId: string) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({message, session_id: sessionId})
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Chat failed')
  }
  return res.json()
}

export async function tts(text: string, voice?: string) {
  const res = await fetch(`${API_BASE}/tts`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({text, voice})
  })
  if (!res.ok) {
    const textErr = await res.text()
    throw new Error(textErr || 'TTS failed')
  }
  const arrayBuffer = await res.arrayBuffer()
  return arrayBuffer
}

export async function uploadDoc(file: File) {
  const form = new FormData()
  form.append('file', file, file.name)
  const res = await fetch(`${API_BASE}/docs/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Upload failed')
  }
  return res.json()
}

/**
 * List indexed documents.
 * Backend returns: { docs: [ { source: string, snippet: string }, ... ] }
 */
export async function listDocs() {
  const res = await fetch(`${API_BASE}/docs/list`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'List docs failed')
  }
  const payload = await res.json()
  // defensive: return an array or empty array
  if (!payload || !Array.isArray(payload.docs)) {
    return []
  }
  return payload.docs
}