// Código de barras → alimento (Open Food Facts) para a pessoa conferir. Só para quem é da casa; nada é gravado.
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { memberOf } from '@/lib/server/member'
import { lookupBarcode } from '@/lib/server/barcode'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: 'servidor sem SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 })
  let body: any = null
  try { body = await req.json() } catch { /* vazio */ }
  const m = await memberOf(createDb(), req, String(body?.householdId || ''))
  if (m.ok === false) return NextResponse.json({ error: m.error }, { status: m.status })
  const r = await lookupBarcode(String(body?.code || '').trim())
  if (r.ok === true) return NextResponse.json(r.label)
  const fail = r as { status: number, message: string }
  return NextResponse.json({ error: fail.message }, { status: fail.status })
}
