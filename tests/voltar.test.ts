import { beforeEach, describe, expect, it } from 'vitest'
import { _resetBackNav, navigateTo, openOverlay, startBackNav, type NavSnap } from '@/lib/backNav'

// Histórico de mentira (como o do navegador): pilha de entradas, voltar dispara popstate.
function fakeWindow() {
  const entries: any[] = [null]; let i = 0
  const handlers: Record<string, Array<(e: any) => void>> = {}
  const w: any = {
    history: {
      get state() { return entries[i] },
      pushState(s: any) { entries.splice(i + 1); entries.push(s); i++ },
      replaceState(s: any) { entries[i] = s },
      back() { if (i === 0) { w.exited = true; return } i--; (handlers.popstate || []).slice().forEach(h => h({ state: entries[i] })) },
    },
    addEventListener(t: string, h: any) { (handlers[t] = handlers[t] || []).push(h) },
    removeEventListener(t: string, h: any) { handlers[t] = (handlers[t] || []).filter(x => x !== h) },
    touch() { const hs = handlers.pointerdown || []; handlers.pointerdown = []; hs.forEach(h => h({})) },
    exited: false,
    get depth() { return i },
  }
  return w
}

let w: any, screen: NavSnap, toasts: string[]
const nav = (s: string, casa = 'tarefas') => ({ screen: s, casa })
beforeEach(() => {
  _resetBackNav()
  w = fakeWindow(); (globalThis as any).window = w
  screen = nav('inicio'); toasts = []
  startBackNav(screen, n => { screen = n }, n => { if (n.screen !== 'inicio') return nav('inicio'); toasts.push('sair?'); return null })
})
const go = (n: NavSnap) => { screen = n; navigateTo(n) }

describe('botão voltar do celular', () => {
  it('volta pelas telas e abas na ordem; no Início pede para tocar de novo; o segundo voltar sai', () => {
    w.touch()
    go(nav('casa')); go(nav('casa', 'compras')); go(nav('caes'))
    w.history.back(); expect(screen).toEqual(nav('casa', 'compras'))
    w.history.back(); expect(screen).toEqual(nav('casa'))
    w.history.back(); expect(screen).toEqual(nav('inicio'))
    expect(w.exited).toBe(false)
    w.history.back(); expect(toasts).toEqual(['sair?']); expect(w.exited).toBe(false)
    w.history.back(); expect(w.exited).toBe(true)
  })
  it('a janela aberta fecha antes de mudar de tela', () => {
    w.touch(); go(nav('casa'))
    let open = true
    const release = openOverlay(() => { open = false })
    w.history.back()
    expect(open).toBe(false); expect(screen).toEqual(nav('casa'))
    release() // a folha sumiu da tela depois de fechar: não mexe no histórico
    w.history.back(); expect(screen).toEqual(nav('inicio'))
  })
  it('janela fechada pelo ✕: o próximo voltar não "some" (pula a entrada morta)', () => {
    w.touch(); go(nav('casa'))
    const release = openOverlay(() => {})
    release() // fechou pelo ✕
    w.history.back()
    expect(screen).toEqual(nav('inicio'))
  })
  it('trocar de janela (menu → editar) reaproveita a entrada: um voltar fecha a de cima', () => {
    w.touch(); go(nav('casa'))
    const r1 = openOverlay(() => {}); r1()
    let edit = true
    openOverlay(() => { edit = false })
    expect(w.depth).toBe(3) // começo, Início, casa, janela (a do menu foi reaproveitada)
    w.history.back(); expect(edit).toBe(false); expect(screen).toEqual(nav('casa'))
  })
  it('janelas uma sobre a outra fecham uma por vez', () => {
    w.touch()
    const closed: string[] = []
    openOverlay(() => { closed.push('a') }); openOverlay(() => { closed.push('b') })
    w.history.back(); expect(closed).toEqual(['b'])
    w.history.back(); expect(closed).toEqual(['b', 'a'])
  })
  it('janela que não pode fechar (passo do assistente) continua aberta e o voltar segue valendo', () => {
    w.touch()
    let step = 3
    openOverlay(() => { if (step > 1) { step--; return false } })
    w.history.back(); expect(step).toBe(2)
    w.history.back(); expect(step).toBe(1)
    w.history.back(); expect(step).toBe(1) // fechou
    w.history.back(); expect(toasts).toEqual(['sair?'])
  })
  it('aberto direto numa tela (link da notificação): o voltar leva ao Início antes de sair', () => {
    go(nav('caes')) // sem toque ainda
    w.history.back()
    expect(w.exited).toBe(false)
    expect(screen).toEqual(nav('inicio'))
  })
})
