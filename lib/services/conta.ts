// Cadastro pelo app (047): criar conta, criar a casa, convidar e aceitar convite.
import { supabase } from '@/lib/supabase'
import { toNinhoError } from '@/lib/errors'

/** Cria a conta. Sem sessão na volta = o Supabase pede para confirmar o e-mail antes. */
export async function signUp(email: string, password: string): Promise<{ session: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined } })
  if (error) throw error
  return { session: !!data.session }
}

const rpc = async <T>(fn: string, args: Record<string, unknown>, ctx: string): Promise<T> => {
  const r = await supabase.rpc(fn, args)
  if (r.error) {
    const e = toNinhoError(r.error, ctx)
    // as funções do cadastro explicam o motivo ("esta conta já tem uma casa", "convite vencido…")
    const m = String(r.error.message || '').match(/NINHO_[A-Z_]+: (.+)$/)
    if (m) e.userMessage = m[1].charAt(0).toUpperCase() + m[1].slice(1) + (/[.!?]$/.test(m[1]) ? '' : '.')
    throw e
  }
  return r.data as T
}

export const createHousehold = (houseName: string, myName: string) => rpc<string>('ninho_create_household', { p_house_name: houseName, p_display_name: myName }, 'criar a casa')
export const createInvite = (householdId: string) => rpc<string>('ninho_create_invite', { p_household_id: householdId }, 'gerar convite')
export const acceptInvite = (code: string, myName: string) => rpc<string>('ninho_accept_invite', { p_code: code, p_display_name: myName }, 'entrar na casa')

/** Nome da casa e de quem convidou (antes de entrar). null = convite inválido, usado ou vencido. */
export async function inviteInfo(code: string): Promise<{ house: string, from: string } | null> {
  const r = await supabase.rpc('ninho_invite_info', { p_code: code })
  if (r.error) throw toNinhoError(r.error, 'ver o convite')
  return (r.data as any) || null
}
