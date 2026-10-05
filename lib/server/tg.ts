// Chamadas à API do Telegram (SÓ servidor: usa TELEGRAM_BOT_TOKEN).
import type { TgCall, BotDeps } from './telegram'
import { createDb } from './push'
import { weeklyTips } from './ai'

export function telegramConfigured(env = process.env): boolean {
  return !!env.TELEGRAM_BOT_TOKEN && !!env.TELEGRAM_WEBHOOK_SECRET && !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY
}

export function createTg(env = process.env): TgCall {
  // TELEGRAM_API_BASE só existe para testes locais (receptor falso); em produção é a API oficial
  const base = env.TELEGRAM_API_BASE || 'https://api.telegram.org'
  return async (method, body) => {
    try {
      const r = await fetch(`${base}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
      })
      return await r.json()
    } catch (e: any) {
      return { ok: false, error_code: 0, description: String(e?.message || e).slice(0, 200) }
    }
  }
}

export function createBotDeps(env = process.env): BotDeps {
  const db = createDb(env)
  return {
    db, tg: createTg(env),
    tips: async (householdId: string) => {
      const r = await weeklyTips(db, householdId, { apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL })
      return r.ok === true ? { ok: true as const, text: r.text } : { ok: false as const, message: (r as { message: string }).message }
    },
  }
}

/** O Telegram manda o segredo combinado no cabeçalho de cada atualização. */
export function webhookAuthorized(req: Request, env = process.env): boolean {
  const s = env.TELEGRAM_WEBHOOK_SECRET
  return !!s && req.headers.get('x-telegram-bot-api-secret-token') === s
}
