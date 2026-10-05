import { describe, expect, it } from 'vitest'
import { DEVICE_KEY, clearDeviceWho, readDeviceWho, writeDeviceWho } from '@/lib/device'

function memoryStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, m }
}

describe('identificação local do aparelho', () => {
  it('primeiro acesso: ninguém escolhido', () => {
    expect(readDeviceWho(memoryStorage())).toBeNull()
  })
  it('salva e lê a escolha (não pergunta de novo)', () => {
    const s = memoryStorage()
    expect(writeDeviceWho('s', s)).toBe(true)
    expect(readDeviceWho(s)).toBe('s')
    expect(s.m.get(DEVICE_KEY)).toBe('s')
  })
  it('pode trocar depois', () => {
    const s = memoryStorage()
    writeDeviceWho('g', s); writeDeviceWho('s', s)
    expect(readDeviceWho(s)).toBe('s')
  })
  it('ignora valor inválido salvo', () => {
    const s = memoryStorage(); s.setItem(DEVICE_KEY, 'admin')
    expect(readDeviceWho(s)).toBeNull()
    expect(writeDeviceWho('x' as any, s)).toBe(false)
  })
  it('limpar volta ao primeiro acesso', () => {
    const s = memoryStorage(); writeDeviceWho('g', s); clearDeviceWho(s)
    expect(readDeviceWho(s)).toBeNull()
  })
  it('aparelho que não deixa salvar (aba anônima) não quebra', () => {
    const broken = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') }, removeItem: () => { throw new Error('bloqueado') } }
    expect(readDeviceWho(broken)).toBeNull()
    expect(writeDeviceWho('g', broken)).toBe(false)
    expect(() => clearDeviceWho(broken)).not.toThrow()
  })
  it('é diferente da coluna visualizada em Hoje (chaves separadas)', () => {
    expect(DEVICE_KEY).not.toBe('ninho.person')
  })
})
