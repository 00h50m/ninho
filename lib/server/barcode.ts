// Busca o produto do código de barras no Open Food Facts (SÓ servidor; base pública, sem chave).
// OFF_API_URL só existe para testes locais; em produção é o endereço oficial.
import { offToLabel, validBarcode } from '@/lib/openFoodFacts'
import type { LabelRead } from '@/lib/foodLabel'

export async function lookupBarcode(code: string, env = process.env, timeoutMs = 7000): Promise<{ ok: true, label: LabelRead } | { ok: false, status: number, message: string }> {
  if (!validBarcode(code)) return { ok: false, status: 400, message: 'Esse número não é um código de barras válido (8 a 14 dígitos).' }
  const base = (env.OFF_API_URL || 'https://world.openfoodfacts.org').replace(/\/+$/, '')
  try {
    const r = await fetch(`${base}/api/v2/product/${code}.json?fields=product_name,product_name_pt,brands,serving_size,serving_quantity,nutriments`, {
      headers: { 'user-agent': 'Ninho/1.0 (app da casa; contato pelo GitHub 00h50m/ninho)' }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
    })
    if (r.status === 404) return { ok: false, status: 404, message: 'Produto não encontrado na base. Use a foto do rótulo.' }
    if (!r.ok) return { ok: false, status: 502, message: 'A base de produtos não respondeu agora. Use a foto do rótulo.' }
    const j = await r.json().catch(() => null)
    if (!j || j.status === 0) return { ok: false, status: 404, message: 'Produto não encontrado na base. Use a foto do rótulo.' }
    const label = offToLabel(j)
    return label ? { ok: true, label } : { ok: false, status: 422, message: 'O produto está na base, mas sem as calorias. Use a foto do rótulo.' }
  } catch {
    return { ok: false, status: 504, message: 'A base de produtos não respondeu agora. Use a foto do rótulo.' }
  }
}
