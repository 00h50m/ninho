// Redesign · Fase 1: tokens centralizados, temas e navegação em cinco áreas.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { MODULES, legacyScreen, moduleOf } from '@/lib/nav'
import { THEMES, isTheme, readTheme, saveTheme, THEME_BOOT } from '@/lib/theme'

const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(/

describe('design tokens', () => {
  it('nenhuma cor solta nos componentes e no CSS do app (só em styles/tokens.css)', () => {
    const files = [...walk('components'), ...walk('app'), 'styles/app.css'].filter(f => /\.(tsx|css)$/.test(f) && !f.endsWith('layout.tsx'))
    const found = files.flatMap(f => readFileSync(f, 'utf8').split('\n').map((l, i) => ({ f, i: i + 1, l }))
      .filter(x => COLOR.test(x.l) && !/href="#|'#'/.test(x.l)))
    expect(found.map(x => `${x.f}:${x.i}`)).toEqual([])
  })

  it('os temas definem as mesmas variáveis (nenhum tema fica sem cor)', () => {
    const css = readFileSync('styles/tokens.css', 'utf8')
    const block = (sel: string) => {
      const start = css.indexOf(sel); const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
      return new Set(Array.from(body.matchAll(/(--[\w-]+)\s*:/g)).map(m => m[1]))
    }
    const a = block('[data-theme="aconchego"]')
    expect(a.size).toBeGreaterThan(40)
    for (const t of THEMES.map(x => x.id).filter(x => x !== 'aconchego')) {
      const n = block(`[data-theme="${t}"]`)
      expect({ t, faltam: Array.from(a).filter(v => !n.has(v)), sobram: Array.from(n).filter(v => !a.has(v)) }).toEqual({ t, faltam: [], sobram: [] })
      // amostra do seletor existe
      expect(css).toContain(`--sw-${t}-bg`)
    }
    // Todas as variáveis de cor usadas no app existem nos temas
    const used = new Set(Array.from(readFileSync('styles/app.css', 'utf8').matchAll(/var\((--[\w-]+)/g)).map(m => m[1]))
    const base = block(':root {')
    const missing = Array.from(used).filter(v => !a.has(v) && !base.has(v))
    expect(missing).toEqual([])
  })
})

describe('temas', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } } }
  it('sem escolha, segue o sistema; a escolha fica no aparelho', () => {
    const s = mem()
    expect(readTheme(s, false)).toBe('aconchego')
    expect(readTheme(s, true)).toBe('noturno')
    saveTheme('noturno', s)
    expect(readTheme(s, false)).toBe('noturno')
    s.setItem('ninho.theme', 'inventado')
    expect(readTheme(s, true)).toBe('noturno')
  })
  it('cinco temas; o script inicial conhece todos', () => {
    expect(THEMES.map(t => t.id)).toEqual(['aconchego', 'noturno', 'natureza', 'aurora', 'minimal'])
    expect(isTheme('aurora') && isTheme('noturno') && !isTheme('x')).toBe(true)
    for (const t of THEMES) expect(THEME_BOOT).toContain(`"${t.id}"`)
    // o script roda de verdade: tema salvo vale; inválido cai no padrão do sistema
    const run = (saved: string | null, dark: boolean) => {
      const html = { dataset: {} as Record<string, string> }
      new Function('localStorage', 'matchMedia', 'document', THEME_BOOT)({ getItem: () => saved }, () => ({ matches: dark }), { documentElement: html })
      return html.dataset.theme
    }
    expect(run('aurora', false)).toBe('aurora')
    expect(run('inventado', true)).toBe('noturno')
    expect(run(null, false)).toBe('aconchego')
  })
})

describe('navegação', () => {
  it('cinco áreas no menu principal', () => {
    expect(MODULES.map(m => m.label)).toEqual(['Início', 'Rotinas', 'Casa', 'Cães', 'Nós'])
  })
  it('abas antigas continuam levando ao lugar certo', () => {
    expect(legacyScreen('today')).toEqual({ screen: 'inicio' })
    expect(legacyScreen('tasks')).toEqual({ screen: 'casa', casa: 'tarefas' })
    expect(legacyScreen('shop')).toEqual({ screen: 'casa', casa: 'compras' })
    expect(legacyScreen('week')).toEqual({ screen: 'nos' })
    expect(legacyScreen('pets')).toEqual({ screen: 'caes' })
    expect(legacyScreen('settings')).toEqual({ screen: 'ajustes' })
    expect(legacyScreen('caes')).toEqual({ screen: 'caes' })
    expect(legacyScreen('qualquer')).toEqual({ screen: 'inicio' })
  })
  it('Ajustes destaca Nós no menu', () => {
    expect(moduleOf('ajustes')).toBe('nos')
    expect(moduleOf('casa')).toBe('casa')
  })
})
