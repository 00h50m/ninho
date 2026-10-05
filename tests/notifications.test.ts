import { describe, expect, it } from 'vitest'
import { morningMessage, weeklyMessage, testMessage } from '@/lib/digest'
import { planToday } from '@/lib/today'
import { EMPTY_SCORES } from '@/lib/gamification'
import { cachedHousehold, isOfflineError, readSnapshot, rememberHousehold, saveSnapshot } from '@/lib/offline'
import { urlBase64ToUint8Array } from '@/lib/pushClient'
import { cronAuthorized, missingConfig } from '@/lib/server/push'
import type { Dog, Task } from '@/lib/types'
import { readFileSync } from 'node:fs'

const names = { g: 'Giovanna', s: 'Sabrina' }
const task = (id: string, o: Partial<Task> = {}): Task => ({ id, title: id, category: 'general', weight: 'light', frequency: 'daily', assigned_to: null, scheduled_time: null, essential: false, active: true, ...o })
const T = '2026-10-07'

describe('bom dia', () => {
  const tasks = [
    task('Louça', { assigned_to: 'g', essential: true, scheduled_time: '08:00' }),
    task('Reset da sala', { assigned_to: 'g', scheduled_time: '21:30' }),
    task('Regar plantas', { assigned_to: 's' }),
    task('Lavar roupa', { assigned_to: 'g', frequency: 'weekly', prev_done: '2026-10-05' }), // já feita na semana
    task('Passeio (tarefa de cão)', { category: 'dogs', assigned_to: 'g' }),               // some com cães cadastrados
  ]
  const dogs: Dog[] = [{ id: 'd', name: 'Zelda', breed: null, is_puppy: true, routines: [{ id: 'r', title: 'Ração manhã', frequency: 'daily', scheduled_time: '07:00' }] }]
  const plan = planToday(tasks, dogs, T)
  const mine = (w: 'g' | 's') => plan.items.filter(i => plan.ownerOfItem(i) === w)

  it('só o que é da pessoa, devido hoje, sem tarefas de cães repetidas', () => {
    const titles = mine('g').map(i => i.task?.title || i.dog?.title)
    expect(titles).toContain('Louça')
    expect(titles).not.toContain('Regar plantas')
    expect(titles).not.toContain('Lavar roupa')
    expect(titles).not.toContain('Passeio (tarefa de cão)')
  })
  it('texto com contagem, essenciais, primeira por horário e aviso do bônus', () => {
    const m = morningMessage('g', names, mine('g'), '06:30')
    expect(m.title).toBe('Bom dia, Giovanna! ☀️')
    expect(m.body).toMatch(/^Hoje: 2 tarefas \(1 essencial\)/)
    expect(m.body).toMatch(/Primeira: (Ração manhã às 07:00|Louça às 08:00)/)
    expect(m.body).toContain('×1,5')
  })
  it('nada pendente', () => {
    expect(morningMessage('s', names, [], '07:00').body).toContain('Nada pendente')
  })
  it('modo sobrevivência: só essenciais (rotinas dos cães continuam)', () => {
    const p = planToday(tasks, dogs, T, { focus: true })
    const g = p.items.filter(i => p.ownerOfItem(i) === 'g').map(i => i.task?.title || i.dog?.title)
    expect(g).toContain('Louça')
    expect(g).not.toContain('Reset da sala')
  })
})

describe('resumo de domingo', () => {
  it('placar, quem paga a aposta, sequência e pendências', () => {
    const m = weeklyMessage(names, { ...EMPTY_SCORES, g: { xp: 58, done: 30, on_time: 9 }, s: { xp: 51, done: 27, on_time: 4 } }, 'Quem perder escolhe o jantar', 12,
      [{ title: 'Limpar banheiro', frequency: 'weekly' }, { title: 'Faxina geral', frequency: 'monthly' }])
    expect(m.body).toContain('Vocês fizeram 57 conclusões')
    expect(m.body).toContain('Giovanna 58 × 51 Sabrina — Giovanna venceu! Sabrina paga: Quem perder escolhe o jantar.')
    expect(m.body).toContain('🔥 12 dias seguidos')
    expect(m.body).toContain('Ficou para trás: Limpar banheiro (semanal), Faxina geral (mensal)')
  })
  it('empate e nada para trás', () => {
    const m = weeklyMessage(names, EMPTY_SCORES, null, 0, [])
    expect(m.body).toContain('empate')
    expect(m.body).toContain('Nada ficou para trás')
  })
  it('teste', () => expect(testMessage('s', names).body).toContain('Sabrina'))
})

describe('sem internet', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) } } }
  it('guarda e lê o último carregamento por casa', () => {
    const s = mem()
    expect(saveSnapshot('h1', T, { tasks: [1, 2] }, s)).toBe(true)
    const snap = readSnapshot<{ tasks: number[] }>('h1', s)!
    expect(snap.today).toBe(T)
    expect(snap.data.tasks).toEqual([1, 2])
    expect(readSnapshot('h2', s)).toBeNull()
  })
  it('armazenamento cheio ou bloqueado não quebra', () => {
    const broken = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('cota') }, removeItem: () => {} }
    expect(saveSnapshot('h1', T, {}, broken)).toBe(false)
    expect(readSnapshot('h1', broken)).toBeNull()
  })
  it('lembra a casa para abrir sem internet', () => {
    const s = mem(); rememberHousehold('h9', s)
    expect(cachedHousehold(s)).toBe('h9')
  })
  it('reconhece erro de rede', () => {
    expect(isOfflineError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isOfflineError({ message: 'permission denied' })).toBe(false)
  })
})

describe('servidor de notificações', () => {
  it('chave VAPID em base64url vira bytes', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID_-8'))).toEqual([1, 2, 3, 255, 239])
  })
  it('agendamento só com o segredo certo', () => {
    const req = (h?: string) => new Request('https://x/api/cron/morning', { headers: h ? { authorization: h } : {} })
    expect(cronAuthorized(req('Bearer abc'), { CRON_SECRET: 'abc' } as any)).toBe(true)
    expect(cronAuthorized(req('Bearer errado'), { CRON_SECRET: 'abc' } as any)).toBe(false)
    expect(cronAuthorized(req(), { CRON_SECRET: 'abc' } as any)).toBe(false)
    expect(cronAuthorized(req('Bearer '), {} as any)).toBe(false) // sem segredo configurado: nunca libera
  })
  it('lista o que falta configurar, sem mostrar valores', () => {
    expect(missingConfig({ NEXT_PUBLIC_SUPABASE_URL: 'u' } as any)).toEqual(['SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'])
  })
  it('chave service_role nunca vai para o navegador', () => {
    for (const f of ['components/NinhoApp.tsx', 'components/NotificationsCard.tsx', 'lib/services/ninho.ts', 'lib/pushClient.ts', 'lib/supabase.ts'])
      expect(readFileSync(f, 'utf8')).not.toContain('SERVICE_ROLE')
  })
  it('agendamentos: manhã ~7h e domingo ~19h em São Paulo (UTC−3)', () => {
    const v = JSON.parse(readFileSync('vercel.json', 'utf8'))
    expect(v.crons).toEqual([{ path: '/api/cron/morning', schedule: '0 10 * * *' }, { path: '/api/cron/weekly', schedule: '0 22 * * 0' }])
  })
})
