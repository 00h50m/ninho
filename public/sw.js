// Service worker do Ninho.
// · Abre sem internet: guarda a casca do app (HTML e arquivos estáticos).
//   Os dados da casa ficam no aparelho pelo próprio app (último carregamento).
// · Nunca guarda chamadas ao Supabase nem às rotas /api.
// · Recebe as notificações push (manhã e resumo de domingo).
const VERSION = 'ninho-v1'
const SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png', '/favicon.ico']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase e fontes: sempre pela rede
  if (url.pathname.startsWith('/api/')) return

  // Arquivos do build têm nome com hash: podem vir do cache
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)) }
      return res
    })))
    return
  }

  // Páginas: rede primeiro (versão nova do app), cache se estiver sem internet
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('/', copy)) }
      return res
    }).catch(() => caches.match('/').then(hit => hit || Response.error())))
    return
  }

  // Ícones e manifest: cache e atualiza em segundo plano
  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)) } return res }).catch(() => hit)
      return hit || net
    }))
  }
})

// ── Push ────────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'Ninho', body: event.data ? event.data.text() : '' } }
  const title = data.title || 'Ninho'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'ninho',
    renotify: !!data.tag,
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(target).catch(() => {}); return c.focus() } }
    return self.clients.openWindow(target)
  }))
})
