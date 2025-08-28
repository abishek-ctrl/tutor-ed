import React, { forwardRef, useImperativeHandle, useRef } from 'react'

const AudioPlayer = forwardRef(({ mascotRef }: any, ref) => {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)

  useImperativeHandle(ref, () => ({
    async playAudioBuffer(arrayBuffer: ArrayBuffer, emotion: string) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      const audioCtx = audioCtxRef.current
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0))
      if (sourceRef.current) {
        try { sourceRef.current.stop() } catch {}
      }
      const src = audioCtx.createBufferSource()
      src.buffer = audioBuffer
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048
      const gain = audioCtx.createGain()
      src.connect(analyser)
      analyser.connect(gain)
      gain.connect(audioCtx.destination)
      src.start(0)
      sourceRef.current = src
      analyserRef.current = analyser
      // set mascot to happy while teaching
      if (mascotRef && mascotRef.current) {
        mascotRef.current.setEmotion('happy')
      }
      const data = new Float32Array(analyser.fftSize)
      function step() {
        analyser.getFloatTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) { sum += data[i]*data[i] }
        const rms = Math.sqrt(sum / data.length)
        const open = Math.min(1, Math.max(0, (rms * 20)))
        if (mascotRef && mascotRef.current) {
          mascotRef.current.setMouthOpen(open)
        }
        rafRef.current = requestAnimationFrame(step)
      }
      step()
      src.onended = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        if (mascotRef && mascotRef.current) {
          mascotRef.current.setMouthOpen(0)
          // keep mascot happy for a small delay, then idle happy
          setTimeout(() => mascotRef.current.setEmotion('happy'), 200)
        }
      }
    }
  }))

  return null
})

export default AudioPlayer
