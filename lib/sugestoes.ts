// Casa › 💡 Sugestões: catálogo de tarefas para manter a casa organizada e limpa, e de cuidados
// com os pets. Mostra o que vocês já têm (pelo nome) e adiciona com um toque, alternando entre
// vocês. As de pet viram rotinas dos cães (aba Cães), uma para cada cão. Puro, testado.

export type SugFreq = 'daily' | 'weekly' | 'biweekly' | 'monthly'
export interface Sug {
  t: string, f: SugFreq, w: 'light' | 'medium' | 'heavy', cat: string, why: string
  /** pet = rotina dos cães; tarefa = tarefa da casa */
  kind?: 'pet'
  /** outros nomes que contam como "já tem" (sem acento, minúsculas) */
  also?: string[]
}
export interface SugArea { key: string, icon: string, label: string, items: Sug[] }

const T = (t: string, f: SugFreq, w: Sug['w'], cat: string, why: string, also?: string[]): Sug => ({ t, f, w, cat, why, also })
const P = (t: string, f: SugFreq, w: Sug['w'], why: string, also?: string[]): Sug => ({ t, f, w, cat: 'dogs', why, kind: 'pet', also })

export const CATALOG: SugArea[] = [
  { key: 'cozinha', icon: '🍳', label: 'Cozinha', items: [
    T('Louça diária', 'daily', 'medium', 'kitchen', 'Pia vazia deixa a cozinha pronta para a próxima refeição.', ['louca']),
    T('Limpar bancada e fogão', 'daily', 'light', 'kitchen', 'Gordura sai fácil no dia; depois gruda.'),
    T('Lixo da cozinha', 'daily', 'light', 'kitchen', 'Evita cheiro e bichinhos.', ['lixo']),
    T('Trocar esponja e pano de prato', 'weekly', 'light', 'kitchen', 'Esponja velha acumula bactérias.', ['esponja']),
    T('Limpar micro-ondas', 'weekly', 'light', 'kitchen', 'Um minuto com água e limão amolece a sujeira.', ['microondas']),
    T('Organizar geladeira', 'weekly', 'medium', 'kitchen', 'Antes do mercado: tira o vencido e mostra o que falta.'),
    T('Limpar forno e air fryer', 'biweekly', 'medium', 'kitchen', 'Gordura queimada solta fumaça e cheiro.', ['air fryer', 'forno']),
    T('Autolimpeza da lava-louças', 'biweekly', 'light', 'kitchen', 'Filtro limpo lava melhor.', ['lava-loucas', 'lava loucas']),
    T('Limpar geladeira por dentro', 'monthly', 'medium', 'kitchen', 'Prateleiras e gavetas sem respingos.'),
    T('Limpar armários e despensa', 'monthly', 'medium', 'kitchen', 'Migalhas atraem formigas; aproveita para ver validades.', ['despensa']),
    T('Lavar as lixeiras', 'monthly', 'medium', 'kitchen', 'Tira o cheiro que fica no fundo.', ['lixeiras']),
    T('Limpar filtro da coifa / depurador', 'monthly', 'medium', 'kitchen', 'Filtro engordurado não puxa a fumaça.', ['coifa', 'depurador']),
  ] },
  { key: 'banheiro', icon: '🚿', label: 'Banheiro', items: [
    T('Repor papel e sabonete', 'weekly', 'light', 'bathroom', 'Ninguém fica na mão.'),
    T('Limpar pia e espelho', 'weekly', 'light', 'bathroom', 'Respingos de pasta e água marcam rápido.', ['limpar banheiro']),
    T('Limpar vaso sanitário', 'weekly', 'medium', 'bathroom', 'O básico da higiene do banheiro.', ['limpar banheiro']),
    T('Limpar box / chuveiro', 'weekly', 'medium', 'bathroom', 'Evita limo e manchas de água.', ['limpar banheiro']),
    T('Trocar toalhas', 'weekly', 'light', 'bathroom', 'Toalha úmida por dias pega cheiro.'),
    T('Lavar tapete do banheiro', 'weekly', 'light', 'bathroom', 'Acumula umidade e cabelo.', ['limpar banheiro']),
    T('Limpar ralos', 'biweekly', 'light', 'bathroom', 'Cabelo acumulado entope e cheira.'),
    T('Limpar azulejos e rejunte', 'monthly', 'heavy', 'bathroom', 'Mofo no rejunte é difícil de tirar depois.', ['rejunte']),
  ] },
  { key: 'roupas', icon: '👕', label: 'Roupas', items: [
    T('Lavar roupa', 'weekly', 'medium', 'laundry', 'Cesto sob controle.', ['lavar e estender']),
    T('Dobrar e guardar', 'weekly', 'medium', 'laundry', 'Roupa parada no varal amassa.', ['dobrar']),
    T('Lavar e secar toalhas', 'weekly', 'medium', 'laundry', 'Toalhas separadas lavam melhor.', ['lavar toalhas']),
    T('Trocar roupa de cama', 'weekly', 'medium', 'laundry', 'Uma vez por semana é o ideal.', ['roupa de cama']),
    T('Passar roupa', 'weekly', 'medium', 'laundry', 'Só o que precisa, de uma vez.'),
    T('Lavar panos de limpeza', 'weekly', 'light', 'laundry', 'Pano sujo espalha a sujeira.', ['panos']),
    T('Limpar a máquina de lavar', 'monthly', 'light', 'laundry', 'Ciclo vazio com vinagre tira o cheiro.', ['maquina de lavar']),
    T('Lavar cortinas', 'monthly', 'medium', 'laundry', 'Acumulam pó e cheiro.', ['cortinas']),
  ] },
  { key: 'casa', icon: '🏠', label: 'Casa e organização', items: [
    T('Reset da sala (noite)', 'daily', 'light', 'general', '10 minutos guardando tudo: a manhã começa leve.', ['reset']),
    T('Arrumar a cama', 'daily', 'light', 'bedroom', 'O quarto inteiro parece arrumado.'),
    T('Varrer / aspirar', 'weekly', 'medium', 'general', 'Pó e pelos fora do chão.', ['aspirador', 'aspirar', 'varrer']),
    T('Passar pano no chão', 'weekly', 'medium', 'general', 'Chão limpo de verdade.', ['pano no chao', 'fabin']),
    T('Tirar o pó dos móveis', 'weekly', 'light', 'general', 'Menos alergia e casa mais clara.', ['tirar o po']),
    T('Esvaziar lixeiras dos quartos e banheiros', 'weekly', 'light', 'general', 'Junta tudo no dia do lixo.', ['esvaziar lixeiras']),
    T('Organizar entrada e sapateira', 'weekly', 'light', 'general', 'Chaves, sapatos e sacolas no lugar.', ['sapateira']),
    T('Limpar maçanetas e interruptores', 'weekly', 'light', 'general', 'Onde todo mundo põe a mão.', ['macanetas']),
    T('Faxina geral', 'monthly', 'heavy', 'general', 'Os cantos que o dia a dia não pega.', ['faxina']),
    T('Limpar janelas e vidros', 'monthly', 'medium', 'general', 'Entra mais luz.', ['janelas', 'vidros']),
    T('Aspirar sofá e colchão', 'monthly', 'medium', 'general', 'Ácaros e pelos dos cães.', ['sofa', 'colchao']),
    T('Limpar ventiladores', 'monthly', 'light', 'general', 'Pás sujas espalham pó.', ['ventiladores']),
    T('Destralhar uma gaveta ou armário', 'monthly', 'medium', 'general', 'Um por mês: a casa não enche de coisa parada.', ['destralhar']),
    T('Organizar papéis e correspondências', 'monthly', 'light', 'general', 'Boletos e documentos no lugar certo.', ['correspondencias', 'papeis']),
  ] },
  { key: 'aparelhos', icon: '🤖', label: 'Aparelhos', items: [
    T('Limpar os robôs aspiradores', 'weekly', 'light', 'general', 'Reservatório vazio e escovas limpas aspiram melhor.', ['robos']),
    T('Limpar filtro do ar-condicionado', 'monthly', 'light', 'general', 'Ar mais limpo e conta menor.', ['ar-condicionado', 'ar condicionado']),
    T('Limpar filtro do purificador / umidificador', 'monthly', 'light', 'general', 'Evita mofo e cheiro.', ['purificador', 'umidificador']),
  ] },
  { key: 'compras', icon: '🛒', label: 'Compras e planejamento', items: [
    T('Planejar o cardápio da semana', 'weekly', 'light', 'shopping', 'Menos desperdício e menos "o que vamos comer?".', ['cardapio']),
    T('Mercado semanal', 'weekly', 'medium', 'shopping', 'Uma ida grande no lugar de várias pequenas.', ['mercado']),
    T('Repor produtos de limpeza', 'monthly', 'light', 'shopping', 'Nada de faltar detergente no meio da faxina.', ['produtos de limpeza']),
    T('Verificar validades', 'monthly', 'light', 'kitchen', 'Remédios, despensa e geladeira.', ['validades']),
    T('Repor ração dos cães', 'monthly', 'light', 'shopping', 'O alerta de ração acabando avisa, mas é bom ter o dia.', ['repor racao']),
  ] },
  { key: 'plantas', icon: '🪴', label: 'Plantas', items: [
    T('Regar as plantas', 'weekly', 'light', 'general', 'Ajuste os dias conforme cada planta.', ['regar']),
    T('Adubar e limpar as plantas', 'monthly', 'light', 'general', 'Folhas secas fora e um pouco de adubo.', ['adubar']),
  ] },
  { key: 'pets', icon: '🐾', label: 'Pets (rotinas dos cães)', items: [
    P('Água fresca', 'daily', 'light', 'Água trocada todo dia, pote cheio.'),
    P('Lavar os potes de comida e água', 'daily', 'light', 'Pote com baba acumula bactéria.', ['potes']),
    P('Limpar a área do xixi / tapete higiênico', 'daily', 'light', 'Lugar limpo, menos xixi fora do lugar.', ['xixi', 'tapete higienico', 'banheiro', 'area dos caes']),
    P('Recolher cocô do quintal', 'daily', 'light', 'Evita cheiro e verme.', ['coco']),
    P('Enriquecimento ambiental', 'daily', 'light', 'Brinquedo recheado ou farejar: cão cansado é cão tranquilo.', ['enriquecimento']),
    P('Treino curto (5 minutos)', 'daily', 'light', 'Comandos e reforço positivo, um pouquinho por dia.', ['treino']),
    P('Passeio', 'daily', 'medium', 'Gasta energia e faz as necessidades fora.', ['passeio']),
    P('Escovação', 'weekly', 'light', 'Menos pelo pela casa e pelo sem nós.', ['escovacao', 'escovar']),
    P('Limpar orelhas', 'weekly', 'light', 'Previne otite, ainda mais em orelha caída.', ['orelhas']),
    P('Escovar os dentes', 'weekly', 'light', 'Evita tártaro e mau hálito.', ['dentes']),
    P('Banho', 'biweekly', 'heavy', 'Ou no pet shop: o importante é ter dia certo.', ['banho']),
    P('Lavar caminhas e cobertas', 'biweekly', 'medium', 'Pelo, cheiro e ácaros.', ['caminhas']),
    P('Cortar as unhas', 'monthly', 'medium', 'Unha grande machuca a pata e risca o chão.', ['unhas']),
    P('Lavar os brinquedos', 'monthly', 'light', 'Brinquedo babado também precisa de banho.', ['brinquedos']),
  ] },
]

export const FREQ_LABEL: Record<SugFreq, string> = { daily: 'todo dia', weekly: 'toda semana', biweekly: 'a cada 15 dias', monthly: 'todo mês' }

/** Sem acento, minúsculas e espaços simples. */
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim()

/** Já tem? Pelo nome igual, ou por um dos outros nomes dentro de alguma tarefa/rotina existente. */
export function hasSug(s: Sug, taskTitles: string[], petTitles: string[]): boolean {
  const pool = (s.kind === 'pet' ? petTitles : taskTitles).map(norm)
  const me = norm(s.t)
  return pool.some(x => x === me || (s.also || []).some(a => x.includes(norm(a))))
}

/** Áreas com a marcação "já tem", na ordem: o que falta primeiro. */
export function suggestionView(taskTitles: string[], petTitles: string[], onlyMissing: boolean) {
  return CATALOG.map(a => {
    const items = a.items.map(s => ({ s, has: hasSug(s, taskTitles, petTitles) }))
    const shown = (onlyMissing ? items.filter(x => !x.has) : items).sort((x, y) => Number(x.has) - Number(y.has))
    return { ...a, shown, missing: items.filter(x => !x.has).length, total: items.length }
  })
}
