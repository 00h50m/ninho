// Álbum do Ninho (migration 040). Da casa: as duas veem e editam. Sem a migration: indisponível.
import { supabase } from '@/lib/supabase'
import { NinhoError, isMissingTable, logError } from '@/lib/errors'
import type { Who } from '@/lib/types'
import type { AlbumPhoto, AlbumTag } from '@/lib/album'

function must<T>(r: { data: T | null, error: any }, ctx: string): T {
  if (r.error) { logError(ctx, r.error); throw new NinhoError(r.error, ctx) }
  return r.data as T
}

/** Miniaturas (a foto grande só abre quando toca). */
export async function loadAlbum(householdId: string): Promise<{ ready: boolean, photos: AlbumPhoto[] }> {
  const r = await supabase.from('album_photos').select('id,date,tag,caption,thumb,added_by').eq('household_id', householdId)
    .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(600)
  if (r.error) { if (isMissingTable(r.error)) return { ready: false, photos: [] }; must(r, 'carregar álbum') }
  return { ready: true, photos: (r.data || []) as AlbumPhoto[] }
}

export async function albumPhotoData(id: string): Promise<string> {
  return (must(await supabase.from('album_photos').select('data').eq('id', id).single(), 'abrir foto') as any).data
}

export async function addAlbumPhoto(householdId: string, by: Who | null, p: { date: string, tag: AlbumTag, caption: string | null, thumb: string, data: string }): Promise<void> {
  must(await supabase.from('album_photos').insert({ household_id: householdId, added_by: by, ...p, caption: p.caption?.trim().slice(0, 200) || null }).select('id'), 'guardar foto')
}

export async function updateAlbumPhoto(id: string, patch: { caption?: string | null, tag?: AlbumTag, date?: string }): Promise<void> {
  must(await supabase.from('album_photos').update(patch).eq('id', id).select('id'), 'editar foto')
}

export async function deleteAlbumPhoto(id: string): Promise<void> {
  must(await supabase.from('album_photos').delete().eq('id', id).select('id'), 'apagar foto')
}
