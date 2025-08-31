import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { uploadDocs } from '../services/api'
import UploadZone from './UploadZone'

type Doc = { source: string; snippet: string }

type Props = {
  allDocs: Doc[]
  onRefreshDocs: () => Promise<void>
  onCreate: (name: string, selectedDocs: string[]) => void
}

export default function CreateSession({ allDocs, onRefreshDocs, onCreate }: Props) {
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [sessionName, setSessionName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate()
  const { user } = useAuth()

  function handleToggleDoc(source: string) {
    const newSet = new Set(selectedDocs)
    if (newSet.has(source)) newSet.delete(source)
    else newSet.add(source)
    setSelectedDocs(newSet)
  }

  async function handleFileUpload(files: File[]) {
    if (!user) return
    setIsUploading(true)
    setSuccessMessage('');
    try {
      await uploadDocs(user.email, files)
      await onRefreshDocs() 
      const newFileNames = files.map(f => f.name)
      setSelectedDocs(prev => new Set([...prev, ...newFileNames]))
      setSuccessMessage(`${files.length} document(s) indexed successfully!`);
      setTimeout(() => setSuccessMessage(''), 4000); // Clear message
    } catch (e) {
      console.error("Upload failed", e)
      alert("Upload failed. Please try again.");
    } finally {
      setIsUploading(false)
    }
  }

  function handleCreate() {
    if (!sessionName.trim()) return
    onCreate(sessionName.trim(), Array.from(selectedDocs))
  }

  return (
    <div className="min-h-screen w-screen bg-slate-900 text-zinc-200 font-sans p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-10">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/dashboard')} className="btn-ghost mr-4">
            <ArrowLeft />
          </motion.button>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Create New Session</h1>
            <p className="text-zinc-400">Name your session and choose or upload the knowledge sources to use.</p>
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-medium text-zinc-400 mb-2">Session Name</label>
          <input
            className="w-full max-w-lg rounded-xl px-4 py-3 bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="e.g., Quantum Physics Study"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
          />
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Select Knowledge Sources</h2>
          {allDocs.length === 0 && <p className="text-zinc-500">You haven't uploaded any documents yet.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allDocs.map((doc) => (
              <motion.div
                whileHover={{ y: -2, transition: { duration: 0.1 } }}
                key={doc.source}
                onClick={() => handleToggleDoc(doc.source)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                  selectedDocs.has(doc.source) ? 'border-brand-500 bg-brand-500/10' : 'border-zinc-700 bg-zinc-800'
                }`}
              >
                <div className="flex items-start">
                  <input type="checkbox" checked={selectedDocs.has(doc.source)} readOnly className="mt-1 mr-3 h-4 w-4 rounded border-gray-600 bg-gray-700 text-brand-600 focus:ring-brand-500" />
                  <div>
                    <div className="font-mono font-semibold truncate">{doc.source}</div>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{doc.snippet}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Or Upload New Documents</h2>
          <UploadZone onFiles={handleFileUpload} />
          <AnimatePresence>
            {isUploading && <p className="text-sm text-zinc-400 mt-2">Uploading and indexing, please wait...</p>}
            {successMessage && (
                <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 text-sm text-green-400 mt-3"
                >
                <CheckCircle size={16} />
                <span>{successMessage}</span>
                </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }} whileHover={{ y: -2 }}
          onClick={handleCreate} disabled={!sessionName.trim() || isUploading}
          className="btn-primary disabled:opacity-50"
        >
          {isUploading ? 'Processing...' : 'Start Chat Session'}
        </motion.button>
      </div>
    </div>
  )
}