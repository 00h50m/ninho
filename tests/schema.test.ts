import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const schema = readFileSync(new URL('../supabase-schema.sql', import.meta.url), 'utf8')
const migration = readFileSync(
  new URL('../supabase/migrations/202610030001_phase1_stabilization.sql', import.meta.url),
  'utf8',
)

describe('contrato do banco da Fase 1', () => {
  it.each(['weekly_meetings', 'xp_history', 'puppy_accidents'])(
    'mantém a tabela %s no schema canônico',
    (table) => {
      expect(schema).toContain(`create table if not exists public.${table}`)
    },
  )

  it.each(['get_household_xp', 'get_streak', 'set_task_completion', 'set_dog_completion'])(
    'versiona a função %s',
    (fn) => {
      expect(schema).toContain(`function public.${fn}`)
      expect(migration).toContain(`function public.${fn}`)
    },
  )

  it('protege o XP com uma chave idempotente', () => {
    expect(schema).toContain('idx_xp_history_idempotency')
    expect(migration).toContain('idx_xp_history_idempotency')
    expect(migration).toContain("xp_key text := 'task:'")
    expect(migration).toContain("xp_key text := 'dog:'")
  })

  it('usa explicitamente o fuso de São Paulo no banco', () => {
    expect(schema).toContain("timezone('America/Sao_Paulo', now())::date")
    expect(migration).toContain("timezone('America/Sao_Paulo', now())::date")
  })
})

