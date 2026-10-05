// Último carregamento da casa guardado no aparelho, para abrir o app sem internet
// (só leitura: sem conexão, marcar e editar continuam mostrando o erro de conexão).
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>

const VERSION = 1
const key = (householdId: string) => `ninho.cache.v${VERSION}.${householdId}`
export const HOUSEHOLD_KEY = 'ninho.household'

export interface Snapshot<T> { savedAt: string, today: string, data: T }

function storage(s?: Storage | null): Storage | null {
  if (s) return s
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

export function saveSnapshot<T>(householdId: string, today: string, data: T, s?: Storage | null): boolean {
  try {
    storage(s)?.setItem(key(householdId), JSON.stringify({ savedAt: new Date().toISOString(), today, data }))
    return true
  } catch { return false } // cota cheia ou armazenamento bloqueado: segue sem cache
}

export function readSnapshot<T>(householdId: string, s?: Storage | null): Snapshot<T> | null {
  try {
    const raw = storage(s)?.getItem(key(householdId))
    if (!raw) return null
    const v = JSON.parse(raw)
    return v && typeof v.savedAt === 'string' && v.data ? v as Snapshot<T> : null
  } catch { return null }
}

/** Erro de rede (sem internet / servidor inalcançável), não um erro do banco. */
export function isOfflineError(e: unknown): boolean {
  const m = String((e as any)?.message || e || '')
  return /Failed to fetch|NetworkError|Load failed|fetch failed|network/i.test(m) ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
}

export function rememberHousehold(id: string, s?: Storage | null) {
  try { storage(s)?.setItem(HOUSEHOLD_KEY, id) } catch { /* sem armazenamento */ }
}

export function cachedHousehold(s?: Storage | null): string | null {
  try { return storage(s)?.getItem(HOUSEHOLD_KEY) || null } catch { return null }
}
