import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from './context/AuthContext'
import { initOrCheckUser, listUserDocs } from './services/api'
import { useSessions } from './hooks/useSessions'

import EntryScreen from './components/EntryScreen'
import MascotPage from './components/MascotPage'
import SessionDashboard from './components/SessionDashboard'
import CreateSession from './components/CreateSession'
import ConfirmationModal from './components/ConfirmationModal'
import ProtectedRoute from './router/ProtectedRoute'

type Doc = { source: string; snippet: string }
type ModalState = { isOpen: boolean; title: string; message: string; onConfirm: () => void }

const pageVariants = {
  initial: { opacity: 0 },
  in: { opacity: 1 },
  out: { opacity: 0 },
}
const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.3,
}

export default function App() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [allUserDocs, setAllUserDocs] = useState<Doc[]>([])
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '', onConfirm: () => {} })

  const { sessions, addSession, updateSession, deleteSession, getSession } = useSessions(user)

  const showConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setModalState({ isOpen: true, title, message, onConfirm })
  }

  async function fetchDocs() {
    if (user) {
      const docs = await listUserDocs(user.email)
      setAllUserDocs(docs)
    }
  }

  useEffect(() => {
    if (user) {
      fetchDocs() // Fetch docs whenever user is available
      // If user is on a public page after login, redirect to dashboard
      if (['/login', '/'].includes(location.pathname)) {
        navigate('/dashboard')
      }
    }
  }, [user, navigate])

  if (isAuthLoading) {
     return <div className="h-screen flex items-center justify-center bg-zinc-900"></div>; // Blank screen during auth check
  }

  return (
    <>
      <ConfirmationModal {...modalState} onClose={() => setModalState({ ...modalState, isOpen: false })} />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          transition={pageTransition}
        >
          <Routes location={location}>
            <Route path="/login" element={<EntryScreen />} />
            
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<SessionDashboard 
                sessions={sessions} 
                allDocs={allUserDocs}
                onRefreshDocs={fetchDocs}
                onDeleteSession={deleteSession} 
                showConfirmation={showConfirmation} 
              />} />
              <Route path="/session/new" element={<CreateSession
                allDocs={allUserDocs}
                onRefreshDocs={fetchDocs}
                onCreate={(name, docs) => {
                  const newSession = addSession({ name, selectedDocs: docs, messages: [] });
                  navigate(`/session/${newSession.id}`);
                }}
              />} />
              <Route path="/session/:sessionId" element={<MascotPage allDocs={allUserDocs} onRefreshDocs={fetchDocs} sessionsApi={{ getSession, updateSession }} />} />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Route>
          </Routes>
        </motion.div>
      </AnimatePresence>
    </>
  )
}