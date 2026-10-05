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
export const SUGG: Record<string, Array<{ t: string, w: string, f: string, cat: string, ess: boolean }>> = {
  'Cozinha': [{ t: 'Louça diária', w: 'light', f: 'daily', cat: 'kitchen', ess: true }, { t: 'Limpar bancada e fogão', w: 'light', f: 'daily', cat: 'kitchen', ess: true }, { t: 'Lixo da cozinha', w: 'light', f: 'daily', cat: 'kitchen', ess: true }, { t: 'Organizar geladeira', w: 'medium', f: 'weekly', cat: 'kitchen', ess: false }, { t: 'Limpar microondas', w: 'light', f: 'weekly', cat: 'kitchen', ess: false }, { t: 'Limpar geladeira por dentro', w: 'medium', f: 'monthly', cat: 'kitchen', ess: false }],
  'Banheiro': [{ t: 'Limpar pia e espelho', w: 'light', f: 'weekly', cat: 'bathroom', ess: false }, { t: 'Limpar vaso sanitário', w: 'medium', f: 'weekly', cat: 'bathroom', ess: false }, { t: 'Limpar box / chuveiro', w: 'medium', f: 'weekly', cat: 'bathroom', ess: false }, { t: 'Repor papel e sabonete', w: 'light', f: 'weekly', cat: 'bathroom', ess: true }],
  'Casa geral': [{ t: 'Varrer / aspirar', w: 'medium', f: 'weekly', cat: 'general', ess: false }, { t: 'Passar pano no chão', w: 'medium', f: 'weekly', cat: 'general', ess: false }, { t: 'Reset da sala (noite)', w: 'light', f: 'daily', cat: 'general', ess: true }, { t: 'Faxina geral', w: 'heavy', f: 'monthly', cat: 'general', ess: false }],
  'Lavanderia': [{ t: 'Lavar roupa', w: 'medium', f: 'weekly', cat: 'laundry', ess: false }, { t: 'Dobrar e guardar', w: 'medium', f: 'weekly', cat: 'laundry', ess: false }, { t: 'Trocar roupa de cama', w: 'medium', f: 'weekly', cat: 'laundry', ess: false }],
  'Cães': [{ t: 'Ração manhã', w: 'light', f: 'daily', cat: 'dogs', ess: true }, { t: 'Ração noite', w: 'light', f: 'daily', cat: 'dogs', ess: true }, { t: 'Água fresca', w: 'light', f: 'daily', cat: 'dogs', ess: true }, { t: 'Passeio manhã', w: 'medium', f: 'daily', cat: 'dogs', ess: true }, { t: 'Passeio tarde', w: 'medium', f: 'daily', cat: 'dogs', ess: true }, { t: 'Limpeza área dos cães', w: 'light', f: 'daily', cat: 'dogs', ess: true }, { t: 'Banho dos cães', w: 'heavy', f: 'biweekly', cat: 'dogs', ess: false }, { t: 'Escovação', w: 'light', f: 'weekly', cat: 'dogs', ess: false }],
  'Compras': [{ t: 'Mercado semanal', w: 'medium', f: 'weekly', cat: 'shopping', ess: false }, { t: 'Repor ração dos cães', w: 'light', f: 'monthly', cat: 'shopping', ess: true }],
}
export const DR_DEF = [{ t: 'Ração manhã', f: 'daily', time: '07:00' }, { t: 'Água fresca', f: 'daily', time: null }, { t: 'Passeio manhã', f: 'daily', time: '08:00' }, { t: 'Ração noite', f: 'daily', time: '18:00' }, { t: 'Passeio tarde', f: 'daily', time: '17:30' }, { t: 'Enriquecimento ambiental', f: 'daily', time: null }, { t: 'Escovação', f: 'weekly', time: null }, { t: 'Banho', f: 'weekly', time: null }]
export const DR_PUP = [{ t: 'Saída xixi manhã', f: 'daily', time: '07:30' }, { t: 'Saída xixi tarde', f: 'daily', time: '14:00' }, { t: 'Saída xixi noite', f: 'daily', time: '21:00' }, { t: 'Treino básico', f: 'daily', time: null }, { t: 'Socialização', f: 'daily', time: null }]
export const RFREQ: Array<[string, string]> = [['daily', 'Diária'], ['weekly', 'Semanal'], ['biweekly', 'Quinzenal'], ['monthly', 'Mensal']]
export const ACCIDENT_PLACES = ['Sala', 'Quarto', 'Cozinha', 'Banheiro', 'Corredor']
/** Conclusões dos últimos 62 dias (cobre o período mensal e o "feita há X dias"). */
export const COMPLETION_WINDOW_DAYS = 62
