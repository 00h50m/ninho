import { describe, expect, it } from 'vitest'
import { CASA_GROUP, casaGroups, type CasaView } from '@/lib/nav'

describe('Casa em grupos', () => {
  it('toda aba tem um grupo', () => {
    const all: CasaView[] = ['tarefas', 'compras', 'manutencao', 'agenda', 'faxinao', 'despensa', 'jantar', 'sugestoes']
    expect(all.every(v => !!CASA_GROUP[v])).toBe(true)
  })
  it('4 grupos na ordem, somando os números; grupo sem aba some', () => {
    const g = casaGroups([['tarefas', 'Tarefas', 8], ['compras', 'Compras', 4], ['manutencao', 'Manutenção', 1], ['agenda', 'Agenda', 2], ['despensa', 'Despensa', 3], ['jantar', 'Jantar'], ['sugestoes', 'Sugestões']])
    expect(g.map(x => [x.g, x.n, x.views.length])).toEqual([['tarefas', 8, 1], ['compras', 4, 1], ['comida', 3, 2], ['mais', 3, 3]])
    // sem a migration 038 (Despensa e Jantar indisponíveis), o grupo Comida não aparece
    expect(casaGroups([['tarefas', 'Tarefas'], ['compras', 'Compras'], ['sugestoes', 'Sugestões']]).map(x => x.g)).toEqual(['tarefas', 'compras', 'mais'])
  })
})
