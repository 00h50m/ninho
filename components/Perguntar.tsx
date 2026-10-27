'use client'
// "Perguntar ao Ninho": ajuda no dia a dia (manchas, limpeza, organização, cuidados com as
// cachorras, cozinha). Escrevendo ou falando; a resposta já leva em conta a casa.
import { useState } from 'react'
import type { Who } from '@/lib/types'
import { Sheet } from '@/components/ui/Sheet'
import { useSpeech } from '@/hooks/useSpeech'
import { supabase } from '@/lib/supabase'

const IDEAS = ['Como tirar mancha de xixi do sofá?', 'Quanto de ração para filhote de 6 meses?', 'Como organizar a geladeira?', 'O que fazer com o mofo do banheiro?']

async function ask(householdId: string, me: Who, question: string): Promise<{ ok: true, text: string } | { ok: false, error: string }> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return { ok: false, error: 'Sessão não encontrada. Recarregue o app.' }
    const r = await fetch('/api/ai/pergunta', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ householdId, question, who: me }) })
    const j = await r.json().catch(() => ({}))
    return r.ok ? { ok: true, text: j.text } : { ok: false, error: j.error || 'Não foi possível responder agora.' }
  } catch { return { ok: false, error: 'Sem conexão com o servidor. Confira a internet e tente de novo.' } }
}

export function PerguntarSheet(p: { householdId: string, me: Who, onClose: () => void }) {
  const [q, setQ] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null)
  const [log, setLog] = useState<Array<{ q: string, a: string }>>([])
  const sp = useSpeech(t => setQ(x => `${x.trim()} ${t.trim()}`.trim()))
  async function go(text = q) {
    const t = text.trim()
    if (t.length < 3 || busy) return
    setBusy(true); setErr(null)
    const r = await ask(p.householdId, p.me, t)
    setBusy(false)
    if (r.ok === true) { setLog(l => [{ q: t, a: r.text }, ...l].slice(0, 5)); setQ('') } else setErr((r as { error: string }).error)
  }
  return (
    <Sheet title="💬 Perguntar ao Ninho" onClose={p.onClose}>
      <p className="row-s" style={{ marginBottom: 8 }}>Limpeza, manchas, organização, cuidados com as cachorras, cozinha… A resposta já leva em conta a casa de vocês.</p>
      <label className="onb-f"><span>Sua pergunta</span>
        <textarea className="fita" rows={3} maxLength={1200} value={q} onChange={e => setQ(e.target.value)} placeholder="Ex.: como tirar mancha de xixi do sofá?"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go() } }}/></label>
      <div className="md-acts">
        <button className="btn btn-p" disabled={q.trim().length < 3 || busy} onClick={() => go()}>{busy ? 'Pensando…' : 'Perguntar'}</button>
        {sp.supported && <button className={`btn ${sp.on ? 'btn-p' : 'btn-g'}`} onClick={sp.toggle} aria-pressed={sp.on}>{sp.on ? '⏺ Ouvindo…' : '🎤 Falar'}</button>}
      </div>
      {err && <p className="inline-err" role="alert">{err}</p>}
      {!log.length && <div className="fchips" style={{ marginTop: 6 }}>{IDEAS.map(i => <button key={i} className="fc" onClick={() => go(i)} disabled={busy}>{i}</button>)}</div>}
      <div aria-live="polite">{log.map((x, i) => <section key={i} className="card ask-a">
        <div className="slbl">{x.q}</div>
        <div className="ask-t">{x.a}</div>
      </section>)}</div>
      <p className="row-s" style={{ marginTop: 10 }}>Dica: no Telegram dá para perguntar escrevendo ou por áudio.</p>
    </Sheet>
  )
}
