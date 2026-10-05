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
  const [codes, setCodes] = useState<Partial<Record<Who, string>>>({})
  const [busy, setBusy] = useState<Who | null>(null)
  const poll = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    const r = await supabase.from('telegram_links').select('id,who,chat_id,linked_at,morning,weekly,active').eq('household_id', householdId).not('chat_id', 'is', null)
    if (r.error) { logError('carregar Telegram', r.error); setLinks([]); return [] }
    setLinks(r.data as LinkRow[])
    return r.data as LinkRow[]
  }, [householdId])

  useEffect(() => { load(); return () => { if (poll.current) clearInterval(poll.current) } }, [load])

  const of = (w: Who) => (links || []).filter(l => l.who === w && l.active)
  const linkUrl = (code: string) => `https://t.me/${BOT}?start=${code}`

  /** Gera o código da pessoa. Para quem usa o aparelho, já abre o Telegram; para a outra, mostra o link para enviar. */
  async function invite(w: Who) {
    if (!me) { onNeedIdentity(); return }
    setBusy(w)
    try {
      const r = await supabase.rpc('ninho_telegram_link_code', { p_household_id: householdId, p_who: w })
      if (r.error) throw r.error
      const c = String(r.data)
      setCodes(p => ({ ...p, [w]: c }))
      if (w === me) window.open(linkUrl(c), '_blank', 'noopener')
      // Espera a conversa ser ligada (até 30 minutos, o prazo do código)
      const before = of(w).length, started = Date.now()
      if (poll.current) clearInterval(poll.current)
      poll.current = setInterval(async () => {
        const now = (await load()).filter(l => l.who === w && l.active)
        if (now.length > before) { clearInterval(poll.current!); setCodes(p => ({ ...p, [w]: undefined })); onToast(`Telegram da ${first(names[w])} conectado! 🎉`) }
        else if (Date.now() - started > 30 * 60000) clearInterval(poll.current!)
      }, 4000)
    } catch (e) { onError(toNinhoError(e, 'conectar Telegram').userMessage) }
    finally { setBusy(null) }
  }

  async function share(w: Who) {
    const c = codes[w]; if (!c) return
    const text = `${first(names[w])}, toque para ligar seu Telegram ao Ninho: ${linkUrl(c)}`
    try {
      if (navigator.share) { await navigator.share({ text }); return }
      await navigator.clipboard.writeText(text); onToast('Link copiado')
    } catch { /* cancelou */ }
  }

  async function setPref(l: LinkRow, k: 'morning' | 'weekly', v: boolean) {
    setLinks(p => (p || []).map(x => x.id === l.id ? { ...x, [k]: v } : x))
    const r = await supabase.from('telegram_links').update({ [k]: v }).eq('id', l.id).select('id')
    if (r.error) { setLinks(p => (p || []).map(x => x.id === l.id ? l : x)); onError(toNinhoError(r.error, 'salvar Telegram').userMessage) }
  }

  async function disconnect(l: LinkRow) {
    if (!confirm(`Desligar o Telegram da ${first(names[l.who])} do Ninho?`)) return
    const r = await supabase.from('telegram_links').delete().eq('id', l.id).select('id')
    if (r.error) { onError(toNinhoError(r.error, 'desligar Telegram').userMessage); return }
    setLinks(p => (p || []).filter(x => x.id !== l.id)); onToast('Telegram desligado')
  }

  if (!BOT) return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="slbl">Telegram</div>
      <div className="row-s">O bot do Telegram ainda não foi configurado no servidor.</div>
    </div>
  )

  const order: Who[] = me === 's' ? ['s', 'g'] : ['g', 's']
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="slbl">Telegram <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--faint)' }}>@{BOT}</span></div>
      <div className="row-s" style={{ marginBottom: 4 }}>Bom dia, resumo de domingo e comandos: /hoje para ver e concluir, /compras para a lista, /dicas para a IA.</div>
      {order.map(w => {
        const mine = of(w), code = codes[w], isMe = w === me
        return <div key={w} className="tg-person">
          <div className="field-row">
            <div className={`av av-${w}`}>{(names[w] || '?').slice(0, 2).toUpperCase()}</div>
            <div style={{ minWidth: 0 }}>
              <div className="row-t">{first(names[w])}{isMe && <span className="you">você</span>}</div>
              <div className="row-s">{mine.length ? '✓ Conectada' : 'Ainda não conectou'}</div>
            </div>
            {!mine.length && <button className={`btn ${isMe ? 'btn-p' : 'btn-s'}`} style={{ marginLeft: 'auto' }} disabled={busy === w} onClick={() => invite(w)}>
              {busy === w ? 'Gerando…' : isMe ? 'Conectar' : code ? 'Gerar de novo' : 'Gerar convite'}</button>}
          </div>
          {code && !mine.length && <div className="tg-code">
            {isMe ? <>Se o Telegram não abriu: procure <b>@{BOT}</b> e mande <code>/start {code}</code>.</>
              : <>Mande este link para a {first(names[w])} abrir no celular dela (vale 30 minutos):<br/><code>{linkUrl(code)}</code></>}
            <div className="tg-act">
              {isMe ? <button className="lnk" onClick={() => window.open(linkUrl(code), '_blank', 'noopener')}>Abrir de novo</button>
                : <button className="btn btn-s" onClick={() => share(w)}>Enviar pelo WhatsApp / copiar</button>}
            </div>
          </div>}
          {mine.map(l => <div key={l.id}>
            <div className="row">
              <div><div className="row-t">☀️ Bom dia no Telegram</div></div>
              <button className={`switch ${l.morning ? 'on' : ''}`} style={l.morning ? { background: 'var(--gdk)' } : undefined} onClick={() => setPref(l, 'morning', !l.morning)} role="switch" aria-checked={l.morning} aria-label={`Bom dia no Telegram da ${first(names[w])}`} />
            </div>
            <div className="row">
              <div><div className="row-t">🏆 Resumo de domingo</div></div>
              <button className={`switch ${l.weekly ? 'on' : ''}`} style={l.weekly ? { background: 'var(--gdk)' } : undefined} onClick={() => setPref(l, 'weekly', !l.weekly)} role="switch" aria-checked={l.weekly} aria-label={`Resumo no Telegram da ${first(names[w])}`} />
            </div>
            <div className="row"><button className="btn btn-g btn-w" onClick={() => disconnect(l)}>Desconectar</button></div>
          </div>)}
        </div>
      })}
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
