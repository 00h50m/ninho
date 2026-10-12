'use client'
// Cartão do Início com o resumo do mês do Sobrou! (finanças ficam lá; aqui só os números do mês).
// Só aparece quando o Sobrou está ligado ao Ninho (variáveis na Vercel). Dá para esconder em Ajustes.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { addDays } from '@/lib/dates'
import { brl, mesNome, quando, type SobrouResumo } from '@/lib/sobrou'

export type SobrouCheck = { s: 'off', missing: string[] } | { s: 'err', msg: string } | { s: 'ok', r: SobrouResumo }
type State = { s: 'loading' } | SobrouCheck

/** Pergunta ao servidor do Ninho como está a ligação com o Sobrou (e os números, se ligada). */
export async function checkSobrou(householdId: string): Promise<SobrouCheck> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return { s: 'err', msg: 'Sessão não encontrada. Recarregue o app.' }
    const res = await fetch('/api/sobrou', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ householdId }) })
    const j = await res.json().catch(() => ({}))
    if (j.configured === false) return { s: 'off', missing: Array.isArray(j.missing) ? j.missing : [] }
    return res.ok && j.resumo ? { s: 'ok', r: j.resumo } : { s: 'err', msg: j.error || 'Não foi possível ler o Sobrou agora.' }
  } catch { return { s: 'err', msg: 'Sem conexão com o servidor.' } }
}

export function SobrouCard({ householdId, today, link, onGuide }: { householdId: string, today: string, link: string | null, onGuide?: () => void }) {
  const [st, setSt] = useState<State>({ s: 'loading' })
  const load = useCallback(async () => { setSt(await checkSobrou(householdId)) }, [householdId])
  useEffect(() => { load() }, [load])
  if (st.s === 'loading') return null
  // ainda não ligado: diz o que falta (dá para esconder o cartão em Ajustes se não usam o Sobrou)
  if (st.s === 'off') return st.missing.length ? <div className="card sob">
    <div className="slbl">💰 Sobrou</div>
    <p className="row-s">O resumo do mês ainda não está ligado. Falta na Vercel do Ninho:</p>
    <ul className="sob-miss">{st.missing.map(m => <li key={m}><code>{m}</code></li>)}</ul>
    <p className="row-s">Depois de cadastrar, faça <b>Redeploy</b> do Ninho. As variáveis valem para o ambiente em que foram marcadas (Production e/ou Preview).</p>
    {onGuide && <button className="btn btn-s" onClick={onGuide}>Ver o passo a passo</button>}
    <p className="row-s">Não usam o Sobrou? Esconda este cartão em Ajustes › Cartões do Início.</p>
  </div> : null
  const open = link && /^https?:\/\//.test(link) ? <a className="lnk" href={link} target="_blank" rel="noopener noreferrer">Abrir ↗<span className="sr-only"> o Sobrou (abre em outra aba)</span></a> : null
  if (st.s === 'err') return <div className="card sob">
    <div className="slbl">💰 Sobrou{open}</div>
    <p className="row-s">{st.msg} <button className="lnk-inline" onClick={() => { setSt({ s: 'loading' }); load() }}>Tentar de novo</button>{onGuide && <> · <button className="lnk-inline" onClick={onGuide}>passo a passo</button></>}</p>
  </div>
  const r = st.r, pos = r.sobraProjetada >= 0, tomorrow = addDays(today, 1)
  const pct = Math.max(0, Math.min(100, r.pctComprometido ?? 0))
  return <div className={`card sob ${pos ? '' : 'sob-neg'}`}>
    <div className="slbl">💰 Sobrou · {mesNome(r.mes)}{open}</div>
    {!pos && <p className="sob-alert" role="status">⚠️ O mês está fechando no vermelho. Vale olhar as contas no Sobrou.</p>}
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
