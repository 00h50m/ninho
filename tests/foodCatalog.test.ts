import { describe, expect, it } from 'vitest'
import { catalogFoods, parseCsv } from '@/lib/foodCatalog'
import { validateLabel } from '@/lib/foodLabel'

// Planilhas fictícias (nenhum dado real)
const CAT = [
  'nome,categoria,porcao,quantidade_por_porcao,unidade_medida,kcal_por_porcao,proteina_g_por_porcao,precisa_revisar,motivo_revisao,prioridade_cadastro',
  'Iogurte teste zero,Iogurte,1 pote,120,g,60,6,SIM,"Marca, sabor e tamanho variam",ALTA',
  'Arroz de teste cozido,Carboidrato,100 g,100,g,128,2.5,NÃO,,ALTA',
  'Bebida teste,Bebida,200 ml,200,ml,40,1,SIM,,BAIXA',
  ',Vazio,1,1,g,1,1,NÃO,,BAIXA',
  'Sem caloria,Teste,1 un,10,g,,1,NÃO,,BAIXA',
  'Sem gramas,Teste,1 unidade,,unidade,50,1,NÃO,,BAIXA',
  'Ovo de teste,Proteína,1 unidade,50,g,73,6.7,SIM,Tamanho do ovo varia,ALTA',
].join('\r\n')

describe('importar planilha de alimentos', () => {
  it('lê aspas, vírgulas dentro de aspas e CRLF', () => {
    const r = parseCsv('a,b\r\n"x, y","com ""aspas"""\r\n\r\n')
    expect(r).toEqual([['a', 'b'], ['x, y', 'com "aspas"']])
  })
  it('catálogo da dieta: porção, gramas, kcal, proteína e "para conferir" com o motivo', () => {
    const r = catalogFoods(CAT)!
    expect(r.add.map(x => x.name)).toEqual(['Iogurte teste zero', 'Arroz de teste cozido', 'Bebida teste', 'Ovo de teste'])
    expect(r.add[0]).toEqual({ name: 'Iogurte teste zero', portion: '1 pote', portion_g: 120, kcal: 60, protein: 6, carb: null, fat: null, review: 'Marca, sabor e tamanho variam' })
    expect(r.add[1].review).toBeNull()
    expect(r.add[1].protein).toBe(2.5)
    // SIM sem motivo: aviso genérico
    expect(r.add[2]).toMatchObject({ portion: '200 ml', portion_g: 200, review: 'Conferir no rótulo' })
    // nada inventado: sem kcal ou sem gramas volta explicado
    expect(r.bad).toEqual([
      { line: 6, name: 'Sem caloria', why: 'calorias faltando ou fora do normal' },
      { line: 7, name: 'Sem gramas', why: 'porção sem gramas (ou ml)' },
    ])
  })
  it('o que já está em Meus alimentos (mesmo nome, sem acento/maiúscula) fica de fora; repetido na planilha também', () => {
    const r = catalogFoods(CAT + '\r\nOVO DE TESTE,x,1,50,g,70,6,NÃO,,', [{ name: 'iogurte TESTE zero' }])!
    expect(r.dup).toEqual(['Iogurte teste zero', 'OVO DE TESTE'])
    expect(r.add.map(x => x.name)).not.toContain('Iogurte teste zero')
  })
  it('planilha simples com ponto e vírgula e decimal com vírgula (Excel)', () => {
    const r = catalogFoods('Nome;Porção;Gramas;Kcal;Proteína\nBarrinha teste;1 barra;30;112,5;10\nPão teste;1 fatia (25 g);;63;2,4')!
    expect(r.add).toEqual([
      { name: 'Barrinha teste', portion: '1 barra', portion_g: 30, kcal: 112.5, protein: 10, carb: null, fat: null, review: null },
      { name: 'Pão teste', portion: '1 fatia (25 g)', portion_g: 25, kcal: 63, protein: 2.4, carb: null, fat: null, review: null },
    ])
  })
  it('sem as colunas mínimas não importa nada', () => {
    expect(catalogFoods('produto,preco\nx,10')).toBeNull()
    expect(catalogFoods('nome,kcal')).toBeNull()
  })
})

describe('foto do rótulo', () => {
  const base = { is_label: true, name: 'Iogurte grego teste', portion: '1 pote', portion_g: 100, kcal: 60, protein: 5, carb: 7, fat: 0.4, note: null }
  it('copia porção, gramas, kcal e macros', () => {
    expect(validateLabel(base)).toEqual({ name: 'Iogurte grego teste', portion: '1 pote', portion_g: 100, kcal: 60, protein: 5, carb: 7, fat: 0.4, note: null })
  })
  it('não é rótulo, ou faltam gramas/kcal: não usa', () => {
    expect(validateLabel({ ...base, is_label: false })).toBeNull()
    expect(validateLabel({ ...base, kcal: null })).toBeNull()
    expect(validateLabel({ ...base, portion_g: 0 })).toBeNull()
    expect(validateLabel('texto')).toBeNull()
  })
  it('macros maiores que a porção: descarta os macros e pede para conferir', () => {
    const r = validateLabel({ ...base, portion_g: 30, protein: 25, carb: 20, fat: 5 })!
    expect(r).toMatchObject({ kcal: 60, protein: null, carb: null, fat: null })
    expect(r.note).toMatch(/confira/)
  })
  it('sem a medida caseira, usa os gramas', () => {
    expect(validateLabel({ ...base, portion: null, portion_g: 25.5 })!.portion).toBe('25,5 g')
  })
})
