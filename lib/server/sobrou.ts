// Busca o resumo do mês no Sobrou! (SÓ servidor). O endereço e o segredo vêm só das variáveis da Vercel
// (SOBROU_API_URL e SOBROU_RESUMO_TOKEN) — nunca do link salvo no app, para o segredo não ir para outro lugar.
import { validateSobrou, type SobrouResumo } from '@/lib/sobrou'

export function sobrouConfigured(env = process.env): boolean {
  return sobrouMissing(env).length === 0
}

/** O que falta para ligar (só nomes e o motivo; nunca os valores). */
export function sobrouMissing(env = process.env): string[] {
  const out: string[] = []
  const url = (env.SOBROU_API_URL || '').trim()
  if (!url) out.push('SOBROU_API_URL (não cadastrada)')
  else if (!/^https?:\/\//.test(url)) out.push('SOBROU_API_URL (precisa começar com https://)')
  const tok = (env.SOBROU_RESUMO_TOKEN || '').trim()
  if (!tok) out.push('SOBROU_RESUMO_TOKEN (não cadastrada)')
  else if (tok.length < 24) out.push('SOBROU_RESUMO_TOKEN (precisa ter 24 caracteres ou mais)')
  return out
}

export async function fetchSobrou(env = process.env, timeoutMs = 8000): Promise<{ ok: true, resumo: SobrouResumo } | { ok: false, status: number, message: string }> {
  if (!sobrouConfigured(env)) return { ok: false, status: 503, message: 'O Sobrou ainda não está ligado ao Ninho.' }
  const url = `${env.SOBROU_API_URL!.trim().replace(/\/+$/, '')}/api/resumo-ninho`
  try {
    const r = await fetch(url, { headers: { authorization: `Bearer ${(env.SOBROU_RESUMO_TOKEN || '').trim()}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(timeoutMs) })
    if (r.status === 401) return { ok: false, status: 502, message: 'O Sobrou recusou o acesso (o segredo não confere).' }
    if (!r.ok) return { ok: false, status: 502, message: 'O Sobrou não respondeu agora.' }
    const j = await r.json().catch(() => null)
    const resumo = validateSobrou(j?.resumo)
    return resumo ? { ok: true, resumo } : { ok: false, status: 502, message: 'O Sobrou respondeu num formato inesperado.' }
  } catch {
    return { ok: false, status: 504, message: 'O Sobrou não respondeu agora. Tente de novo em instantes.' }
  }
}
