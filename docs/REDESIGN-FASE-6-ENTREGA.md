# Redesign · Fase 6: Casa completa

Branch: `redesign-fase-6`, criada a partir da `redesign-fase-5`, que ainda não foi mesclada. **Sem merge automático.**

Casa passa a ter 4 abas: **Tarefas · Compras · Manutenção · Agenda**. No celular, as quatro ficam em grade 2×2.

## Tarefas
- **Já existia:** busca, filtros, esforço, frequência, prazo, responsável, rodízio, adiar e pular.
- **Prioridade** (alta, normal, baixa), separada de "essencial". Filtro "↑ Alta prioridade".
- **Checklist** dentro da tarefa (até 30 itens):
  - em tarefa recorrente, volta em branco a cada conclusão (gatilho no banco);
  - em tarefa pontual, fica como foi feito.
- **Observações** (até 500 caracteres).
- **Pedir ajuda** (menu ⋯ / ⏭ da tarefa):
  - a outra vê "🙋 Giovanna pediu ajuda: …" em **Para agora**, com um toque para abrir;
  - concluir atende o pedido automaticamente;
  - filtro "🙋 Pedidos de ajuda".
- **Histórico** no editor: últimas conclusões (com quem fez), pulos e adiamentos.

## Compras
- **Já existia:** item, quantidade, categoria por corredor, tempo real, riscar e reabrir, inclusão rápida, comprar de novo.
- **Novo editor do item** (✎):
  - quantidade e **unidade**;
  - corredor;
  - **⚠ está acabando** e **↑ prioridade**: sobem no corredor;
  - **quem compra**;
  - **recorrência**: o item comprado volta sozinho para a lista depois de N dias, sem duplicar se já estiver lá;
  - observação.

## Manutenção
- **Já existia:** item, última e próxima execução, recorrência, responsável, observação.
- **Novos campos:**
  - **prestador**;
  - **garantia até** (avisa quando vence);
  - **custo opcional**;
  - **comprovante ou link** (só https).

## Agenda da casa (nova)
- **Tipos de evento:** consultas dos cães, visitas, entregas, serviços, compromissos da casa. Cada um com data, horário, quem vai, observação e link.
- **Lista "Próximos 60 dias"** agrupada em Atrasados / Hoje / Amanhã / dia. Inclui as **manutenções** que vencem, com atalho para a aba Manutenção.
- **Vencimentos simples:**
  - nome, data, quem cuida e **pago ou pendente**, com atrasados destacados;
  - **"Abrir no Sobrou!"** usa o link do item ou o link do Sobrou! configurado uma vez para a casa;
  - **sem valores e sem contas:** não é módulo financeiro.
- **Início:** um cartão mostra os eventos de hoje e amanhã e os vencimentos dos próximos 3 dias.
- **Ação rápida:** novo atalho "Agenda da casa".

## Migration 019 — `supabase/migrations/20261018120000_casa_completa.sql`
- **Novas colunas em tabelas existentes:**
  - `tasks`: `priority`, `notes`, `checklist`, `help_by`, `help_at`;
  - `shopping_items`: `unit`, `priority`, `assigned_to`, `running_low`, `recur_days`, `back_on`;
  - `maintenance_items`: `provider`, `warranty_until`, `cost`, `link`;
  - `households`: `sobrou_url`.
- **Tabela nova `house_events`**, com segurança por casa e Realtime.
- **Gatilhos e funções:**
  - concluir tarefa → atende o pedido de ajuda e zera o checklist das recorrentes;
  - item recorrente comprado → marca a data de volta;
  - `ninho_shopping_recur`: devolve os itens à lista, sem duplicar.
- **Não apaga nada** e pode rodar mais de uma vez.
- **Sem a 019, o app funciona como antes:** os campos novos não aparecem e a Agenda avisa que falta atualizar o banco.

### Procedimento (Supabase de produção)
Aplicar **a 018 (Sprint) antes**, se ainda não foi.
1. **Migration:** SQL Editor → aba nova → Ctrl+A / Ctrl+C no arquivo → cole (a primeira linha começa com `-- ═══`) → Run, sem nada selecionado.
2. **Conferência:**
   ```sql
   select to_regclass('public.house_events') is not null as agenda,
          exists (select 1 from information_schema.columns where table_name = 'tasks' and column_name = 'checklist') as checklist,
          exists (select 1 from information_schema.columns where table_name = 'shopping_items' and column_name = 'recur_days') as compras,
          to_regprocedure('public.ninho_shopping_recur(uuid)') is not null as recorrencia;
   ```
   O esperado é `true | true | true | true`.

## Testes
- **Unitários:** 185/185. Novo: `tests/casa-completa.test.ts` (6), cobrindo:
  - agenda dos próximos dias, com atrasados e sem feitos;
  - agrupamento por dia;
  - vencimentos;
  - link do Sobrou!, só http(s);
  - ordem de compras por urgência;
  - quantidade com unidade.
- **Banco** (`supabase/tests/99-casa.test.sql`), nos 3 cenários:
  - prioridade válida;
  - concluir atende o pedido e zera o checklist da recorrente (a pontual fica);
  - compra recorrente volta na data, uma vez, com os mesmos detalhes;
  - links só http(s) e custo não negativo;
  - agenda só com tipos da casa;
  - outra casa não vê;
  - sem login não executa.
- **Build:** ok.
- **Ponta a ponta** (login real, 011 ativa): **28 verificações, todas ok**:
  - tarefa com prioridade, checklist, observação e histórico;
  - pedir ajuda: a Sabrina vê e conclui, e o pedido é atendido;
  - item de compra completo, que volta sozinho em 15 dias;
  - manutenção com prestador, garantia, custo e link;
  - evento em "Amanhã";
  - vencimento com "Abrir no Sobrou!", marcado como pago;
  - cartão no Início;
  - celular sem rolagem lateral nas 4 abas;
  - nenhum erro de página.
- **Regressão das Fases 1, 3, 4 e 5:** ok. Um teste antigo foi ajustado: agora são 11 atalhos.

## Como desfazer
- **App:** não mesclar, ou `git revert`.
- **Banco:** a 019 só acrescenta. Para remover a agenda: `drop table if exists public.house_events;`. As colunas novas podem ficar, porque o app antigo as ignora.
