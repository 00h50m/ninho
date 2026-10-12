'use client'
// Pop-up de água: abre quando a pessoa usa o app e está atrás do ritmo (no máximo a cada 2 h),
// ou pelo toque no lembrete. Copos grandes, último copo e "+" para beber mais um.
import { useEffect, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { WaterCups } from './WaterCups'
import { L, lastCup, shouldNudge, waterExpected } from '@/lib/water'
import { waterOn, type PLog, type PSettings } from '@/lib/meudia'
import type { Who } from '@/lib/types'
import { addDays } from '@/lib/dates'

const KEY = 'ninho.aguaPop'
const read = (): { shown?: number, muted?: string } => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
const write = (v: { shown?: number, muted?: string }) => { try { localStorage.setItem(KEY, JSON.stringify({ ...read(), ...v })) } catch { /* sem armazenamento */ } }

export function AguaPopup({ me, today, nowHM, settings, logs, force, onAdd, onUndo, onClose }: {
  me: Who, today: string, nowHM: string, settings: PSettings[], logs: PLog[], force: boolean
  onAdd: (ml: number) => Promise<void>, onUndo: (l: PLog) => Promise<void>, onClose: () => void
}) {
  const s = settings.find(x => x.who === me)
  const goal = s?.water_goal_ml || 2000, cup = s?.cup_ml || 250
  const mine = logs.filter(l => l.who === me && l.kind === 'agua' && l.date === today)
  const ml = waterOn(logs, me, today)
  const last = mine.map(l => l.created_at ? Date.parse(l.created_at) : NaN).filter(Number.isFinite).sort((a, b) => b - a)[0] ?? null
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])
  // decide uma vez ao abrir o app (ou quando o lembrete pede)
  useEffect(() => {
    if (force) { setOpen(true); write({ shown: Date.now() }); return }
    // só para quem acompanha a água (registrou algum copo nos últimos 7 dias)
    const uses = logs.some(l => l.who === me && l.kind === 'agua' && l.date >= addDays(today, -7))
    const st = read()
    if (uses && shouldNudge({ ml, goal, cup, hm: nowHM, nowMs: Date.now(), lastCupMs: last, lastShownMs: st.shown ?? null, mutedDay: st.muted ?? null, today })) { setOpen(true); write({ shown: Date.now() }) }
  }, [force]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null
  const close = () => { setOpen(false); onClose() }
  const behind = Math.max(0, waterExpected(goal, nowHM) - ml)
  return (
    <Sheet title="💧 Água de hoje" onClose={close} size="sm" footer={<>
      <button className="btn btn-p" onClick={() => onAdd(cup).catch(() => {})}>+1 copo ({cup} ml)</button>
      <button className="btn btn-g" onClick={() => { write({ muted: today }); close() }}>Hoje não</button>
    </>}>
      <div className="ag-pop">
        <div className="ag-big"><b className="mono">{L(ml)}</b><span>de {L(goal)}</span></div>
        <p className="row-s">Último copo: <b>{lastCup(last, now)}</b>{ml < goal && behind >= cup / 2 ? (Math.ceil(behind / cup) > 1 ? ` · uns ${Math.ceil(behind / cup)} copos atrás do ritmo` : ' · um copo atrás do ritmo') : ''}</p>
        <WaterCups ml={ml} goal={goal} cup={cup} onAdd={() => onAdd(cup).catch(() => {})} onUndo={() => { const l = [...mine].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]; if (l) onUndo(l).catch(() => {}) }}/>
        <p className="row-s ag-tip">Para lembrar com o app fechado: Ajustes › Notificações › 💧 Água. No Android, o aviso tem o botão “+1 copo”.</p>
      </div>
    </Sheet>
  )
}
