import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { DEFAULT_A11Y, effectiveTheme, readA11y, saveA11y, setupSnoozed, A11Y_BOOT } from '@/lib/a11y'

const mem = (init?: string) => { const m = new Map<string, string>(); if (init) m.set('ninho.a11y', init); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } } }

describe('preferências de conforto', () => {
  it('sem nada salvo: padrão', () => expect(readA11y(mem())).toEqual(DEFAULT_A11Y))
  it('valores estranhos voltam ao padrão', () => {
    const p = readA11y(mem(JSON.stringify({ size: 'gigante', contrast: 'sim', motion: 'x', lightTheme: 'roxo', hidden: ['checkin', 'nada'], setupSnooze: 'amanhã' })))
    expect(p).toEqual({ ...DEFAULT_A11Y, hidden: ['checkin'] })
    expect(readA11y(mem('{quebrado'))).toEqual(DEFAULT_A11Y)
  })
  it('salva e lê de volta', () => {
    const s = mem(); const p = { ...DEFAULT_A11Y, size: 'xl' as const, contrast: true, motion: 'reduce' as const, autoTheme: true, lightTheme: 'natureza' as const, darkTheme: 'aurora' as const }
    saveA11y(p, s); expect(readA11y(s)).toEqual(p)
  })
  it('tema automático segue o celular', () => {
    const p = { ...DEFAULT_A11Y, autoTheme: true, lightTheme: 'minimal' as const, darkTheme: 'aurora' as const }
    expect(effectiveTheme(p, 'aconchego', true)).toBe('aurora')
    expect(effectiveTheme(p, 'aconchego', false)).toBe('minimal')
    expect(effectiveTheme({ ...p, autoTheme: false }, 'natureza', true)).toBe('natureza')
  })
  it('"agora não" esconde o aviso de configuração até a data', () => {
    const p = { ...DEFAULT_A11Y, setupSnooze: '2026-10-20' }
    expect(setupSnoozed(p, '2026-10-20')).toBe(true); expect(setupSnoozed(p, '2026-10-21')).toBe(false); expect(setupSnoozed(DEFAULT_A11Y, '2026-10-01')).toBe(false)
  })
  it('script do <head> aplica tamanho, contraste, movimento e tema automático', () => {
    const ds: Record<string, string> = {}
    const run = (saved: object, dark: boolean) => {
      for (const k of Object.keys(ds)) delete ds[k]
      new Function('localStorage', 'document', 'matchMedia', A11Y_BOOT)({ getItem: () => JSON.stringify(saved) }, { documentElement: { dataset: ds } }, () => ({ matches: dark }))
      return { ...ds }
    }
    expect(run({ size: 'xl', contrast: true, motion: 'reduce' }, false)).toEqual({ size: 'xl', contrast: 'high', motion: 'reduce' })
    expect(run({ autoTheme: true, lightTheme: 'natureza', darkTheme: 'aurora' }, true).theme).toBe('aurora')
    expect(run({ autoTheme: true, lightTheme: 'xx' }, false).theme).toBe('aconchego')
  })
})

// Contraste WCAG de todos os temas (texto 4,5:1; texto auxiliar e ícones 3:1)
describe('contraste dos temas', () => {
  const css = readFileSync('styles/tokens.css', 'utf8')
  const themes: Record<string, Record<string, string>> = {}
  for (const m of Array.from(css.matchAll(/\[data-theme="(\w+)"\][^{]*\{([^}]*)\}/g))) {
    const v: Record<string, string> = {}
    for (const x of Array.from(m[2].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g))) v[x[1]] = x[2]
    themes[m[1]] = v
  }
  const lum = (h: string) => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const PAIRS: Array<[string, string, number]> = [['tx', 'bg', 4.5], ['tx', 'sf', 4.5], ['mu', 'sf', 4.5], ['sub', 'bg', 4.5], ['sub', 'sf', 4.5], ['sub', 'sf2', 4.5], ['faint', 'sf', 4.5], ['faint', 'bg', 4.5], ['faint', 'sf2', 4.5],
    ['on-pri', 'pri', 4.5], ['pri', 'sf', 4.5], ['pri', 'bg', 4.5], ['green', 'sf', 4.5], ['green', 'gbg', 4.5], ['on-green', 'gdk', 4.5], ['amb', 'abg', 4.5], ['cor-tx', 'cbg', 4.5], ['pur', 'pbg', 4.5], ['toast-tx', 'toast-bg', 4.5]]
  it('os 5 temas existem', () => expect(Object.keys(themes).sort()).toEqual(['aconchego', 'aurora', 'minimal', 'natureza', 'noturno']))
  for (const [name, v] of Object.entries(themes)) {
    it(`${name}: todos os pares de cor no mínimo`, () => {
      const bad = PAIRS.filter(([a, b]) => v[a] && v[b]).map(([a, b, min]) => [a, b, ratio(v[a], v[b]), min] as const).filter(([, , r, min]) => r < min).map(([a, b, r, min]) => `${a}/${b} ${r.toFixed(2)} < ${min}`)
      expect(bad).toEqual([])
    })
  }
})
