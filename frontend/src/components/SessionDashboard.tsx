import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Plus, MessageSquare, LogOut, Trash2, BookUp } from 'lucide-react'
import { Session } from '../hooks/useSessions'
import { useAuth } from '../context/AuthContext'
import { deleteUserDocs, uploadDocs } from '../services/api'
import UploadZone from './UploadZone'

type Doc = { source: string; snippet: string }

type Props = {
  sessions: Session[]
  allDocs: Doc[]
  onRefreshDocs: () => Promise<void>
  onDeleteSession: (id: string) => void
  showConfirmation: (title: string, message: string, onConfirm: () => void) => void
}

export default function SessionDashboard({ sessions, allDocs, onRefreshDocs, onDeleteSession, showConfirmation }: Props) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [isUploading, setIsUploading] = useState(false)

  async function handleDeleteData() {
    if (!user) return
    showConfirmation(
      'Delete All Data?',
      'Are you sure you want to delete ALL your indexed documents? This will clear your knowledge base permanently.',
      async () => {
        try {
          await deleteUserDocs(user.email)
          await onRefreshDocs()
        } catch (e: any) {
          console.error('Deletion failed:', e)
        }
      }
    )
  }
  
  async function handleFileUpload(files: File[]) {
    if (!user) return
    setIsUploading(true)
    try {
      await uploadDocs(user.email, files)
      await onRefreshDocs()
    } catch (e) {
      console.error("Upload failed", e)
    } finally {
      setIsUploading(false)
    }
  }


  function handleDeleteSession(session: Session) {
    showConfirmation(
      `Delete Session "${session.name}"?`,
      'This will permanently delete this chat session and its history.',
      () => onDeleteSession(session.id)
    )
  }

  const hasDocuments = allDocs.length > 0

  return (
    <div className="relative min-h-screen w-screen bg-slate-900 text-zinc-200 font-sans p-6 md:p-10">
      <div className="absolute top-6 right-6 flex items-center gap-4">
        {hasDocuments && (
          <motion.button
            whileHover={{ y: -1, scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={handleDeleteData}
            className="btn-ghost text-red-400 hover:bg-red-500/10 flex items-center gap-2"
          >
            <Trash2 size={16} /> Delete All Data
          </motion.button>
        )}
        <motion.button
          whileHover={{ y: -1, scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={logout} className="btn-ghost flex items-center gap-2"
        >
          <LogOut size={16} /> Logout
        </motion.button>
      </div>

      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-display font-bold text-white mb-2">
            {hasDocuments ? "Your Learning Sessions" : `Welcome, ${user?.name.split(' ')[0]}!`}
          </h1>
          <p className="text-zinc-400 mb-10">
            {hasDocuments ? "Select an existing session or start a new one." : "Let's build your knowledge base. Upload your first document to begin."}
          </p>
        </motion.div>

        {!hasDocuments ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <UploadZone onFiles={handleFileUpload} />
            {isUploading && (
              <div className="text-center mt-4 text-zinc-400 flex items-center justify-center gap-2">
                <BookUp className="animate-pulse" />
                <span>Processing your documents... this may take a moment.</span>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <motion.button
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/session/new')}
              className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl bg-slate-800 border border-brand-500 border-dashed hover:bg-slate-700 transition-colors h-48"
            >
              <Plus className="text-brand-500" size={32} />
              <span className="font-semibold">New Session</span>
            </motion.button>

            {sessions.map((s, i) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4, scale: 1.02 }}
                key={s.id}
                className="group relative flex flex-col justify-between p-6 rounded-2xl bg-slate-800 hover:bg-slate-700 transition-colors h-48 cursor-pointer"
                onClick={() => navigate(`/session/${s.id}`)}
              >
                <div>
                  <MessageSquare className="text-zinc-400 mb-3" />
                  <h3 className="font-semibold text-white truncate">{s.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1">{s.messages.length} messages</p>
                </div>
                <p className="text-xs text-zinc-400 truncate">
                  Sources: {s.selectedDocs.length > 0 ? s.selectedDocs.join(', ') : 'None'}
                </p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="absolute top-3 right-3 icon-btn opacity-0 group-hover:opacity-100 text-red-400 hover:bg-red-500/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(s);
                  }}
                >
                  <Trash2 size={16} />
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}