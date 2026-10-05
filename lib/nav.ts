// Áreas do app e telas. Sem JSX, para ser usado também em testes e no servidor.
// Cinco áreas: Início, Rotinas, Casa, Cães, Nós. Ajustes fica no perfil e em Nós.

export type ModuleId = 'inicio' | 'rotinas' | 'casa' | 'caes' | 'nos'
export type ScreenId = ModuleId | 'ajustes'
export type CasaView = 'tarefas' | 'compras' | 'manutencao'

export const MODULES: Array<{ id: ModuleId, label: string, hint: string }> = [
  { id: 'inicio', label: 'Início', hint: 'O dia de hoje' },
  { id: 'rotinas', label: 'Rotinas', hint: 'Rotinas e hábitos' },
  { id: 'casa', label: 'Casa', hint: 'Tarefas, compras e manutenção' },
  { id: 'caes', label: 'Cães', hint: 'Penélope e Zelda' },
  { id: 'nos', label: 'Nós', hint: 'Semana, reunião e conquistas' },
]

/** A área do menu que fica destacada em cada tela (Ajustes pertence a Nós). */
export function moduleOf(screen: ScreenId): ModuleId {
  return screen === 'ajustes' ? 'nos' : screen
}

/** Abas da versão anterior → nova tela (links antigos, atalhos, preferências guardadas). */
export function legacyScreen(tab: string): { screen: ScreenId, casa?: CasaView } {
  switch (tab) {
    case 'today': return { screen: 'inicio' }
    case 'tasks': return { screen: 'casa', casa: 'tarefas' }
    case 'shop': return { screen: 'casa', casa: 'compras' }
    case 'week': return { screen: 'nos' }
    case 'pets': return { screen: 'caes' }
    case 'settings': return { screen: 'ajustes' }
    default: return { screen: (MODULES.some(m => m.id === tab) || tab === 'ajustes') ? tab as ScreenId : 'inicio' }
  }
}
