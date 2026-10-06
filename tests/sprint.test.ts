// Redesign · Fase 5: Sprint do Ninho.
import { describe, expect, it } from 'vitest'
import { elapsedMs, fmtClock, remainingMs, suggestTasks, summary, areaLabel } from '@/lib/sprint'
import type { Task } from '@/lib/types'

const T0 = Date.parse('2026-10-06T22:00:00Z')
const base = { started_at: '2026-10-06T22:00:00Z', paused_at: null, paused_ms: 0, ended_at: null, duration_min: 15 }

describe('cronômetro pelo horário', () => {
  it('conta pelo relógio: sair da tela ou bloquear o celular não perde tempo', () => {
    expect(remainingMs(base, T0)).toBe(15 * 60000)
    expect(remainingMs(base, T0 + 5 * 60000)).toBe(10 * 60000) // "voltou" 5 min depois
    expect(remainingMs(base, T0 + 60 * 60000)).toBe(0) // nunca negativo
  })
  it('pausas não contam (a em andamento e as já somadas)', () => {
    const paused = { ...base, paused_at: '2026-10-06T22:04:00Z', paused_ms: 30000 }
    expect(elapsedMs(paused, T0 + 10 * 60000)).toBe(4 * 60000 - 30000)
    expect(remainingMs(paused, T0 + 20 * 60000)).toBe(remainingMs(paused, T0 + 10 * 60000)) // parado enquanto pausado
  })
  it('encerrado: o tempo para no fim', () => {
    expect(elapsedMs({ ...base, ended_at: '2026-10-06T22:12:00Z' }, T0 + 99 * 60000)).toBe(12 * 60000)
  })
  it('relógio mm:ss arredonda para cima', () => {
    expect(fmtClock(15 * 60000)).toBe('15:00')
    expect(fmtClock(61001)).toBe('01:02')
    expect(fmtClock(0)).toBe('00:00')
  })
})

describe('tarefas sugeridas', () => {
  const t = (id: string, o: Partial<Task>): Task => ({ id, title: id, category: 'kitchen', weight: 'light', frequency: 'weekly', assigned_to: null, scheduled_time: null, essential: false, active: true, ...o })
  const list = [
    t('pesada', { weight: 'heavy' }), t('leve', {}), t('hoje', { frequency: 'daily' }), t('essencial', { essential: true, prev_done: '2026-10-05' }), t('urgente', { essential: true, frequency: 'daily' }),
    t('feita', { frequency: 'daily', completed_today: true }), t('banheiro', { category: 'bathroom' }),
    t('futura', { frequency: 'once', due_date: '2026-12-01' }), t('arquivada', { active: false }),
  ]
  it('do cômodo, pendentes: as de hoje primeiro (essenciais na frente, depois as rápidas), depois as que podem esperar', () => {
    expect(suggestTasks(list, 'kitchen', '2026-10-06').map(x => x.id)).toEqual(['urgente', 'hoje', 'leve', 'pesada', 'essencial'])
  })
  it('casa toda pega todos os cômodos; respeita o limite', () => {
    expect(suggestTasks(list, 'casa', '2026-10-06').map(x => x.id)).toContain('banheiro')
    expect(suggestTasks(list, 'casa', '2026-10-06', 2)).toHaveLength(2)
  })
})

describe('resumo', () => {
  it('formato "Sprint de 15 minutos — Cozinha · 4 tarefas concluídas · +6 XP"', () => {
    expect(summary({ duration_min: 15, area: 'kitchen', goal: null, done_task_ids: ['a', 'b', 'c', 'd'], xp: 6 }))
      .toEqual({ title: 'Sprint de 15 minutos — Cozinha', result: '4 tarefas concluídas · +6 XP' })
    expect(summary({ duration_min: 10, area: 'casa', goal: 'Visita chegando', done_task_ids: ['a'], xp: 1 }).result).toBe('1 tarefa concluída · +1 XP')
    expect(areaLabel('casa')).toBe('Casa toda')
  })
})
