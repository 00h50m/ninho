import { describe, expect, it } from 'vitest'
import { EMPTY_FACTS, bothCheckinStreak, dayHit, dayNotes, matchRef, meetingAgenda, moodGrid, progress, timeline, type Challenge } from '@/lib/nos'

const T = '2026-10-08' // quinta
const ch = (p: Partial<Challenge>): Challenge => ({ id: 'c1', title: 'Cozinha', kind: 'livre', ref_id: null, per_day: 1, days: 7, goal: 7, start_date: '2026-10-05', status: 'active', reward: null, created_by: 'g', ended_at: null, ...p })
const names = { g: 'Giovanna Cupo', s: 'Sabrina' }

describe('desafios em dupla', () => {
  it('livre: um dia conta quando uma das duas marca', () => {
    const f = { ...EMPTY_FACTS, marks: [{ challenge_id: 'c1', date: '2026-10-05', who: 's' as const }, { challenge_id: 'outro', date: '2026-10-06', who: 'g' as const }] }
    expect(dayHit(ch({}), f, '2026-10-05')).toBe(true)
    expect(dayHit(ch({}), f, '2026-10-06')).toBe(false)
  })
  it('rotina, hábito, check-in das duas, tarefas por dia e sprint', () => {
    const f = { ...EMPTY_FACTS,
      runs: [{ routine_id: 'r1', date: T }], habitLogs: [{ habit_id: 'h1', date: T }],
      checkins: [{ date: T, who: 'g' as const }, { date: T, who: 's' as const }, { date: '2026-10-07', who: 'g' as const }],
      completions: [{ date: T }, { date: T }, { date: '2026-10-07' }], sprints: [{ date: T, status: 'done' }, { date: '2026-10-07', status: 'cancelled' }] }
    expect(dayHit(ch({ kind: 'rotina', ref_id: 'r1' }), f, T)).toBe(true)
    expect(dayHit(ch({ kind: 'rotina', ref_id: 'r2' }), f, T)).toBe(false)
    expect(dayHit(ch({ kind: 'habito', ref_id: 'h1' }), f, T)).toBe(true)
    expect(dayHit(ch({ kind: 'checkin' }), f, T)).toBe(true)
    expect(dayHit(ch({ kind: 'checkin' }), f, '2026-10-07')).toBe(false)
    expect(dayHit(ch({ kind: 'tarefas', per_day: 2 }), f, T)).toBe(true)
    expect(dayHit(ch({ kind: 'tarefas', per_day: 2 }), f, '2026-10-07')).toBe(false)
    expect(dayHit(ch({ kind: 'sprint' }), f, '2026-10-07')).toBe(false)
  })
  it('progresso: em andamento, conseguimos e não deu', () => {
    const marks = (ds: string[]) => ({ ...EMPTY_FACTS, marks: ds.map(date => ({ challenge_id: 'c1', date, who: 'g' as const })) })
    const p = progress(ch({}), marks(['2026-10-05', '2026-10-06', '2026-10-07']), T)
    expect(p.hits).toBe(3); expect(p.left).toBe(4); expect(p.state).toBe('active'); expect(p.todayHit).toBe(false)
    expect(p.days.filter(d => d.future).length).toBe(3)
    // meta 7/7 e um dia passado sem marcar → não dá mais
    expect(progress(ch({}), marks(['2026-10-05', '2026-10-07']), T).state).toBe('missed')
    // ontem sem marcar ainda dá (pode marcar até o fim de hoje); em desafio automático, não
    expect(progress(ch({}), marks(['2026-10-05', '2026-10-06']), T).state).toBe('active')
    expect(progress(ch({ kind: 'sprint' }), { ...EMPTY_FACTS, sprints: ['2026-10-05', '2026-10-06'].map(date => ({ date, status: 'done' })) }, T).state).toBe('missed')
    // meta 2 de 7 já batida
    expect(progress(ch({ goal: 2 }), marks(['2026-10-05', '2026-10-06']), T).state).toBe('done')
    // hoje ainda conta como possível
    expect(progress(ch({ goal: 4 }), marks(['2026-10-05']), '2026-10-08').state).toBe('active')
    // status salvo (cancelado) não muda
    expect(progress(ch({ status: 'cancelled' }), marks([]), T).state).toBe('cancelled')
  })
  it('liga a sugestão à rotina pelo nome', () => {
    expect(matchRef([{ id: 'a', title: 'Fechar a cozinha' }, { id: 'b', title: 'Reset' }], 'cozinha')?.id).toBe('a')
    expect(matchRef([{ id: 'b', title: 'Reset' }], 'cozinha')).toBeNull()
  })
})

describe('histórico', () => {
  const rows = [
    { date: T, who: 'g' as const, mood: 'bem' as const, energy: 'high', note: null, good: 'Jantar', need: null, thanks: null },
    { date: '2026-10-07', who: 's' as const, mood: 'cansaco' as const, energy: 'low', note: null, need: 'Dormir', good: null, thanks: 'Café' },
    { date: '2026-10-06', who: 'g' as const, mood: 'normal' as const, energy: null, note: null },
  ]
  it('grade de humor dos últimos dias, do mais antigo para hoje', () => {
    const g = moodGrid(rows, 'g', T, 7)
    expect(g).toHaveLength(7); expect(g[6]).toEqual({ date: T, mood: 'bem', energy: 'high' }); expect(g[4].mood).toBe('normal'); expect(g[5].mood).toBeNull()
  })
  it('registros do dia, mais recentes primeiro', () => {
    expect(dayNotes(rows, '2026-10-01').map(r => r.date)).toEqual([T, '2026-10-07'])
  })
  it('dias seguidos com check-in das duas', () => {
    const r = [T, '2026-10-07', '2026-10-06'].flatMap(date => [{ date, who: 'g' as const }, { date, who: 's' as const }]).concat([{ date: '2026-10-05', who: 'g' as const }])
    expect(bothCheckinStreak(r, T)).toBe(3)
    expect(bothCheckinStreak(r.filter(x => x.date !== T), T)).toBe(2) // hoje ainda não fizeram: conta até ontem
  })
})

describe('pauta da reunião e linha do tempo', () => {
  it('monta a pauta com o que aconteceu, sem placar', () => {
    const a = meetingAgenda({
      weekStart: '2026-10-05', today: T,
      completions: [{ date: T, completed_by: 'g' }, { date: '2026-10-06', completed_by: 's' }, { date: '2026-09-30', completed_by: 's' }],
      helpAsked: 1, runs: [{ date: T }], habitLogs: [], sprints: [{ date: T, status: 'done', done: 3 }],
      checkins: [{ date: T, who: 's', mood: 'cansaco', energy: 'low', note: null, need: 'Uma noite livre', thanks: null }],
      dogNext: [{ title: 'V10 da Zelda', date: '2026-10-15' }, { title: 'Vermífugo', date: '2026-12-01' }],
      events: [{ title: 'Visita da mãe', date: '2026-10-11', kind: 'visita' }],
      challenges: [{ title: 'Cozinha fechada', hits: 7, goal: 7, state: 'done' }],
      shared: ['Giovanna: água na meta 4 de 7 dias'],
      lastAgreements: [{ text: 'Lavar louça antes de dormir', who: 'both', task_id: null, done: true }, { text: 'Ligar pro encanador', who: 's', task_id: 't', done: false }],
    }, names)
    const txt = a.map(s => s.title + ': ' + s.lines.join(' | ')).join('\n')
    expect(txt).toContain('2 tarefas feitas pela casa · 1 rotina concluída')
    expect(txt).toContain('1 sprint juntas (3 tarefas)')
    expect(txt).toContain('1 pedido de ajuda')
    expect(txt).toContain('Cozinha fechada: 7/7 ✓ conseguimos')
    expect(txt).toContain('Sabrina precisou: Uma noite livre')
    expect(txt).toContain('11/10 · Visita da mãe')
    expect(txt).toContain('15/10 · 🐾 V10 da Zelda')
    expect(txt).not.toContain('Vermífugo')
    expect(txt).toContain('○ Ligar pro encanador (Sabrina)')
    expect(txt).not.toMatch(/ganhou|venceu|placar|na frente/i)
  })
  it('linha do tempo com desafios, reuniões e sprints', () => {
    const t = timeline({ challenges: [{ ...ch({ status: 'done', ended_at: '2026-10-07T20:00:00Z' }) }, ch({ id: 'c2', status: 'missed' })], meetings: [{ week_start: '2026-09-28', wins: 'Casa em ordem' }], sprints: [{ date: T, status: 'done', area: 'cozinha', done: 2 }] })
    expect(t.map(i => i.icon)).toEqual(['⏱', '🏆', '📋'])
    expect(t[2].text).toContain('Casa em ordem')
  })
})
