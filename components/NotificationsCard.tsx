'use client'
import { useCallback, useEffect, useState } from 'react'
import type { Names, Who } from '@/lib/types'
import * as api from '@/lib/services/ninho'
import { toNinhoError } from '@/lib/errors'
import { RKINDS, prefsOf, type RKind, type RPrefs } from '@/lib/reminders'
import { canPromptInstall, currentSubscription, isIOS, isStandalone, onInstallChange, promptInstall, pushBlock, subscribePush, subscriptionKeys } from '@/lib/pushClient'

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const first = (n: string) => (n || '').split(' ')[0]

type State = 'checking' | 'off' | 'on' | 'busy'

/** Ajustes → App e notificações: instalar na tela inicial e ativar o bom dia / resumo de domingo. */
export function NotificationsCard({ householdId, me, names, onToast, onError, onNeedIdentity }: {
  householdId: string, me: Who | null, names: Names,
  onToast: (m: string) => void, onError: (m: string) => void, onNeedIdentity: () => void,
}) {
  const [state, setState] = useState<State>('checking')
  const [prefs, setPrefs] = useState({ morning: true, weekly: true })
  const [rem, setRem] = useState<{ ok: boolean, kinds: RPrefs, quiet_start: string, quiet_end: string }>({ ok: false, kinds: prefsOf(null), quiet_start: '22:00', quiet_end: '07:00' })
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [installable, setInstallable] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [block, setBlock] = useState<ReturnType<typeof pushBlock>>(null)

  useEffect(() => {
    setInstalled(isStandalone()); setInstallable(canPromptInstall()); setBlock(pushBlock(VAPID))
    return onInstallChange(() => { setInstallable(canPromptInstall()); setInstalled(isStandalone()) })
  }, [])

  // Estado atual deste aparelho
  const refresh = useCallback(async () => {
    if (pushBlock(VAPID)) { setState('off'); return }
    try {
      const sub = await currentSubscription()
      if (!sub) { setState('off'); return }
      const keys = subscriptionKeys(sub)
      setEndpoint(keys.endpoint)
      const row = await api.loadPushSubscription(keys.endpoint)
      if (!row || !row.active) { setState('off'); return }
      setPrefs({ morning: row.morning, weekly: row.weekly })
      setRem(row.quiet_start ? { ok: true, kinds: prefsOf(row.reminders), quiet_start: row.quiet_start, quiet_end: row.quiet_end || '07:00' } : r => ({ ...r, ok: false }))
      setState('on')
      // O aparelho trocou de pessoa em Ajustes: as notificações passam a ser dela
      if (me && row.who !== me) await api.savePushSubscription(householdId, me, keys, { morning: row.morning, weekly: row.weekly })
    } catch { setState('off') }
  }, [householdId, me])
  useEffect(() => { refresh() }, [refresh])

  async function enable() {
    if (!me) { onNeedIdentity(); return }
    setState('busy')
    try {
      const sub = await subscribePush(VAPID!)
      const keys = subscriptionKeys(sub)
      await api.savePushSubscription(householdId, me, keys, prefs)
      setEndpoint(keys.endpoint); setState('on')
      onToast('Notificações ativadas neste aparelho')
    } catch (e: any) {
      setState('off')
      onError(e?.userMessage || e?.message || 'Não foi possível ativar as notificações.')
    }
  }

  async function disable() {
    if (!endpoint) return
    setState('busy')
    try {
      await api.updatePushPrefs(endpoint, { active: false })
      const sub = await currentSubscription(); await sub?.unsubscribe().catch(() => {})
      setState('off'); onToast('Notificações desativadas neste aparelho')
    } catch (e) { setState('on'); onError(toNinhoError(e, 'desativar notificações').userMessage) }
  }

  async function setPref(k: 'morning' | 'weekly', v: boolean) {
    if (!endpoint) return
    const prev = prefs
    setPrefs(p => ({ ...p, [k]: v }))
    try { await api.updatePushPrefs(endpoint, { [k]: v }) }
    catch (e) { setPrefs(prev); onError(toNinhoError(e, 'salvar notificações').userMessage) }
  }

  async function setRemPref(patch: { kinds?: Partial<RPrefs>, quiet_start?: string, quiet_end?: string }) {
    if (!endpoint) return
    const prev = rem
    const next = { ...rem, ...patch, kinds: { ...rem.kinds, ...(patch.kinds || {}) } }
    setRem(next)
    try { await api.updatePushPrefs(endpoint, { reminders: next.kinds, quiet_start: next.quiet_start, quiet_end: next.quiet_end }) }
    catch (e) { setRem(prev); onError(toNinhoError(e, 'salvar lembretes').userMessage) }
  }

  async function test() {
    if (!endpoint) return
    try {
      const r = await fetch('/api/push/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint }) })
      const j = await r.json().catch(() => ({}))
      if (r.ok) onToast('Notificação de teste enviada'); else onError(j.message || 'Não foi possível enviar o teste.')
    } catch { onError('Sem conexão com o servidor. Confira a internet e tente de novo.') }
  }

  const blockText: Record<string, string> = {
    'no-key': 'As notificações ainda não foram configuradas no servidor.',
    dev: 'Notificações funcionam no app publicado (não no modo de desenvolvimento).',
    'ios-install': 'No iPhone, as notificações só funcionam com o Ninho na tela inicial (iOS 16.4 ou mais novo). Instale como explicado acima e ative por lá.',
    'no-sw': 'Este navegador não suporta notificações.',
    'no-push': 'Este navegador não suporta notificações.',
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="slbl">App e notificações</div>
      <div className="field-row">
        <div style={{ minWidth: 0 }}>
          <div className="row-t">{installed ? '✓ Instalado neste aparelho' : 'Instalar na tela inicial'}</div>
          <div className="row-s">
            {installed ? 'O Ninho abre como app e funciona sem internet (mostrando os últimos dados).'
              : isIOS() ? <>No Safari: toque em <b>Compartilhar</b> (□↑) → <b>Adicionar à Tela de Início</b>.</>
              : installable ? 'Vira um ícone na tela inicial, abre como app e funciona sem internet.'
              : <>No menu do navegador (⋮), escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</>}
          </div>
        </div>
        {!installed && installable && <button className="btn btn-s" style={{ marginLeft: 'auto' }} onClick={async () => { if (await promptInstall()) onToast('Ninho instalado!') }}>Instalar</button>}
      </div>
      <div className="field-row">
        <div style={{ minWidth: 0 }}>
          <div className="row-t">Notificações {state === 'on' && <span className="you">ativas</span>}</div>
          <div className="row-s">
            {block ? blockText[block]
              : state === 'on' ? `Para ${me ? first(names[me]) : 'este aparelho'}: só o que é seu (fixo ou pela vez do rodízio).`
              : 'Bom dia, lembretes (remédio, rotinas, sprint, cães, agenda) e o resumo de domingo.'}
          </div>
        </div>
        {!block && state !== 'checking' && (state === 'on'
          ? <button className="btn btn-g" style={{ marginLeft: 'auto' }} onClick={disable}>Desativar</button>
          : <button className="btn btn-p" style={{ marginLeft: 'auto' }} disabled={state === 'busy'} onClick={enable}>{state === 'busy' ? 'Ativando…' : 'Ativar'}</button>)}
      </div>
      {state === 'on' && <>
        <div className="row">
          <div><div className="row-t">☀️ Bom dia</div><div className="row-s">Todo dia, por volta das 7h: suas tarefas e rotinas de hoje.</div></div>
          <button className={`switch ${prefs.morning ? 'on' : ''}`} style={prefs.morning ? { background: 'var(--gdk)' } : undefined} onClick={() => setPref('morning', !prefs.morning)} role="switch" aria-checked={prefs.morning} aria-label="Bom dia" />
        </div>
        <div className="row">
          <div><div className="row-t">🏡 Resumo de domingo</div><div className="row-s">Domingo, por volta das 19h: o que a casa fez junta e o que ficou para trás.</div></div>
          <button className={`switch ${prefs.weekly ? 'on' : ''}`} style={prefs.weekly ? { background: 'var(--gdk)' } : undefined} onClick={() => setPref('weekly', !prefs.weekly)} role="switch" aria-checked={prefs.weekly} aria-label="Resumo de domingo" />
        </div>
        {rem.ok && <div className="nt-rem">
          <div className="slbl rt-sec">Lembretes com o app fechado</div>
          {RKINDS.map(([k, ic, l, d]) => (
            <div className="row" key={k}>
              <div><div className="row-t">{ic} {l}</div><div className="row-s">{d}</div></div>
              <button className={`switch ${rem.kinds[k] ? 'on' : ''}`} style={rem.kinds[k] ? { background: 'var(--gdk)' } : undefined} onClick={() => setRemPref({ kinds: { [k]: !rem.kinds[k] } as Partial<Record<RKind, boolean>> })} role="switch" aria-checked={rem.kinds[k]} aria-label={l} data-kind={k}/>
            </div>))}
          <div className="row nt-quiet">
            <div><div className="row-t">🌙 Horário de silêncio</div><div className="row-s">Nenhum lembrete nesse intervalo (bom dia e domingo seguem no horário deles).</div></div>
            <div className="nt-q">
              <input className="fi" type="time" aria-label="Silêncio começa" value={rem.quiet_start} onChange={e => e.target.value && setRemPref({ quiet_start: e.target.value })}/>
              <span>até</span>
              <input className="fi" type="time" aria-label="Silêncio termina" value={rem.quiet_end} onChange={e => e.target.value && setRemPref({ quiet_end: e.target.value })}/>
            </div>
          </div>
        </div>}
        <div className="row"><button className="btn btn-g btn-w" onClick={test}>Enviar notificação de teste</button></div>
      </>}
    </div>
  )
}
