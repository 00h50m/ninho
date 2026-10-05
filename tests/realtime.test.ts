import { describe, expect, it } from 'vitest'
import { applyCompletionDeleted, applyCompletionToday, applyTaskRow, isForHousehold } from '@/lib/realtime'
import type { Task } from '@/lib/types'

const t = (id: string, o: Partial<Task> = {}): Task => ({ id, title: id, category: 'general', weight: 'light', frequency: 'daily', assigned_to: null, scheduled_time: null, essential: false, active: true, ...o })

describe('Realtime: atualização localizada', () => {
  it('conclusão da outra pessoa aparece com autoria', () => {
    const out = applyCompletionToday([t('a'), t('b')], 'a', { id: 'c1', completed_by: 'g' })
    expect(out[0]).toMatchObject({ completed_today: true, completed_by_today: 'g', completion_id: 'c1' })
    expect(out[1].completed_today).toBeUndefined()
  })
  it('conclusão de app antigo (sem autoria) fica como não identificado', () => {
    expect(applyCompletionToday([t('a')], 'a', { id: 'c1', completed_by: null })[0].completed_by_today).toBeNull()
  })
  it('exclusão só desmarca o item com aquele id de conclusão', () => {
    const items = [t('a', { completed_today: true, completion_id: 'c1' }), t('b', { completed_today: true, completion_id: 'c2' })]
    const out = applyCompletionDeleted(items, 'c1')
    expect(out[0].completed_today).toBe(false)
    expect(out[1].completed_today).toBe(true)
  })
  it('exclusão de outra casa (id desconhecido) não muda nada', () => {
    const items = [t('a', { completed_today: true, completion_id: 'c1' })]
    expect(applyCompletionDeleted(items, 'de-outra-casa')).toEqual(items)
  })
  it('evento de outra casa é ignorado', () => {
    expect(isForHousehold({ household_id: 'outra' }, 'minha')).toBe(false)
    expect(isForHousehold({ household_id: 'minha' }, 'minha')).toBe(true)
    expect(isForHousehold(null, 'minha')).toBe(false)
  })
  it('edição da tarefa mantém o estado de conclusão', () => {
    const { tasks, needsReload } = applyTaskRow([t('a', { completed_today: true, completed_by_today: 's' })], { id: 'a', essential: true })
    expect(needsReload).toBe(false)
    expect(tasks[0]).toMatchObject({ essential: true, completed_today: true, completed_by_today: 's' })
  })
  it('tarefa arquivada sai; tarefa nova pede recarga', () => {
    expect(applyTaskRow([t('a')], { id: 'a', active: false }).tasks).toHaveLength(0)
    expect(applyTaskRow([t('a')], { id: 'novo', active: true })).toMatchObject({ needsReload: true })
  })
})
