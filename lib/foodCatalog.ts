// Importar uma planilha de alimentos (CSV) para "Meus alimentos".
// Aceita o catálogo da dieta (nome, porcao, quantidade_por_porcao, unidade_medida,
// kcal_por_porcao, proteina_g_por_porcao, precisa_revisar, motivo_revisao) e planilhas
// simples (nome, porção, gramas, kcal, proteína). Vírgula ou ponto e vírgula; decimal
// com ponto ou vírgula. Puro, testado. Nada sai do aparelho para ler o arquivo.
import { norm, type CustomFood } from './nutricao'

export interface CatalogFood { name: string, portion: string, portion_g: number, kcal: number, protein: number | null, carb: null, fat: null, review: string | null }
export interface CatalogResult { add: CatalogFood[], dup: string[], bad: Array<{ line: number, name: string, why: string }> }

export const MAX_IMPORT = 300

/** Linhas do CSV (aspas, aspas dobradas, quebra de linha dentro de aspas). */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '')
  const first = t.split(/\r?\n/, 1)[0] || ''
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === sep) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some(c => c.trim())) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some(c => c.trim())) rows.push(row)
  return rows
}

const key = (h: string) => norm(h).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const COLS: Record<string, string[]> = {
  name: ['nome', 'alimento', 'name'],
  portion: ['porcao', 'porcao_descricao', 'medida', 'portion'],
  qty: ['quantidade_por_porcao', 'gramas', 'gramas_da_porcao', 'peso_g', 'g', 'portion_g', 'quantidade'],
  unit: ['unidade_medida', 'unidade'],
  kcal: ['kcal_por_porcao', 'kcal', 'calorias', 'energia_kcal'],
  protein: ['proteina_g_por_porcao', 'proteina', 'proteina_g', 'protein'],
  flag: ['precisa_revisar', 'revisar', 'conferir'],
  why: ['motivo_revisao', 'motivo', 'observacao_revisao'],
}
const num = (s: string | undefined) => {
  const v = (s || '').trim().replace(/\s/g, '')
  if (!v) return NaN
  // "1.234,5" → 1234.5 · "2,5" → 2.5 · "2.5" → 2.5
  return Number(/,\d*$/.test(v) ? v.replace(/\./g, '').replace(',', '.') : v)
}
const yes = (s: string | undefined) => /^(sim|s|yes|y|x|1|true|verdadeiro)$/.test(norm(s || ''))

/**
 * Planilha → alimentos para cadastrar. O que já está em Meus alimentos (mesmo nome) fica de fora;
 * linhas sem nome, sem calorias ou sem porção válida voltam explicadas, nada é inventado.
 */
export function catalogFoods(text: string, mine: Array<Pick<CustomFood, 'name'>> = []): CatalogResult | null {
  const rows = parseCsv(text)
  if (rows.length < 2) return null
  const head = rows[0].map(key)
  const at = (k: keyof typeof COLS) => head.findIndex(h => COLS[k].includes(h))
  const c = { name: at('name'), portion: at('portion'), qty: at('qty'), unit: at('unit'), kcal: at('kcal'), protein: at('protein'), flag: at('flag'), why: at('why') }
  if (c.name < 0 || c.kcal < 0 || (c.qty < 0 && c.portion < 0)) return null
  const seen = new Set(mine.map(m => norm(m.name)))
  const out: CatalogResult = { add: [], dup: [], bad: [] }
  rows.slice(1).forEach((r, i) => {
    const line = i + 2
    const name = (r[c.name] || '').replace(/\s+/g, ' ').trim()
    if (!name) return
    if (name.length > 60) { out.bad.push({ line, name: name.slice(0, 60), why: 'nome com mais de 60 letras' }); return }
    const kcal = num(r[c.kcal])
    if (!(kcal >= 0 && kcal <= 3000)) { out.bad.push({ line, name, why: 'calorias faltando ou fora do normal' }); return }
    let portion = c.portion >= 0 ? (r[c.portion] || '').replace(/\s+/g, ' ').trim() : ''
    let g = c.qty >= 0 ? num(r[c.qty]) : NaN
    const unit = c.unit >= 0 ? norm(r[c.unit] || '') : ''
    if (!(g > 0)) { const m = portion.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i); g = m ? num(m[1]) : NaN }
    if (!(g > 0 && g <= 2000)) { out.bad.push({ line, name, why: 'porção sem gramas (ou ml)' }); return }
    if (!portion) portion = `${String(g).replace('.', ',')} ${unit === 'ml' ? 'ml' : 'g'}`
    const p = c.protein >= 0 ? num(r[c.protein]) : NaN
    const k = norm(name)
    if (seen.has(k)) { out.dup.push(name); return }
    seen.add(k)
    const flag = c.flag >= 0 && yes(r[c.flag])
    const why = c.why >= 0 ? (r[c.why] || '').replace(/\s+/g, ' ').trim() : ''
    out.add.push({
      name, portion: portion.slice(0, 30), portion_g: Math.round(g * 10) / 10, kcal: Math.round(kcal * 10) / 10,
      protein: p >= 0 && p <= 500 ? Math.round(p * 10) / 10 : null, carb: null, fat: null,
      review: flag ? (why || 'Conferir no rótulo').slice(0, 200) : null,
    })
  })
  if (out.add.length > MAX_IMPORT) {
    out.add.slice(MAX_IMPORT).forEach(f => out.bad.push({ line: 0, name: f.name, why: `passa do limite de ${MAX_IMPORT} por vez` }))
    out.add = out.add.slice(0, MAX_IMPORT)
  }
  return out
}
