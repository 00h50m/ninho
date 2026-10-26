// Casa › 💡 Sugestões › Checklists de estação: pacotes de tarefas que só valem numa época
// (verão, inverno, chuvas, fim de ano, volta das férias). Entram com período (migration 039):
// as que repetem valem de … até …; as de uma vez só entram como pontual na data de início.
// Datas do hemisfério sul (São Paulo). Puro, testado.
import { addDays } from './dates'
import { norm } from './sugestoes'

export type PackFreq = 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly'
export interface PackItem { t: string, f: PackFreq, w: 'light' | 'medium' | 'heavy', cat: string, why: string }
export interface Pack {
  key: string, icon: string, label: string, why: string
  /** início e fim no ano ("MM-DD"); se o fim vem antes do início, atravessa o ano. null = a partir de hoje, por `days` dias */
  season: { from: string, to: string } | null
  days?: number
  items: PackItem[]
}

const I = (t: string, f: PackFreq, w: PackItem['w'], cat: string, why: string): PackItem => ({ t, f, w, cat, why })

export const PACKS: Pack[] = [
  { key: 'verao', icon: '☀️', label: 'Verão', why: 'Calor, mosquito e ar-condicionado ligado.', season: { from: '12-01', to: '03-20' }, items: [
    I('Limpar filtros do ar-condicionado', 'monthly', 'medium', 'general', 'Filtro sujo gela menos e gasta mais luz.'),
    I('Limpar ventiladores', 'biweekly', 'light', 'general', 'Pó nas pás espalha alergia pela casa.'),
    I('Conferir antipulgas e carrapato dos cães', 'monthly', 'light', 'general', 'No calor as pulgas e os carrapatos aparecem mais.'),
    I('Trocar a roupa de cama por uma mais leve', 'once', 'light', 'laundry', 'Edredom guardado limpo e seco.'),
    I('Conferir telas e repelentes', 'once', 'light', 'general', 'Mosquito da dengue gosta de verão.'),
    I('Tirar água parada (vasos, ralos, baldes)', 'weekly', 'light', 'general', 'Uma vez por semana quebra o ciclo do mosquito.'),
  ] },
  { key: 'chuvas', icon: '🌧️', label: 'Época de chuva', why: 'Mofo, infiltração e ralo entupido.', season: { from: '11-01', to: '03-31' }, items: [
    I('Limpar ralos e calhas', 'monthly', 'medium', 'general', 'Folha e sujeira entopem na primeira chuva forte.'),
    I('Conferir infiltrações e mofo', 'monthly', 'light', 'general', 'Pegar cedo evita parede estragada.'),
    I('Ventilar armários e guarda-roupa', 'biweekly', 'light', 'general', 'Umidade parada vira cheiro de mofo.'),
    I('Secar e guardar as capas de chuva e guarda-chuvas', 'weekly', 'light', 'general', 'Molhados dentro de casa mofam.'),
  ] },
  { key: 'inverno', icon: '❄️', label: 'Inverno', why: 'Cobertores, umidade e banho quente.', season: { from: '06-01', to: '08-31' }, items: [
    I('Lavar cobertores e edredons', 'once', 'heavy', 'laundry', 'Antes de usar: tira o cheiro de guardado.'),
    I('Conferir chuveiro e resistência', 'once', 'light', 'general', 'Melhor descobrir antes do dia mais frio.'),
    I('Ventilar a casa nos dias de sol', 'weekly', 'light', 'general', 'Casa fechada acumula umidade e mofo.'),
    I('Caminhas e mantas dos cães quentinhas', 'once', 'light', 'general', 'Cachorro também sente frio.'),
  ] },
  { key: 'fimdeano', icon: '🎄', label: 'Fim de ano', why: 'Casa em ordem para as festas e para o ano novo.', season: { from: '12-10', to: '12-31' }, items: [
    I('Faxina de fim de ano', 'once', 'heavy', 'general', 'Uma geral antes das visitas.'),
    I('Organizar armários e separar doações', 'once', 'medium', 'general', 'O que não usou no ano pode servir para alguém.'),
    I('Conferir validades da despensa', 'once', 'light', 'kitchen', 'Antes das compras da ceia.'),
    I('Limpar a geladeira antes da ceia', 'once', 'medium', 'kitchen', 'Espaço para o que vem.'),
    I('Planejar a ceia e as compras', 'once', 'light', 'shopping', 'Lista pronta evita mercado lotado na véspera.'),
  ] },
  { key: 'ferias', icon: '🧳', label: 'Volta das férias', why: 'Para a casa voltar ao normal em poucos dias.', season: null, days: 4, items: [
    I('Desfazer as malas', 'once', 'light', 'general', 'Mala aberta no quarto vira bagunça por semanas.'),
    I('Lavar a roupa da viagem', 'once', 'medium', 'laundry', 'Tudo de uma vez, enquanto lembra o que é o quê.'),
    I('Conferir geladeira e jogar fora o vencido', 'once', 'light', 'kitchen', 'O que ficou para trás antes de ir.'),
    I('Mercado de reposição', 'once', 'medium', 'shopping', 'Só o básico para a semana.'),
    I('Regar e cuidar das plantas', 'once', 'light', 'general', 'Ver quem sentiu falta de água.'),
    I('Tirar o pó da casa', 'once', 'medium', 'general', 'Casa fechada junta pó rápido.'),
  ] },
]

const md = (d: string) => d.slice(5)
/** Período do pacote a partir de hoje: a estação de agora (de hoje até o fim) ou a próxima. */
export function packWindow(p: Pack, today: string): { from: string, to: string, now: boolean } {
  if (!p.season) return { from: today, to: addDays(today, (p.days || 7) - 1), now: true }
  const { from, to } = p.season, y = Number(today.slice(0, 4)), t = md(today)
  const cross = to < from
  const inside = cross ? (t >= from || t <= to) : (t >= from && t <= to)
  if (inside) return { from: today, to: `${cross && t >= from ? y + 1 : y}-${to}`, now: true }
  const startY = t < from ? y : y + 1
  return { from: `${startY}-${from}`, to: `${cross ? startY + 1 : startY}-${to}`, now: false }
}

/** Quais itens do pacote vocês já têm (pelo nome, entre as tarefas ativas). */
export function packHas(p: Pack, taskTitles: string[]): Set<string> {
  const have = new Set(taskTitles.map(norm))
  return new Set(p.items.filter(i => have.has(norm(i.t))).map(i => i.t))
}

/** As tarefas para criar: repetidas com período; de uma vez só como pontual no início. Alternando entre vocês. */
export function packTasks(items: PackItem[], from: string, to: string) {
  return items.map(i => ({
    title: i.t, category: i.cat, weight: i.w, frequency: i.f, assigned_to: null, scheduled_time: null, essential: false,
    ...(i.f === 'once' ? { due_date: from } : { starts_on: from, ends_on: to }),
  }))
}
