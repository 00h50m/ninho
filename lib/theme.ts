// Tema do Ninho (aparência). Guardado no APARELHO: cada uma escolhe o que é
// confortável no próprio celular (claro de dia, escuro à noite) sem mudar o da outra.
// Sem escolha salva, segue o modo claro/escuro do sistema.
export type ThemeId = 'aconchego' | 'noturno'

export const THEMES: Array<{ id: ThemeId, name: string, desc: string, swatch: [string, string, string] }> = [
  { id: 'aconchego', name: 'Ninho Aconchego', desc: 'Claro: creme, terracota e verde', swatch: ['var(--sw-aconchego-bg)', 'var(--sw-aconchego-pri)', 'var(--sw-aconchego-ok)'] },
  { id: 'noturno', name: 'Ninho Noturno', desc: 'Escuro: o visual original', swatch: ['var(--sw-noturno-bg)', 'var(--sw-noturno-pri)', 'var(--sw-noturno-ok)'] },
]

export const THEME_KEY = 'ninho.theme'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>
function storage(s?: Storage | null): Storage | null {
  if (s) return s
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

export function isTheme(v: unknown): v is ThemeId {
  return THEMES.some(t => t.id === v)
}

/** Tema salvo; sem escolha, o do sistema (escuro → Noturno, claro → Aconchego). */
export function readTheme(s?: Storage | null, prefersDark = false): ThemeId {
  try {
    const v = storage(s)?.getItem(THEME_KEY)
    if (isTheme(v)) return v
  } catch { /* sem armazenamento */ }
  return prefersDark ? 'noturno' : 'aconchego'
}

export function saveTheme(t: ThemeId, s?: Storage | null): void {
  try { storage(s)?.setItem(THEME_KEY, t) } catch { /* sem armazenamento: vale até fechar */ }
}

/** Aplica no <html> (as cores vêm de styles/tokens.css). */
export function applyTheme(t: ThemeId): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = t
  // Barra do navegador/celular acompanha o fundo do tema escolhido
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  if (bg) document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.setAttribute('content', bg); m.removeAttribute('media') })
}

/** Script que roda antes da página aparecer (evita piscar o tema errado). */
export const THEME_BOOT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='aconchego'&&t!=='noturno'){t=matchMedia('(prefers-color-scheme: dark)').matches?'noturno':'aconchego'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='aconchego'}`
