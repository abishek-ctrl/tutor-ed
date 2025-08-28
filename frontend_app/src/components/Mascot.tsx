import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react'

export type MascotHandle = {
  setEmotion: (e: string) => void
  setMouthOpen: (v: number) => void
}

const Mascot = forwardRef<MascotHandle>((props, ref) => {
  const [emotion, setEmotion] = useState('happy') // default happy
  const mouthRef = useRef<HTMLCanvasElement | null>(null)
  const mouthOpenRef = useRef(0)

  useImperativeHandle(ref, () => ({
    setEmotion: (e: string) => setEmotion(e || 'happy'),
    setMouthOpen: (v: number) => {
      mouthOpenRef.current = v
    }
  }))

  useEffect(() => {
    let raf = 0
    const canvas = mouthRef.current
    const ctx = canvas?.getContext('2d')!
    function draw() {
      if (!canvas) return
      const w = canvas.width = canvas.clientWidth * devicePixelRatio
      const h = canvas.height = canvas.clientHeight * devicePixelRatio
      ctx.clearRect(0,0,w,h)
      // Draw mouth based on mouthOpenRef
      const open = Math.max(0, Math.min(1, mouthOpenRef.current))
      ctx.fillStyle = '#222'
      const centerX = w/2
      const centerY = h/2
      const radius = Math.max(8, (w/6))
      const mouthHeight = 8 + open * (h/3)
      ctx.beginPath()
      ctx.ellipse(centerX, centerY, radius, mouthHeight, 0, 0, Math.PI*2)
      ctx.fill()
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className={`mascot ${emotion}`}>
      <div className="face">
        <div className="eyes">
          <div className="eye left" />
          <div className="eye right" />
        </div>
        <canvas ref={mouthRef} className="mouth-canvas" />
      </div>
      <div className="emotion-label">{emotion}</div>
    </div>
  )
})

export default Mascot
