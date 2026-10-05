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
    const f = friendly(e)
    this.userMessage = f.message
    this.retryable = f.retryable
  }
}

function friendly(e: RawError): { message: string, retryable: boolean } {
  const msg = e.message || ''
  if (/Failed to fetch|NetworkError|Load failed|network|fetch failed|timeout/i.test(msg))
    return { message: 'Sem conexão com o servidor. Confira a internet e tente de novo.', retryable: true }
  if (msg.includes('NINHO_INVALID_PERSON'))
    return { message: 'Escolha em Ajustes quem está usando este aparelho.', retryable: false }
  if (msg.includes('NINHO_INVALID_DATE'))
    return { message: 'A data do aparelho parece errada. Confira o relógio do celular.', retryable: false }
  if (msg.includes('NINHO_NOT_FOUND'))
    return { message: 'Esse item não existe mais. Atualize a tela.', retryable: false }
  if (e.code === 'PGRST202' || e.code === '42883')
    return { message: 'O banco ainda não foi atualizado para esta versão do app (migrations da Fase 0).', retryable: false }
  if (e.code === '23505')
    return { message: 'Isso já foi registrado.', retryable: false }
  if (e.code === '42501' || e.code === 'PGRST301' || /permission|JWT/i.test(msg))
    return { message: 'O servidor recusou a alteração (permissão). Recarregue o app.', retryable: true }
  return { message: 'Não foi possível salvar. Tente de novo.', retryable: true }
}

/** Log técnico sem dados sensíveis. */
export function logError(context: string, err: unknown): void {
  const e = (err ?? {}) as RawError & { userMessage?: string }
  // eslint-disable-next-line no-console
  console.error('[ninho]', context, { code: e.code || undefined, message: e.message || String(err), hint: e.hint || undefined })
}

/** Converte qualquer erro em NinhoError (para exibir userMessage). */
export function toNinhoError(err: unknown, context: string): NinhoError {
  return err instanceof NinhoError ? err : new NinhoError(err, context)
}
