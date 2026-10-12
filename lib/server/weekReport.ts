// Dados do resumo da semana do Meu dia de UMA pessoa (SÓ servidor: chave service_role).
// Vai só para o Telegram dela; nada da outra pessoa entra.
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays } from '@/lib/dates'
import { calorieTarget } from '@/lib/nutricao'
import { proteinTarget } from '@/lib/protein'
import { bodySeries } from '@/lib/meudia'
import { weekReport } from '@/lib/weekReport'
import type { Who } from '@/lib/types'

/** As linhas do resumo (vazio quando o Meu dia não existe ou nada foi registrado). */
export async function meuDiaWeekLines(db: SupabaseClient, householdId: string, who: Who, today: string): Promise<string[]> {
  const from = addDays(today, -60)
  const [l, s, m, pr] = await Promise.all([
    db.from('personal_logs').select('id,who,date,kind,value,data,created_at').eq('household_id', householdId).eq('who', who).gte('date', from).limit(4000),
    db.from('personal_settings').select('water_goal_ml,sleep_goal_h').eq('household_id', householdId).eq('who', who).maybeSingle(),
    db.from('daily_checkins').select('date,mood').eq('household_id', householdId).eq('who', who).gte('date', addDays(today, -14)),
    db.from('personal_food_profile').select('*').eq('household_id', householdId).eq('who', who).maybeSingle(),
  ])
  if (l.error) return []
  const logs = ((l.data || []) as any[]).map(x => ({ ...x, value: x.value == null ? null : Number(x.value) }))
  const prof = pr.error ? null : pr.data as any
  const w = bodySeries(logs, who, 'weight').pop()?.v ?? null
  const kcal = prof && w ? calorieTarget({ ...prof, height_cm: Number(prof.height_cm), pace_kg_week: Number(prof.pace_kg_week), target_kg: prof.target_kg == null ? null : Number(prof.target_kg) }, w, Number(today.slice(0, 4))).kcal : null
  const protein = prof && w ? proteinTarget({ goal: prof.goal, target_kg: prof.target_kg == null ? null : Number(prof.target_kg), protein_g_kg: prof.protein_g_kg == null ? null : Number(prof.protein_g_kg) }, w).g : null
  return weekReport({
    logs, who, today, moods: m.error ? [] : (m.data || []) as any[],
    waterGoal: Number((s.data as any)?.water_goal_ml) || 2000, sleepGoal: Number((s.data as any)?.sleep_goal_h) || 8,
    kcalTarget: kcal, proteinTarget: protein, hideNumbers: !!prof?.hide_numbers,
  })
}
