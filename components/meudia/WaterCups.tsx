'use client'
// Água em copinhos: um toque num copo vazio bebe mais um copo; o último copo
// cheio desfaz. O "tanque" enche até a meta e comemora quando bate.
const L = (ml: number) => `${String(Math.round(ml / 100) / 10).replace('.', ',')} L`

export function WaterCups({ ml, goal, cup, onAdd, onUndo, compact }: { ml: number, goal: number, cup: number, onAdd: () => void, onUndo?: () => void, compact?: boolean }) {
  const n = Math.max(1, Math.min(12, Math.ceil(goal / cup)))
  const filled = Math.min(n, Math.floor(ml / cup + 0.001))
  const pct = Math.min(100, Math.round(ml / Math.max(1, goal) * 100)), hit = ml >= goal
  return (
    <div className={`wc ${compact ? 'compact' : ''} ${hit ? 'hit' : ''}`}>
      <div className="wc-tank" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Água de hoje: ${L(ml)} de ${L(goal)}`}>
        <div className="wc-fill" style={{ width: `${pct}%` }}/>
        <span className="wc-txt">{hit ? `Meta batida 🎉 · ${L(ml)}` : `${L(ml)} de ${L(goal)}`}</span>
      </div>
      <div className="wc-cups">{Array.from({ length: n }, (_, i) => {
        const on = i < filled, last = i === filled - 1
        const glass = <svg viewBox="0 0 24 28" aria-hidden="true"><path className="wc-g" d="M4 3h16l-2 22H6Z"/><path className="wc-w" d="M5.6 11h12.8l-1.3 13H6.9Z"/></svg>
        if (on && !last) return <span key={i} className="wc-cup on" aria-hidden="true">{glass}</span>
        return <button key={i} type="button" className={`wc-cup ${on ? 'on' : ''}`} aria-pressed={on}
          aria-label={on ? `Copo ${i + 1} de ${n} cheio. Toque para desfazer` : `Copo ${i + 1} de ${n} vazio. Toque para beber ${cup} ml`}
          onClick={() => on ? onUndo?.() : onAdd()}>{glass}</button>
      })}{ml > n * cup && <span className="wc-more">+{Math.round((ml - n * cup) / cup)}</span>}</div>
    </div>
  )
}
