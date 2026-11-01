// Erros do Supabase traduzidos para mensagens que fazem sentido para quem usa o app.
// Os logs técnicos guardam só código e mensagem do erro — nunca chaves, tokens ou dados da casa.

export interface RawError { message?: string; code?: string; details?: string | null; hint?: string | null; name?: string }

export class NinhoError extends Error {
  code: string
  userMessage: string
  retryable: boolean
  constructor(raw: RawError | unknown, context: string) {
    const e = (raw ?? {}) as RawError
    super(`${context}: ${e.message || String(raw)}`)
    this.name = 'NinhoError'
    this.code = e.code || ''
    const f = friendly(e, context)
    this.userMessage = f.message
    this.retryable = f.retryable
  }
}

function friendly(e: RawError, context = ''): { message: string, retryable: boolean } {
  const msg = e.message || ''
  if (/Failed to fetch|NetworkError|Load failed|network|fetch failed|timeout/i.test(msg))
    return { message: 'Sem conexão com o servidor. Confira a internet e tente de novo.', retryable: true }
  if (msg.includes('NINHO_INVALID_PERSON'))
    return { message: 'Escolha em Ajustes quem está usando este aparelho.', retryable: false }
  if (msg.includes('NINHO_INVALID_DATE'))
    return { message: 'A data do aparelho parece errada. Confira o relógio do celular.', retryable: false }
  if (msg.includes('NINHO_INVALID_INPUT'))
    return { message: 'Confira o que foi digitado (nome vazio ou longo demais).', retryable: false }
  if (msg.includes('NINHO_NOT_FOUND'))
    return { message: 'Esse item não existe mais. Atualize a tela.', retryable: false }
  if (e.code === 'PGRST202' || e.code === '42883' || e.code === 'PGRST205' || e.code === '42P01')
    return { message: 'O banco ainda não foi atualizado para esta versão do app (falta aplicar uma migration).', retryable: false }
  if (e.code === '23505')
    return { message: 'Isso já foi registrado.', retryable: false }
  if (e.code === '42501' || e.code === 'PGRST301' || /permission|JWT/i.test(msg))
    return { message: 'O servidor recusou a alteração (permissão). Recarregue o app.', retryable: true }
  if (context.startsWith('carregar'))
    return { message: 'Não foi possível carregar os dados agora. Tente de novo.', retryable: true }
  return { message: 'Não foi possível salvar. Tente de novo.', retryable: true }
}

/** Para onde mandar os erros além do console (043: Ajustes › Sistema). O app liga depois do login. */
type Sink = (row: { context: string, message: string, code: string | null }) => void
let sink: Sink | null = null
let sent = 0
const recent = new Map<string, number>()
export function setErrorSink(s: Sink | null): void { sink = s }

/** Decide se manda para o registro: no máximo 30 por sessão e o mesmo erro só 1 vez por minuto. Puro, testado. */
export function shouldReport(key: string, now: number, seen: Map<string, number>, count: number): boolean {
  if (count >= 30) return false
  const last = seen.get(key)
  return last === undefined || now - last > 60_000
}

/** Log técnico sem dados sensíveis (e no registro de erros do app, se estiver ligado). */
export function logError(context: string, err: unknown): void {
  const e = (err ?? {}) as RawError & { userMessage?: string }
  const message = (e.message || String(err)).slice(0, 600)
  // eslint-disable-next-line no-console
  console.error('[ninho]', context, { code: e.code || undefined, message, hint: e.hint || undefined })
  if (!sink) return
  // sem internet (ou o tempo real caindo e voltando sozinho) não é erro do app: não registra
  if (/Failed to fetch|NetworkError|Load failed|offline|transport failure|CHANNEL_ERROR|TIMED_OUT/i.test(message) || /^realtime/.test(context)) return
  const key = `${context}|${message}`, now = Date.now()
  if (!shouldReport(key, now, recent, sent)) return
  recent.set(key, now); sent++
  try { sink({ context: context.slice(0, 120), message, code: e.code ? String(e.code).slice(0, 40) : null }) } catch { /* o registro nunca derruba o app */ }
}

/** Converte qualquer erro em NinhoError (para exibir userMessage). */
export function toNinhoError(err: unknown, context: string): NinhoError {
  const n = err instanceof NinhoError ? err : new NinhoError(err, context)
  // erro que chega para a pessoa também vai para o registro (menos falta de internet)
  if (!(err instanceof NinhoError)) logError(context, err)
  return n
}

/** Tabela inexistente (migration não aplicada): Postgres 42P01 ou PostgREST PGRST205. */
export function isMissingTable(e: unknown): boolean {
  const x = (e || {}) as { code?: string, message?: string }
  return x.code === '42P01' || x.code === 'PGRST205' || x.code === 'PGRST202' || /does not exist|could not find the table/i.test(x.message || '')
}
