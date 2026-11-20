'use client'
// Ajustes › Módulos da casa: a casa liga ou desliga os pets (aba Cães). A IA aparece só como
// informação: quem administra o Ninho é que liga para cada casa (migration 046).
import { useEffect, useState } from 'react'
import type { Features } from '@/lib/modulos'

export function ModulosCard({ features, pets, onPets }: { features: Features, pets: boolean, onPets: (on: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false), [on, setOn] = useState(pets)
  useEffect(() => setOn(pets), [pets])
  return (
    <section className="card aj-sec" id="aj-modulos" aria-labelledby="mod-h" style={{ marginBottom: 14 }}>
      <div className="slbl" id="mod-h">Módulos da casa</div>
      <label className="aj-switch">
        <span><b>🐾 Pets</b><small>A aba Cães, as rotinas (ração, passeio) e a saúde dos pets</small></span>
        <input type="checkbox" role="switch" checked={on} disabled={busy} aria-label="Pets: mostrar a aba Cães"
          onChange={async e => { const v = e.target.checked; setOn(v); setBusy(true); try { await onPets(v) } catch { setOn(!v) } finally { setBusy(false) } }}/>
      </label>
      <div className="aj-switch aj-ro">
        <span><b>✨ IA</b><small>{features.ia
          ? 'Ligada: Faxinão, Perguntar ao Ninho, planejar o dia, fotos no Meu dia e o Telegram em texto livre e áudio.'
          : 'Desligada nesta casa. O resto do Ninho funciona igual; quem administra o Ninho pode ligar.'}</small></span>
        <span className={`chip ${features.ia ? 'green' : ''}`}>{features.ia ? 'ligada' : 'desligada'}</span>
      </div>
    </section>
  )
}
