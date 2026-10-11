// Faxinão com IA (SÓ servidor): organiza o mutirão a partir do que a pessoa escreveu ou falou.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Who } from '@/lib/types'
import { FAX_SCHEMA, FAX_SYSTEM, faxContext, fmtMin, faxTotals, validateFax, type FaxPlan, type FaxWho } from '@/lib/faxinao'
import { DEFAULT_NAMES } from '@/lib/constants'
import { ask, type AiOpts } from './nutritionAi'
import { must } from './notify'

export const FAX_DAILY_LIMIT = 20
type Fail = { ok: false, status: number, message: string }

export async function planFax(db: SupabaseClient, householdId: string, req: { text: string, who: FaxWho, minutes: number | null }, opts: AiOpts = {}): Promise<{ ok: true, plan: FaxPlan } | Fail> {
  const since = new Date((opts.now ?? new Date()).getTime() - 24 * 3600 * 1000).toISOString()
  const used = must(await db.from('ai_log').select('id').eq('household_id', householdId).eq('kind', 'faxinao').gte('created_at', since), 'uso da IA') as any[]
  if (used.length >= FAX_DAILY_LIMIT) return { ok: false, status: 429, message: `Limite de ${FAX_DAILY_LIMIT} faxinões organizados por dia. Tente amanhã.` }
  const [profiles, dogs] = await Promise.all([
    db.from('profiles').select('display_name,role').eq('household_id', householdId),
    db.from('dogs').select('name').eq('household_id', householdId).eq('active', true),
  ])
  const p = (profiles.data || []) as any[]
  const names = { g: p.find(x => x.role === 'g')?.display_name || DEFAULT_NAMES.g, s: p.find(x => x.role === 's')?.display_name || DEFAULT_NAMES.s }
  const r = await ask(db, householdId, 'faxinao', opts, {
    system: FAX_SYSTEM, schema: FAX_SCHEMA, effort: 'low', maxTokens: 6000,
    content: [{ type: 'text', text: faxContext({ text: req.text, names, who: req.who, minutes: req.minutes, dogs: ((dogs.data || []) as any[]).map(d => d.name) }) }],
  })
  if (r.ok === false) return r
  const plan = validateFax(r.json, req.who)
  if (!plan) return { ok: false, status: 422, message: 'Não consegui montar o faxinão com esse texto. Liste o que precisa ser feito (ex.: banheiro, cozinha, roupa de cama).' }
  return { ok: true, plan }
}

/** Telegram: "faxinão: …" vira um rascunho no app (para conferir e começar lá). */
export async function faxFromTelegram(db: SupabaseClient, link: { household_id: string, who: Who }, text: string, opts: AiOpts = {}): Promise<string> {
  const body = text.replace(/^\s*(faxin[aã]o|mutir[aã]o)\s*[:\-–]?\s*/i, '').trim()
  if (body.length < 3) return 'Me diga o que precisa ser feito, por exemplo: "faxinão: banheiro, cozinha, roupa de cama, quintal".'
  const r = await planFax(db, link.household_id, { text: body, who: 'both', minutes: null }, opts)
  if (r.ok === false) return (r as { message: string }).message
  const ins = await db.from('faxinoes').insert({ household_id: link.household_id, title: r.plan.title, steps: r.plan.steps, tips: r.plan.tips, status: 'rascunho', created_by: link.who })
  if (ins.error) return 'Montei o plano, mas não consegui guardar agora (o faxinão precisa da atualização do banco). Tente pelo app.'
  const t = faxTotals(r.plan.steps), tag = (w: FaxWho) => w === 'both' ? 'as duas' : w === 'g' ? 'G' : 'S'
  const lines = r.plan.steps.slice(0, 18).map((s, i) => `${i + 1}. [${tag(s.who)}] ${s.title} · ${s.min} min${s.wait ? ' ⏳' : ''}`)
  return [`🧹 ${r.plan.title} · cerca de ${fmtMin(t.total)}`, ...lines, r.plan.steps.length > 18 ? `… e mais ${r.plan.steps.length - 18}` : '', '', 'Está como rascunho no app: Casa › Faxinão, para conferir e tocar em ▶ Começar.']
    .filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n')
}

