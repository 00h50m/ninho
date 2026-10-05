# Redesign · Fase 4: Rotinas (checklist) e Hábitos

Branch: `redesign-fase-4`, criada **a partir da `redesign-fase-3`**, que ainda não foi mesclada. Mesclar a 3 antes, ou as duas juntas. **Sem merge automático.**

## O que já existia
- **Tarefas:** com prazo, atraso, rodízio, pular e adiar.
- **Rotinas com passos (cadastro):** criadas na configuração (014), só para leitura.
- **Rotinas dos cães:** à parte, em `dog_routines`.
- **Aba Hábitos:** existia vazia.

## Três conceitos, três comportamentos
| | Tarefa | Rotina | Hábito |
|---|---|---|---|
| O que é | Tem começo e fim | Passos num momento do dia | Comportamento para ganhar constância |
| Atraso | Pode atrasar | Não acumula: uma ocorrência por dia | **Nunca vira atraso**: o dia fica "sem registro" |
| Conclusão | Feita ou não | Parcial (passo a passo) ou inteira; reabrir | Registro do dia (desfazer) |
| Quem fez | `completed_by` | Cada passo guarda quem marcou; a rotina guarda quem concluiu | Cada registro guarda quem fez |
| Sobrevivência | Só essenciais | **Versão reduzida**: só os passos 🛡 | Pausa |
| Meta | Frequência | Dias e horário | Dias certos **ou** X vezes por semana, com sequência |

## O que foi criado
- **Minhas rotinas** (`components/rotinas/RoutinesView.tsx`):
  - checklist de hoje, com quem marcou cada passo (avatar), progresso e "Concluir rotina";
  - quando concluída, mostra quem concluiu e permite "Reabrir";
  - histórico dos últimos 7 dias (concluída, em parte, não feita, não era dia);
  - no rodízio, mostra de quem é a vez hoje;
  - seção "Outros dias e pausadas".
- **Construtor de rotina** (`components/rotinas/Editors.tsx`):
  - nome, descrição, categoria, dias, horário, duração;
  - quem faz: as duas, rodízio, Giovanna ou Sabrina;
  - essencial;
  - passos: ordenar (↑↓), 🛡 e remover;
  - data inicial, pausa até e lembrete (fica guardado para quando houver notificação de rotina);
  - arquivar.
  - Passo removido e rotina arquivada **guardam o histórico**.
- **Modelos:** catálogo com 10 rotinas, incluindo as novas "Reset da sala" e "Organização de 10 minutos".
  - O que já existe aparece como "já existe" e não duplica.
  - Uma rotina arquivada volta com o histórico se for adicionada de novo.
- **Hábitos** (`components/rotinas/HabitsView.tsx`):
  - de quem é: as duas, Giovanna ou Sabrina;
  - dias certos ou X vezes por semana;
  - progresso da semana e sequência (🔥 em dias ou semanas);
  - últimos 7 dias, com dia livre neutro;
  - "Fiz hoje" com quem fez, e desfazer;
  - pausar;
  - **abandonar sem apagar o histórico**;
  - sugestões: preparar o dia seguinte, reset rápido da sala, 5 minutos de organização, água dos cães.
- **Início:** o cartão "Rotina agora" mostra o progresso do checklist.

## Migration 016 — `supabase/migrations/20261015120000_rotinas_habitos.sql`
- **`routines`:** + `start_date`, `paused_until`, `reminder_min`.
- **`routine_steps`:** + `active` (passo arquivado).
- **`routine_runs`:** uma ocorrência por rotina por dia.
- **`routine_step_checks`:** passo marcado, com quem fez.
- **`habits`:** os hábitos.
- **`ninho_habit_logs`:** um registro por hábito por dia.
- **Funções:**
  - `ninho_routine_step`: marca ou desmarca um passo;
  - `ninho_routine_finish`: conclui ou reabre;
  - quem fez é sempre a conta logada;
  - aceita só os últimos 7 dias;
  - no modo sobrevivência, conclui com os passos 🛡.
- **Segurança por casa** e **Realtime** nas 4 tabelas novas.
- **Não apaga nada** e pode rodar mais de uma vez.

### Procedimento (Supabase de produção)
Aplicar **a 015 (Fase 3) antes**, se ainda não foi.
1. **Backup** (opcional, só acrescenta): `supabase/scripts/export-data-json.sql`.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro → Run, sem nada selecionado.
3. **Conferência:**
   ```sql
   select to_regclass('public.routine_runs') is not null as ocorrencias,
          to_regclass('public.ninho_habits') is not null as habitos,
          to_regprocedure('public.ninho_routine_step(uuid,uuid,date,text,boolean,boolean)') is not null as funcao,
          (select count(*) from pg_policies where tablename in ('routine_runs','routine_step_checks','ninho_habits','ninho_habit_logs') and policyname = 'household_member') as regras;
   ```
   O esperado é `true | true | true | 4`.

Sem a 016, as rotinas aparecem só para leitura e a aba Hábitos avisa que falta atualizar o banco.

## Testes
- **Typecheck:** ok.
- **Unitários:** 172/172. Novo: `tests/rotinas.test.ts` (9), cobrindo:
  - dias, data inicial e pausa;
  - versão reduzida;
  - conclusão parcial;
  - histórico;
  - rodízio alternando por dia;
  - hábito perdido não vira atraso;
  - sequência em dias e em semanas;
  - pausa.
- **Banco** (`supabase/tests/97-rotinas-habitos.test.sql`), nos 3 cenários:
  - parcial, desfazer, concluir e reabrir, com o histórico mantido;
  - quem fez vem da conta;
  - versão reduzida;
  - uma ocorrência por dia;
  - passo arquivado: sai da conta e mantém a marca;
  - hábito: um registro por dia, meta entre 1 e 7, abandono mantém o histórico;
  - outra casa não vê nem conclui;
  - sem login não executa;
  - rotina não mexe em tarefas.
- **Build:** ok.
- **Ponta a ponta** (login real, 011 ativa): **todas ok**:
  - modelos sem duplicar;
  - checklist com quem fez, desfazer, concluir e reabrir;
  - construtor com reordenar, rodízio e essencial;
  - remover passo guarda o histórico;
  - pausa;
  - modo sobrevivência mostra só 🛡;
  - hábito com meta semanal, "fiz hoje", desfazer e abandonar sem perder o histórico;
  - hábito não aparece em Para agora;
  - nenhuma tarefa alterada;
  - a Sabrina vê e marca pelo celular;
  - celular sem rolagem lateral;
  - nenhum erro de página.
- **Regressão das Fases 1, 2 e 3:** ok.

## Fica para depois
- **Lembrete da rotina:** o campo já é guardado. O aviso chega na etapa de notificações.
- **XP:** rotinas e hábitos ainda não dão XP. Antes disso, é preciso decidir junto com a fase Nós (meta conjunta).

## Como desfazer
- **App:** não mesclar, ou `git revert`.
- **Banco (opcional):** apaga só o checklist e os hábitos.
  ```sql
  drop function if exists public.ninho_routine_finish(uuid,date,text,boolean,boolean);
  drop function if exists public.ninho_routine_step(uuid,uuid,date,text,boolean,boolean);
  drop function if exists public.ninho_routine_refresh(uuid,text);
  drop function if exists public.ninho_actor(uuid,text);
  drop table if exists public.routine_step_checks;
  drop table if exists public.routine_runs;
  drop table if exists public.ninho_habit_logs;
  drop table if exists public.ninho_habits;
  ```

## Complemento: "Salvar como modelo" (migration 017)
- **No editor de rotina:** o botão **Salvar como modelo** guarda a rotina (dias, horário, quem faz, passos com 🛡) em `routine_templates`.
  - Salvar de novo com o mesmo nome **atualiza** o modelo e não cria outro.
- **Em Rotinas › Modelos:**
  - a seção **Da casa** fica acima dos modelos do Ninho e aparece para as duas;
  - "Adicionar" cria a rotina;
  - se já existe uma rotina com o mesmo nome, aparece "já existe";
  - 🗑 apaga só o modelo, e as rotinas criadas com ele continuam.
- **Migration** `supabase/migrations/20261016120000_modelos_da_casa.sql`: tabela com segurança por casa e Realtime. Não apaga nada e pode rodar de novo.
  - Sem ela, o botão não aparece e o resto funciona.
- **Testes:**
  - banco: mesmo nome atualiza, e outra casa não vê;
  - ponta a ponta: salvar, usar, não duplicar, atualizar, a Sabrina vê no celular, apagar mantém a rotina.
- **Conferência:** `select to_regclass('public.routine_templates') is not null;` deve dar `true`.
