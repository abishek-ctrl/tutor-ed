import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'

type Props = {
  onUtterance: (blob: Blob) => Promise<void> | void
}

export default function MicButton({ onUtterance }: Props) {
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunks = useRef<BlobPart[]>([])
  const acRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const silenceTimer = useRef<number | null>(null)

  useEffect(()=>{
    return ()=>{
      if (silenceTimer.current) window.clearTimeout(silenceTimer.current)
      acRef.current?.close()
    }
  }, [])

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const ac = new AudioContext()
    acRef.current = ac
    const source = ac.createMediaStreamSource(stream)
    sourceRef.current = source
    const analyser = ac.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)
    analyserRef.current = analyser

    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    mediaRecorderRef.current = mr
    audioChunks.current = []

    mr.ondataavailable = (e)=> audioChunks.current.push(e.data)
    mr.onstop = async ()=>{
      const blob = new Blob(audioChunks.current, { type: 'audio/webm' })
      await onUtterance(blob)
      // cleanup
      stream.getTracks().forEach(t=>t.stop())
      analyser.disconnect()
      source.disconnect()
      await ac.close()
      acRef.current = null
    }
    mr.start()

    setRecording(true)
    loopVAD()
  }

  function stop() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (silenceTimer.current) window.clearTimeout(silenceTimer.current)
  }

  function loopVAD() {
    const analyser = analyserRef.current
    if (!analyser) return
    const data = new Float32Array(analyser.fftSize)
    const threshold = 0.0015 // RMS threshold
    const windowMs = 2000 // 2s
    let lastAbove = performance.now()

    function tick() {
      analyser.getFloatTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
      const rms = Math.sqrt(sum / data.length)
      if (rms > threshold) lastAbove = performance.now()
      const silentFor = performance.now() - lastAbove
      if (silentFor >= windowMs) {
        stop()
        return
      }
      if (recording) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  return (
    <button onClick={()=> recording ? stop() : start()} className="btn-primary rounded-full w-16 h-16 flex items-center justify-center">
      {recording ? <Square/> : <Mic/>}
    </button>
  )
}
