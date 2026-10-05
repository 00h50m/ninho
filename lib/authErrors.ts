// Erros do login (Supabase Auth) em mensagens claras.
export function friendlyAuthError(msg: string | undefined): string {
  const m = msg || ''
  if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(m)) return 'Esta conta ainda não foi confirmada. No Supabase, confirme o usuário (Auto Confirm).'
  if (/password should be at least|weak password/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Espere um minuto e tente de novo.'
  if (/fetch|network|load failed/i.test(m)) return 'Sem conexão com o servidor. Confira a internet e tente de novo.'
  return 'Não foi possível entrar agora. Tente de novo.'
}
