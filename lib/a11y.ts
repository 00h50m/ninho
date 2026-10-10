// Conforto e acessibilidade (Fase 9). Tudo guardado no APARELHO: cada uma ajusta o
// próprio celular sem mudar o da outra. Aplicado no <html> antes da página aparecer.
import { THEMES, type ThemeId } from './theme'

export type TextSize = 'md' | 'lg' | 'xl'
export const TEXT_SIZES: Array<[TextSize, string, number]> = [['md', 'Normal', 1], ['lg', 'Grande', 1.12], ['xl', 'Maior', 1.25]]

/** Cartões do Início que a pessoa pode esconder (neste aparelho). */
export const HOME_CARDS: Array<[string, string]> = [
  ['resumo', 'Resumo do dia (números)'], ['semana', 'A semana'], ['checkin', 'Check-in'], ['meudia', 'Meu dia'],
  ['rotina', 'Rotina agora'], ['caes', 'Cães hoje'], ['agenda', 'Agenda'], ['manutencao', 'Manutenção'],
  ['compras', 'Lista de compras'], ['atalhos', 'Atalhos'],
]

export interface A11yPrefs {
  size: TextSize
  contrast: boolean
  /** 'system' segue o celular; 'reduce' desliga as animações mesmo se o celular não pedir */
  motion: 'system' | 'reduce'
  /** tema automático: claro de dia / escuro à noite, conforme o celular */
  autoTheme: boolean
  lightTheme: ThemeId
  darkTheme: ThemeId
  hidden: string[]
  /** "Agora não" no aviso de configuração (data até quando esconder) */
  setupSnooze: string | null
}
export const A11Y_KEY = 'ninho.a11y'
export const DEFAULT_A11Y: A11yPrefs = { size: 'md', contrast: false, motion: 'system', autoTheme: false, lightTheme: 'aconchego', darkTheme: 'noturno', hidden: [], setupSnooze: null }

const DARK: ThemeId[] = ['noturno', 'aurora']
export const isDarkTheme = (t: ThemeId) => DARK.includes(t)

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>
function storage(s?: Storage | null): Storage | null {
  if (s) return s
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

/** Lê e corrige (valor estranho volta ao padrão; nada quebra). */
export function readA11y(s?: Storage | null): A11yPrefs {
  try {
    const raw = JSON.parse(storage(s)?.getItem(A11Y_KEY) || '{}') || {}
    const theme = (v: unknown, d: ThemeId) => THEMES.some(t => t.id === v) ? v as ThemeId : d
    return {
      size: TEXT_SIZES.some(([k]) => k === raw.size) ? raw.size : 'md',
      contrast: raw.contrast === true,
      motion: raw.motion === 'reduce' ? 'reduce' : 'system',
      autoTheme: raw.autoTheme === true,
      lightTheme: theme(raw.lightTheme, 'aconchego'),
      darkTheme: theme(raw.darkTheme, 'noturno'),
      hidden: Array.isArray(raw.hidden) ? raw.hidden.filter((x: unknown) => typeof x === 'string' && HOME_CARDS.some(([k]) => k === x)) : [],
      setupSnooze: typeof raw.setupSnooze === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.setupSnooze) ? raw.setupSnooze : null,
    }
  } catch { return { ...DEFAULT_A11Y } }
}

export function saveA11y(p: A11yPrefs, s?: Storage | null): void {
  try { storage(s)?.setItem(A11Y_KEY, JSON.stringify(p)) } catch { /* sem armazenamento: vale até fechar */ }
}

/** Tema que vale agora (automático segue o claro/escuro do celular). */
export function effectiveTheme(p: A11yPrefs, chosen: ThemeId, prefersDark: boolean): ThemeId {
  return p.autoTheme ? (prefersDark ? p.darkTheme : p.lightTheme) : chosen
}

/** Aplica no <html>: tamanho, contraste e movimento (as regras estão em styles/app.css). */
export function applyA11y(p: A11yPrefs): void {
  if (typeof document === 'undefined') return
  const h = document.documentElement
  h.dataset.size = p.size
  if (p.contrast) h.dataset.contrast = 'high'; else delete h.dataset.contrast
  if (p.motion === 'reduce') h.dataset.motion = 'reduce'; else delete h.dataset.motion
}

/** Script do <head>: aplica tudo antes de pintar (sem piscar tamanho, contraste ou tema). */
export const A11Y_BOOT = `try{var a=JSON.parse(localStorage.getItem('${A11Y_KEY}')||'{}')||{},h=document.documentElement;if(a.size==='lg'||a.size==='xl')h.dataset.size=a.size;if(a.contrast===true)h.dataset.contrast='high';if(a.motion==='reduce')h.dataset.motion='reduce';if(a.autoTheme===true){var ok=${JSON.stringify(THEMES.map(t => t.id))};var d=matchMedia('(prefers-color-scheme: dark)').matches;var t=d?a.darkTheme:a.lightTheme;if(ok.indexOf(t)<0)t=d?'noturno':'aconchego';h.dataset.theme=t}}catch(e){}`

/** O aviso de configuração está adiado até hoje? */
export const setupSnoozed = (p: A11yPrefs, today: string) => !!p.setupSnooze && today <= p.setupSnooze
