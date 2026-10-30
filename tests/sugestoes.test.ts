import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { CATALOG, hasSug, norm, suggestionView } from '@/lib/sugestoes'

// Títulos parecidos com os de uma casa real (fictícios)
const TASKS = ['Louça da manhã (tirar, guardar e pôr)', 'Levar o lixo', 'Aspirador Klebin (vassourinha)', 'Limpar banheiro 1', 'Limpar os robôs (Klebin e Fabin)', 'Mercado semanal', 'Reset da sala (noite)']
const PETS = ['Comida e banheiro manhã', 'Lavar os potes de comida e água', 'Lavar caminhas e cobertas', 'Água fresca', 'Passeio manhã', 'Escovação', 'Banho']
const sug = (t: string) => CATALOG.flatMap(a => a.items).find(s => s.t === t)!

describe('sugestões de tarefas', () => {
  it('catálogo: nomes únicos, frequências e pesos válidos, explicação curta', () => {
    const all = CATALOG.flatMap(a => a.items)
    expect(new Set(all.map(s => norm(s.t))).size).toBe(all.length)
    expect(all.length).toBeGreaterThanOrEqual(60)
    expect(all.every(s => ['daily', 'weekly', 'biweekly', 'monthly'].includes(s.f) && ['light', 'medium', 'heavy'].includes(s.w) && s.why.length > 5 && s.why.length <= 90)).toBe(true)
    expect(CATALOG.find(a => a.key === 'pets')!.items.every(s => s.kind === 'pet')).toBe(true)
  })
  it('"já tem" pelo nome sem acento ou por um nome parecido', () => {
    expect(hasSug(sug('Louça diária'), TASKS, PETS)).toBe(true)          // "Louça da manhã…"
    expect(hasSug(sug('Lixo da cozinha'), TASKS, PETS)).toBe(true)       // "Levar o lixo"
    expect(hasSug(sug('Varrer / aspirar'), TASKS, PETS)).toBe(true)      // "Aspirador Klebin"
    expect(hasSug(sug('Limpar vaso sanitário'), TASKS, PETS)).toBe(true) // dentro de "Limpar banheiro 1"
    expect(hasSug(sug('Limpar os robôs aspiradores'), TASKS, PETS)).toBe(true)
    expect(hasSug(sug('Tirar o pó dos móveis'), TASKS, PETS)).toBe(false)
    // pets olham só as rotinas dos cães
    expect(hasSug(sug('Lavar os potes de comida e água'), TASKS, PETS)).toBe(true)
    expect(hasSug(sug('Limpar a área do xixi / tapete higiênico'), TASKS, PETS)).toBe(true) // "Comida e banheiro"
    expect(hasSug(sug('Cortar as unhas'), TASKS, PETS)).toBe(false)
    expect(hasSug(sug('Água fresca'), ['Água fresca'], [])).toBe(false) // tarefa antiga não conta como rotina
  })
  it('vista: só o que falta, contagem por área', () => {
    const v = suggestionView(TASKS, PETS, true)
    const pets = v.find(a => a.key === 'pets')!
    expect(pets.shown.every(x => !x.has)).toBe(true)
    expect(pets.missing).toBe(pets.total - pets.items.filter(s => hasSug(s, TASKS, PETS)).length)
    const all = suggestionView(TASKS, PETS, false).find(a => a.key === 'cozinha')!
    expect(all.shown.length).toBe(all.total)
    expect(all.shown.findIndex(x => x.has)).toBeGreaterThan(all.shown.findIndex(x => !x.has)) // o que falta primeiro
  })
  it('a janela antiga de sugestões saiu; os botões levam para a aba', () => {
    const src = ['components/NinhoApp.tsx', ...readdirSync('components/app').map(f => 'components/app/' + f), 'components/screens/Casa.tsx'].map(f => readFileSync(f, 'utf8')).join('\n')
    expect(src).not.toContain("openModal('sugg')")
    expect(src).toContain("['sugestoes','💡 Sugestões']")
  })
})
