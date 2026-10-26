'use client'
// Nós › 📸 Álbum do Ninho: fotos da casa, dos cães e de vocês, com os marcos do casal
// (reuniões, sprints, desafios) numa linha do tempo por mês. As duas veem, põem e apagam.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Names, Who } from '@/lib/types'
import type { TimelineItem } from '@/lib/nos'
import { fmtDate } from '@/lib/dates'
import { ALBUM_TAGS, TAG_LABEL, albumTimeline, onThisDay, type AlbumPhoto, type AlbumTag } from '@/lib/album'
import * as api from '@/lib/services/album'
import { shrink } from '@/lib/services/aiFiles'
import { Sheet } from '@/components/ui/Sheet'

const first = (n: string) => (n || '').split(' ')[0]
const img = (b64: string) => `data:image/jpeg;base64,${b64}`

export function AlbumView({ householdId, me, names, today, marks, onToast, onError }: {
  householdId: string, me: Who | null, names: Names, today: string, marks: TimelineItem[]
  onToast: (m: string) => void, onError: (e: unknown, ctx: string) => void
}) {
  const [state, setState] = useState<{ ready: boolean, photos: AlbumPhoto[] } | null>(null)
  const [tag, setTag] = useState<AlbumTag | 'all'>('all')
  const [newTag, setNewTag] = useState<AlbumTag>('casa')
  const [date, setDate] = useState(today)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<AlbumPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const reload = useCallback(() => api.loadAlbum(householdId).then(setState).catch(e => { onError(e, 'carregar álbum'); setState({ ready: true, photos: [] }) }), [householdId, onError])
  useEffect(() => { reload() }, [reload])
  if (!state) return <div className="loadscr" role="status"><span className="spin" aria-hidden="true"/>Abrindo o álbum…</div>
  if (!state.ready) return <div className="card empty"><span className="empty-icon">📸</span>O álbum precisa da atualização do banco (migration 040).</div>

  async function add(file: File | undefined) {
    if (!file) return
    setBusy(true); setErr(null)
    try {
      const [full, thumb] = await Promise.all([shrink(file, 1280, 0.82), shrink(file, 360, 0.7)])
      if (full.data.length > 2_000_000) throw new Error('grande')
      await api.addAlbumPhoto(householdId, me, { date, tag: newTag, caption: caption || null, thumb: thumb.data, data: full.data })
      setCaption(''); await reload(); onToast('📸 Foto no álbum')
    } catch (e: any) { setErr(e?.message === 'grande' ? 'Essa foto ficou grande demais. Tente outra.' : 'Não foi possível guardar a foto. Confira a internet e tente de novo.') }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const months = albumTimeline(state.photos, marks, tag)
  const memories = onThisDay(state.photos, today)
  return (
    <div className="narrow al">
      <section className="card al-add" aria-labelledby="al-add">
        <div className="slbl" id="al-add">📸 Pôr uma foto</div>
        <div className="onb-days wrap" role="radiogroup" aria-label="De quê">{ALBUM_TAGS.map(([k, l]) => <button key={k} role="radio" aria-checked={newTag === k} className={`onb-day wide ${newTag === k ? 'on' : ''}`} onClick={() => setNewTag(k)}>{l}</button>)}</div>
        <div className="onb-row">
          <label className="onb-f"><span>Legenda</span><input className="fi" value={caption} maxLength={200} placeholder="opcional: primeiro banho da Zelda" onChange={e => setCaption(e.target.value)}/></label>
          <label className="onb-f"><span>Data</span><input className="fi" type="date" value={date} max={today} onChange={e => setDate(e.target.value || today)}/></label>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={e => add(e.target.files?.[0])}/>
        <div className="md-acts"><button className="btn btn-p" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Guardando…' : '📷 Escolher foto'}</button></div>
        {err && <p className="inline-err" role="alert">{err}</p>}
        <p className="row-s">A foto é reduzida no celular antes de sair. As duas veem o álbum.</p>
      </section>

      {memories.length > 0 && <section className="card" aria-labelledby="al-mem">
        <div className="slbl" id="al-mem">🕰 Neste dia</div>
        <div className="al-grid">{memories.map(p => <Thumb key={p.id} p={p} onOpen={setView}/>)}</div>
      </section>}

      <div className="fchips" role="tablist" aria-label="Filtrar o álbum">
        <button role="tab" aria-selected={tag === 'all'} className={`fc ${tag === 'all' ? 'on' : ''}`} onClick={() => setTag('all')}>Tudo · {state.photos.length}</button>
        {ALBUM_TAGS.map(([k, l]) => { const n = state.photos.filter(p => p.tag === k).length; return n > 0 && <button key={k} role="tab" aria-selected={tag === k} className={`fc ${tag === k ? 'on' : ''}`} onClick={() => setTag(k)}>{l} · {n}</button> })}
      </div>

      {months.length === 0 ? <div className="card empty"><span className="empty-icon">🖼</span>Ainda sem fotos. Comece pela de hoje!</div>
        : months.map(m => <section key={m.month} className="card al-m" aria-labelledby={`al-${m.month}`}>
          <div className="slbl" id={`al-${m.month}`}>{m.label}</div>
          {(() => {
            const photos = m.entries.flatMap(e => e.kind === 'foto' ? [e.photo] : [])
            const marksM = m.entries.flatMap(e => e.kind === 'marco' ? [e.item] : [])
            return <>
              {photos.length > 0 && <div className="al-grid">{photos.map(p => <Thumb key={p.id} p={p} onOpen={setView}/>)}</div>}
              {marksM.length > 0 && <ol className="tl al-tl">{marksM.map((i, k) => <li key={k}><span className="mono">{fmtDate(i.date)}</span><span aria-hidden="true">{i.icon}</span><span>{i.text}</span></li>)}</ol>}
            </>
          })()}
        </section>)}

      {view && <PhotoSheet photo={view} names={names} onClose={() => setView(null)}
        onSave={async patch => { try { await api.updateAlbumPhoto(view.id, patch); await reload(); setView(null); onToast('Foto atualizada') } catch (e) { onError(e, 'editar foto') } }}
        onDelete={async () => { if (!confirm('Apagar esta foto do álbum?')) return; try { await api.deleteAlbumPhoto(view.id); await reload(); setView(null); onToast('Foto apagada') } catch (e) { onError(e, 'apagar foto') } }}/>}
    </div>
  )
}

function Thumb({ p, onOpen }: { p: AlbumPhoto, onOpen: (p: AlbumPhoto) => void }) {
  return <button className="al-th" onClick={() => onOpen(p)} aria-label={`Abrir foto${p.caption ? `: ${p.caption}` : ''}, ${fmtDate(p.date)}`}>
    <img src={img(p.thumb)} alt=""/>{p.caption && <span>{p.caption}</span>}
  </button>
}

function PhotoSheet({ photo, names, onClose, onSave, onDelete }: { photo: AlbumPhoto, names: Names, onClose: () => void, onSave: (p: { caption: string | null, tag: AlbumTag }) => Promise<void>, onDelete: () => Promise<void> }) {
  const [full, setFull] = useState<string | null>(null)
  const [caption, setCaption] = useState(photo.caption || '')
  const [tag, setTag] = useState<AlbumTag>(photo.tag)
  useEffect(() => { api.albumPhotoData(photo.id).then(setFull).catch(() => setFull(null)) }, [photo.id])
  return <Sheet title={`${TAG_LABEL[photo.tag]} · ${fmtDate(photo.date)}`} onClose={onClose} footer={<>
    <button className="btn btn-danger" onClick={onDelete}>Apagar</button>
    <button className="btn btn-p" onClick={() => onSave({ caption: caption.trim() || null, tag })}>Salvar</button>
  </>}>
    <img className="al-full" src={img(full || photo.thumb)} alt={photo.caption || 'Foto do álbum'}/>
    {photo.added_by && <p className="row-s">Posta por {first(names[photo.added_by])}</p>}
    <label className="onb-f"><span>Legenda</span><input className="fi" value={caption} maxLength={200} onChange={e => setCaption(e.target.value)}/></label>
    <div className="onb-days wrap" role="radiogroup" aria-label="De quê">{ALBUM_TAGS.map(([k, l]) => <button key={k} role="radio" aria-checked={tag === k} className={`onb-day wide ${tag === k ? 'on' : ''}`} onClick={() => setTag(k)}>{l}</button>)}</div>
  </Sheet>
}
