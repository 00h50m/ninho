// Erros do login (Supabase Auth) em mensagens claras.
export function friendlyAuthError(msg: string | undefined): string {
  const m = msg || ''
  if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(m)) return 'Falta confirmar o e-mail: abra o link que mandamos (veja também o spam) e tente de novo.'
  if (/already registered|already exists/i.test(m)) return 'Esse e-mail já tem conta. Entre com ele ou use "Esqueci a senha".'
  if (/signups? (not allowed|disabled)/i.test(m)) return 'O cadastro está fechado no momento.'
  if (/invalid.*email|email.*invalid/i.test(m)) return 'Confira o e-mail digitado.'
  if (/password should be at least|weak password|password.*(short|weak)/i.test(m)) return 'A senha é fraca: use pelo menos 8 caracteres, misturando letras e números.'
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Espere um minuto e tente de novo.'
  if (/fetch|network|load failed/i.test(m)) return 'Sem conexão com o servidor. Confira a internet e tente de novo.'
  return 'Não foi possível entrar agora. Tente de novo.'
}
