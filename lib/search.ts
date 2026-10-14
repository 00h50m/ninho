// Busca em tudo (o que já está carregado no app): tarefas, compras, agenda, rotinas, cães,
// Meus alimentos e refeições salvas. Sem acento e sem maiúscula; começo da palavra vale mais. Puro, testado.
import { norm } from './nutricao'

export type SearchKind = 'tarefa' | 'compra' | 'agenda' | 'rotina' | 'cao' | 'alimento' | 'salva'
export interface SearchItem { kind: SearchKind, id: string, title: string, sub?: string }
export interface SearchHit extends SearchItem { score: number }

export const KIND_LABEL: Record<SearchKind, string> = {
  tarefa: '✓ Tarefas', compra: '🛒 Compras', agenda: '📅 Agenda', rotina: '🔁 Rotinas', cao: '🐾 Cães', alimento: '🥗 Meus alimentos', salva: '⭐ Refeições salvas',
}

const clean = (s: string) => ` ${norm(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `

/** Pontua um título para a busca (0 = não bate). Todas as palavras precisam aparecer. */
export function score(title: string, sub: string | undefined, q: string): number {
  const words = clean(q).trim().split(' ').filter(Boolean)
  if (!words.length) return 0
  const t = clean(title), s = sub ? clean(sub) : ''
  let total = 0
  for (const w of words) {
    if (t.startsWith(` ${w}`)) total += 6
    else if (t.includes(` ${w}`)) total += 4
    else if (t.includes(w)) total += 2
    else if (s.includes(` ${w}`)) total += 1
    else return 0
  }
  return total + (clean(q) === t ? 10 : 0)
}

/** Resultados por relevância (no máximo `limit` por tipo). */
export function searchAll(items: SearchItem[], q: string, limit = 6): SearchHit[] {
  if (clean(q).trim().length < 2) return []
  const hits = items.map(i => ({ ...i, score: score(i.title, i.sub, q) })).filter(h => h.score > 0)
    .sort((a, b) => b.score - a.score || a.title.length - b.title.length || a.title.localeCompare(b.title, 'pt-BR'))
  const per = new Map<SearchKind, number>()
  return hits.filter(h => { const n = per.get(h.kind) || 0; if (n >= limit) return false; per.set(h.kind, n + 1); return true })
}
