'use client'
import { useCallback, useEffect, useState } from 'react'
import type { Who } from '@/lib/types'
import { clearDeviceWho, readDeviceWho, writeDeviceWho } from '@/lib/device'

/**
 * Quem está usando este aparelho (Giovanna ou Sabrina), guardado só no aparelho.
 * `ready` evita mostrar o modal antes de ler o localStorage.
 * `persisted=false` quando o aparelho não deixa salvar (ex.: aba anônima): a escolha vale até fechar o app.
 */
export function useDeviceIdentity() {
  const [who, setWhoState] = useState<Who | null>(null)
  const [ready, setReady] = useState(false)
  const [persisted, setPersisted] = useState(true)

  useEffect(() => { setWhoState(readDeviceWho()); setReady(true) }, [])

  const setWho = useCallback((w: Who) => {
    setPersisted(writeDeviceWho(w))
    setWhoState(w)
  }, [])

  const clear = useCallback(() => { clearDeviceWho(); setWhoState(null) }, [])

  return { who, ready, persisted, setWho, clear }
}
