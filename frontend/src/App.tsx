import { useEffect, useState } from 'react'
import EntryScreen from './components/EntryScreen'
import RagInit from './components/RagInit'
import MascotPage from './components/MascotPage'
import { initOrCheckUser, listUserDocs } from './services/api'

type User = { name: string; email: string }

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [hasData, setHasData] = useState<boolean | null>(null)

  useEffect(()=>{
    const cached = localStorage.getItem('ai_tutor_user')
    if (cached) setUser(JSON.parse(cached))
  }, [])

  useEffect(()=>{
    (async()=>{
      if (!user) return
      const status = await initOrCheckUser(user.email).catch(()=>null)
      if (status && typeof status.has_data === 'boolean') {
        setHasData(status.has_data)
      } else {
        const docs = await listUserDocs(user.email)
        setHasData(docs.length > 0)
      }
    })()
  }, [user])

  if (!user) return <EntryScreen onSubmit={(u)=>{ setUser(u); localStorage.setItem('ai_tutor_user', JSON.stringify(u)) }} />
  if (hasData === null) return <div className="h-screen flex items-center justify-center text-gray-500">Checking your knowledge base…</div>
  if (!hasData) return <RagInit user={user} onComplete={()=>setHasData(true)} />
  return <MascotPage user={user} />
}
