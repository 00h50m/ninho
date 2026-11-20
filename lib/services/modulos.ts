// Módulos da casa (migration 046): o que a casa usa. Sem a coluna, tudo como sempre foi.
import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/errors'
import { LEGACY, featuresOf, type Features } from '@/lib/modulos'

export async function loadFeatures(householdId: string): Promise<Features> {
  const r = await supabase.from('households').select('features').eq('id', householdId).maybeSingle()
  if (r.error) {
    if (r.error.code === '42703' || /features/.test(r.error.message)) return LEGACY
    logError('carregar módulos da casa', r.error); return LEGACY
  }
  return featuresOf((r.data as any)?.features)
}

/** A casa escolhe se tem pets (aba Cães). IA e Sobrou não mudam por aqui. */
export async function setPets(householdId: string, on: boolean): Promise<Features> {
  const r = await supabase.rpc('ninho_set_feature', { p_household_id: householdId, p_key: 'pets', p_on: on })
  if (r.error) throw r.error
  return featuresOf(r.data)
}
