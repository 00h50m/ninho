// "+1 copo" direto na notificação (SÓ servidor): o aviso leva um bilhete assinado que vale para
// uma pessoa, um dia e uma quantidade. O service worker não tem login; o bilhete é a permissão.
import { createHmac, timingSafeEqual } from 'crypto'

export interface WaterTicket { h: string, w: 'g' | 's', d: string, ml: number, r: string, exp: number }

const b64 = (s: string) => Buffer.from(s).toString('base64url')
const key = (secret: string) => createHmac('sha256', secret).update('ninho:agua:v1').digest()
const sig = (body: string, secret: string) => createHmac('sha256', key(secret)).update(body).digest('base64url')

export function signWater(t: WaterTicket, secret: string): string {
  const body = b64(JSON.stringify(t))
  return `${body}.${sig(body, secret)}`
}

/** Bilhete válido, dentro do prazo e com quantidade razoável; senão null. */
export function verifyWater(token: string, secret: string, nowMs = Date.now()): WaterTicket | null {
  if (!secret || typeof token !== 'string' || token.length > 600) return null
  const [body, s] = token.split('.')
  if (!body || !s) return null
  const a = Buffer.from(sig(body, secret)), b = Buffer.from(s)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const t = JSON.parse(Buffer.from(body, 'base64url').toString()) as WaterTicket
    if (!/^[0-9a-f-]{36}$/.test(t.h) || !['g', 's'].includes(t.w) || !/^\d{4}-\d{2}-\d{2}$/.test(t.d) || !(t.ml >= 50 && t.ml <= 1000) || typeof t.r !== 'string' || !(t.exp > nowMs)) return null
    return t
  } catch { return null }
}

/** O segredo vem da chave do servidor (nunca vai para o navegador). */
export const waterSecret = (env = process.env) => env.SUPABASE_SERVICE_ROLE_KEY || ''
