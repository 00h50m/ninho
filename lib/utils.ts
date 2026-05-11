import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function getWeekStart(date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

export function formatGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function getXPColor(xp: number, max: number): string {
  const pct = xp / max
  if (pct >= 0.8) return '#5dcaa5'
  if (pct >= 0.5) return '#ef9f27'
  return '#d85a30'
}

export function getChaosLabel(pct: number): { label: string; color: string; bg: string } {
  if (pct < 35) return { label: 'Organizada ✦', color: '#5dcaa5', bg: '#0f2a1e' }
  if (pct < 65) return { label: 'Atenção necessária', color: '#ef9f27', bg: '#2a1a08' }
  return { label: 'Casa em alerta!', color: '#e24b4a', bg: '#2a0808' }
}

export function getXPForWeight(weight: 'light' | 'medium' | 'heavy'): number {
  return weight === 'light' ? 1 : weight === 'medium' ? 2 : 3
}

export const CATEGORIES = [
  { value: 'kitchen',  label: '🍳 Cozinha' },
  { value: 'bathroom', label: '🚿 Banheiro' },
  { value: 'bedroom',  label: '🛏 Quarto' },
  { value: 'laundry',  label: '👕 Lavanderia' },
  { value: 'general',  label: '🏠 Geral' },
  { value: 'dogs',     label: '🐾 Cães' },
  { value: 'shopping', label: '🛒 Compras' },
  { value: 'finance',  label: '💰 Finanças' },
]

export const CATEGORY_LABELS: Record<string, string> = {
  kitchen:  '🍳 Cozinha',
  bathroom: '🚿 Banheiro',
  bedroom:  '🛏 Quarto',
  laundry:  '👕 Lavanderia',
  general:  '🏠 Geral',
  dogs:     '🐾 Cães',
  shopping: '🛒 Compras',
  finance:  '💰 Finanças',
}

export const WEIGHT_LABELS: Record<string, string> = {
  light:  'Leve',
  medium: 'Médio',
  heavy:  'Pesado',
}

export const FREQUENCY_LABELS: Record<string, string> = {
  daily:     'Diária',
  weekly:    'Semanal',
  biweekly:  'Quinzenal',
  monthly:   'Mensal',
  once:      'Pontual',
}

export const LEVELS = [
  { level: 1, name: 'Nest Builders',    min: 0,    max: 100  },
  { level: 2, name: 'Nest Keepers',     min: 100,  max: 300  },
  { level: 3, name: 'Home Runners',     min: 300,  max: 600  },
  { level: 4, name: 'Domestic Legends', min: 600,  max: 1000 },
  { level: 5, name: 'Ninho Masters',    min: 1000, max: 9999 },
]

export function getCurrentLevel(xp: number) {
  return LEVELS.findLast(l => xp >= l.min) ?? LEVELS[0]
}
