import React, { useEffect, useState, useRef } from 'react'
import { uploadDoc, listDocs } from '../lib/api'

export default function RAGPanel({ initialDocs }: { initialDocs?: any[] }) {
  const [docs, setDocs] = useState<any[]>(initialDocs || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    // load docs on mount if not provided
    if (!initialDocs || initialDocs.length === 0) {
      fetchDocs()
    }
  }, [])

  async function fetchDocs() {
    setLoading(true)
    setError(null)
    try {
      const d = await listDocs()
      setDocs(d || [])
    } catch (err: any) {
      console.error('Failed to list docs', err)
      setError(err.message || 'Failed to list docs')
    } finally {
      setLoading(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    try {
      setLoading(true)
      await uploadDoc(file)
      await fetchDocs()
      alert('Uploaded and indexed: ' + file.name)
    } catch (err: any) {
      console.error(err)
      alert('Upload failed: ' + (err.message || String(err)))
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="rag-panel">
      <div className="upload">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.md,.txt"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => fileRef.current?.click()}>Upload Document</button>
          <button onClick={fetchDocs} disabled={loading}>Refresh</button>
        </div>
        {error && <div style={{ color: 'salmon', marginTop: 8 }}>{error}</div>}
      </div>

      <div className="doc-list" style={{ marginTop: 12 }}>
        {loading && <div className="muted">Loading documents…</div>}
        {!loading && docs.length === 0 && <div className="muted">No documents uploaded yet.</div>}

        {docs.map((d: any, idx: number) => (
          <div key={idx} className="doc-item" style={{ padding: 8, borderRadius: 8, marginBottom: 8, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontWeight: 600 }}>{d.source}</div>
            <div style={{ color: '#9aa4b2', marginTop: 6, whiteSpace: 'pre-wrap' }}>{d.snippet}</div>
          </div>
        ))}
      </div>
    </div>
  )
}