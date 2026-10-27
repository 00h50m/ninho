// Áreas do app e telas. Sem JSX, para ser usado também em testes e no servidor.
// Seis áreas: Início, Meu dia, Rotinas, Casa, Cães, Nós. Ajustes fica no perfil e em Nós.

export type ModuleId = 'inicio' | 'eu' | 'rotinas' | 'casa' | 'caes' | 'nos'
export type ScreenId = ModuleId | 'ajustes'
export type CasaView = 'tarefas' | 'compras' | 'manutencao' | 'agenda' | 'faxinao' | 'despensa' | 'jantar' | 'sugestoes'

export const MODULES: Array<{ id: ModuleId, label: string, hint: string }> = [
  { id: 'inicio', label: 'Início', hint: 'O dia de hoje' },
  { id: 'eu', label: 'Meu dia', hint: 'Água, sono, comida e corpo' },
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

/** Partes do Meu dia (aparecem no menu lateral quando o Meu dia está aberto e na barra do topo). */
export type MdTab = 'hoje' | 'comida' | 'treinos' | 'corpo' | 'ajustes'
export const MD_TABS: Array<{ id: MdTab, icon: string, label: string, short: string }> = [
  { id: 'hoje', icon: '☀️', label: 'Hoje', short: 'Hoje' },
  { id: 'comida', icon: '🍽️', label: 'Alimentação', short: 'Comida' },
  { id: 'treinos', icon: '🏋️', label: 'Treinos', short: 'Treinos' },
  { id: 'corpo', icon: '📏', label: 'Evolução', short: 'Corpo' },
  { id: 'ajustes', icon: '⚙️', label: 'Metas e privacidade', short: 'Ajustes' },
]

/** Casa em 4 grupos (menos abas no topo): Tarefas · Compras · Comida (Jantar, Despensa) · Mais (o resto). */
export type CasaGroup = 'tarefas' | 'compras' | 'comida' | 'mais'
export const CASA_GROUP: Record<CasaView, CasaGroup> = {
  tarefas: 'tarefas', compras: 'compras', jantar: 'comida', despensa: 'comida', manutencao: 'mais', agenda: 'mais', faxinao: 'mais', sugestoes: 'mais',
}
export const CASA_GROUP_LABEL: Record<CasaGroup, string> = { tarefas: 'Tarefas', compras: 'Compras', comida: '🍲 Comida', mais: '☰ Mais' }

/** Grupos que têm alguma aba disponível, na ordem, com a soma dos números das abas. */
export function casaGroups(views: Array<[CasaView, string, number?]>): Array<{ g: CasaGroup, label: string, n: number, views: Array<[CasaView, string, number?]> }> {
  return (['tarefas', 'compras', 'comida', 'mais'] as CasaGroup[])
    .map(g => { const vs = views.filter(([v]) => CASA_GROUP[v] === g); return { g, label: CASA_GROUP_LABEL[g], n: vs.reduce((a, [, , n]) => a + (n || 0), 0), views: vs } })
    .filter(x => x.views.length > 0)
}
