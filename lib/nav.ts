// Áreas do app e telas. Sem JSX, para ser usado também em testes e no servidor.
// Cinco áreas na barra: Início, Meu dia, Casa, Cães, Nós. As rotinas com passos ficam em Casa
// (Tarefas › Rotinas) e os hábitos no Meu dia. Ajustes fica no perfil e em Nós.

export type ModuleId = 'inicio' | 'eu' | 'rotinas' | 'casa' | 'caes' | 'nos'
export type ScreenId = ModuleId | 'ajustes'
export type CasaView = 'tarefas' | 'rotinas' | 'compras' | 'manutencao' | 'agenda' | 'faxinao' | 'despensa' | 'jantar' | 'sugestoes'

export const MODULES: Array<{ id: ModuleId, label: string, hint: string }> = [
  { id: 'inicio', label: 'Início', hint: 'O dia de hoje' },
  { id: 'eu', label: 'Meu dia', hint: 'Água, sono, comida e corpo' },
  { id: 'casa', label: 'Casa', hint: 'Tarefas, rotinas, compras e agenda' },
  { id: 'caes', label: 'Cães', hint: 'Penélope e Zelda' },
  { id: 'nos', label: 'Nós', hint: 'Semana, reunião e conquistas' },
]

/** A área do menu que fica destacada em cada tela (Ajustes pertence a Nós). */
export function moduleOf(screen: ScreenId): ModuleId {
  return screen === 'ajustes' ? 'nos' : screen === 'rotinas' ? 'casa' : screen
}

/** Abas da versão anterior → nova tela (links antigos, atalhos, preferências guardadas). */
export function legacyScreen(tab: string): { screen: ScreenId, casa?: CasaView } {
  switch (tab) {
    case 'today': return { screen: 'inicio' }
    case 'tasks': return { screen: 'casa', casa: 'tarefas' }
    case 'shop': return { screen: 'casa', casa: 'compras' }
    case 'week': return { screen: 'nos' }
    case 'pets': return { screen: 'caes' }
    // a aba Rotinas saiu da barra: as rotinas com passos estão em Casa › Tarefas › Rotinas
    case 'rotinas': return { screen: 'casa', casa: 'rotinas' }
    case 'settings': return { screen: 'ajustes' }
    default: return { screen: (MODULES.some(m => m.id === tab) || tab === 'ajustes') ? tab as ScreenId : 'inicio' }
  }
}

/** Partes do Meu dia (aparecem no menu lateral quando o Meu dia está aberto e na barra do topo). */
export type MdTab = 'hoje' | 'habitos' | 'comida' | 'treinos' | 'corpo' | 'ajustes'
export const MD_TABS: Array<{ id: MdTab, icon: string, label: string, short: string }> = [
  { id: 'hoje', icon: '☀️', label: 'Hoje', short: 'Hoje' },
  { id: 'habitos', icon: '✅', label: 'Hábitos', short: 'Hábitos' },
  { id: 'comida', icon: '🍽️', label: 'Alimentação', short: 'Comida' },
  { id: 'treinos', icon: '🏋️', label: 'Treinos', short: 'Treinos' },
  { id: 'corpo', icon: '📏', label: 'Evolução', short: 'Corpo' },
  { id: 'ajustes', icon: '⚙️', label: 'Metas e privacidade', short: 'Ajustes' },
]

/** Casa em 4 grupos: Tarefas (e rotinas) · Compras (lista, despensa, jantar) · Agenda · Mais (o resto). */
export type CasaGroup = 'tarefas' | 'compras' | 'agenda' | 'mais'
export const CASA_GROUP: Record<CasaView, CasaGroup> = {
  tarefas: 'tarefas', rotinas: 'tarefas', compras: 'compras', jantar: 'compras', despensa: 'compras', agenda: 'agenda', manutencao: 'mais', faxinao: 'mais', sugestoes: 'mais',
}
export const CASA_GROUP_LABEL: Record<CasaGroup, string> = { tarefas: 'Tarefas', compras: 'Compras', agenda: 'Agenda', mais: '☰ Mais' }

/** Grupos que têm alguma aba disponível, na ordem, com a soma dos números das abas. */
export function casaGroups(views: Array<[CasaView, string, number?]>): Array<{ g: CasaGroup, label: string, n: number, views: Array<[CasaView, string, number?]> }> {
  return (['tarefas', 'compras', 'agenda', 'mais'] as CasaGroup[])
    .map(g => { const vs = views.filter(([v]) => CASA_GROUP[v] === g); return { g, label: CASA_GROUP_LABEL[g], n: vs.reduce((a, [, , n]) => a + (n || 0), 0), views: vs } })
    .filter(x => x.views.length > 0)
}
