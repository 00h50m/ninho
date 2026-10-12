// Exportar meus dados do Meu dia em CSV (abre no Excel/Planilhas em português: ponto e vírgula,
// decimal com vírgula e BOM para os acentos). Só os dados de quem baixa. Puro, testado.
import { MEALS, type CustomFood, type MealItem } from './nutricao'
import type { PLog } from './meudia'
import { workoutLabel } from './meudia'
import type { SavedMeal } from './savedMeals'

type Cell = string | number | null | undefined
const cell = (v: Cell) => {
  if (v == null) return ''
  const s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v)
  // aspas quando precisa; e nada de fórmula (=, +, -, @ no começo viram texto)
  const safe = /^[=+\-@]/.test(s) && typeof v !== 'number' ? `'${s}` : s
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
export const toCsv = (head: string[], rows: Cell[][]) => '﻿' + [head, ...rows].map(r => r.map(cell).join(';')).join('\r\n') + '\r\n'

const byDate = (a: PLog, b: PLog) => a.date.localeCompare(b.date) || String(a.created_at || '').localeCompare(String(b.created_at || ''))

export const EXPORTS = [
  ['refeicoes', '🍽️ Refeições'], ['peso', '⚖️ Peso e medidas'], ['sono', '😴 Sono'], ['agua', '💧 Água'],
  ['treinos', '🏋️ Treinos'], ['remedios', '💊 Remédios tomados'], ['alimentos', '🥗 Meus alimentos'], ['salvas', '⭐ Refeições salvas'],
] as const
export type ExportKind = typeof EXPORTS[number][0]

export function exportCsv(kind: ExportKind, d: { logs: PLog[], foods: CustomFood[], saved: SavedMeal[] }): string {
  const L = (k: string) => d.logs.filter(l => l.kind === k).sort(byDate)
  switch (kind) {
    case 'refeicoes': return toCsv(['data', 'refeição', 'o que comeu', 'kcal', 'proteína (g)', 'carboidrato (g)', 'gordura (g)'], L('refeicao').map(l => {
      const it = (l.data?.items || []) as MealItem[], s = (k: 'p' | 'c' | 'f') => it.reduce((a, i) => a + (Number(i[k]) || 0), 0)
      return [l.date, MEALS.find(m => m[0] === l.data?.meal)?.[2] || '', it.length ? it.map(i => i.name).join(', ') : l.data?.text || '', l.value, s('p'), s('c'), s('f')]
    }))
    case 'peso': {
      const keys = Array.from(new Set(L('corpo').flatMap(l => Object.keys(l.data || {}).filter(k => typeof l.data[k] === 'number')))).sort()
      return toCsv(['data', 'peso (kg)', ...keys.filter(k => k !== 'weight')], L('corpo').map(l => [l.date, l.value ?? l.data?.weight, ...keys.filter(k => k !== 'weight').map(k => l.data?.[k])]))
    }
    case 'sono': return toCsv(['data', 'horas', 'deitou', 'acordou', 'qualidade'], L('sono').map(l => [l.date, l.value, l.data?.bed, l.data?.wake, l.data?.quality]))
    case 'agua': {
      const by = new Map<string, number>()
      L('agua').forEach(l => by.set(l.date, (by.get(l.date) || 0) + (Number(l.value) || 0)))
      return toCsv(['data', 'água (ml)'], Array.from(by.entries()).map(([dt, ml]) => [dt, ml]))
    }
    case 'treinos': return toCsv(['data', 'tipo', 'minutos', 'intensidade', 'observação'], L('treino').map(l => [l.date, workoutLabel(l.data?.type).replace(/^\S+\s/, ''), l.value, l.data?.intensity, l.data?.note]))
    case 'remedios': return toCsv(['data', 'remédio', 'horário da dose'], L('remedio').map(l => [l.date, l.data?.name, l.data?.time]))
    case 'alimentos': return toCsv(['nome', 'porção', 'gramas da porção', 'kcal da porção', 'proteína (g)', 'carboidrato (g)', 'gordura (g)', 'conferir'],
      [...d.foods].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(f => [f.name, f.portion, f.portion_g, f.kcal, f.protein, f.carb, f.fat, f.review || '']))
    case 'salvas': return toCsv(['nome', 'kcal', 'itens', 'vezes usada'], d.saved.map(s => [s.name, s.kcal, s.items.map(i => i.name).join(', '), s.uses]))
  }
}
