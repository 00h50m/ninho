'use client'
// Ajustes › Integrantes, na casa de 1 pessoa (047): gera o link de convite para a segunda pessoa.
// O link vale 7 dias e uma vez; gerar de novo invalida o anterior.
import { useState } from 'react'
import { inviteLink } from '@/lib/convite'
import * as conta from '@/lib/services/conta'

export function ConviteCard({ householdId, onError }: { householdId: string, onError: (msg: string) => void }) {
  const [link, setLink] = useState<string | null>(null), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false)
  async function gen() {
    setBusy(true); setCopied(false)
    try { setLink(inviteLink(window.location.origin, await conta.createInvite(householdId))) }
    catch (e: any) { onError(e?.userMessage || 'Não foi possível gerar o convite agora.') }
    finally { setBusy(false) }
  }
  async function share() {
    if (!link) return
    const text = `Vem para o Ninho comigo! Crie a sua conta por este link (vale 7 dias): ${link}`
    try {
      if (navigator.share) { await navigator.share({ title: 'Convite para o Ninho', text }); return }
    } catch { /* cancelou: tenta copiar */ }
    try { await navigator.clipboard.writeText(link); setCopied(true) } catch { /* sem área de transferência */ }
  }
  return (
    <div className="conv" aria-labelledby="conv-h">
      <div className="row-t" id="conv-h">➕ Convidar a segunda pessoa</div>
      <p className="row-s">Ela cria a conta pelo link e entra direto nesta casa. A divisão das tarefas, o rodízio e o placar ligam sozinhos.</p>
      {!link ? <button className="btn btn-p" disabled={busy} onClick={gen}>{busy ? 'Gerando…' : 'Gerar link de convite'}</button> : <>
        <input className="fi conv-l" readOnly value={link} aria-label="Link do convite" onFocus={e => e.target.select()}/>
        <div className="md-acts">
          <button className="btn btn-p" onClick={share}>Compartilhar</button>
          <button className="btn btn-g" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true) } catch { /* ok */ } }}>{copied ? '✓ Copiado' : 'Copiar'}</button>
          <button className="lnk-inline" onClick={gen} disabled={busy}>Gerar outro</button>
        </div>
        <p className="row-s">Vale 7 dias e só uma vez. Gerar outro cancela este.</p>
      </>}
    </div>
  )
}
