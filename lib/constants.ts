import type { Who } from './types'

export const CAT: Record<string, string> = { kitchen: '🍳 Cozinha', bathroom: '🚿 Banheiro', bedroom: '🛏 Quarto', laundry: '👕 Lavanderia', general: '🏠 Geral', dogs: '🐾 Cães', shopping: '🛒 Compras', finance: '💰 Finanças' }
export const WPT: Record<string, string> = { light: 'Leve', medium: 'Médio', heavy: 'Pesado' }
export const FPT: Record<string, string> = { daily: 'Diária', weekly: 'Semanal', biweekly: 'Quinzenal', monthly: 'Mensal', once: 'Pontual' }
/** Carga relativa por frequência (vezes por semana, aproximado) — usada na divisão da carga. */
export const FEFF: Record<string, number> = { daily: 7, weekly: 2, biweekly: 1, monthly: 0.5, once: 1 }
export const ROLE: Record<Who, string> = { g: 'home office', s: 'professora' }
export const DEFAULT_NAMES: Record<Who, string> = { g: 'Giovanna', s: 'Sabrina' }
export const ENERGY: Record<string, { ic: string, l: string, short: string, s: string, cls: string }> = {
  high: { ic: '🌿', l: 'Alta energia', short: 'Alta', s: 'Lista completa ativa', cls: 'green' },
  medium: { ic: '🌤', l: 'Energia média', short: 'Média', s: 'Modo padrão', cls: 'amber' },
  low: { ic: '🌧', l: 'Baixa energia', short: 'Baixa', s: 'Foco no essencial', cls: 'coral' },
}
export const TABS: Array<[string, string, string]> = [['today', '☀️', 'Hoje'], ['tasks', '📋', 'Tarefas'], ['shop', '🛒', 'Compras'], ['week', '📅', 'Semana'], ['pets', '🐾', 'Cães'], ['settings', '⚙️', 'Ajustes']]
export const DR_DEF = [{ t: 'Ração manhã', f: 'daily', time: '07:00' }, { t: 'Água fresca', f: 'daily', time: null }, { t: 'Passeio manhã', f: 'daily', time: '08:00' }, { t: 'Ração noite', f: 'daily', time: '18:00' }, { t: 'Passeio tarde', f: 'daily', time: '17:30' }, { t: 'Enriquecimento ambiental', f: 'daily', time: null }, { t: 'Escovação', f: 'weekly', time: null }, { t: 'Banho', f: 'weekly', time: null }]
export const DR_PUP = [{ t: 'Saída xixi manhã', f: 'daily', time: '07:30' }, { t: 'Saída xixi tarde', f: 'daily', time: '14:00' }, { t: 'Saída xixi noite', f: 'daily', time: '21:00' }, { t: 'Treino básico', f: 'daily', time: null }, { t: 'Socialização', f: 'daily', time: null }]
export const RFREQ: Array<[string, string]> = [['daily', 'Diária'], ['weekly', 'Semanal'], ['biweekly', 'Quinzenal'], ['monthly', 'Mensal']]
export const ACCIDENT_PLACES = ['Sala', 'Quarto', 'Cozinha', 'Banheiro', 'Corredor']
/** Conclusões dos últimos 62 dias (cobre o período mensal e o "feita há X dias"). */
export const COMPLETION_WINDOW_DAYS = 62
