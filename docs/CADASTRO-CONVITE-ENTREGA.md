# E2: cadastro pelo app, convite por link e casa de 1 pessoa

## Como funciona para quem chega

1. **Criar conta** (tela de entrada): e-mail, senha (mínimo 8 caracteres) e repetir a senha.
   - Se o Supabase pede confirmação de e-mail, a tela avisa: "Mandamos um e-mail…". Depois de confirmar, a pessoa entra normalmente.
2. **Criar minha casa:** a pessoa informa o próprio nome e o nome da casa (opcional).
   - A casa nasce **de 1 pessoa**, com **IA e Sobrou desligados** (E1).
   - Em seguida abre a configuração inicial, que já pergunta "têm pet?".
3. **Convidar a segunda pessoa:** em Ajustes › Integrantes › **Gerar link de convite**, com os botões Compartilhar (WhatsApp) e Copiar.
   - O link vale **7 dias** e serve **uma vez**.
   - Gerar outro cancela o anterior.
4. **Quem abre o link:** a tela de entrada mostra "**Ana** te convidou para a casa **Casa da Ana**" e já começa em "Criar conta".
   - Depois de criar a conta, "Tenho um convite" já vem preenchido. A pessoa só escreve o nome e toca em **Entrar na casa**.
   - A casa passa a ser de 2 pessoas, e rodízio, divisão e placar ligam sozinhos.
5. **Quem já tem conta e ainda não tem casa:** pode colar o link em "Tenho um convite".

## Casa de 1 pessoa

- **Tarefas e cães:** tudo é da única pessoa da casa. Não há rodízio nem divisão, e os compromissos não passam tarefas para a outra pessoa.
  - Isso vale no app e no servidor: lembretes, Telegram, plano da semana e bom dia.
- **O que muda nas telas:**

  | Tela | Na casa de 1 pessoa |
  |---|---|
  | Início | uma coluna só, sem a troca entre as duas pessoas |
  | Nós | sem "Juntas" e sem "Equilíbrio" |
  | Configuração inicial | só o seu nome |
  | Tarefa | sem "Responsável" |
  | Telegram | só a sua linha |
  | Reunião | só o seu humor |

## Segurança

- **Uma casa por conta.** Ninguém entra numa casa sem convite, e só quem é da casa gera convite.
- **Convite:** uma vez só, dentro do prazo, e só enquanto a vaga estiver livre.
- **Tabela de convites:** o app não lê. Tudo passa por funções que conferem quem pede.
- **Antes de entrar,** o convite mostra só o nome da casa e de quem convidou.
- **Casa criada pelo app:** nunca vem com IA ou Sobrou ligados (trava da E1).

## Migration 047 (rodar no Supabase)

- **Arquivo:** `supabase/migrations/20261115120000_cadastro_convite.sql`.
- **É segura:** não destrutiva e pode rodar mais de uma vez.
- **Conferência:** **5** (a tabela de convites e as 4 funções).

## Configuração no Supabase (painel, sem SQL)

Em **Authentication**:
- **Sign In / Providers › Allow new users to sign up:** ligado.
- **Confirm email:** recomendado ligado.
- **URL Configuration › Site URL:** o endereço do app, para o link do e-mail voltar para ele.

## Arquivos

- **Banco:** `supabase/migrations/20261115120000_cadastro_convite.sql`.
- **Convite e cadastro:** `lib/convite.ts`, `lib/services/conta.ts`.
- **Telas:** `components/LoginScreen.tsx` (Criar conta e a tela da casa) e `components/ConviteCard.tsx`.
- **Casa de 1 pessoa:** `lib/today.ts` (`planToday` com `solo`) e `lib/modulos.ts` (`solo`, `peopleOf`). As telas foram ajustadas conforme a tabela acima.

## Testes

- **Unitários:** `tests/cadastro.test.ts`.
- **Banco:** `supabase/tests/99zzzz-cadastro.test.sql`, nos 3 cenários.
- **Ponta a ponta:** r59 cobre criar conta, criar a casa, configuração de 1 pessoa, Início e Nós de 1 pessoa, convite, Bia entrando pelo link e convite usado recusado.
- **Regressão:** r53–r59.
