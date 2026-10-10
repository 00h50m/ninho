# Etapa 1: Sono completo e "Parar de…"

Branch: `sono-parar`, feita a partir da `main` 66ac6fe. **Sem merge automático.**

Tudo fica no **Meu dia**, é **por pessoa** e é **privado por padrão**. A outra só vê se a dona ligar o compartilhamento em "Metas e privacidade".

## Sono completo (aba Hoje)
- **Anel da noite:** depois de registrar, mostra as horas dormidas e a % da meta, mais o horário, a qualidade e o botão "refazer".
- **Registrar minha noite:** o mesmo formulário de antes (dormi / acordei / qualidade), agora dentro do painel.
- **Números da semana**, sempre dos últimos 7 dias:

  | Número | O que é |
  |---|---|
  | Média da semana | média das noites registradas |
  | Melhor noite | a noite mais longa e a data |
  | Noites na meta | noites seguidas na meta; hoje conta se já registrou, senão conta desde ontem. Também aparece como selo no título |
  | Dívida de sono | soma do que faltou para a meta nas noites registradas |

- **Gráfico da semana:**
  - uma barra por noite, com o valor escrito;
  - linha tracejada da meta;
  - "hoje" em destaque;
  - detalhe ao passar o dedo, o mouse ou o teclado;
  - "Ver valores" abre a tabela.
- **Dívida de 3 h ou mais:** aparece uma dica curta para dormir um pouco mais cedo.

## "Parar de…"
- **Cadastro:** em "Metas e privacidade", com o hábito ("refrigerante", "celular na cama") e, se quiser, o motivo. O contador começa no dia do cadastro.
- **Cartão na aba Hoje**, para cada hábito:
  - **dias** sem o hábito;
  - **recorde**: o maior trecho já feito;
  - recaídas nos últimos 30 dias;
  - o motivo, para lembrar por que começou.
- **"Tive uma recaída":**
  - o texto é acolhedor;
  - a observação é opcional;
  - o contador recomeça hoje e **o recorde fica**.
- **Encerrar:** tira o hábito da lista e guarda o histórico.
- **Compartilhar "Parar de…":** a outra vê o hábito e os dias no resumo "… hoje". Ela também vê as datas das recaídas e as observações. O formulário da recaída avisa isso.

## Migration 025: `supabase/migrations/20261024120000_parar_de.sql`
- **`personal_quits`:** os hábitos (quem, título, motivo, desde quando, ativo).
- **`personal_logs`:** passa a aceitar o tipo `parar` (as recaídas). Só a regra de tipos muda; nenhum registro é alterado.
- **Privacidade:** igual ao resto do Meu dia.
  - Só a dona grava.
  - A outra só lê se a dona compartilhar `parar`.
  - Outra casa e quem não fez login não veem nada.
- **Tempo real ligado.** Termina recarregando a lista de tabelas (`notify pgrst`).
- **Pode rodar mais de uma vez. Não apaga nada.**
- **Sem a migration, o app continua funcionando:** o Sono completo aparece normalmente; só o "Parar de…" fica escondido.

A `011` (segurança por casa), o rollback e a pós-checagem também passaram a conhecer a tabela nova.

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro (a primeira linha começa com `-- ═══`) → Run.
3. **Conferência:**
   ```sql
   select to_regclass('public.personal_quits') is not null as tabela,
          (select count(*) from pg_policies where tablename = 'personal_quits') as politicas,
          (select count(*) from pg_constraint where conname = 'personal_logs_kind_check2') as regra_tipos;
   ```
   O esperado é `true | 2 | 1`.

## Testes
- **Unitários:** 250/250. Novos em `tests/meudia.test.ts`:
  - semana de sono: média, melhor noite, sequência na meta e dívida;
  - contador, recorde e recaídas do "Parar de…".
- **Banco** (`supabase/tests/99g-parar.test.sql`), nos 3 cenários:
  - a dona cria o hábito e a recaída;
  - tipo desconhecido recusado;
  - a outra não vê, não cria e não altera;
  - compartilhar libera a leitura na hora;
  - outra casa e sem login: nada.
- **Ponta a ponta** (`r14`), com as duas pessoas logadas. **Todas ok**:
  - **semana de sono:** formulário, 3 noites na meta, 6 barras e hoje vazio;
  - **depois de registrar 8 h:**
    - anel em 100%;
    - 4 noites na meta;
    - média 7,8 h, melhor noite 8,5 h, dívida 2,5 h;
    - 7 barras com valor;
    - linha da meta, detalhe ao passar o mouse e tabela;
  - **"Parar de…":**
    - cadastro gravado;
    - 5 dias com recorde 15;
    - a recaída grava a observação, o contador volta a 0 e o recorde fica em 15;
  - **privacidade:**
    - a Sabrina não vê nada até a Giovanna compartilhar e depois vê o contador;
    - o hábito da Sabrina não aparece para a Giovanna;
  - **encerrar:** mantém o histórico;
  - **celular:** sem rolagem lateral, inclusive com o texto no maior tamanho;
  - **acessibilidade (axe):** zero problemas no computador, no celular com texto maior, no tema Noturno e com alto contraste.
- **Regressão:** r1–r13. O r9 foi atualizado: agora são 4 tabelas privadas no Meu dia.

## Como desfazer
- **App:** não mesclar, ou `git revert`.
- **Banco (opcional):** `drop table if exists public.personal_quits;`. As recaídas ficam em `personal_logs` com o tipo `parar` e podem ser apagadas com `delete from public.personal_logs where kind = 'parar';`.
