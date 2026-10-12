// Resumo do mês do Sobrou! para o cartão do Início. Só para quem é da casa; nada é guardado.
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { memberOf } from '@/lib/server/member'
import { fetchSobrou, sobrouMissing } from '@/lib/server/sobrou'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: 'servidor sem SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 })
  let body: any = null
  try { body = await req.json() } catch { /* vazio */ }
  const m = await memberOf(createDb(), req, String(body?.householdId || ''))
  if (m.ok === false) return NextResponse.json({ error: m.error }, { status: m.status })
  // só para quem é da casa: o que falta na Vercel (nomes, nunca valores)
  const missing = sobrouMissing()
  if (missing.length) return NextResponse.json({ configured: false, missing }, { status: 200 })
  const r = await fetchSobrou()
  if (r.ok === true) return NextResponse.json({ configured: true, resumo: r.resumo }, { headers: { 'cache-control': 'no-store' } })
  const fail = r as { status: number, message: string }
  return NextResponse.json({ configured: true, error: fail.message }, { status: fail.status })
}
