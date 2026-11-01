'use client'
// Ajustes › Sistema (043): backups da casa (automático todo domingo, as 8 últimas) e os erros do app.
import { useCallback, useEffect, useState } from 'react'
import type { Names, Who } from '@/lib/types'
import * as sys from '@/lib/services/sistema'

const first = (n: string) => (n || '').split(' ')[0]
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const kb = (n: number) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`

export function SistemaCard({ householdId, me, names, today, onToast, onError }: { householdId: string, me: Who | null, names: Names, today: string, onToast: (m: string) => void, onError: (m: string) => void }) {
  const [backups, setBackups] = useState<{ available: boolean, rows: sys.BackupRow[] } | null>(null)
  const [errs, setErrs] = useState<{ available: boolean, rows: sys.AppErrorRow[] } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(async () => { const [b, e] = await Promise.all([sys.loadBackups(householdId), sys.loadErrors(householdId)]); setBackups(b); setErrs(e) }, [householdId])
  useEffect(() => { load() }, [load])
  const run = async (k: string, f: () => Promise<void>) => { setBusy(k); try { await f() } finally { setBusy(null) } }
  if (!backups || !errs) return <div className="card aj-sec" id="aj-sistema" style={{ marginBottom: 14 }}><div className="slbl">🧰 Sistema</div><p className="row-s">Carregando…</p></div>
  return (
    <div className="card aj-sec" id="aj-sistema" style={{ marginBottom: 14 }}>
      <div className="slbl">🧰 Sistema</div>
      {!backups.available ? <p className="row-s">Backup e registro de erros precisam da atualização do banco (migration 043).</p> : <>
        <div className="row-t">💾 Backups da casa</div>
        <p className="row-s">Todo domingo o Ninho guarda uma cópia dos dados da casa (tarefas, histórico, cães, compras, agenda, Nós…) e mantém as 8 últimas. O Meu dia é pessoal e fica de fora: cada uma baixa o seu.</p>
        {backups.rows.length === 0 ? <p className="row-s">Nenhum backup ainda. O primeiro sai no domingo, ou faça um agora.</p>
          : <ul className="sys-l">{backups.rows.map(b => <li key={b.id}>
            <span className="sys-t">{when(b.created_at)} <small>{b.kind === 'auto' ? 'automático' : 'feito na hora'} · {kb(b.size_bytes)}</small></span>
            <button className="lnk" disabled={busy === b.id} onClick={() => run(b.id, () => sys.downloadBackup(b).catch(() => onError('Não foi possível baixar agora.')))}>⬇ Baixar</button>
          </li>)}</ul>}
        <div className="sys-acts">
          <button className="btn btn-g btn-s" disabled={busy === 'now'} onClick={() => run('now', async () => { const r = await sys.backupNow(householdId); if (r.ok === true) { onToast('💾 Backup feito'); await load() } else onError((r as { error: string }).error) })}>{busy === 'now' ? 'Fazendo…' : '💾 Fazer backup agora'}</button>
          {me && <button className="btn btn-g btn-s" disabled={busy === 'mine'} onClick={() => run('mine', () => sys.downloadMine(householdId, me, today).then(() => onToast('Meu dia baixado')).catch(() => onError('Não foi possível baixar agora.')))}>⬇ Baixar o meu Meu dia</button>}
        </div>

        <div className="row-t" style={{ marginTop: 16 }}>🧯 Erros do app</div>
        {errs.rows.length === 0 ? <p className="row-s">Nenhum erro registrado. 🎉</p> : <>
          <p className="row-s">Os últimos erros que aconteceram nos celulares de vocês ou nos avisos automáticos. Ajudam a descobrir o que falhou e quando.</p>
          <ul className="sys-l sys-err">{errs.rows.slice(0, 20).map(e => <li key={e.id}>
            <span className="sys-t">{when(e.created_at)} · {e.household_id ? (e.who ? first(names[e.who]) : 'app') : 'servidor'} · <b>{e.context}</b><small>{e.message}{e.code ? ` (${e.code})` : ''}</small></span>
          </li>)}</ul>
          <button className="lnk-inline" disabled={busy === 'clr'} onClick={() => run('clr', () => sys.clearErrors(householdId).then(load).then(() => onToast('Registro de erros limpo')).catch(() => onError('Não foi possível limpar agora.')))}>Limpar o registro</button>
        </>}
      </>}
    </div>
  )
}
