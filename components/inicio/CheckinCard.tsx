'use client'
// Check-in rápido: humor e energia de cada uma, texto opcional. Cada uma registra o seu.
import { useEffect, useState } from 'react'
import type { Energy, Names, Who } from '@/lib/types'
import { ENERGY } from '@/lib/constants'
import { MOODS, moodOf, type Checkin, type MoodId } from '@/lib/week'

const first = (n: string) => (n || '').split(' ')[0]

export function CheckinCard({ me, names, today, onSave }: {
  me: Who, names: Names, today: Checkin[],
  onSave: (v: { mood?: MoodId, energy?: Energy, note?: string | null }) => Promise<void>
}) {
  const mine = today.find(c => c.who === me)
  const other: Who = me === 'g' ? 's' : 'g'
  const theirs = today.find(c => c.who === other)
  const [note, setNote] = useState(mine?.note || '')
  const [noteOpen, setNoteOpen] = useState(!!mine?.note)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setNote(mine?.note || '') }, [mine?.note])
  const save = async (v: Parameters<typeof onSave>[0]) => { setBusy(true); try { await onSave(v) } catch { /* aviso já mostrado */ } finally { setBusy(false) } }
  const tm = moodOf(theirs?.mood)

  return (
    <section className="card ck" aria-labelledby="ck-h" id="checkin">
      <div className="slbl" id="ck-h">Check-in de hoje</div>
      <div className="ck-q">Como você está, {first(names[me])}?</div>
      <div className="ck-moods" role="radiogroup" aria-label="Seu humor hoje">
        {MOODS.map(m => (
          <button key={m.id} role="radio" aria-checked={mine?.mood === m.id} className={`ck-mood ${mine?.mood === m.id ? 'on' : ''}`} disabled={busy} onClick={() => save({ mood: m.id })}>
            <span aria-hidden="true">{m.emoji}</span><small>{m.label}</small>
          </button>
        ))}
      </div>
      <div className="ck-q">Energia</div>
      <div className="ck-en" role="radiogroup" aria-label="Sua energia hoje">
        {(['high', 'medium', 'low'] as Energy[]).map(e => (
          <button key={e} role="radio" aria-checked={mine?.energy === e} className={`ck-eb ${mine?.energy === e ? 'on' : ''}`} disabled={busy} onClick={() => save({ energy: e })}>{ENERGY[e].ic} {ENERGY[e].short}</button>
        ))}
      </div>
      {noteOpen ? (
        <div className="ck-note">
          <textarea className="fita" rows={2} maxLength={280} placeholder="Observação (opcional)" aria-label="Observação do dia" value={note} onChange={e => setNote(e.target.value)}/>
          <button className="btn btn-g" disabled={busy || note === (mine?.note || '')} onClick={() => save({ note })}>Salvar</button>
        </div>
      ) : <button className="lnk-inline ck-add" onClick={() => setNoteOpen(true)}>+ Observação</button>}
      <div className="ck-other">
        <span className={`mini av-${other}`} aria-hidden="true">{names[other].slice(0, 1).toUpperCase()}</span>
        {theirs && (tm || theirs.energy)
          ? <span><b>{first(names[other])}</b>: {tm ? `${tm.emoji} ${tm.label}` : ''}{tm && theirs.energy ? ' · ' : ''}{theirs.energy ? `${ENERGY[theirs.energy].ic} ${ENERGY[theirs.energy].short}` : ''}{theirs.note && <em> “{theirs.note}”</em>}</span>
          : <span className="ck-mu">{first(names[other])} ainda não fez o check-in hoje</span>}
      </div>
    </section>
  )
}
