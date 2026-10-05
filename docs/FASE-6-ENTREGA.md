# Fase 6 — Login e segurança por casa: entrega

Branch: `fase-6-login`, criada a partir da `main` (Fases 0–5). Sem merge na `main` e sem deploy.

## O que foi feito

| Item | Como funciona |
|---|---|
| **Entrar com e-mail e senha** | O app abre na tela de entrada. As contas são criadas no painel do Supabase; o app não tem cadastro. Depois de entrar, o celular lembra a conta. |
| **Quem fez o quê** | Vem da conta: não existe mais a pergunta “quem está usando este aparelho”. Em Ajustes › **Sua conta** aparecem o e-mail e o botão **Sair**. |
| **Esqueci a senha** | O app envia um link por e-mail. Abrir o link mostra a tela de senha nova. |
| **Conta sem casa** | Se uma conta entrar sem estar ligada à casa, o app mostra exatamente qual comando rodar no SQL Editor. |
| **Segurança por casa** (migration 011) | Só quem é da casa lê e altera os dados. Antes, qualquer pessoa com o app (login anônimo) acessava tudo. O bom dia, o Telegram e a IA continuam funcionando, porque usam a chave do servidor. |
| **Telegram das duas** | Ajustes › Telegram mostra as duas pessoas. **Conectar** liga o seu Telegram. **Gerar convite** cria o link da outra, para mandar pelo WhatsApp (ou copiar). O cartão mostra quando ela conecta. |
| **IA** | A conferência de “é desta casa” passou a usar as contas. |
| **Sem internet** | Continua abrindo com os dados guardados da última conta usada no aparelho. |

## Banco

- **010 · `20261011120000_login_membros.sql`** (etapa A, sem risco):
  - cria `household_members`, que liga cada conta a uma casa e a uma pessoa (g ou s);
  - cria `ninho_link_member(e-mail, 'g'|'s')`, que só funciona pelo SQL Editor; o app não consegue se ligar sozinho a uma casa;
  - cria `ninho_is_member`;
  - o app antigo continua funcionando.
- **011 · `20261011120100_rls_por_casa.sql`** (etapa B): troca as regras de acesso de todas as tabelas para “só membros da casa”. Não apaga dados. Para desfazer, use `supabase/scripts/rollback-rls-por-casa.sql`.

## O que você precisa fazer (nesta ordem)

1. **Criar as duas contas:** Supabase › **Authentication › Users › Add user › Create new user**. Informe e-mail e senha e marque **Auto Confirm User**. Faça uma para você e outra para a Sabrina.
2. **SQL Editor:** rode a migration `20261011120000_login_membros.sql`.
3. **SQL Editor:** ligue as contas, trocando pelos e-mails reais:
   ```sql
   select public.ninho_link_member('seu-email@...', 'g');
   select public.ninho_link_member('email-da-sabrina@...', 's');
   ```
   Cada linha deve responder `ok: ... ligada à casa como ...`.
4. **Link do “esqueci a senha”:** Authentication › **URL Configuration** › **Site URL** = `https://ninho-ten.vercel.app`.
5. **Merge e deploy.**
6. **Nos dois celulares:** abra o app, entre com e-mail e senha e confira se tudo aparece.
7. **Fechar as portas antigas:** Authentication › **Sign In / Providers** (ou Settings):
   - desligue **Allow anonymous sign-ins**;
   - desligue **Allow new users to sign up**. Com isso, só as contas criadas por você entram.
8. **SQL Editor:** rode a migration `20261011120100_rls_por_casa.sql`. Depois rode a conferência (`post-migration-check.sql`) e confira estes dois itens:
   - “segurança por casa (011)” deve sair `ok`;
   - “contas da casa” deve mostrar `Giovanna e Sabrina ligadas`.

Se algo travar depois do passo 8, rode `supabase/scripts/rollback-rls-por-casa.sql`. Ele volta à regra antiga sem apagar nada.

## Resultados

- `npm run typecheck`: sem erros.
- `npm test`: 137 testes passando.
- `npm run test:db`: tudo passando nos 3 cenários. A 011 é aplicada por último, duas vezes, e desfeita e refeita no cenário legado. Os testes da 011 conferem que:
  - cada conta vê e altera só a própria casa;
  - não é possível concluir nem criar nada em outra casa;
  - conta sem casa e sessão anônima antiga não veem nada;
  - o servidor continua com acesso;
  - trocar a conta de uma pessoa substitui a ligação antiga;
  - não sobrou nenhuma regra “qualquer um acessa”.
- `npm run build`: sem erros.
- **Ponta a ponta** (modo produção, login com senha imitando o Supabase): 25 verificações ok, nenhum erro de página.
  - Entrada: tela de entrada; senha errada; conta sem casa; sair.
  - Uso logado: entrar sem a pergunta do aparelho; “feito por” vindo da conta.
  - Segurança: 011 aplicada com o app aberto, que continua funcionando; a sessão anônima antiga não lê mais nada.
  - Duas contas: Sabrina em outro celular vê o que a Giovanna fez.
  - Telegram: convite da Sabrina gerado pela Giovanna e ligado.
  - IA funcionando com a conta.
  - Sair; esqueci a senha; tela de senha nova.

## Observações

- **Os perfis “Integrante” antigos** (das sessões anônimas) continuam no banco. Depois da 011 eles não têm acesso a nada. A limpeza entra na Fase 7.
- **O app instalado nos celulares** pede login na primeira abertura depois do deploy. É uma vez só.
- **Notificações e Telegram** continuam ligados. Eles pertencem ao aparelho e à pessoa, não à sessão.
- **Não testado com o Supabase Auth de verdade.** O login foi testado com uma imitação local das mesmas chamadas. A confirmação vem no passo 6.

## Como desfazer

- **Banco:** `rollback-rls-por-casa.sql` desfaz a 011.
- **App:** promova o deploy anterior na Vercel. Isso só funciona se a 011 não tiver sido aplicada, ou se ela foi desfeita, porque o app antigo usa login anônimo. Antes de voltar, ligue de novo **Allow anonymous sign-ins**.
