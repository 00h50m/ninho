'use client'
// Agenda › 📱 No celular (035): link secreto para o Google Agenda / calendário do iPhone assinarem
// a agenda da casa (eventos, manutenções e cuidados dos cães). O link é gerado no servidor;
// dá para trocar (o antigo para de funcionar) ou desligar.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/errors'

type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready', token: string | null }

async function callLink(householdId: string, action: 'on' | 'off'): Promise<{ token?: string | null, error?: string }> {
  try {
    const { data } = await supabase.auth.getSession()
    const t = data.session?.access_token
    if (!t) return { error: 'Sessão não encontrada. Recarregue o app.' }
    const r = await fetch('/api/agenda/link', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: JSON.stringify({ householdId, action }) })
    const j = await r.json().catch(() => ({}))
    return r.ok ? { token: j.token ?? null } : { error: j.error || 'Não foi possível agora.' }
  } catch { return { error: 'Sem conexão com o servidor. Confira a internet e tente de novo.' } }
}

export function AgendaCelular({ householdId, onToast, onError }: { householdId: string, onToast: (m: string) => void, onError: (m: string) => void }) {
  const [st, setSt] = useState<State>({ kind: 'loading' }), [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const r = await supabase.from('households').select('ics_token').eq('id', householdId).maybeSingle()
    if (r.error) {
      if (r.error.code === '42703' || /ics_token/.test(r.error.message || '')) { setSt({ kind: 'missing' }); return }
      logError('carregar link da agenda', r.error); setSt({ kind: 'ready', token: null }); return
    }
    setSt({ kind: 'ready', token: (r.data as any)?.ics_token || null })
  }, [householdId])
  useEffect(() => { load() }, [load])

  async function act(action: 'on' | 'off', msg: string) {
    setBusy(true)
    const r = await callLink(householdId, action)
    setBusy(false)
    if (r.error) { onError(r.error); return }
    setSt({ kind: 'ready', token: r.token || null }); onToast(msg)
  }

  if (st.kind === 'loading') return null
  const host = typeof window !== 'undefined' ? window.location.host : ''
  const token = st.kind === 'ready' ? st.token : null
  const https = token ? `https://${host}/api/agenda/ics/${token}.ics` : ''
  const webcal = token ? `webcal://${host}/api/agenda/ics/${token}.ics` : ''
  async function copy() {
    try { await navigator.clipboard.writeText(https); onToast('Link copiado') } catch { window.prompt('Copie o link da agenda:', https) }
  }
  return (
    <div className="card ag-cel" aria-labelledby="ag-cel-t">
      <div className="slbl" id="ag-cel-t">📱 Agenda no celular</div>
      {st.kind === 'missing' ? <p className="row-s">Para ver a agenda da casa no Google Agenda ou no iPhone, falta rodar a atualização do banco (migration 035) no Supabase.</p>
        : !token ? <>
          <p className="row-s">Veja os compromissos da casa, as manutenções e os cuidados dos cães no calendário do celular, junto com os seus. Atualiza sozinho (o Google pode levar algumas horas).</p>
          <div className="md-acts"><button className="btn btn-p" disabled={busy} onClick={() => act('on', 'Link da agenda criado 📱')}>{busy ? 'Gerando…' : 'Criar link da agenda'}</button></div>
        </> : <>
          <p className="row-s">Abra no celular de cada uma. Quem tiver o link vê a agenda, então mande só para vocês duas.</p>
          <div className="md-acts">
            <a className="btn btn-p" href={webcal}>iPhone / Mac</a>
            <a className="btn btn-s" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer">Google Agenda</a>
            <button className="btn btn-g" onClick={copy}>Copiar link</button>
          </div>
          <details className="ag-cel-how"><summary>Como fazer</summary>
            <ol>
              <li><b>iPhone:</b> toque em “iPhone / Mac” e confirme “Assinar”.</li>
              <li><b>Android / Google:</b> toque em “Google Agenda” e em “Adicionar”. No celular, se não abrir, copie o link e cole no Google Agenda pelo computador em “Outras agendas › Do URL”.</li>
            </ol>
          </details>
          <div className="md-acts">
            <button className="lnk-inline" disabled={busy} onClick={() => { if (confirm('Trocar o link? O link antigo para de funcionar e cada uma precisa assinar de novo.')) act('on', 'Link trocado') }}>Trocar link</button>
            <button className="lnk-inline" disabled={busy} onClick={() => { if (confirm('Desligar a agenda no celular? Os calendários param de atualizar.')) act('off', 'Agenda no celular desligada') }}>Desligar</button>
          </div>
        </>}
    </div>
  )
}
