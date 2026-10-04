import { supabase } from '@/lib/supabase'
import { throwIfError } from '@/lib/errors'

export async function initializeAnonymousHousehold() {
  const sessionResult = await supabase.auth.getSession()
  throwIfError('carregar sessão', sessionResult.error)

  let session = sessionResult.data.session
  if (!session) {
    const signInResult = await supabase.auth.signInAnonymously()
    throwIfError('iniciar sessão anônima', signInResult.error)
    session = signInResult.data.session
  }

  if (!session) {
    throw new Error('A sessão anônima não foi criada.')
  }

  const userId = session.user.id
  const profileResult = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', userId)
    .maybeSingle()
  throwIfError('carregar perfil', profileResult.error)

  let householdId = profileResult.data?.household_id as string | undefined

  if (!householdId) {
    const existingResult = await supabase
      .from('households')
      .select('id')
      .limit(1)
      .maybeSingle()
    throwIfError('localizar casa', existingResult.error)

    householdId = existingResult.data?.id

    if (!householdId) {
      const createResult = await supabase
        .from('households')
        .insert({ name: 'Ninho' })
        .select('id')
        .single()
      throwIfError('criar casa', createResult.error)
      householdId = createResult.data?.id
    }

    if (!householdId) {
      throw new Error('A casa não foi criada.')
    }

    const profileUpsert = await supabase.from('profiles').upsert({
      id: userId,
      household_id: householdId,
      name: 'Integrante',
      display_name: 'Integrante',
      role: 'g',
    })
    throwIfError('salvar perfil', profileUpsert.error)
  }

  return householdId
}

