// Nós › 📸 Álbum do Ninho (migration 040): fotos da casa e dos cães junto com os marcos do casal
// (reuniões, sprints, desafios), numa linha do tempo por mês. Puro, testado.
import type { TimelineItem } from './nos'

export type AlbumTag = 'casa' | 'caes' | 'nos' | 'passeio' | 'outro'
export const ALBUM_TAGS: Array<[AlbumTag, string]> = [['casa', '🏠 Casa'], ['caes', '🐾 Cães'], ['nos', '💞 Nós'], ['passeio', '🌳 Passeio'], ['outro', '✨ Outro']]
export const TAG_LABEL: Record<string, string> = Object.fromEntries(ALBUM_TAGS)

export interface AlbumPhoto { id: string, date: string, tag: AlbumTag, caption: string | null, thumb: string, added_by: 'g' | 's' | null }
export type AlbumEntry = { kind: 'foto', date: string, photo: AlbumPhoto } | { kind: 'marco', date: string, item: TimelineItem }

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`

/**
 * Linha do tempo por mês, do mais recente para o mais antigo. Com filtro de tag, só as fotos
 * daquela tag (os marcos aparecem em "Tudo" e em "Nós").
 */
export function albumTimeline(photos: AlbumPhoto[], marks: TimelineItem[], tag: AlbumTag | 'all' = 'all'): Array<{ month: string, label: string, entries: AlbumEntry[] }> {
  const entries: AlbumEntry[] = [
    ...photos.filter(p => tag === 'all' || p.tag === tag).map(p => ({ kind: 'foto' as const, date: p.date, photo: p })),
    ...(tag === 'all' || tag === 'nos' ? marks.map(m => ({ kind: 'marco' as const, date: m.date, item: m })) : []),
  ].sort((a, b) => b.date.localeCompare(a.date) || (a.kind === b.kind ? 0 : a.kind === 'foto' ? -1 : 1))
  const out: Array<{ month: string, label: string, entries: AlbumEntry[] }> = []
  for (const e of entries) {
    const m = e.date.slice(0, 7)
    if (!out.length || out[out.length - 1].month !== m) out.push({ month: m, label: monthLabel(m), entries: [] })
    out[out.length - 1].entries.push(e)
  }
  return out
}

/** "Há um ano": fotos do mesmo dia e mês em anos anteriores. */
export function onThisDay(photos: AlbumPhoto[], today: string): AlbumPhoto[] {
  return photos.filter(p => p.date.slice(5) === today.slice(5) && p.date < today)
}
