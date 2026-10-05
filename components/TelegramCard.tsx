'use client'
// Ajustes › Telegram: ligar o Telegram da pessoa deste aparelho ao bot do Ninho.
// O app gera um código (30 min); o link t.me/<bot>?start=<código> abre o bot e liga a conversa.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Names, Who } from '@/lib/types'
import { logError, toNinhoError } from '@/lib/errors'

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ''
const first = (n: string) => (n || '').split(' ')[0]

interface LinkRow { id: string, who: Who, chat_id: number | null, linked_at: string | null, morning: boolean, weekly: boolean, active: boolean }

export function TelegramCard({ householdId, me, names, onToast, onError, onNeedIdentity }: {
  householdId: string, me: Who | null, names: Names
  onToast: (m: string) => void, onError: (m: string) => void, onNeedIdentity: () => void
}) {
  const [links, setLinks] = useState<LinkRow[] | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const poll = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    const r = await supabase.from('telegram_links').select('id,who,chat_id,linked_at,morning,weekly,active').eq('household_id', householdId).not('chat_id', 'is', null)
    if (r.error) { logError('carregar Telegram', r.error); setLinks([]); return [] }
    setLinks(r.data as LinkRow[])
    return r.data as LinkRow[]
  }, [householdId])

  useEffect(() => { load(); return () => { if (poll.current) clearInterval(poll.current) } }, [load])

  const mine = (links || []).filter(l => l.who === me && l.active)
  const other: Who | null = me ? (me === 'g' ? 's' : 'g') : null
  const otherOn = !!other && (links || []).some(l => l.who === other && l.active)

  async function connect() {
    if (!me) { onNeedIdentity(); return }
    setBusy(true)
    try {
      const r = await supabase.rpc('ninho_telegram_link_code', { p_household_id: householdId, p_who: me })
      if (r.error) throw r.error
      const c = String(r.data)
      setCode(c)
      window.open(`https://t.me/${BOT}?start=${c}`, '_blank', 'noopener')
      // Espera a conversa ser ligada (até 5 minutos)
      const before = mine.length, started = Date.now()
      if (poll.current) clearInterval(poll.current)
      poll.current = setInterval(async () => {
        const now = (await load()).filter(l => l.who === me && l.active)
        if (now.length > before) { clearInterval(poll.current!); setCode(null); onToast('Telegram conectado! 🎉') }
        else if (Date.now() - started > 5 * 60000) clearInterval(poll.current!)
      }, 3000)
    } catch (e) { onError(toNinhoError(e, 'conectar Telegram').userMessage) }
    finally { setBusy(false) }
  }

  async function setPref(l: LinkRow, k: 'morning' | 'weekly', v: boolean) {
    setLinks(p => (p || []).map(x => x.id === l.id ? { ...x, [k]: v } : x))
    const r = await supabase.from('telegram_links').update({ [k]: v }).eq('id', l.id).select('id')
    if (r.error) { setLinks(p => (p || []).map(x => x.id === l.id ? l : x)); onError(toNinhoError(r.error, 'salvar Telegram').userMessage) }
  }

  async function disconnect(l: LinkRow) {
    if (!confirm('Desligar o Telegram do Ninho? Você para de receber mensagens lá.')) return
    const r = await supabase.from('telegram_links').delete().eq('id', l.id).select('id')
    if (r.error) { onError(toNinhoError(r.error, 'desligar Telegram').userMessage); return }
    setLinks(p => (p || []).filter(x => x.id !== l.id)); onToast('Telegram desligado')
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="slbl">Telegram</div>
      {!BOT ? (
        <div className="row-s">O bot do Telegram ainda não foi configurado no servidor.</div>
      ) : <>
        <div className="field-row">
          <div style={{ minWidth: 0 }}>
            <div className="row-t">{mine.length ? <>Conectado {me && <span className="you">{first(names[me])}</span>}</> : `Receber o Ninho no Telegram${me ? ` (${first(names[me])})` : ''}`}</div>
            <div className="row-s">Bom dia, resumo de domingo e comandos: /hoje para ver e concluir, /compras para a lista, /dicas para a IA.</div>
          </div>
          {!mine.length && <button className="btn btn-p" style={{ marginLeft: 'auto' }} disabled={busy} onClick={connect}>{busy ? 'Abrindo…' : 'Conectar'}</button>}
        </div>
        {code && !mine.length && <div className="tg-code">
          Se o Telegram não abriu: procure <b>@{BOT}</b> e mande <code>/start {code}</code> (vale 30 minutos).
          <button className="lnk" onClick={connect}>Abrir de novo</button>
        </div>}
        {mine.map(l => <div key={l.id}>
          <div className="row">
            <div><div className="row-t">☀️ Bom dia no Telegram</div><div className="row-s">Com o botão para ver e concluir.</div></div>
            <button className={`switch ${l.morning ? 'on' : ''}`} style={l.morning ? { background: 'var(--gdk)' } : undefined} onClick={() => setPref(l, 'morning', !l.morning)} role="switch" aria-checked={l.morning} aria-label="Bom dia no Telegram" />
          </div>
          <div className="row">
            <div><div className="row-t">🏆 Resumo de domingo no Telegram</div></div>
            <button className={`switch ${l.weekly ? 'on' : ''}`} style={l.weekly ? { background: 'var(--gdk)' } : undefined} onClick={() => setPref(l, 'weekly', !l.weekly)} role="switch" aria-checked={l.weekly} aria-label="Resumo no Telegram" />
          </div>
          <div className="row"><button className="btn btn-g btn-w" onClick={() => disconnect(l)}>Desconectar este Telegram</button></div>
        </div>)}
        {other && <div className="row-s" style={{ marginTop: 8 }}>{first(names[other])}: {otherOn ? 'conectada ✓' : 'ainda não conectou (cada uma conecta no próprio celular)'}</div>}
      </>}
    </div>
  )
}

/** Pede as sugestões da IA (Reunião semanal). */
export async function fetchAiTips(householdId: string): Promise<{ tips?: string[], error?: string }> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return { error: 'Sessão não encontrada. Recarregue o app.' }
    const r = await fetch('/api/ai/weekly', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ householdId }) })
    const j = await r.json().catch(() => ({}))
    return r.ok ? { tips: j.tips || [] } : { error: j.error || 'Não foi possível gerar as sugestões agora.' }
  } catch { return { error: 'Sem conexão com o servidor. Confira a internet e tente de novo.' } }
}
