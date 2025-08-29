import { API_BASE } from '../lib/config'

export async function initOrCheckUser(email: string) {
  const res = await fetch(`${API_BASE}/user/has-data?email=${encodeURIComponent(email)}`)
  if (!res.ok) return { has_data: false }
  return res.json()
}

export async function listUserDocs(email: string) {
  const res = await fetch(`${API_BASE}/docs/list?email=${encodeURIComponent(email)}`)
  if (!res.ok) return []
  const payload = await res.json()
  return payload.docs || []
}

export async function uploadDocs(email: string, files: File[]) {
  const form = new FormData()
  form.append('email', email)
  for (const f of files) form.append('files', f, f.name)
  const res = await fetch(`${API_BASE}/docs/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.json().catch(()=>({}))
}

export async function deleteUserDocs(email: string) {
  const url = `${API_BASE}/docs/delete?email=${encodeURIComponent(email)}`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
  return res.json().catch(()=>({}))
}

export async function sttUpload(blob: Blob, email: string) {
  const form = new FormData()
  form.append('file', blob, 'utterance.webm')
  form.append('email', email)
  const res = await fetch(`${API_BASE}/stt`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.text()
}

export async function chat(message: string, sessionId: string, name: string, email: string) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ message, session_id: sessionId, name, email, short_answer: true })
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function tts(text: string, voice?: string) {
  const res = await fetch(`${API_BASE}/tts`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ text, voice })
  })
  if (!res.ok) throw new Error(await res.text())
  const buf = await res.arrayBuffer()
  return buf
}