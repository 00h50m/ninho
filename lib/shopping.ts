// Lista de compras: categorias, ordem da lista e "comprar de novo".
// Funções puras (sem banco), testadas em tests/shopping.test.ts.
import type { Who } from './types'

export interface ShoppingItem {
  id: string
  household_id: string
  title: string
  qty: string | null
  category: string
  note: string | null
  added_by: Who | null
  checked_at: string | null
  checked_by: Who | null
  done_at: string | null
  created_at: string
}

/** Ordem = ordem dos corredores num mercado comum. */
export const SHOP_CATS: Array<[string, string]> = [
  ['hortifruti', '🥬 Hortifrúti'],
  ['padaria', '🍞 Padaria'],
  ['acougue', '🥩 Açougue e peixaria'],
  ['frios', '🧀 Frios e laticínios'],
  ['mercearia', '🥫 Mercearia'],
  ['bebidas', '🥤 Bebidas'],
  ['congelados', '🧊 Congelados'],
  ['limpeza', '🧽 Limpeza'],
  ['higiene', '🧴 Higiene'],
  ['pets', '🐾 Pets'],
  ['farmacia', '💊 Farmácia'],
  ['outros', '🛒 Outros'],
]
export const SHOP_CAT_LABEL: Record<string, string> = Object.fromEntries(SHOP_CATS)

const WORDS: Record<string, string[]> = {
  hortifruti: ['alface', 'tomate', 'cebola', 'alho', 'batata', 'cenoura', 'banana', 'maca', 'laranja', 'limao', 'mamao', 'abacate', 'uva', 'morango', 'melancia', 'melao', 'abacaxi', 'manga', 'pera', 'kiwi', 'brocolis', 'couve', 'rucula', 'espinafre', 'pepino', 'abobrinha', 'abobora', 'berinjela', 'pimentao', 'cheiro verde', 'salsinha', 'cebolinha', 'coentro', 'gengibre', 'mandioca', 'aipim', 'inhame', 'beterraba', 'repolho', 'chuchu', 'quiabo', 'vagem', 'milho verde', 'fruta', 'verdura', 'legume', 'ovo', 'ovos'],
  padaria: ['pao', 'paes', 'bisnaguinha', 'croissant', 'bolo', 'torrada', 'baguete', 'sonho'],
  acougue: ['carne', 'frango', 'peito', 'coxa', 'sobrecoxa', 'file', 'patinho', 'alcatra', 'picanha', 'costela', 'linguica', 'bacon', 'peixe', 'salmao', 'tilapia', 'camarao', 'moida', 'bife', 'porco', 'lombo', 'acem', 'musculo', 'cupim', 'hamburguer'],
  frios: ['leite', 'queijo', 'presunto', 'mussarela', 'muçarela', 'iogurte', 'manteiga', 'margarina', 'requeijao', 'creme de leite', 'nata', 'peito de peru', 'salame', 'ricota', 'cream cheese', 'parmesao', 'coalhada'],
  mercearia: ['arroz', 'feijao', 'macarrao', 'massa', 'acucar', 'sal', 'cafe', 'farinha', 'oleo', 'azeite', 'vinagre', 'molho', 'extrato', 'milho', 'ervilha', 'atum', 'sardinha', 'biscoito', 'bolacha', 'cereal', 'aveia', 'granola', 'chocolate', 'achocolatado', 'tempero', 'pimenta', 'oregano', 'fuba', 'tapioca', 'goma', 'lentilha', 'grao de bico', 'pipoca', 'gelatina', 'fermento', 'maionese', 'ketchup', 'mostarda', 'mel', 'geleia', 'amendoim', 'castanha', 'cha'],
  bebidas: ['agua', 'refrigerante', 'suco', 'cerveja', 'vinho', 'energetico', 'cha gelado', 'agua de coco', 'kombucha', 'refri', 'coca'],
  congelados: ['sorvete', 'congelado', 'pizza', 'lasanha', 'nugget', 'batata frita', 'polpa', 'gelo', 'pao de queijo'],
  limpeza: ['detergente', 'sabao', 'amaciante', 'agua sanitaria', 'cloro', 'desinfetante', 'multiuso', 'esponja', 'pano', 'saco de lixo', 'lixo', 'vassoura', 'rodo', 'alcool', 'limpa vidro', 'lustra', 'tira manchas', 'bom ar', 'luva', 'papel toalha', 'guardanapo', 'filme plastico', 'papel aluminio', 'pastilha sanitaria', 'veja', 'lava roupas'],
  higiene: ['papel higienico', 'shampoo', 'xampu', 'condicionador', 'sabonete', 'pasta de dente', 'creme dental', 'escova de dente', 'fio dental', 'desodorante', 'absorvente', 'algodao', 'cotonete', 'hidratante', 'protetor solar', 'barbeador', 'lamina', 'enxaguante', 'lenco'],
  pets: ['racao', 'petisco', 'tapete higienico', 'areia', 'bifinho', 'osso', 'brinquedo', 'coleira', 'antipulgas', 'vermifugo', 'sache'],
  farmacia: ['remedio', 'dipirona', 'paracetamol', 'ibuprofeno', 'vitamina', 'curativo', 'band aid', 'termometro', 'soro', 'pomada', 'colirio'],
}

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Sugere a categoria pelo nome. Expressões mais longas ganham das curtas
 * ("papel higiênico" → higiene, mesmo contendo "papel"; "pão de queijo" → congelados).
 */
export function guessCategory(title: string): string {
  const t = ` ${normalize(title)} `
  let best = { cat: 'outros', len: 0 }
  for (const [cat, words] of Object.entries(WORDS)) {
    for (const w of words) {
      const nw = normalize(w)
      if (nw.length > best.len && (t.includes(` ${nw} `) || t.includes(` ${nw}s `))) best = { cat, len: nw.length }
    }
  }
  return best.cat
}

/** Separa "2 kg arroz", "arroz 2kg", "3x leite" em nome e quantidade. */
export function parseEntry(raw: string): { title: string, qty: string | null } {
  const s = raw.trim().replace(/\s+/g, ' ')
  const unit = '(?:kg|g|l|ml|un|und|unid|unidades?|pct|pacotes?|cx|caixas?|dz|duzias?|x)'
  const front = s.match(new RegExp(`^(\\d+(?:[.,]\\d+)?\\s*${unit}?)\\s+(?:de\\s+)?(.+)$`, 'i'))
  if (front) return { title: cap(front[2]), qty: front[1].replace(/\s+/g, ' ') }
  const back = s.match(new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?\\s*${unit})$`, 'i'))
  if (back) return { title: cap(back[1]), qty: back[2].replace(/\s+/g, ' ') }
  return { title: cap(s), qty: null }
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** Lista aberta agrupada por categoria (ordem do mercado); riscados vão para o fim de cada grupo. */
export function groupOpen(items: ShoppingItem[]): Array<{ cat: string, label: string, items: ShoppingItem[] }> {
  const open = items.filter(i => !i.done_at)
  return SHOP_CATS
    .map(([cat, label]) => ({
      cat, label,
      items: open.filter(i => (SHOP_CAT_LABEL[i.category] ? i.category : 'outros') === cat)
        .sort((a, b) => Number(!!a.checked_at) - Number(!!b.checked_at) || a.title.localeCompare(b.title, 'pt-BR')),
    }))
    .filter(g => g.items.length)
}

/**
 * "Comprar de novo": itens das últimas compras que não estão na lista,
 * do mais frequente para o menos frequente.
 */
export function buyAgain(history: ShoppingItem[], open: ShoppingItem[], limit = 12): Array<{ title: string, category: string, count: number, last: string }> {
  const inList = new Set(open.filter(i => !i.done_at).map(i => normalize(i.title)))
  const m = new Map<string, { title: string, category: string, count: number, last: string }>()
  for (const h of history) {
    if (!h.done_at || !h.checked_at) continue
    const k = normalize(h.title)
    if (inList.has(k)) continue
    const cur = m.get(k)
    if (!cur) m.set(k, { title: h.title, category: h.category, count: 1, last: h.done_at })
    else { cur.count++; if (h.done_at > cur.last) { cur.last = h.done_at; cur.title = h.title } }
  }
  return Array.from(m.values()).sort((a, b) => b.count - a.count || b.last.localeCompare(a.last)).slice(0, limit)
}

export function shoppingCounts(items: ShoppingItem[]) {
  const open = items.filter(i => !i.done_at)
  return { open: open.length, checked: open.filter(i => i.checked_at).length, toBuy: open.filter(i => !i.checked_at).length }
}
