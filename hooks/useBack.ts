'use client'
// Botão voltar do celular: a janela aberta fecha com o voltar (ver lib/backNav.ts).
import { useEffect, useRef } from 'react'
import { openOverlay } from '@/lib/backNav'

/** Enquanto `open`, o voltar chama `onClose` (devolva false para não fechar). */
export function useBackClose(open: boolean, onClose: () => boolean | void) {
  const ref = useRef(onClose)
  ref.current = onClose
  useEffect(() => { if (!open) return; return openOverlay(() => ref.current()) }, [open])
}
