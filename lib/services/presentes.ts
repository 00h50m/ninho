// Ideias de presente (migration 036). O banco só devolve o que é da pessoa logada.
import { supabase } from '@/lib/supabase'
import { NinhoError, isMissingTable, logError } from '@/lib/errors'
import type { Who } from '@/lib/types'
import { cleanLink, type GiftDate, type GiftIdea, type GiftStatus } from '@/lib/presentes'

function must<T>(r: { data: T | null, error: any }, ctx: string): T {
  if (r.error) { logError(ctx, r.error); throw new NinhoError(r.error, ctx) }
  return r.data as T
}

export interface GiftsData { ready: boolean, dates: GiftDate[], ideas: GiftIdea[] }

export async function loadGifts(householdId: string, who: Who): Promise<GiftsData> {
  const [d, i] = await Promise.all([
    supabase.from('gift_dates').select('id,who,title,month,day,for_who').eq('household_id', householdId).eq('who', who).order('month').order('day'),
    supabase.from('gift_ideas').select('id,who,for_who,title,note,link,price,date_id,status,given_on,created_at').eq('household_id', householdId).eq('who', who).order('created_at', { ascending: false }).limit(500),
  ])
  const e = d.error || i.error
  if (e) {
    if (isMissingTable(e)) return { ready: false, dates: [], ideas: [] }
    must({ data: null, error: e }, 'carregar presentes')
  }
  return { ready: true, dates: (d.data || []) as GiftDate[], ideas: (i.data || []) as GiftIdea[] }
}

export interface IdeaInput { id?: string, for_who: Who, title: string, note: string | null, link: string | null, price: string | null, date_id: string | null }
export async function saveIdea(householdId: string, who: Who, x: IdeaInput): Promise<void> {
  const row = { for_who: x.for_who, title: x.title.trim().slice(0, 120), note: x.note?.trim().slice(0, 500) || null, link: cleanLink(x.link), price: x.price?.trim().slice(0, 40) || null, date_id: x.date_id, updated_at: new Date().toISOString() }
  if (x.id) must(await supabase.from('gift_ideas').update(row).eq('id', x.id).select('id'), 'salvar ideia')
  else must(await supabase.from('gift_ideas').insert({ ...row, household_id: householdId, who }).select('id'), 'anotar ideia')
}
export async function setIdeaStatus(id: string, status: GiftStatus, today: string): Promise<void> {
  must(await supabase.from('gift_ideas').update({ status, given_on: status === 'dado' ? today : null, updated_at: new Date().toISOString() }).eq('id', id).select('id'), 'atualizar ideia')
}
export async function deleteIdea(id: string): Promise<void> {
  must(await supabase.from('gift_ideas').delete().eq('id', id).select('id'), 'apagar ideia')
}

export interface DateInput { id?: string, title: string, month: number, day: number, for_who: Who | 'both' | null }
export async function saveDate(householdId: string, who: Who, x: DateInput): Promise<void> {
  const row = { title: x.title.trim().slice(0, 60), month: x.month, day: x.day, for_who: x.for_who }
  if (x.id) must(await supabase.from('gift_dates').update(row).eq('id', x.id).select('id'), 'salvar data')
  else must(await supabase.from('gift_dates').insert({ ...row, household_id: householdId, who }).select('id'), 'salvar data')
}
export async function deleteDate(id: string): Promise<void> {
  must(await supabase.from('gift_dates').delete().eq('id', id).select('id'), 'apagar data')
}
