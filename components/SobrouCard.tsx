'use client'
// Cartão do Início com o resumo do mês do Sobrou! (finanças ficam lá; aqui só os números do mês).
// Só aparece quando o Sobrou está ligado ao Ninho (variáveis na Vercel). Dá para esconder em Ajustes.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { addDays } from '@/lib/dates'
import { brl, mesNome, quando, type SobrouResumo } from '@/lib/sobrou'

type State = { s: 'loading' } | { s: 'off' } | { s: 'err', msg: string } | { s: 'ok', r: SobrouResumo }

export function SobrouCard({ householdId, today, link }: { householdId: string, today: string, link: string | null }) {
  const [st, setSt] = useState<State>({ s: 'loading' })
  const load = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return setSt({ s: 'off' })
      const res = await fetch('/api/sobrou', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ householdId }) })
      const j = await res.json().catch(() => ({}))
      if (j.configured === false) return setSt({ s: 'off' })
      setSt(res.ok && j.resumo ? { s: 'ok', r: j.resumo } : { s: 'err', msg: j.error || 'Não foi possível ler o Sobrou agora.' })
    } catch { setSt({ s: 'err', msg: 'Sem conexão com o servidor.' }) }
  }, [householdId])
  useEffect(() => { load() }, [load])
  if (st.s === 'loading' || st.s === 'off') return null
  const open = link && /^https?:\/\//.test(link) ? <a className="lnk" href={link} target="_blank" rel="noopener noreferrer">Abrir ↗<span className="sr-only"> o Sobrou (abre em outra aba)</span></a> : null
  if (st.s === 'err') return <div className="card sob">
    <div className="slbl">💰 Sobrou{open}</div>
    <p className="row-s">{st.msg} <button className="lnk-inline" onClick={() => { setSt({ s: 'loading' }); load() }}>Tentar de novo</button></p>
  </div>
  const r = st.r, pos = r.sobraProjetada >= 0, tomorrow = addDays(today, 1)
  const pct = Math.max(0, Math.min(100, r.pctComprometido ?? 0))
  return <div className="card sob">
    <div className="slbl">💰 Sobrou · {mesNome(r.mes)}{open}</div>
    <div className="sob-big">
      <small>{pos ? 'Sobra projetada' : 'Faltam no mês'}</small>
      <b className={pos ? 'pos' : 'neg'}>{brl(Math.abs(r.sobraProjetada))}</b>
    </div>
    {r.renda > 0 && <><div className="bar" aria-hidden="true"><div className="barf" style={{ width: pct + '%', background: pct > 90 ? 'var(--cor)' : 'var(--gdk)' }}/></div>
      <p className="row-s">{brl(r.comprometido)} comprometidos{r.pctComprometido != null ? ` (${r.pctComprometido}% da renda)` : ''}</p></>}
    <p className="row-s">{r.aPagar > 0.005 ? <>Ainda a pagar: <b>{brl(r.aPagar)}</b></> : 'Tudo pago neste mês ✓'}</p>
    {r.vencimentos.length > 0 && <ul className="sob-venc" aria-label="Vence nos próximos dias">
      {r.vencimentos.map(v => <li key={v.data + v.titulo} className={v.data === today ? 'today' : ''}>
        <span className="mono">{quando(v.data, today, tomorrow)}</span><span className="sob-t">{v.titulo}{v.estimada ? ' (estimada)' : ''}</span><span className="mono">{brl(v.valor)}</span>
      </li>)}
    </ul>}
    {r.avisos.length > 0 && <div className="sob-av">{r.avisos.map(a => <span key={a.texto} className={`chip ${a.tom === 'ruim' ? 'coral' : 'amber'}`}>{a.tom === 'ruim' ? '⚠️' : '•'} {a.texto}</span>)}</div>}
  </div>
}
