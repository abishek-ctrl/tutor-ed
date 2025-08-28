import React from 'react'

export default function ChatWindow({ chatHistory }: { chatHistory: any[] }) {
  return (
    <div className="chat-window" role="log" aria-live="polite">
      {chatHistory.map((t, i) => (
        <div key={i} className={`chat-turn ${t.role}`}>
          <div className="bubble">
            <div className="text">{t.text}</div>
            {t.citations && t.citations.length > 0 && (
              <div className="citations">
                {t.citations.map((c: any, idx: number) => (
                  <button key={idx} className="citation">{c.source || c.id}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
