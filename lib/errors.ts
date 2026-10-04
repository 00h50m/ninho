type ErrorLike = {
  code?: string
  message?: string
  status?: number
}

export class NinhoDataError extends Error {
  readonly code?: string
  readonly userMessage: string

  constructor(context: string, error: unknown, userMessage?: string) {
    const source = error as ErrorLike | null
    super(source?.message || `Falha em ${context}`)
    this.name = 'NinhoDataError'
    this.code = source?.code
    this.userMessage = userMessage || friendlyMessage(error)
  }
}

export function friendlyMessage(error: unknown) {
  if (error instanceof NinhoDataError) return error.userMessage

  const source = error as ErrorLike | null
  const message = source?.message?.toLowerCase() || ''

  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'Sem conexão com o Ninho. Verifique a internet e tente novamente.'
  }
  if (source?.code === '42501') {
    return 'Seu acesso não permite concluir esta ação.'
  }
  if (source?.code === '23505') {
    return 'Essa ação já foi registrada.'
  }
  if (source?.code === 'PGRST116') {
    return 'O registro solicitado não foi encontrado.'
  }

  return 'Não foi possível concluir a ação. Tente novamente.'
}

export function throwIfError(
  context: string,
  error: unknown,
  userMessage?: string,
): asserts error is null | undefined {
  if (error) throw new NinhoDataError(context, error, userMessage)
}

export function reportError(context: string, error: unknown) {
  const source = error as ErrorLike | null
  console.error('[Ninho]', {
    context,
    code: source?.code,
    status: source?.status,
    message: source?.message || 'Erro desconhecido',
  })
}

