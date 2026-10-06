# Redesign · Fase 5: Sprint do Ninho

Branch: `redesign-fase-5` (a partir da `main` b3beca8). **Sem merge automático.**

## O que é
Um mutirão curto com cronômetro, num cômodo ou objetivo. Exemplo de resumo: **"Sprint de 15 minutos — Cozinha · 2 tarefas concluídas · +3 XP"**.

## Fluxo
1. **Duração:** 10, 15 ou 25 min, ou outro valor (1 a 120).
2. **Cômodo ou objetivo:** casa toda, cozinha, banheiro, quarto, lavanderia, geral, cães ou compras, mais um objetivo opcional ("visita chegando").
3. **Participantes:** as duas, Giovanna ou Sabrina.
4. **Tarefas sugeridas** do cômodo:
   - pendentes, primeiro as de hoje e as essenciais, depois as rápidas;
   - as 4 primeiras vêm marcadas;
   - dá para trocar.
5. **Iniciar:** anel com o tempo restante.
6. **Pausar e continuar**, **+5 min** quando o tempo acaba, **encerrar**, ou **cancelar** (não conta nada).
7. **Marcar o que foi feito:** usa a mesma conclusão de sempre (com quem fez, XP idempotente, desfazer). Dá para adicionar tarefas no meio do sprint.
8. **Resumo:** título, tarefas concluídas e XP. Os últimos sprints ficam listados.

## Regras atendidas
- **Iniciar não dá XP.** O XP do resumo é calculado no servidor (`ninho_finish_sprint`): só tarefas do sprint concluídas no dia, somando o XP que **já foi registrado** por elas. Nada é criado a mais.
- **Sem duplicar:**
  - concluir de novo não gera outra conclusão;
  - encerrar duas vezes dá o mesmo resultado;
  - só um sprint ativo por casa.
- **Sair da tela sem perder o cronômetro:**
  - o tempo é calculado pelo horário (`started_at` + pausas somadas no servidor), não por um contador;
  - fechar a tela, recarregar o app, bloquear o celular ou abrir no outro aparelho mostra o mesmo tempo;
  - fora da tela, uma faixa "⏱ Sprint · Cozinha · 08:12 · Voltar" aparece em todas as áreas.
- **Tela bloqueada ou app em segundo plano:** ao voltar, o app recalcula o tempo e recarrega o sprint. Se o tempo já acabou, mostra "Tempo!".
- **Vibração e som:** só se a pessoa ligar (vibrar ligado por padrão, som desligado) e se o celular permitir. Avisa uma vez por sprint.
- **Acessibilidade:**
  - o tempo restante é anunciado para leitor de tela uma vez por minuto (não a cada segundo);
  - o anel respeita "reduzir movimento";
  - foco no título a cada etapa e Esc fecha;
  - o fundo não rola com o sprint aberto.
- **As duas veem o mesmo sprint** (Realtime).

## Migration 018 — `supabase/migrations/20261017120000_sprint.sql`
- **`sprints`:** um ativo por casa (índice único parcial). Guarda duração, cômodo, objetivo, participantes, tarefas, início, pausas, fim, tarefas concluídas e XP.
- **`ninho_sprint_pause`:** pausar e continuar pelo relógio do servidor, com +minutos.
- **`ninho_finish_sprint`:** encerrar (conta as tarefas concluídas e o XP real) ou cancelar. Idempotente.
- **Segurança por casa** e **Realtime**.
- **Não apaga nada** e pode rodar mais de uma vez.

### Procedimento (Supabase de produção)
1. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro (a primeira linha começa com `-- ═══`) → Run, sem nada selecionado.
2. **Conferência:**
   ```sql
   select to_regclass('public.sprints') is not null as sprints,
          to_regprocedure('public.ninho_finish_sprint(uuid,boolean)') is not null as encerrar,
          to_regprocedure('public.ninho_sprint_pause(uuid,boolean,integer)') is not null as pausar;
   ```
   O esperado é `true | true | true`.

Sem a 018, o atalho do Sprint não aparece e o resto funciona normalmente.

## Testes
- **Unitários:** 179/179. Novo: `tests/sprint.test.ts` (7), cobrindo:
  - cronômetro pelo horário;
  - pausas;
  - fim;
  - mm:ss;
  - sugestões por cômodo e prioridade;
  - formato do resumo.
- **Banco** (`supabase/tests/98-sprint.test.sql`), nos 3 cenários:
  - iniciar sem XP;
  - um ativo por casa;
  - conta só as tarefas do sprint, sem duplicar;
  - XP igual ao real;
  - encerrar de novo não muda o resultado;
  - cancelar soma a pausa e não conta XP;
  - pausar e continuar com +5 min;
  - outra casa não vê nem encerra;
  - sem login não executa.
- **Build:** ok.
- **Ponta a ponta** (login real, 011 ativa): **todas ok**:
  - montar;
  - iniciar sem XP;
  - concluir, desfazer e refazer sem duplicar;
  - pausar e continuar;
  - sair da tela, recarregar e continuar;
  - a Sabrina vê o mesmo sprint no celular;
  - relógio adiantado 11 min mostra "Tempo!";
  - +5 min;
  - resumo com o XP real;
  - XP total sem nada extra;
  - histórico;
  - cancelar sem XP;
  - celular sem rolagem lateral;
  - nenhum erro de página.
- **Regressão das Fases 1 a 4 e dos modelos da casa:** ok. Dois testes antigos foram ajustados: agora são 10 atalhos, e a contagem de segunda vem do banco.

## Limites
- **Sem aviso com o app fechado:** com o app totalmente fechado, o celular não avisa no fim do tempo. O aviso aparece ao abrir. Notificação de fim de sprint fica para a etapa de notificações.

## Como desfazer
- **App:** não mesclar, ou `git revert`.
- **Banco (opcional):** apaga só os sprints, sem mexer em tarefas nem em XP.
  ```sql
  drop function if exists public.ninho_finish_sprint(uuid,boolean);
  drop function if exists public.ninho_sprint_pause(uuid,boolean,integer);
  drop table if exists public.sprints;
  ```
