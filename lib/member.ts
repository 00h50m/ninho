// Conta logada → casa e pessoa. Guardado no aparelho para abrir sem internet.
import type { Who } from './types'
import { isWho } from './rotation'

export interface Member { householdId: string, who: Who, email: string, userId: string }

export const MEMBER_KEY = 'ninho.member'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
function storage(s?: Storage | null): Storage | null {
  if (s) return s
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

export function rememberMember(m: Member, s?: Storage | null): void {
  try { storage(s)?.setItem(MEMBER_KEY, JSON.stringify(m)) } catch { /* sem armazenamento */ }
}

export function readMember(s?: Storage | null): Member | null {
  try {
    const v = JSON.parse(storage(s)?.getItem(MEMBER_KEY) || 'null')
    return v && typeof v.householdId === 'string' && isWho(v.who) && typeof v.userId === 'string' ? v as Member : null
  } catch { return null }
}

export function forgetMember(s?: Storage | null): void {
  try { storage(s)?.removeItem(MEMBER_KEY) } catch { /* nada */ }
}
