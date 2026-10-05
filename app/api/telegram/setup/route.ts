// Liga o bot a este app (rodar uma vez depois de configurar as variáveis).
// Protegido por CRON_SECRET: abra /api/telegram/setup?key=SEU_CRON_SECRET
// ou mande "Authorization: Bearer SEU_CRON_SECRET".
import { NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/server/push'
import { createTg, telegramConfigured } from '@/lib/server/tg'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const key = url.searchParams.get('key')
  if (!cronAuthorized(req) && !(process.env.CRON_SECRET && key === process.env.CRON_SECRET)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (!telegramConfigured()) return NextResponse.json({ error: 'faltam variáveis', need: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'] }, { status: 500 })
  const tg = createTg()
  const origin = process.env.PUBLIC_APP_URL || `${url.protocol}//${url.host}`
  const webhook = await tg('setWebhook', {
    url: `${origin}/api/telegram/webhook`, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message', 'callback_query'], drop_pending_updates: true,
  })
  const commands = await tg('setMyCommands', { commands: [
    { command: 'hoje', description: 'O que é seu hoje' },
    { command: 'feito', description: 'Concluir pelo nome (ex.: /feito louça)' },
    { command: 'compras', description: 'Lista de compras (ou adicionar: /compras leite)' },
    { command: 'dicas', description: 'Sugestões da IA para a semana' },
    { command: 'ajuda', description: 'O que o bot faz' },
    { command: 'sair', description: 'Desligar esta conversa' },
  ] })
  const me = await tg('getMe', {})
  return NextResponse.json({
    ok: !!webhook.ok && !!commands.ok, webhook: webhook.ok ? 'ok' : webhook.description, commands: commands.ok ? 'ok' : commands.description,
    bot: me.ok ? `@${me.result?.username}` : null,
    lembrete: me.ok && process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME !== me.result?.username ? `Coloque NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=${me.result?.username} na Vercel e publique de novo.` : undefined,
  })
}
