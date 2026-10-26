// Número no ícone do app instalado (Android/Chrome e iPhone com o app na tela de início):
// quantas coisas ainda faltam para mim hoje. Onde o aparelho não deixa, não faz nada.
export function setAppBadge(n: number): void {
  try {
    const nav = navigator as any
    if (typeof nav?.setAppBadge !== 'function') return
    if (n > 0) nav.setAppBadge(Math.min(99, Math.round(n))).catch(() => {})
    else nav.clearAppBadge?.().catch(() => {})
  } catch { /* sem suporte */ }
}
