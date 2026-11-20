// Convite por link (047): https://<app>/?convite=CÓDIGO. Guardado no aparelho até a pessoa
// criar a conta e entrar. Puro (menos o armazenamento), testado.
const KEY = 'ninho.convite'

/** Aceita o link inteiro ou só o código; devolve o código ou null. */
export function inviteCode(text: string | null | undefined): string | null {
  const t = (text || '').trim()
  const m = t.match(/[?&]convite=([A-Za-z0-9]{10,40})/) || t.match(/^([A-Za-z0-9]{10,40})$/)
  return m ? m[1] : null
}
export const inviteLink = (origin: string, code: string) => `${origin.replace(/\/+$/, '')}/?convite=${code}`

export function savePendingInvite(code: string) { try { localStorage.setItem(KEY, code) } catch { /* sem armazenamento */ } }
export function pendingInvite(): string | null { try { return inviteCode(localStorage.getItem(KEY)) } catch { return null } }
export function clearPendingInvite() { try { localStorage.removeItem(KEY) } catch { /* ok */ } }
