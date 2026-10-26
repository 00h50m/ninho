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
  /** Migration 019 */
  unit?: string | null
  priority?: 'alta' | 'normal'
  assigned_to?: Who | null
  running_low?: boolean
  recur_days?: number | null
  /** Migration 040: onde comprar (null = pelo corredor) e quanto custou */
  store?: string | null
  price?: number | string | null
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
/** Acabando (2) e prioridade alta (1) sobem na lista. */
export function urgency(i: Pick<ShoppingItem, 'running_low' | 'priority'>): number {
  return (i.running_low ? 2 : 0) + (i.priority === 'alta' ? 1 : 0)
}

/** "2 kg", "1 pct", "3" */
export function qtyLabel(i: Pick<ShoppingItem, 'qty' | 'unit'>): string {
  return [i.qty, i.unit].filter(Boolean).join(' ')
}

export function groupOpen(items: ShoppingItem[]): Array<{ cat: string, label: string, items: ShoppingItem[] }> {
  const open = items.filter(i => !i.done_at)
  return SHOP_CATS
    .map(([cat, label]) => ({
      cat, label,
      items: open.filter(i => (SHOP_CAT_LABEL[i.category] ? i.category : 'outros') === cat)
        // riscados no fim; antes, o que está acabando e o de prioridade alta
        .sort((a, b) => Number(!!a.checked_at) - Number(!!b.checked_at) || urgency(b) - urgency(a) || a.title.localeCompare(b.title, 'pt-BR')),
    }))
    .filter(g => g.items.length)
}

/**
 * Modo mercado: só o que falta, na ordem dos corredores (SHOP_CATS), e o que já está
 * no carrinho separado no fim. `done`/`total` alimentam a barra de progresso.
 */
export function marketView(items: ShoppingItem[]): { groups: Array<{ cat: string, label: string, items: ShoppingItem[] }>, cart: ShoppingItem[], done: number, total: number } {
  const all = groupOpen(items)
  const groups = all.map(g => ({ ...g, items: g.items.filter(i => !i.checked_at) })).filter(g => g.items.length)
  const cart = all.flatMap(g => g.items.filter(i => !!i.checked_at)).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))
  return { groups, cart, done: cart.length, total: cart.length + groups.reduce((a, g) => a + g.items.length, 0) }
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

// ── Onde comprar (040) ─────────────────────────────────────────────────

export const STORES: Array<[string, string]> = [
  ['mercado', '🛒 Mercado'], ['feira', '🥬 Feira'], ['acougue', '🥩 Açougue'], ['padaria', '🍞 Padaria'], ['petshop', '🐾 Pet shop'],
  ['farmacia', '💊 Farmácia'], ['atacado', '📦 Atacado'], ['online', '📱 Online'], ['outro', '📍 Outro lugar'],
]
export const STORE_LABEL: Record<string, string> = Object.fromEntries(STORES)

/** Onde comprar: o escolhido, ou pelo corredor (farmácia → farmácia; pets → pet shop; o resto → mercado). */
export function storeOf(i: Pick<ShoppingItem, 'store' | 'category'>): string {
  if (i.store && STORE_LABEL[i.store]) return i.store
  return i.category === 'farmacia' ? 'farmacia' : i.category === 'pets' ? 'petshop' : 'mercado'
}

/** Quantos itens faltam comprar em cada lugar (só os lugares com algo), na ordem de STORES. */
export function storeCounts(items: ShoppingItem[]): Array<{ store: string, label: string, n: number }> {
  const open = items.filter(i => !i.done_at && !i.checked_at)
  return STORES.map(([store, label]) => ({ store, label, n: open.filter(i => storeOf(i) === store).length })).filter(x => x.n > 0)
}

export const toPrice = (v: number | string | null | undefined): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) / 100 : null
}

/** "R$ 12,90" */
export function priceLabel(n: number): string {
  return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Última compra de cada item (pelo nome): preço, dia e lugar. Do histórico (finalizadas). */
export function lastBuys(history: ShoppingItem[]): Map<string, { price: number | null, date: string, store: string | null }> {
  const m = new Map<string, { price: number | null, date: string, store: string | null }>()
  for (const h of history) {
    if (!h.done_at) continue
    const k = normalize(h.title), cur = m.get(k), price = toPrice(h.price)
    if (!cur || h.done_at > cur.date) m.set(k, { price: price ?? cur?.price ?? null, date: h.done_at, store: h.store || cur?.store || null })
    else if (cur.price == null && price != null) cur.price = price
  }
  return m
}

/** Quanto deve dar (pela última compra de cada item ainda não riscado). `known` = quantos têm preço. */
export function estimate(items: ShoppingItem[], last: Map<string, { price: number | null }>): { total: number, known: number, of: number } {
  const open = items.filter(i => !i.done_at && !i.checked_at)
  let total = 0, known = 0
  for (const i of open) { const p = toPrice(i.price) ?? last.get(normalize(i.title))?.price; if (p != null) { total += p; known++ } }
  return { total: Math.round(total * 100) / 100, known, of: open.length }
}
