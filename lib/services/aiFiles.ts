// Envio de arquivos para a IA (plano alimentar e foto do prato).
// Fotos são reduzidas no próprio aparelho antes de sair (mais rápido e dentro do limite da Vercel).
import { supabase } from '@/lib/supabase'
import type { DietPlan } from '@/lib/dietPlan'
import type { MealItem } from '@/lib/nutricao'
import type { BodyScan } from '@/lib/bodyScan'

export const MAX_PDF_BYTES = 15 * 1024 * 1024
/** Acima disso o arquivo vai em partes (a Vercel aceita pedidos de até ~4,5 MB). */
const PART = 3_400_000

const toB64 = (buf: ArrayBuffer) => {
  let s = ''; const b = new Uint8Array(buf)
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + 0x8000)))
  return btoa(s)
}

/** Foto → JPEG com no máximo `max` px no lado maior. */
export async function shrink(file: File, max = 1600, quality = 0.85): Promise<{ type: string, data: string }> {
  try {
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const url = c.toDataURL('image/jpeg', quality)
    return { type: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) }
  } catch {
    // navegador sem suporte: manda como veio (o servidor recusa se for grande demais)
    return { type: file.type || 'image/jpeg', data: toB64(await file.arrayBuffer()) }
  }
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<{ ok: true, data: T } | { ok: false, error: string }> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return { ok: false, error: 'Sessão não encontrada. Recarregue o app.' }
    const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    if (r.status === 413) return { ok: false, error: 'O arquivo ficou grande demais. Tente uma foto de cada página.' }
    return r.ok ? { ok: true, data: j as T } : { ok: false, error: j.error || 'Não foi possível ler agora. Tente de novo.' }
  } catch { return { ok: false, error: 'Sem conexão com o servidor. Confira a internet e tente de novo.' } }
}

/** PDF ou foto para a IA ler. PDF grande vai em partes e o servidor junta. */
async function sendDoc<T>(path: string, householdId: string, file: File, what: string): Promise<{ ok: true, data: T } | { ok: false, error: string }> {
  let f: { type: string, data: string }
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) return { ok: false, error: 'O PDF passa de 15 MB. Mande fotos das páginas, ou um PDF menor.' }
    f = { type: 'application/pdf', data: toB64(await file.arrayBuffer()) }
  } else if (file.type.startsWith('image/')) f = await shrink(file, 2000)
  else return { ok: false, error: `Mande um PDF ou uma foto ${what}.` }
  if (f.data.length <= PART) return post<T>(path, { householdId, file: f })
  const id = crypto.randomUUID(), parts = Math.ceil(f.data.length / PART)
  for (let i = 0; i < parts; i++) {
    const r = await post<{ ok: true }>('/api/ai/upload', { householdId, uploadId: id, idx: i, data: f.data.slice(i * PART, (i + 1) * PART) })
    if (r.ok === false) return r
  }
  return post<T>(path, { householdId, upload: { id, total: parts, type: f.type } })
}

export const readPlanFile = (householdId: string, file: File) => sendDoc<{ plan: DietPlan }>('/api/ai/plano', householdId, file, 'do plano')
export const readBodyFile = (householdId: string, file: File) => sendDoc<BodyScan>('/api/ai/medidas', householdId, file, 'do exame')

export async function readPlatePhoto(householdId: string, file: File, caption: string) {
  if (!file.type.startsWith('image/')) return { ok: false as const, error: 'Escolha uma foto.' }
  return post<{ isFood: boolean, items: MealItem[], note: string | null }>('/api/ai/prato', { householdId, image: await shrink(file), caption })
}
