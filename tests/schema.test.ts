import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const schema = readFileSync(new URL('../supabase-schema.sql', import.meta.url), 'utf8')
const migration = readFileSync(
  new URL('../supabase/migrations/202610030001_phase1_stabilization.sql', import.meta.url),
  'utf8',
)
const phase2Migration = readFileSync(
  new URL('../supabase/migrations/202610040001_phase2_task_occurrences.sql', import.meta.url),
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

describe('contrato do banco da Fase 2', () => {
  it('versiona ocorrências sem remover o histórico legado', () => {
    expect(schema).toContain('create table if not exists public.task_occurrences')
    expect(phase2Migration).toContain('create table if not exists public.task_occurrences')
    expect(phase2Migration).toContain('alter table public.task_completions add column if not exists occurrence_id')
    expect(phase2Migration).toContain('from public.task_completions completion')
  })

  it.each([
    'generate_task_occurrences',
    'save_task_template',
    'set_task_occurrence_completion',
    'postpone_task_occurrence',
    'resolve_task_occurrence',
  ])('versiona a função %s', (fn) => {
    expect(schema).toContain(`function public.${fn}`)
    expect(phase2Migration).toContain(`function public.${fn}`)
  })

  it('protege identidade da ocorrência e XP por conclusão', () => {
    expect(phase2Migration).toContain('unique (task_id, original_scheduled_date)')
    expect(phase2Migration).toContain("xp_key := 'task:' || task_record.id::text")
    expect(phase2Migration).toContain('on conflict (household_id, idempotency_key)')
  })

  it('suporta todas as regras de recorrência solicitadas', () => {
    for (const rule of [
      'daily',
      'weekdays',
      'weekly',
      'biweekly',
      'monthly',
      'interval_days',
      'after_completion',
      'once',
    ]) {
      expect(phase2Migration).toContain(`'${rule}'`)
    }
  })
})
