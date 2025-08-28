import React, { useEffect, useRef, useState } from 'react'

type Props = {
  onRecorded: (blob: Blob) => void
  setIsListening?: (v: boolean) => void
}

export default function MicButton({ onRecorded, setIsListening }: Props) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Float32Array | null>(null)
  const silenceStartRef = useRef<number | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setSupported(false)
    }
    return () => {
      stopAll()
    }
  }, [])

  function stopAll() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch {}
      audioCtxRef.current = null
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      audioChunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        onRecorded(blob)
        // cleanup
        stopAll()
        setIsRecording(false)
        setIsListening && setIsListening(false)
      }
      mr.start(250) // collect every 250ms
      // Setup AudioContext VAD
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyserRef.current = analyser
      const data = new Float32Array(analyser.fftSize)
      dataArrayRef.current = data
      silenceStartRef.current = null
      setIsRecording(true)
      setIsListening && setIsListening(true)

      function monitor() {
        if (!analyserRef.current || !dataArrayRef.current) return
        analyserRef.current.getFloatTimeDomainData(dataArrayRef.current)
        // compute RMS
        let sum = 0
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          const v = dataArrayRef.current[i]
          sum += v * v
        }
        const rms = Math.sqrt(sum / dataArrayRef.current.length)
        const SILENCE_THRESHOLD = 0.0012 // tuned empirically
        const now = performance.now()
        if (rms < SILENCE_THRESHOLD) {
          if (silenceStartRef.current === null) silenceStartRef.current = now
          const silenceElapsed = now - (silenceStartRef.current || now)
          if (silenceElapsed > 2000) {
            // stop recording due to 2s silence
            try { mediaRecorderRef.current?.stop() } catch {}
            return
          }
        } else {
          silenceStartRef.current = null
        }
        requestAnimationFrame(monitor)
      }
      requestAnimationFrame(monitor)
    } catch (err) {
      console.error('Microphone access denied', err)
      alert('Microphone access denied. Please allow microphone permission or use text input fallback.')
    }
  }

  function stopRecordingManual() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    } else {
      stopAll()
    }
  }

  return (
    <div className="mic-container">
      <button
        className={`mic-btn ${isRecording ? 'recording' : ''}`}
        onClick={() => {
          if (isRecording) {
            stopRecordingManual()
          } else {
            startRecording()
          }
        }}
        aria-pressed={isRecording}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? '⏹️ Stop' : '🎤 Click to Talk'}
      </button>
      <div className="hint">Click to start; will auto-stop after 2s silence</div>
    </div>
  )
}
