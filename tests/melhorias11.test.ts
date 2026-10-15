import { describe, expect, it } from 'vitest'
import { cleanLink, dateIdeas, daysUntil, giftReminders, nextOccurrence, parseGift, sortIdeas, upcomingDates, whenLabel, type GiftDate, type GiftIdea } from '@/lib/presentes'
import { DEFAULT_RPREFS, RKINDS, dueReminders, forDevice, type RemState } from '@/lib/reminders'
import { HELP } from '@/lib/server/telegram'

// Dados fictícios (nenhum dado real)
const dt = (id: string, title: string, month: number, day: number, who: 'g' | 's' = 'g', for_who: GiftDate['for_who'] = 's'): GiftDate => ({ id, who, title, month, day, for_who })
const idea = (id: string, title: string, o: Partial<GiftIdea> = {}): GiftIdea => ({ id, who: 'g', for_who: 's', title, note: null, link: null, price: null, date_id: null, status: 'ideia', given_on: null, created_at: '2026-10-01T10:00:00Z', ...o })

describe('datas especiais', () => {
  it('próxima vez que a data cai (vira o ano; 29/02 em ano comum vira 28/02)', () => {
    expect(nextOccurrence(3, 14, '2026-10-15')).toBe('2027-03-14')
    expect(nextOccurrence(10, 15, '2026-10-15')).toBe('2026-10-15')
    expect(nextOccurrence(12, 25, '2026-10-15')).toBe('2026-12-25')
    expect(nextOccurrence(2, 29, '2026-10-15')).toBe('2027-02-28')
    expect(nextOccurrence(2, 29, '2027-10-15')).toBe('2028-02-29')
    expect(daysUntil('2026-12-25', '2026-10-15')).toBe(71)
  })
  it('próximas datas com quantas ideias (sem contar as já dadas)', () => {
    const dates = [dt('n', 'Natal', 12, 25, 'g', null), dt('a', 'Aniversário da Sabrina', 10, 29)]
    const ideas = [idea('1', 'Fone', { date_id: 'a' }), idea('2', 'Livro', { date_id: 'a', status: 'comprado' }), idea('3', 'Vela', { date_id: 'a', status: 'dado' })]
    expect(upcomingDates(dates, ideas, '2026-10-15').map(u => `${u.date.title}:${u.days}:${u.ideas}`)).toEqual(['Aniversário da Sabrina:14:2', 'Natal:71:0'])
    expect(upcomingDates(dates, ideas, '2026-10-15', 30)).toHaveLength(1)
    expect([0, 1, 5].map(whenLabel)).toEqual(['hoje', 'amanhã', 'em 5 dias'])
  })
  it('sugestões de datas sem repetir as que já existem', () => {
    const names = { g: 'Giovanna Teste', s: 'Sabrina Teste' }
    expect(dateIdeas(names, 'g', []).map(x => x.title)).toEqual(['Aniversário da Sabrina', 'Aniversário de namoro', 'Dia dos Namorados', 'Natal'])
    expect(dateIdeas(names, 's', [dt('n', 'natal', 12, 25)]).map(x => x.title)).toEqual(['Aniversário da Giovanna', 'Aniversário de namoro', 'Dia dos Namorados'])
    expect(dateIdeas(names, 'g', []).find(x => x.title === 'Dia dos Namorados')).toMatchObject({ month: 6, day: 12, for_who: 'both' })
  })
})

describe('ideias', () => {
  it('"/presente": o quê, link e faixa de preço', () => {
    expect(parseGift('fone sem fio azul https://loja.exemplo/fone?c=1 até R$ 200')).toEqual({ title: 'fone sem fio azul', link: 'https://loja.exemplo/fone?c=1', price: 'até R$ 200' })
    expect(parseGift('livro da autora X, uns 80 reais')).toEqual({ title: 'livro da autora X', link: null, price: 'uns 80 reais' })
    expect(parseGift('   ')).toBeNull()
    expect(parseGift('a'.repeat(200))!.title).toHaveLength(120)
  })
  it('link só http(s)', () => {
    expect(cleanLink(' https://x.exemplo/a ')).toBe('https://x.exemplo/a')
    expect(cleanLink('javascript:alert(1)')).toBeNull()
    expect(cleanLink('loja.com')).toBeNull()
    expect(cleanLink('')).toBeNull()
  })
  it('ordem: as da data mais perto primeiro, depois as mais novas', () => {
    const dates = [dt('n', 'Natal', 12, 25), dt('a', 'Aniversário', 10, 29)]
    const list = [idea('1', 'Sem data antiga'), idea('2', 'Natal', { date_id: 'n' }), idea('3', 'Aniversário', { date_id: 'a' }), idea('4', 'Sem data nova', { created_at: '2026-10-10T10:00:00Z' })]
    expect(sortIdeas(list, dates, '2026-10-15').map(i => i.title)).toEqual(['Aniversário', 'Natal', 'Sem data nova', 'Sem data antiga'])
  })
})

describe('lembretes das datas', () => {
  const dates = [dt('a', 'Aniversário da Sabrina', 10, 29), dt('b', 'Aniversário da Giovanna', 10, 18, 's', 'g'), dt('n', 'Natal', 12, 25)]
  const ideas = [idea('1', 'Fone', { date_id: 'a' }), idea('2', 'Caneca')]
  it('14 e 3 dias antes e no dia, só para a dona, com as ideias', () => {
    expect(giftReminders(dates, ideas, '2026-10-15').map(r => `${r.who}:${r.ref}:${r.title}:${r.body}`)).toEqual([
      's:presente:b:2026-10-18:3:🎁 Aniversário da Giovanna em 3 dias:Nenhuma ideia anotada ainda.',
      'g:presente:a:2026-10-29:14:🎁 Aniversário da Sabrina em 14 dias:1 ideia anotada. Dá tempo de comprar com calma.',
    ])
    expect(giftReminders(dates, [], '2026-10-29')[0]).toMatchObject({ title: '🎁 Aniversário da Sabrina hoje', body: 'É hoje! 💛' })
    expect(giftReminders(dates, ideas, '2026-10-16')).toEqual([])
    // ideias sem data contam para a data da mesma pessoa
    expect(giftReminders([dt('a', 'Aniversário da Sabrina', 10, 18)], [idea('2', 'Caneca')], '2026-10-15')[0].body).toBe('1 ideia anotada.')
  })
  const base = (o: Partial<RemState>): RemState => ({ date: '2026-10-15', hm: '09:01', nowMs: 0, names: { g: 'G', s: 'S' }, meds: [], medTaken: [], water: [], routines: [], routineDone: [], sprint: null, dogHealth: [], events: [], challenges: [], checkins: [], ...o } as RemState)
  it('no agendador: às 9h, só no aparelho da dona; ligado por padrão', () => {
    const list = dueReminders(base({ gifts: { dates, ideas } })).filter(r => r.kind === 'presente')
    expect(list.map(r => `${r.who}:${r.url}`)).toEqual(['s:/?ir=presentes', 'g:/?ir=presentes'])
    expect(forDevice(list, { who: 'g', quiet_start: '22:00', quiet_end: '07:00', reminders: {} }, '09:01').map(r => r.who)).toEqual(['g'])
    expect(dueReminders(base({ hm: '15:00', gifts: { dates, ideas } })).filter(r => r.kind === 'presente')).toEqual([])
    expect(RKINDS.find(k => k[0] === 'presente')?.slice(1, 3)).toEqual(['🎁', 'Datas especiais'])
    expect(DEFAULT_RPREFS.presente).toBe(true)
  })
  it('o Telegram explica os comandos', () => {
    expect(HELP).toContain('/presente fone azul')
  })
})

// ── Compromissos que mexem no dia ─────────────────────────────────────
import { adjustOwner, busyMinutes, busyWindows, conflictAt, fullDay } from '@/lib/busy'
import { buildTasks } from '@/lib/build'
import { planToday } from '@/lib/today'
import { whyLabel } from '@/lib/split'
import { agendaItems, icsCalendar } from '@/lib/ics'
import type { Task } from '@/lib/types'

const DAY = '2026-10-07'
const ev = (id: string, title: string, time: string | null, end: string | null, who: string | null, o: any = {}) => ({ id, kind: 'compromisso', title, date: DAY, time, end_time: end, who, done_at: null, ...o })
describe('compromissos: janelas ocupadas', () => {
  const W = busyWindows([
    ev('d', 'Dentista', '14:00', '16:00', 'g'), ev('c', 'Café', '09:00', null, 'both'), ev('x', 'Sem quem', '10:00', null, null),
    ev('v', 'Conta', '08:00', null, 'g', { kind: 'vencimento' }), ev('f', 'Feito', '11:00', null, 'g', { done_at: 'x' }), ev('o', 'Outro dia', '11:00', null, 'g', { date: '2026-10-08' }),
    ev('t', 'Dia todo', null, null, 's'),
  ], DAY)
  it('só compromissos com hora e de quem vai; sem fim = 1 hora; vencimentos e feitos não contam', () => {
    expect(W.map(w => `${w.who}:${w.title}:${w.start}-${w.end}`)).toEqual(['g:Café:09:00-10:00', 's:Café:09:00-10:00', 'g:Dentista:14:00-16:00'])
  })
  it('conflito: a tarefa ocupa ~30 min', () => {
    expect(conflictAt(W, 'g', '15:30')?.title).toBe('Dentista')
    expect(conflictAt(W, 'g', '13:40')?.title).toBe('Dentista')
    expect(conflictAt(W, 'g', '13:30')).toBeNull()
    expect(conflictAt(W, 'g', '16:00')).toBeNull()
    expect(conflictAt(W, 's', '15:00')).toBeNull()
    expect(conflictAt(W, 'g', null)).toBeNull()
  })
  it('minutos ocupados juntando sobreposições; dia cheio a partir de 4 h', () => {
    const w2 = busyWindows([ev('a', 'A', '08:00', '11:00', 'g'), ev('b', 'B', '10:00', '12:30', 'g')], DAY)
    expect(busyMinutes(w2, 'g')).toBe(270)
    expect(fullDay(w2, 'g')).toBe(true)
    expect(fullDay(W, 'g')).toBe(false)
  })
  it('ajuste da dona: sem dona fixa passa; fixa avisa; as duas ocupadas avisa; dia cheio passa as sem hora', () => {
    expect(adjustOwner({ base: 'g', fixed: false, time: '15:00', windows: W })).toMatchObject({ who: 's', why: { kind: 'busy', from: 'g', title: 'Dentista' }, conflict: null })
    expect(adjustOwner({ base: 'g', fixed: true, time: '15:00', windows: W })).toMatchObject({ who: 'g', why: null, conflict: { title: 'Dentista' } })
    expect(adjustOwner({ base: 'g', fixed: false, time: '09:15', windows: W })).toMatchObject({ who: 'g', why: null, conflict: { title: 'Café' } })
    const full = busyWindows([ev('a', 'Plantão', '08:00', '13:00', 's')], DAY)
    expect(adjustOwner({ base: 's', fixed: false, time: null, windows: full })).toMatchObject({ who: 'g', why: { kind: 'full', minutes: 300 } })
    expect(adjustOwner({ base: 's', fixed: true, time: null, windows: full }).who).toBe('s')
    expect(adjustOwner({ base: 'g', fixed: true, time: '15:00', windows: W, handoff: { to: 's', by: 'g' } })).toMatchObject({ who: 's', why: { kind: 'handoff', by: 'g' }, conflict: null })
  })
})

describe('compromissos na divisão do dia', () => {
  const task = (id: string, o: Partial<Task> = {}): Task => ({ id, title: id, category: 'general', weight: 'medium', frequency: 'daily', assigned_to: null, scheduled_time: null, essential: false, active: true, ...o } as Task)
  const names = { g: 'Giovanna', s: 'Sabrina' }
  it('a tarefa da vez cai no dentista: vai para a outra, com o motivo', () => {
    const tasks = buildTasks([task('louca', { scheduled_time: '15:00' }), task('lixo', { assigned_to: 'g', scheduled_time: '14:30' })], [{ id: '1', task_id: 'louca', date: '2026-10-06', completed_by: 's' }], DAY)
    const base = planToday(tasks, [], DAY, { split: 'smart' })
    expect(base.ownerOfTask(tasks[0])).toBe('g')
    const p = planToday(tasks, [], DAY, { split: 'smart', busy: busyWindows([ev('d', 'Dentista', '14:00', '16:00', 'g')], DAY) })
    expect(p.ownerOfTask(tasks[0])).toBe('s')
    expect(whyLabel(p.whyOf('louca'), names, DAY)).toBe('Hoje com a Sabrina: Giovanna tem Dentista (14:00–16:00)')
    expect(p.conflictOf('louca')).toBeNull()
    // fixa: continua dela, com aviso
    expect(p.ownerOfTask(tasks[1])).toBe('g')
    expect(p.conflictOf('lixo')?.title).toBe('Dentista')
  })
  it('"passar só hoje" vale só no dia', () => {
    const rows = [task('lixo', { assigned_to: 'g' })]
    const ho = [{ id: 'h1', task_id: 'lixo', date: DAY, to_who: 's', by_who: 'g' }]
    const t1 = buildTasks(rows, [], DAY, [], ho)
    expect(t1[0].handoff).toEqual({ id: 'h1', date: DAY, to: 's', by: 'g' })
    const p = planToday(t1, [], DAY, { split: 'smart' })
    expect(p.ownerOfTask(t1[0])).toBe('s')
    expect(whyLabel(p.whyOf('lixo'), names, DAY)).toBe('Só hoje com a Sabrina (passada pela Giovanna)')
    const t2 = buildTasks(rows, [], '2026-10-08', [], ho)
    expect(planToday(t2, [], '2026-10-08', { split: 'smart' }).ownerOfTask(t2[0])).toBe('g')
  })
  it('no rodízio fixo também', () => {
    const tasks = buildTasks([task('regar', { scheduled_time: '15:00' })], [], DAY)
    const who = planToday(tasks, [], DAY, { split: 'rotation' }).ownerOfTask(tasks[0])
    const p = planToday(tasks, [], DAY, { split: 'rotation', busy: busyWindows([ev('d', 'Médico', '14:30', '16:00', who)], DAY) })
    expect(p.ownerOfTask(tasks[0])).toBe(who === 'g' ? 's' : 'g')
  })
  it('o calendário do celular usa a hora de fim', () => {
    const items = agendaItems({ today: DAY, events: [{ ...ev('d', 'Dentista', '14:00', '16:00', 'g'), notes: null, link: null, paid: null } as any], maint: [], health: [], dogs: [] })
    expect(icsCalendar('x', items, '20261007T120000Z')).toContain('DTEND;TZID=America/Sao_Paulo:20261007T160000')
  })
})
