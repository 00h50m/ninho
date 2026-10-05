// Identificação LOCAL do aparelho (sem login): quem está usando este celular.
// Fica só no localStorage do aparelho. Não cria conta e não vai para o banco,
// exceto como completed_by ('g' | 's') quando alguém conclui algo.
import type { Who } from './types'
import { isWho } from './rotation'

export const DEVICE_KEY = 'ninho.device.who'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>

function storage(s?: Storage | null): Storage | null {
  if (s) return s
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

/** Quem está usando este aparelho, ou null se ainda não foi escolhido (ou o armazenamento falhou). */
export function readDeviceWho(s?: Storage | null): Who | null {
  try {
    const v = storage(s)?.getItem(DEVICE_KEY)
    return isWho(v) ? v : null
  } catch { return null }
}

/** Salva a escolha. Retorna false se o aparelho não deixou salvar (ex.: navegação privada). */
export function writeDeviceWho(who: Who, s?: Storage | null): boolean {
  if (!isWho(who)) return false
  try { storage(s)?.setItem(DEVICE_KEY, who); return readDeviceWho(s) === who } catch { return false }
}

export function clearDeviceWho(s?: Storage | null): void {
  try { storage(s)?.removeItem(DEVICE_KEY) } catch { /* sem armazenamento: nada a limpar */ }
}
