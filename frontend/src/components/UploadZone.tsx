import { useRef, useState } from 'react'
import { CloudUpload, FolderOpen } from 'lucide-react'

type Props = {
  onFiles: (files: File[]) => void
  accept?: string
}

export default function UploadZone({ onFiles, accept }: Props) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    onFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    onFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div
      className={"w-full max-w-2xl p-10 rounded-3xl glass cursor-pointer transition " + (isDragOver ? "drag-border" : "")}
      onClick={()=>inputRef.current?.click()}
      onDragOver={(e)=>{e.preventDefault(); setIsDragOver(true)}}
      onDragLeave={()=>setIsDragOver(false)}
      onDrop={onDrop}
    >
      <div className="flex flex-col items-center justify-center gap-3 text-center">
        <CloudUpload className="text-brand-500" size={32} />
        <div className="text-zinc-800 dark:text-zinc-100 font-semibold">Drag & drop files here</div>
        <div className="text-zinc-500 dark:text-zinc-400 text-sm">or click to select from your device</div>
        <div className="text-xs text-zinc-400 mt-2">Supports PDF, DOCX, TXT, CSV, MD and more</div>
        <button className="mt-4 btn-ghost"><FolderOpen className="mr-2" size={16}/>Browse</button>
      </div>
      <input ref={inputRef} type="file" accept={accept} multiple hidden onChange={onPick} />
    </div>
  )
}
