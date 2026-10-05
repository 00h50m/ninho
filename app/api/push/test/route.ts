// "Enviar teste" em Ajustes: manda uma notificação só para o aparelho que pediu.
import { NextResponse } from 'next/server'
import { createDeps, missingConfig } from '@/lib/server/push'
import { runTest } from '@/lib/server/notify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (missingConfig().length) return NextResponse.json({ message: 'Notificações ainda não configuradas no servidor.' }, { status: 503 })
  let endpoint = ''
  try { endpoint = String((await req.json())?.endpoint || '') } catch { /* corpo inválido */ }
  if (!endpoint.startsWith('https://')) return NextResponse.json({ message: 'Aparelho inválido.' }, { status: 400 })
  const r = await runTest(createDeps(), endpoint)
  return NextResponse.json({ message: r.message }, { status: r.status })
}
