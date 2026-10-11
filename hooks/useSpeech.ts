'use client'
// Ditado pelo navegador (Chrome/Android/Safari), quando existe: cada frase entendida chama onText.
import { useRef, useState } from 'react'

/** Voz pelo navegador (Chrome/Android/Safari), quando existe. */
export function useSpeech(onText: (t: string) => void) {
  const [on, setOn] = useState(false), ref = useRef<any>(null)
  const SR = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null
  function toggle() {
    if (on) { ref.current?.stop(); return }
    const r = new SR(); r.lang = 'pt-BR'; r.continuous = true; r.interimResults = false
    r.onresult = (e: any) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) onText(e.results[i][0].transcript) }
    r.onend = () => setOn(false); r.onerror = () => setOn(false)
    ref.current = r; r.start(); setOn(true)
  }
  return { supported: !!SR, on, toggle }
}

