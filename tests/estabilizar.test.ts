import { describe, expect, it } from 'vitest'
import { CASA_GROUP, casaGroups, type CasaView } from '@/lib/nav'

describe('Casa em grupos', () => {
  it('toda aba tem um grupo', () => {
    const all: CasaView[] = ['tarefas', 'compras', 'manutencao', 'agenda', 'faxinao', 'despensa', 'jantar', 'sugestoes']
    expect(all.every(v => !!CASA_GROUP[v])).toBe(true)
  })
  it('4 grupos na ordem, somando os números; grupo sem aba some', () => {
    const g = casaGroups([['tarefas', 'Tarefas', 8], ['rotinas', 'Rotinas', 2], ['compras', 'Lista', 4], ['manutencao', 'Manutenção', 1], ['agenda', 'Agenda', 2], ['despensa', 'Despensa', 3], ['jantar', 'Jantar'], ['sugestoes', 'Sugestões']])
    expect(g.map(x => [x.g, x.n, x.views.length])).toEqual([['tarefas', 10, 2], ['compras', 7, 3], ['agenda', 2, 1], ['mais', 1, 2]])
    // sem a agenda (migration) o grupo Agenda não aparece
    expect(casaGroups([['tarefas', 'Tarefas'], ['compras', 'Compras'], ['sugestoes', 'Sugestões']]).map(x => x.g)).toEqual(['tarefas', 'compras', 'mais'])
  })
})
