import { afterEach, describe, expect, it, vi } from 'vitest'
import { brl, mesNome, quando, validateSobrou } from '@/lib/sobrou'
import { fetchSobrou, sobrouConfigured, sobrouMissing } from '@/lib/server/sobrou'

const RAW = { mes: '2026-10', renda: 5000, comprometido: 3200.456, pago: 1200, aPagar: 2000, sobraProjetada: 1800, pctComprometido: 64.2,
  vencimentos: [{ titulo: 'Internet', valor: 100, data: '2026-10-22', estimada: false }, { titulo: 'x', valor: 1, data: 'amanhã' }],
  avisos: [{ tom: 'ruim', texto: 'Alimentação passou do teto' }, { tom: 'qualquer', texto: '  Lazer perto do teto ' }, { tom: 'ruim', texto: '' }] }
const ENV = { SOBROU_API_URL: 'https://sobrou.example.com/', SOBROU_RESUMO_TOKEN: 'segredo-de-teste-com-mais-de-24-caracteres' } as any

describe('Sobrou no Ninho', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  it('confere a resposta', () => {
    const r = validateSobrou(RAW)!
    expect(r.comprometido).toBe(3200.46)
    expect(r.pctComprometido).toBe(64)
    expect(r.vencimentos.map(v => v.titulo)).toEqual(['Internet'])
    expect(r.avisos).toEqual([{ tom: 'ruim', texto: 'Alimentação passou do teto' }, { tom: 'atencao', texto: 'Lazer perto do teto' }])
    expect(validateSobrou({ mes: 'outubro' })).toBeNull()
    expect(validateSobrou(null)).toBeNull()
  })
  it('formatos', () => {
    expect(brl(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50')
    expect(mesNome('2026-10')).toBe('outubro')
    expect([quando('2026-10-20', '2026-10-20', '2026-10-21'), quando('2026-10-21', '2026-10-20', '2026-10-21'), quando('2026-10-24', '2026-10-20', '2026-10-21')]).toEqual(['hoje', 'amanhã', 'sáb, 24/10'])
  })
  it('só liga com endereço e segredo da Vercel; manda o segredo só para esse endereço', async () => {
    expect(sobrouConfigured({} as any)).toBe(false)
    expect(sobrouConfigured({ ...ENV, SOBROU_RESUMO_TOKEN: 'curto' })).toBe(false)
    expect(sobrouConfigured({ ...ENV, SOBROU_API_URL: 'javascript:alert(1)' })).toBe(false)
    const calls: any[] = []
    vi.stubGlobal('fetch', async (url: string, init: any) => { calls.push({ url, init }); return new Response(JSON.stringify({ ok: true, resumo: RAW }), { status: 200 }) })
    const r = await fetchSobrou(ENV)
    expect(r.ok).toBe(true)
    expect(calls[0].url).toBe('https://sobrou.example.com/api/resumo-ninho')
    expect(calls[0].init.headers.authorization).toBe('Bearer segredo-de-teste-com-mais-de-24-caracteres')
    expect(calls[0].init.redirect).toBe('error')
  })
  it('diz o que falta (sem mostrar valores) e aceita espaços colados por engano', async () => {
    expect(sobrouMissing({} as any)).toEqual(['SOBROU_API_URL (não cadastrada)', 'SOBROU_RESUMO_TOKEN (não cadastrada)'])
    expect(sobrouMissing({ SOBROU_API_URL: 'sobrou.vercel.app', SOBROU_RESUMO_TOKEN: 'curto' } as any)).toEqual(['SOBROU_API_URL (precisa começar com https://)', 'SOBROU_RESUMO_TOKEN (precisa ter 24 caracteres ou mais)'])
    const env = { SOBROU_API_URL: ' https://sobrou.example.com/ \n', SOBROU_RESUMO_TOKEN: ' segredo-de-teste-com-mais-de-24-caracteres\n' } as any
    expect(sobrouMissing(env)).toEqual([])
    const calls: any[] = []
    vi.stubGlobal('fetch', async (url: string, init: any) => { calls.push({ url, init }); return new Response(JSON.stringify({ ok: true, resumo: RAW }), { status: 200 }) })
    await fetchSobrou(env)
    expect(calls[0].url).toBe('https://sobrou.example.com/api/resumo-ninho')
    expect(calls[0].init.headers.authorization).toBe('Bearer segredo-de-teste-com-mais-de-24-caracteres')
  })
  it('falhas viram mensagens amigáveis', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 401 }))
    expect(await fetchSobrou(ENV)).toMatchObject({ ok: false, message: expect.stringContaining('segredo não confere') })
    vi.stubGlobal('fetch', async () => { throw new Error('timeout') })
    expect(await fetchSobrou(ENV)).toMatchObject({ ok: false, status: 504 })
    vi.stubGlobal('fetch', async () => new Response('{"resumo":{"mes":1}}', { status: 200 }))
    expect(await fetchSobrou(ENV)).toMatchObject({ ok: false, message: expect.stringContaining('formato inesperado') })
  })
})
