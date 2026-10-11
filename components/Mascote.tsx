'use client'
// Nino, o mascote do Ninho: passarinho desenhado em SVG com as cores do tema.
// O rosto muda com o humor do dia; os enfeites aparecem conforme o nível.
// Tocar nele mostra uma dica. Respeita "reduzir animações".
import { useEffect, useState } from 'react'
import { MASCOT_NAME, STAGES, tipFor, type MascotSay, type Mood } from '@/lib/mascote'

function Eyes({ mood }: { mood: Mood }) {
  if (mood === 'sono') return <g className="ms-line"><path d="M37 46q4 3 8 0"/><path d="M55 46q4 3 8 0"/></g>
  if (mood === 'festa') return <g className="ms-line"><path d="M37 47q4-5 8 0"/><path d="M55 47q4-5 8 0"/></g>
  if (mood === 'calma') return <g className="ms-line"><path d="M37 46h8"/><path d="M55 46h8"/></g>
  const r = mood === 'animado' ? 4.2 : 3.4
  return <g>
    <circle className="ms-eye" cx="41" cy="46" r={r}/><circle className="ms-eye" cx="59" cy="46" r={r}/>
    <circle className="ms-shine" cx="42.3" cy="44.6" r="1.1"/><circle className="ms-shine" cx="60.3" cy="44.6" r="1.1"/>
    {mood === 'preocupado' && <g className="ms-line"><path d="M36 39l8 2"/><path d="M64 39l-8 2"/></g>}
  </g>
}

export function MascotBird({ mood, stage, size = 64 }: { mood: Mood, stage: number, size?: number }) {
  return <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className={`ms-svg m-${mood}`}>
    <ellipse className="ms-shadow" cx="50" cy="93" rx="22" ry="3.5"/>
    <g className="ms-hop">
      {stage >= 2 && <path className="ms-tuft" d="M48 20q-2-10 4-13q-1 7 3 9q3-6 9-5q-6 4-8 11z"/>}
      <ellipse className="ms-body" cx="50" cy="55" rx="31" ry="32"/>
      <ellipse className="ms-belly" cx="50" cy="70" rx="19" ry="14"/>
      <path className="ms-wing" d="M21 58q-6 14 8 20q4-10-2-20z"/>
      <path className="ms-wing" d="M79 58q6 14-8 20q-4-10 2-20z"/>
      <Eyes mood={mood}/>
      {mood !== 'preocupado' && <><circle className="ms-blush" cx="33" cy="52" r="3.6"/><circle className="ms-blush" cx="67" cy="52" r="3.6"/></>}
      <path className="ms-beak" d={mood === 'festa' || mood === 'animado' ? 'M45 52h10l-5 8z' : 'M45 52h10l-5 5z'}/>
      {stage >= 3 && <path className="ms-scarf" d="M27 71q23 10 46 0v6q-23 10-46 0z M62 76l7 12l-9-2z"/>}
      {stage >= 4 && <g className="ms-flower"><circle cx="70" cy="28" r="3.2"/><circle cx="75" cy="31" r="3.2"/><circle cx="73" cy="36" r="3.2"/><circle cx="67" cy="36" r="3.2"/><circle cx="65" cy="31" r="3.2"/><circle className="ms-flower-c" cx="70" cy="32" r="2.4"/></g>}
      {stage >= 5 && <path className="ms-crown" d="M36 26l4-10l6 7l4-9l4 9l6-7l4 10z"/>}
      <path className="ms-feet" d="M42 86v5m-3 0h6M58 86v5m-3 0h6"/>
    </g>
    {mood === 'sono' && <text className="ms-z" x="74" y="22">z</text>}
    {mood === 'preocupado' && <path className="ms-drop" d="M78 38q-4 6 0 8q4-2 0-8z"/>}
    {mood === 'festa' && <g className="ms-confetti"><circle cx="14" cy="22" r="2.2"/><circle cx="86" cy="18" r="2.2"/><rect x="10" y="44" width="4" height="4" rx="1"/><rect x="85" y="46" width="4" height="4" rx="1"/></g>}
    {mood === 'animado' && <path className="ms-spark" d="M84 24l2 5l5 2l-5 2l-2 5l-2-5l-5-2l5-2z"/>}
  </svg>
}

export function MascoteCard(p: { say: MascotSay, today: string }) {
  const [taps, setTaps] = useState(0), [hop, setHop] = useState(false)
  // o dia mudou (concluiu algo, modo sobrevivência…): volta a mostrar a fala nova
  useEffect(() => { setTaps(0) }, [p.say.line])
  const line = taps > 0 ? `💡 ${tipFor(p.today, taps - 1)}` : p.say.line
  return <div className="card masc">
    <button className={`masc-b ${hop ? 'hop' : ''}`} onClick={() => { setTaps(t => t + 1); setHop(true); setTimeout(() => setHop(false), 450) }}
      aria-label={`${MASCOT_NAME}, o mascote do Ninho (${STAGES[p.say.stage - 1].toLowerCase()}). Tocar para uma dica`}>
      <MascotBird mood={p.say.mood} stage={p.say.stage}/>
    </button>
    <div className="masc-bubble" role="status" aria-live="polite">
      <b>{MASCOT_NAME}</b><span>{line}</span>
    </div>
  </div>
}
