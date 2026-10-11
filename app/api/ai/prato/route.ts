// Estima o prato de uma foto com a IA e devolve os itens para a pessoa conferir.
// Nada é gravado aqui e a foto não fica guardada.
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { memberOf } from '@/lib/server/member'
import { checkFile, customFoods, readPlate } from '@/lib/server/nutritionAi'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: 'A leitura com IA ainda não está configurada neste endereço do app.' }, { status: 503 })
  let body: any = null
  try { body = await req.json() } catch { /* vazio */ }
  const db = createDb()
  const m = await memberOf(db, req, String(body?.householdId || ''))
  if (m.ok === false) return NextResponse.json({ error: m.error }, { status: m.status })
  const image = checkFile(body?.image, false)
  if (!image) return NextResponse.json({ error: 'Foto inválida.' }, { status: 400 })
  try {
    const r = await readPlate(db, body.householdId, image, String(body?.caption || ''), await customFoods(db, body.householdId, m.who), { apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL })
    if (r.ok === true) return NextResponse.json(r.plate)
    const fail = r as { status: number, message: string }
    return NextResponse.json({ error: fail.message }, { status: fail.status })
  } catch (e: any) {
    console.error('[ninho] ia prato', String(e?.message || e).slice(0, 300))
    return NextResponse.json({ error: 'Não foi possível ler a foto agora.' }, { status: 500 })
  }
}
