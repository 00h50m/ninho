// Monta o cardápio da semana com a IA (plano, alimentos e refeições salvas de quem pede).
// Só devolve: o app mostra e grava com as regras do banco.
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { memberOf } from '@/lib/server/member'
import { readMenu } from '@/lib/server/nutritionAi'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: 'A IA ainda não está configurada neste endereço do app.' }, { status: 503 })
  let body: any = null
  try { body = await req.json() } catch { /* vazio */ }
  const db = createDb()
  const m = await memberOf(db, req, String(body?.householdId || ''))
  if (m.ok === false) return NextResponse.json({ error: m.error }, { status: m.status })
  if (!m.who) return NextResponse.json({ error: 'Escolha quem é você no app antes.' }, { status: 400 })
  const kcal = Number(body?.kcal), protein = Number(body?.protein), start = String(body?.start || '')
  if (!(kcal >= 800 && kcal <= 6000) || !(protein >= 20 && protein <= 400) || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return NextResponse.json({ error: 'Meta inválida.' }, { status: 400 })
  try {
    const r = await readMenu(db, body.householdId, m.who, { kcal, protein, prefs: String(body?.prefs || '').slice(0, 300), start }, { apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL })
    if (r.ok === true) return NextResponse.json(r.menu)
    const fail = r as { status: number, message: string }
    return NextResponse.json({ error: fail.message }, { status: fail.status })
  } catch (e: any) {
    console.error('[ninho] ia cardapio', String(e?.message || e).slice(0, 300))
    return NextResponse.json({ error: 'Não foi possível montar o cardápio agora.' }, { status: 500 })
  }
}
