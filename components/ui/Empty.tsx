'use client'
// Ícone das telas vazias: o Nino com o emoji do assunto ao lado.
// Mantém a classe .empty-icon para o resto do estilo (.empty) continuar igual.
import { MascotBird } from '@/components/Mascote'
import type { Mood } from '@/lib/mascote'

export function EmptyNino({ icon, mood = 'calma' }: { icon?: string, mood?: Mood }) {
  return (
    <span className="empty-icon empty-nino" aria-hidden="true">
      <MascotBird mood={mood} stage={1} size={56}/>
      {icon && <span className="empty-badge">{icon}</span>}
    </span>
  )
}
