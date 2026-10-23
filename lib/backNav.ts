// Botão "voltar" do celular (e do navegador) dentro do app.
// O Ninho é uma página só: sem isso, o voltar do Android fecha o app. Aqui cada mudança de tela
// feita pela pessoa vira uma entrada no histórico, e cada janela aberta (folha, busca, sprint…)
// também. O voltar então: 1) fecha a janela de cima; 2) volta para a tela/aba anterior;
// 3) no Início, pede "toque de novo para sair".
// Sem chamar history.back() quando a janela fecha pelo ✕: a entrada fica "morta" e é reaproveitada
// (replaceState) pela próxima navegação, ou pulada quando o voltar cair nela.

export interface NavSnap { [k: string]: string }
type Entry = { ninho: 1, nav: NavSnap, ov: string | null, root?: 1 }
type Overlay = { id: string, close: () => boolean | void }

const isEntry = (s: unknown): s is Entry => !!s && typeof s === 'object' && (s as Entry).ninho === 1
const same = (a: NavSnap | null | undefined, b: NavSnap | null | undefined) => !!a && !!b && Object.keys({ ...a, ...b }).every(k => a[k] === b[k])

let overlays: Overlay[] = []
let dead = false            // a entrada atual é de uma janela que já fechou pelo ✕
let nav: NavSnap | null = null
let applyNav: ((n: NavSnap) => void) | null = null
let atRoot: ((n: NavSnap) => NavSnap | null) | null = null
let started = false
let seq = 0
let initialNav: NavSnap = {}

/** Primeira entrada "de verdade" depois do começo: só com um toque (o Chrome ignora entradas criadas sem toque). */
function arm() { if (cur()?.root) write({ ninho: 1, nav: nav || initialNav, ov: null }, false) }
const armOnTouch = () => { if (typeof window !== 'undefined') window.addEventListener('pointerdown', arm, { once: true, capture: true }) }

const hist = () => (typeof window !== 'undefined' ? window.history : null)
const cur = (): Entry | null => { const s = hist()?.state; return isEntry(s) ? s : null }
const write = (e: Entry, replace: boolean) => { const h = hist(); if (!h) return; replace ? h.replaceState(e, '') : h.pushState(e, '') }

function onPop(ev: PopStateEvent) {
  const st = isEntry(ev.state) ? ev.state : null
  const wasDead = dead
  dead = false
  // 1) fecha as janelas abertas depois da entrada onde caímos
  const keepIdx = st?.ov ? overlays.findIndex(o => o.id === st.ov) : -1
  const toClose = overlays.slice(keepIdx + 1).reverse()
  for (const o of toClose) {
    overlays = overlays.filter(x => x !== o)
    if (o.close() === false) {
      // a janela não pode fechar agora (ex.: passo anterior do assistente): volta a entrada dela
      overlays.push(o)
      write({ ninho: 1, nav: nav || {}, ov: o.id }, false)
      return
    }
  }
  if (toClose.length) {
    // ficou numa entrada de janela que já não existe: pula
    if (st?.ov && keepIdx < 0) { hist()?.back(); return }
    if (st && !same(st.nav, nav) && applyNav) { nav = st.nav; applyNav(st.nav) }
    return
  }
  if (st?.ov && !overlays.some(o => o.id === st.ov)) { hist()?.back(); return }
  // 2) volta para a tela anterior
  if (st && !st.root) {
    if (!same(st.nav, nav) && applyNav) { nav = st.nav; applyNav(st.nav) }
    // só consumiu a entrada de uma janela já fechada: volta mais um passo para o toque valer
    else if (wasDead) hist()?.back()
    return
  }
  // 3) chegou ao começo: o app decide se vai para o Início ou deixa sair
  const home = atRoot ? atRoot(nav || st?.nav || {}) : null
  if (home) { nav = home; applyNav?.(home); write({ ninho: 1, nav: home, ov: null }, false) }
  // "toque de novo para sair": o próximo voltar sai; se a pessoa tocar na tela, o voltar volta a valer
  else armOnTouch()
}

/**
 * Liga o voltar. `apply` muda a tela sem criar entrada. `root` é chamado ao chegar no começo:
 * devolve a tela inicial para ir até ela, ou null para deixar o próximo voltar sair do app.
 */
export function startBackNav(initial: NavSnap, apply: (n: NavSnap) => void, root: (n: NavSnap) => NavSnap | null): () => void {
  applyNav = apply; atRoot = root; nav = initial; initialNav = initial
  if (typeof window === 'undefined' || started) return () => {}
  started = true
  write({ ninho: 1, nav: initial, ov: null, root: 1 }, true)
  armOnTouch()
  window.addEventListener('popstate', onPop)
  return () => { started = false; window.removeEventListener('popstate', onPop); window.removeEventListener('pointerdown', arm, true) }
}

/** A pessoa mudou de tela/aba: nova entrada (ou reaproveita a de uma janela fechada). */
export function navigateTo(n: NavSnap) {
  if (same(n, nav)) return
  nav = n
  if (!started) return
  const c = cur()
  if (c?.root) { write({ ninho: 1, nav: n, ov: null }, false); return }
  write({ ninho: 1, nav: n, ov: null }, dead)
  dead = false
}

/** Janela aberta: o voltar fecha. `close` devolve false para não fechar (e continuar no histórico). */
export function openOverlay(close: () => boolean | void): () => void {
  const id = 'ov' + (++seq)
  const o: Overlay = { id, close }
  overlays.push(o)
  if (started) { write({ ninho: 1, nav: nav || {}, ov: id }, dead && !cur()?.root); dead = false }
  return () => {
    // fechou pelo ✕ (ou sumiu): a entrada fica morta para ser reaproveitada
    if (!overlays.includes(o)) return
    overlays = overlays.filter(x => x !== o)
    if (cur()?.ov === id) dead = true
  }
}

/** Só para testes. */
export function _resetBackNav() { overlays = []; dead = false; nav = null; applyNav = null; atRoot = null; started = false; seq = 0 }
