import { useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'

type Props = {
  onUtterance: (blob: Blob) => Promise<void> | void
}

export default function MicButton({ onUtterance }: Props) {
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunks = useRef<BlobPart[]>([])

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    mediaRecorderRef.current = mr
    audioChunks.current = []

    mr.ondataavailable = (e)=> audioChunks.current.push(e.data)
    mr.onstop = async ()=>{
      const blob = new Blob(audioChunks.current, { type: 'audio/webm' })
      await onUtterance(blob)
      // cleanup
      stream.getTracks().forEach(t=>t.stop())
    }
    mr.start()
    setRecording(true)
  }

  function stop() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  return (
    <button onClick={()=> recording ? stop() : start()} className="btn-primary rounded-full w-16 h-16 flex items-center justify-center">
      {recording ? <Square/> : <Mic/>}
    </button>
  )
}