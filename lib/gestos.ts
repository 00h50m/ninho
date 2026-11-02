// Gestos do celular (puros, testados): deslizar na tarefa e puxar para atualizar.

/** Deslizar: 'right' = concluir, 'left' = opções; null = não chegou ao ponto ou foi mais vertical (rolagem). */
export function swipeOf(dx: number, dy: number, threshold = 72): 'right' | 'left' | null {
  if (Math.abs(dy) > Math.abs(dx) * 0.8) return null
  if (dx >= threshold) return 'right'
  if (dx <= -threshold) return 'left'
  return null
}

/** Quanto o item acompanha o dedo: segue até o ponto e depois resiste (no máximo 1,4× o ponto). */
export function swipeOffset(dx: number, threshold = 72): number {
  const a = Math.abs(dx), s = Math.sign(dx)
  return a <= threshold ? dx : s * Math.min(threshold * 1.4, threshold + (a - threshold) * 0.35)
}

/** Puxar para atualizar: a distância do indicador (com resistência) e se já solta para atualizar. */
export function pullOf(dy: number, threshold = 70): { shown: number, ready: boolean } {
  if (dy <= 0) return { shown: 0, ready: false }
  const shown = Math.min(threshold * 1.3, dy * 0.5)
  return { shown, ready: shown >= threshold * 0.6 }
}
