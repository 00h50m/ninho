// Configuração do servidor para push (SÓ servidor). Lê variáveis de ambiente da Vercel.
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import type { NotifyDeps, Sender } from './notify'

export interface PushConfig { supabaseUrl: string, serviceKey: string, vapidPublic: string, vapidPrivate: string, subject: string }

/** Quais variáveis faltam (para a mensagem de erro, sem mostrar valores). */
export function missingConfig(env = process.env): string[] {
  const need: Array<[string, string | undefined]> = [
    ['NEXT_PUBLIC_SUPABASE_URL', env.NEXT_PUBLIC_SUPABASE_URL],
    ['SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY],
    ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', env.NEXT_PUBLIC_VAPID_PUBLIC_KEY],
    ['VAPID_PRIVATE_KEY', env.VAPID_PRIVATE_KEY],
    ['VAPID_SUBJECT', env.VAPID_SUBJECT],
  ]
  return need.filter(([, v]) => !v).map(([k]) => k)
}

export function createDeps(env = process.env): NotifyDeps {
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  webpush.setVapidDetails(env.VAPID_SUBJECT!, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!)
  const send: Sender = async (sub, payload) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 6 * 3600, urgency: 'normal', topic: payload.tag })
      return { ok: true }
    } catch (e: any) {
      const code = e?.statusCode as number | undefined
      return { ok: false, gone: code === 404 || code === 410, error: `${code ?? 'erro'}: ${String(e?.body || e?.message || e).slice(0, 200)}` }
    }
  }
  return { db, send }
}

/** A Vercel envia "Authorization: Bearer <CRON_SECRET>" nas chamadas agendadas. */
export function cronAuthorized(req: Request, env = process.env): boolean {
  const secret = env.CRON_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}
