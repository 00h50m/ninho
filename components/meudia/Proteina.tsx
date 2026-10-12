'use client'
// Proteína do dia: quanto já comeu, quanto falta e o que encaixar (com os alimentos da pessoa).
import { useState } from 'react'
import { customToFood, itemFor, mealForTime, MEALS, type CustomFood, type FoodProfile } from '@/lib/nutricao'
import { proteinIdeas, proteinTarget } from '@/lib/protein'
import type { PKind } from '@/lib/meudia'

const N1 = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')

export function ProteinCard(p: {
  prof: FoodProfile, weight: number, eatenP: number, kcalLeft: number, foods: CustomFood[], nowHM: string
  onAdd: (kind: PKind, value: number | null, data?: Record<string, any>) => Promise<void>
}) {
  const t = proteinTarget(p.prof, p.weight)
  const left = Math.max(0, t.g - p.eatenP)
  const pct = Math.min(100, Math.round(p.eatenP / Math.max(1, t.g) * 100))
  const ideas = proteinIdeas(left, p.kcalLeft, p.foods)
  const [busy, setBusy] = useState<string | null>(null)
  async function launch(f: CustomFood, n: number) {
    setBusy(f.id)
    const it = itemFor(customToFood(f), n, 'porcao', `${n}x ${f.portion}`)
    const meal = mealForTime(p.nowHM)
    try { await p.onAdd('refeicao', it.kcal, { meal, text: `${f.name} (${n}x ${f.portion})`, items: [it] }) } catch { /* aviso já mostrado */ } finally { setBusy(null) }
  }
  if (p.prof.hide_numbers) return null
  return (
    <section className="card md-card pt-card" aria-labelledby="pt-t">
      <div className="slbl" id="pt-t">💪 Proteína de hoje</div>
      <div className="al-big"><b className="mono">{left > 0 ? `${Math.round(left)} g` : 'Meta batida ✓'}</b><span>{left > 0 ? `faltam para ${t.g} g (${N1(t.perKg)} g por kg${t.baseKg !== p.weight ? ` do peso desejado, ${N1(t.baseKg)} kg` : ''})` : `${Math.round(p.eatenP)} g de ${t.g} g`}</span></div>
      <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Quanto já comeu da meta de proteína"><div className="barf" style={{ width: `${pct}%`, background: 'var(--green)' }}/></div>
      {left > 0 && (ideas.length ? <>
        <p className="row-s pt-q">Para completar, com o que você tem em Meus alimentos{p.kcalLeft > 0 ? ` (cabe nas ${Math.round(p.kcalLeft)} kcal que restam)` : ''}:</p>
        <ul className="pt-ideas">{ideas.map(i => <li key={i.food.id}>
          <span><b>{i.food.name}</b><small>{i.portions > 1 ? `${i.portions}x ` : ''}{i.food.portion} · +{N1(i.protein)} g · {i.kcal} kcal</small></span>
          <button className="btn btn-s" disabled={busy === i.food.id} onClick={() => launch(i.food, i.portions)} aria-label={`Lançar ${i.food.name} no ${MEALS.find(m => m[0] === mealForTime(p.nowHM))?.[2]}`}>{busy === i.food.id ? 'Lançando…' : 'Lançar'}</button>
        </li>)}</ul>
      </> : <p className="row-s pt-q">Cadastre alimentos com proteína em Meus alimentos (ou tire foto do rótulo) para ver sugestões aqui.</p>)}
    </section>
  )
}
