import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from './context/AuthContext'
import { listUserDocs } from './services/api'
import { useSessions } from './hooks/useSessions'

import EntryScreen from './components/EntryScreen'
import MascotPage from './components/MascotPage'
import SessionDashboard from './components/SessionDashboard'
import CreateSession from './components/CreateSession'
import ConfirmationModal from './components/ConfirmationModal'
import ProtectedRoute from './router/ProtectedRoute'

type Doc = { source: string; snippet: string }
type ModalState = { isOpen: boolean; title: string; message: string; onConfirm: () => void }

// A faster, cleaner, and more subtle cross-fade animation
const pageVariants = {
  initial: { opacity: 0 },
  in: { opacity: 1 },
  out: { opacity: 0 },
}
const pageTransition = {
  type: 'tween',
  ease: 'easeOut',
  duration: 0.2, // Faster duration for a snappy feel
}

export default function App() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [allUserDocs, setAllUserDocs] = useState<Doc[]>([])
  const [isDocsLoading, setIsDocsLoading] = useState(true);
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '', onConfirm: () => {} })

  const sessionsApi = useSessions(user ? user.email : null)

  const showConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setModalState({ isOpen: true, title, message, onConfirm })
  }

  async function fetchDocs() {
    if (user) {
      setIsDocsLoading(true);
      try {
        const docs = await listUserDocs(user.email);
        setAllUserDocs(docs);
        if (docs.length > 0) {
          localStorage.setItem(`has_docs_${user.email}`, 'true');
        }
      } catch (e) {
        console.error("Failed to fetch docs", e);
        setAllUserDocs([]);
      } finally {
        setIsDocsLoading(false);
      }
    } else {
      setAllUserDocs([]);
      setIsDocsLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthLoading) {
      fetchDocs();
    }
  }, [user, isAuthLoading]);

  useEffect(() => {
    if (isDocsLoading || !sessionsApi.sessions.length) return;

    const availableDocSources = new Set(allUserDocs.map(doc => doc.source));
    
    sessionsApi.sessions.forEach(session => {
      const newSelectedDocs = session.selectedDocs.filter(docName => availableDocSources.has(docName));

      if (newSelectedDocs.length !== session.selectedDocs.length) {
        sessionsApi.updateSession(session.id, { selectedDocs: newSelectedDocs });
      }
    });

  }, [allUserDocs, isDocsLoading]);


  useEffect(() => {
    if (user && !isDocsLoading) {
      if (['/login', '/'].includes(location.pathname)) {
        navigate('/dashboard');
      }
    }
  }, [user, isDocsLoading, location.pathname, navigate]);


  if (isAuthLoading) {
     return <div className="h-screen flex items-center justify-center bg-zinc-900"></div>;
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
                sessions={sessionsApi.sessions} 
                allDocs={allUserDocs}
                isLoading={isDocsLoading}
                onRefreshDocs={fetchDocs}
                onDeleteSession={sessionsApi.deleteSession} 
                showConfirmation={showConfirmation} 
              />} />
              <Route path="/session/new" element={<CreateSession
                allDocs={allUserDocs}
                onRefreshDocs={fetchDocs}
                onCreate={(name, docs) => {
                  const newSession = sessionsApi.addSession({ name, selectedDocs: docs, messages: [] });
                  navigate(`/session/${newSession.id}`);
                }}
              />} />
              <Route path="/session/:sessionId" element={<MascotPage 
                allDocs={allUserDocs} 
                onRefreshDocs={fetchDocs} 
                sessionsApi={sessionsApi} 
              />} />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Route>
          </Routes>
        </motion.div>
      </AnimatePresence>
    </>
  )
}