'use client'
// Exportar meus dados do Meu dia em CSV (backup ou para levar à nutricionista). Só os dados de quem baixa;
// o arquivo é montado no próprio aparelho.
import { useState } from 'react'
import { EXPORTS, exportCsv, type ExportKind } from '@/lib/exportCsv'
import { allMyLogs } from '@/lib/services/meudia'
import type { CustomFood } from '@/lib/nutricao'
import type { SavedMeal } from '@/lib/savedMeals'
import type { PLog } from '@/lib/meudia'
import type { Who } from '@/lib/types'

export function ExportCard({ householdId, me, foods, saved, today }: { householdId: string, me: Who, foods: CustomFood[], saved: SavedMeal[], today: string }) {
  const [busy, setBusy] = useState<ExportKind | null>(null), [err, setErr] = useState<string | null>(null)
  const [logs, setLogs] = useState<PLog[] | null>(null)
  async function download(k: ExportKind) {
    setBusy(k); setErr(null)
    try {
      const all = logs ?? await allMyLogs(householdId, me)
      setLogs(all)
      const csv = exportCsv(k, { logs: all, foods: foods.filter(f => f.who === me), saved: saved.filter(s => s.who === me) })
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = `ninho-${k}-${today}.csv`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch { setErr('Não foi possível montar o arquivo agora. Tente de novo.') } finally { setBusy(null) }
  }
  return (
    <section className="card" aria-labelledby="md-exp">
      <div className="slbl" id="md-exp">⬇️ Exportar meus dados</div>
      <p className="row-s">Planilhas (CSV) com todo o seu histórico, para guardar ou levar à nutricionista. Abrem no Excel e no Google Planilhas. Só os seus dados.</p>
      <div className="md-acts ex-acts">
        {EXPORTS.map(([k, l]) => <button key={k} className="btn btn-g" disabled={!!busy} onClick={() => download(k)}>{busy === k ? 'Montando…' : l}</button>)}
      </div>
      {err && <p className="al-warn" role="alert">{err}</p>}
    </section>
  )
}
