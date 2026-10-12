// "+1 copo" tocado na notificação (sem abrir o app). Vale só com o bilhete assinado que o próprio
// lembrete levou: uma pessoa, um dia, uma quantidade; tocar duas vezes no mesmo aviso não conta dobrado.
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { verifyWater, waterSecret } from '@/lib/server/waterToken'
import { waterLine } from '@/lib/water'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: 'servidor sem configuração' }, { status: 503 })
  let body: any = null
  try { body = await req.json() } catch { /* vazio */ }
  const t = verifyWater(String(body?.t || ''), waterSecret())
  if (!t) return NextResponse.json({ error: 'Esse aviso expirou. Abra o app para registrar.' }, { status: 401 })
  const db = createDb()
  const dup = await db.from('personal_logs').select('id').eq('household_id', t.h).eq('who', t.w).eq('date', t.d).eq('kind', 'agua').contains('data', { ref: t.r }).limit(1)
  if (dup.error) return NextResponse.json({ error: 'Não foi possível registrar agora.' }, { status: 500 })
  if (!dup.data?.length) {
    const r = await db.from('personal_logs').insert({ household_id: t.h, who: t.w, date: t.d, kind: 'agua', value: t.ml, data: { via: 'lembrete', ref: t.r } })
    if (r.error) return NextResponse.json({ error: 'Não foi possível registrar agora.' }, { status: 500 })
  }
  const [logs, set] = await Promise.all([
    db.from('personal_logs').select('value').eq('household_id', t.h).eq('who', t.w).eq('date', t.d).eq('kind', 'agua'),
    db.from('personal_settings').select('water_goal_ml,cup_ml').eq('household_id', t.h).eq('who', t.w).maybeSingle(),
  ])
  const ml = ((logs.data || []) as any[]).reduce((a, l) => a + (Number(l.value) || 0), 0)
  const goal = Number((set.data as any)?.water_goal_ml) || 2000
  return NextResponse.json({ ok: true, repeated: !!dup.data?.length, ml, goal, text: waterLine(ml, goal, Number((set.data as any)?.cup_ml) || t.ml) })
}
