// Notificações e instalação no aparelho (navegador).
'use client'

export type PushBlock = 'dev' | 'no-sw' | 'no-push' | 'ios-install' | 'no-key' | null

export function isIOS(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true
}

/** Por que (ainda) não dá para ativar notificações neste aparelho. null = dá. */
export function pushBlock(vapidKey: string | undefined): PushBlock {
  if (typeof window === 'undefined') return 'no-sw'
  if (!vapidKey) return 'no-key'
  if (process.env.NODE_ENV !== 'production') return 'dev'
  if (isIOS() && !isStandalone()) return 'ios-install' // iPhone: só com o app na tela inicial (iOS 16.4+)
  if (!('serviceWorker' in navigator)) return 'no-sw'
  if (!('PushManager' in window) || !('Notification' in window)) return 'no-push'
  return null
}

export function urlBase64ToUint8Array(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Pede permissão e inscreve o aparelho. Lança Error com mensagem para a pessoa. */
export async function subscribePush(vapidKey: string): Promise<PushSubscription> {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error(perm === 'denied'
    ? 'As notificações estão bloqueadas para o Ninho. Libere nas configurações do navegador ou do celular e tente de novo.'
    : 'Permissão não concedida.')
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource })
}

export function subscriptionKeys(sub: PushSubscription) {
  const j = sub.toJSON() as { endpoint?: string, keys?: { p256dh?: string, auth?: string } }
  return { endpoint: j.endpoint || sub.endpoint, p256dh: j.keys?.p256dh || '', auth: j.keys?.auth || '' }
}

// ── Instalar (Android/Chrome/Edge): guarda o convite do navegador ─────
let deferred: any = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => { e.preventDefault(); deferred = e; listeners.forEach(f => f()) })
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach(f => f()) })
}
export function canPromptInstall() { return !!deferred }
export function onInstallChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f) } }
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  deferred.prompt()
  const choice = await deferred.userChoice.catch(() => null)
  deferred = null
  listeners.forEach(f => f())
  return choice?.outcome === 'accepted'
}
