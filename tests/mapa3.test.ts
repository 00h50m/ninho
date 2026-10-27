import { describe, expect, it } from 'vitest'
import { ageLabel, isQuestion } from '@/lib/server/askAi'

describe('perguntar ao Ninho', () => {
  it('reconhece pergunta', () => {
    for (const q of ['como tirar mancha de xixi do sofá?', 'Quanto de ração para filhote de 6 meses', 'qual produto uso no box', 'posso usar vinagre no mármore', 'dá pra lavar edredom na máquina', 'é normal a Zelda comer grama', 'o que fazer com mofo?'])
      expect(isQuestion(q)).toBe(true)
  })
  it('o que é para registrar não é pergunta', () => {
    for (const t of ['comprei leite e café', 'a Zelda tomou a V10 hoje', 'bebi um copo de água', 'lavei a louça', 'compras', 'oi, tudo bem?', 'Bom dia!', 'obrigada!'])
      expect(isQuestion(t)).toBe(false)
  })
  it('idade das cachorras', () => {
    expect(ageLabel('2026-04-10', '2026-10-27')).toBe('6 meses')
    expect(ageLabel('2022-01-01', '2026-10-27')).toBe('4 anos')
    expect(ageLabel(null, '2026-10-27')).toBeNull()
    expect(ageLabel('2027-01-01', '2026-10-27')).toBeNull()
  })
})
