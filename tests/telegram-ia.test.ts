// Fase 5: texto enviado à IA, leitura da resposta e configuração do servidor.
import { describe, expect, it } from 'vitest'
import { parseTips, weekContext, SYSTEM, AI_MODEL, type WeekFacts } from '@/lib/server/ai'
import { telegramConfigured, webhookAuthorized } from '@/lib/server/tg'
import { HELP } from '@/lib/server/telegram'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const facts: WeekFacts = {
  names: { g: 'Giovanna', s: 'Sabrina' }, today: '2026-10-07', weekStart: '2026-10-05', split: 'smart', focus: false, energy: 'medium',
  scores: { g: { xp: 12, done: 7, on_time: 2 }, s: { xp: 4, done: 3, on_time: 0 } },
  tasks: [
    { title: 'Louça diária', frequency: 'diária', weight: 'leve', owner: 'Giovanna', fixed: true, last: 'ontem', essential: true, weekdays: '', skippedThisWeek: false, doneThisPeriod: true },
    { title: 'Limpar banheiro', frequency: 'semanal', weight: 'médio', owner: 'Sabrina', fixed: false, last: 'há 9 dias', essential: false, weekdays: 'sáb', skippedThisWeek: true, doneThisPeriod: false },
  ],
  dogs: ['Penélope', 'Zelda'],
  lastMeeting: { overloaded: 'A louça ficou toda comigo', adjustments: '' },
}

describe('IA: resumo da semana', () => {
  const ctx = weekContext(facts)
  it('traz pessoas, cães, placar e tarefas com observações', () => {
    expect(ctx).toContain('Giovanna (home office) e Sabrina (professora), com os cães Penélope e Zelda')
    expect(ctx).toContain('Giovanna 12 XP (7 feitas, 2 no horário) · Sabrina 4 XP')
    expect(ctx).toContain('- Louça diária · diária · leve · sempre Giovanna · ontem · essencial')
    expect(ctx).toContain('- Limpar banheiro · semanal · médio · divisão (hoje: Sabrina) · há 9 dias · dias: sáb · pulada nesta semana · ainda não feita no período')
    expect(ctx).toContain('- O que pesou: A louça ficou toda comigo')
  })
  it('não manda ids nem dados técnicos', () => {
    expect(ctx).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/)
  })
  it('lê as linhas de sugestão e ignora o resto', () => {
    expect(parseTips('Aqui vão:\n- Passe a louça para a Sabrina às terças.\n• Marque o banheiro para sábado.\n\nBoa semana!')).toEqual(['Passe a louça para a Sabrina às terças.', 'Marque o banheiro para sábado.'])
    expect(parseTips('sem lista')).toEqual([])
  })
  it('modelo e instruções', () => {
    expect(AI_MODEL).toBe('claude-opus-5-5')
    expect(SYSTEM).toContain('de 3 a 5 ajustes')
  })
})

describe('Telegram: configuração', () => {
  it('só liga com token, segredo e banco do servidor', () => {
    expect(telegramConfigured({} as any)).toBe(false)
    expect(telegramConfigured({ TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_WEBHOOK_SECRET: 'y', NEXT_PUBLIC_SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' } as any)).toBe(true)
  })
  it('webhook exige o segredo combinado', () => {
    const env = { TELEGRAM_WEBHOOK_SECRET: 'abc' } as any
    expect(webhookAuthorized(new Request('http://x', { headers: { 'x-telegram-bot-api-secret-token': 'abc' } }), env)).toBe(true)
    expect(webhookAuthorized(new Request('http://x', { headers: { 'x-telegram-bot-api-secret-token': 'errado' } }), env)).toBe(false)
    expect(webhookAuthorized(new Request('http://x'), { } as any)).toBe(false)
  })
  it('ajuda lista os comandos', () => {
    ;['/hoje', '/feito', '/compras', '/dicas', '/sair'].forEach(c => expect(HELP).toContain(c))
  })
  it('segredos do servidor não aparecem no código do navegador', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
    const client = [...walk('components'), ...walk('hooks'), 'app/page.tsx'].filter(f => /\.(tsx?|js)$/.test(f))
    for (const f of client) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/TELEGRAM_BOT_TOKEN|TELEGRAM_WEBHOOK_SECRET|ANTHROPIC_API_KEY|@\/lib\/server\//)
    }
  })
})

describe('Telegram: menu', () => {
  it('botões do menu viram comandos', async () => {
    const { menuCommand, MENU } = await import('@/lib/server/telegram')
    expect(menuCommand('📋 Hoje')).toBe('/hoje')
    expect(menuCommand('🛒 Compras')).toBe('/compras')
    expect(menuCommand('➕ Adicionar à lista')).toBe('/adicionar')
    expect(menuCommand('✦ Dicas')).toBe('/dicas')
    expect(menuCommand('❓ Ajuda')).toBe('/ajuda')
    expect(menuCommand('leite')).toBeNull()
    expect(menuCommand('/hoje')).toBeNull()
    const labels = MENU.keyboard.flat().map(b => b.text)
    labels.forEach(l => expect(menuCommand(l), l).not.toBeNull())
  })
})
