// Guarda contra envio duplo: enquanto uma gravação de um item está em andamento,
// novos cliques no mesmo item são ignorados. O banco também é idempotente; esta
// guarda só evita requisições e piscadas desnecessárias.
export function createPendingGuard(onChange?: (keys: Set<string>) => void) {
  const keys = new Set<string>()
  return {
    has: (k: string) => keys.has(k),
    /** Executa fn se nenhuma das chaves estiver ocupada. Retorna false se ignorou. */
    async run(ks: string[], fn: () => Promise<void>): Promise<boolean> {
      if (ks.some(k => keys.has(k))) return false
      ks.forEach(k => keys.add(k)); onChange?.(new Set(keys))
      try { await fn() } finally { ks.forEach(k => keys.delete(k)); onChange?.(new Set(keys)) }
      return true
    },
  }
}
