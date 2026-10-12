// Resumo do mês vindo do Sobrou! (app de finanças, separado do Ninho). Só números; nada é guardado no Ninho.
// Puro: confere o que chegou e formata. Testado.
export interface SobrouResumo {
  mes: string, renda: number, comprometido: number, pago: number, aPagar: number, sobraProjetada: number, pctComprometido: number | null
  vencimentos: Array<{ titulo: string, valor: number, data: string, estimada: boolean }>
  avisos: Array<{ tom: 'ruim' | 'atencao', texto: string }>
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0 }
const str = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''

/** Confere a resposta do Sobrou (tipos, tamanhos, datas). */
export function validateSobrou(raw: unknown): SobrouResumo | null {
  const r = (raw && typeof raw === 'object' ? raw : null) as any
  if (!r || typeof r.mes !== 'string' || !/^\d{4}-\d{2}$/.test(r.mes)) return null
  return {
    mes: r.mes, renda: num(r.renda), comprometido: num(r.comprometido), pago: num(r.pago), aPagar: num(r.aPagar), sobraProjetada: num(r.sobraProjetada),
    pctComprometido: r.pctComprometido == null || !Number.isFinite(Number(r.pctComprometido)) ? null : Math.round(Number(r.pctComprometido)),
    vencimentos: (Array.isArray(r.vencimentos) ? r.vencimentos : []).filter((v: any) => typeof v?.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.data)).slice(0, 6)
      .map((v: any) => ({ titulo: str(v.titulo, 60) || 'Conta', valor: num(v.valor), data: v.data, estimada: !!v.estimada })),
    avisos: (Array.isArray(r.avisos) ? r.avisos : []).map((a: any) => ({ tom: a?.tom === 'ruim' ? 'ruim' as const : 'atencao' as const, texto: str(a?.texto, 80) })).filter((a: { texto: string }) => a.texto).slice(0, 3),
  }
}

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const mesNome = (ym: string) => MESES[Number(ym.slice(5, 7)) - 1] || ym
/** "hoje", "amanhã" ou "sex, 24/10". */
export function quando(data: string, today: string, tomorrow: string): string {
  if (data === today) return 'hoje'
  if (data === tomorrow) return 'amanhã'
  const wd = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(`${data}T12:00:00Z`).getUTCDay()]
  return `${wd}, ${data.slice(8, 10)}/${data.slice(5, 7)}`
}

/**
 * Avisos do Sobrou para a mensagem da manhã: contas que vencem hoje ou amanhã e o mês no vermelho.
 * Vazio = nada para avisar.
 */
export function sobrouAlerts(r: SobrouResumo, today: string, tomorrow: string): string[] {
  const out: string[] = []
  for (const v of r.vencimentos.filter(v => v.data === today || v.data === tomorrow))
    out.push(`💰 Vence ${v.data === today ? 'hoje' : 'amanhã'}: ${v.titulo} ${brl(v.valor)}${v.estimada ? ' (estimada)' : ''}`)
  if (r.sobraProjetada < 0) out.push(`⚠️ O mês está fechando no vermelho: faltam ${brl(-r.sobraProjetada)} (Sobrou, ${mesNome(r.mes)})`)
  return out
}
