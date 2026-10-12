// Código de barras → alimento, pela base pública Open Food Facts (sem chave, sem IA).
// Puro: confere o código e transforma a resposta. A busca fica no servidor (lib/server/barcode.ts).
import type { LabelRead } from './foodLabel'

/** EAN-8, UPC-A (12), EAN-13 e GTIN-14, com o dígito verificador certo. */
export function validBarcode(code: string): boolean {
  const c = code.replace(/\D/g, '')
  if (![8, 12, 13, 14].includes(c.length) || c !== code.trim()) return false
  const d = c.split('').map(Number), check = d.pop()!
  const sum = d.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - sum % 10) % 10 === check
}

const n = (v: unknown) => { const x = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v); return Number.isFinite(x) && x >= 0 ? x : null }
const r1 = (v: number) => Math.round(v * 10) / 10
const str = (v: unknown, max: number) => typeof v === 'string' && v.replace(/\s+/g, ' ').trim() ? v.replace(/\s+/g, ' ').trim().slice(0, max) : null

/**
 * Produto do Open Food Facts → mesmo formato da foto do rótulo (para conferir antes de salvar).
 * Usa a porção do rótulo quando existe; senão, 100 g. null = produto sem calorias na base.
 */
export function offToLabel(j: unknown): LabelRead | null {
  const p = (j as any)?.product
  if (!p || typeof p !== 'object') return null
  const nu = p.nutriments || {}
  const kcal100 = n(nu['energy-kcal_100g']) ?? (n(nu['energy_100g']) != null ? n(nu['energy_100g'])! / 4.184 : null)
  const sg = n(p.serving_quantity)
  const serving = sg && sg > 0 && sg <= 2000 ? sg : null
  const per = (k: string) => {
    const s = n(nu[`${k}_serving`]), h = n(nu[`${k}_100g`])
    return serving && s != null ? s : h != null ? (serving ? h * serving / 100 : h) : null
  }
  const kcal = serving && n(nu['energy-kcal_serving']) != null ? n(nu['energy-kcal_serving'])! : kcal100 != null ? (serving ? kcal100 * serving / 100 : kcal100) : null
  if (kcal == null || kcal > 3000) return null
  const g = serving ?? 100
  const name = [str(p.product_name_pt, 50) || str(p.product_name, 50), str(String(p.brands || '').split(',')[0], 25)].filter(Boolean).join(' ').slice(0, 60) || null
  const macro = (k: string) => { const v = per(k); return v != null && v <= 500 ? r1(v) : null }
  return {
    name, portion: (serving ? str(p.serving_size, 30) : null) || `${String(r1(g)).replace('.', ',')} g`, portion_g: r1(g), kcal: r1(kcal),
    protein: macro('proteins'), carb: macro('carbohydrates'), fat: macro('fat'),
    note: 'Valores da base pública Open Food Facts: confira com a embalagem.',
  }
}
