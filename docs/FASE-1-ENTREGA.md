# Fase 1 — Gamificação: entrega

Branch: `fase-1-gamificacao`, criada a partir de `fase-0-estabilizacao`. **Depende da Fase 0 aplicada no banco.** Sem merge na `main` e sem deploy.

## O que foi feito

| Item | Como funciona |
|---|---|
| **Bônus no horário** | Diária com horário concluída até o horário vale XP ×1,5, arredondado para cima: leve 2, média 3, pesada 5; rotina de cão 2 por cão. Atrasada no mesmo dia vale o XP normal: ninguém perde pontos. Quem decide é o banco, pelo relógio de São Paulo, então mudar a hora do celular não dá bônus. O ⚡ aparece no XP enquanto ainda dá tempo, e o aviso mostra "⚡ no horário". |
| **Placar da semana** | XP de cada uma de segunda a domingo, com quantas fez e quantas no horário. Mostra quem está na frente (👑), a diferença e o resultado da semana passada ("Giovanna paga: …"). Aparece compacto em Hoje e completo em Semana. O XP sem autoria (de aparelho sem identificação) fica de fora. |
| **Aposta da semana** | Texto livre ou sugestões ("Quem perder escolhe o jantar", "…lava a louça no domingo"…). Fica salva por semana. |
| **Sequências** | Casa ativa (algo feito no dia), casa em dia (todas as essenciais diárias feitas), a de cada uma, cada uma com o recorde. Ninguém perde a sequência no meio do dia: hoje só entra depois do primeiro check. |
| **Conquistas** | 13 conquistas com bronze, prata e ouro: 8 por cômodo (Mestre da Lavanderia, Chef da Limpeza…; rotinas dos cães contam em "Melhor Amiga dos Cães"), Faxina Relâmpago (tarefas em 1 hora), Pontualidade, Madrugadora (antes das 8h), Peso Pesado e Sequência de Ferro. Cada uma mostra o progresso até o próximo nível. Quando uma sobe de nível, aparece um aviso, sem cobrir o "Desfazer". |
| **Guia** | Ajustes → Guia do Ninho → "XP, níveis e sequência" explica tudo isso. |

## Banco (migration 005)

`supabase/migrations/20261006120000_gamification.sql` só acrescenta:

- **Colunas em `xp_history`:** `earned_by`, `activity_date` e `on_time`, com backfill do dia e da autoria a partir das conclusões que já têm `completed_by`.
- **Coluna em `weekly_settings`:** `bet`.
- **Funções:** `ninho_is_on_time`, `ninho_xp_with_bonus`, `ninho_weekly_scores`, `ninho_streaks`, `ninho_achievement_stats` e auxiliares.
- **Substitui:** `ninho_complete_task` e `ninho_complete_dog_routines`, com a mesma assinatura. O retorno ganha `on_time` e `base_xp`.
- **Permissões:** as funções novas só executam para `authenticated` (o login anônimo atual), nunca para `anon`.

## O que você precisa fazer

1. Aplicar a Fase 0 (`docs/FASE-0-ENTREGA.md`).
2. Fazer um backup novo e rodar `supabase/migrations/20261006120000_gamification.sql` no SQL Editor.
3. Rodar `supabase/scripts/post-migration-check.sql` (agora confere também os itens da Fase 1).
4. Fazer o merge desta branch. Se for direto para a `main`, ela já inclui a Fase 0.

## Resultados

- `npm run typecheck`: sem erros.
- `npm test`: 75 testes passando (10 novos de gamificação).
- `npm run test:db`: tudo passando no banco novo e no legado. Pontualidade com relógio controlado (antes, no minuto exato, depois, virada do domingo), bônus sem duplicar, desfazer remove o bônus, placar, sequências, conquistas, aposta e bloqueio para `anon`.
- `npm run build`: sem erros nem avisos (rota `/` 101 kB, First Load 189 kB).
- Ponta a ponta local (app → PostgREST → PostgreSQL com 001–005):
  - bônus +5⚡ gravado como 5 XP no horário para quem concluiu;
  - rotina dos 2 cães com +4⚡;
  - aviso "Mestre da Lavanderia (Bronze)" depois do "Desfazer";
  - placar igual ao banco;
  - aposta salva;
  - sequências com recorde;
  - conquistas abrem em quem usa o aparelho;
  - sem rolagem horizontal no celular;
  - nenhum erro no console.
- Telas conferidas em 390 px e 1366 px (Hoje e Semana). As conquistas ficam em 2 colunas no celular.

## Riscos e observações

- **O placar só conta conclusões com autoria.** Até os dois celulares escolherem "quem está usando este aparelho", parte do XP fica como "sem autoria".
- **"Casa em dia" é aproximada para o passado.** Usa as tarefas essenciais ativas hoje (criadas até aquele dia). Uma essencial arquivada não entra nos dias antigos.
- **O bônus vale só para diárias com horário.** Semanal com horário não tem bônus, porque "no horário" não tem um dia definido.
- **Recordes:** os recordes de sequência olham os últimos 400 dias.
- **Herdado da Fase 0:** os alertas do Next 14 continuam valendo.

## Como desfazer

- **App:** não fazer o merge, ou promover o deploy anterior na Vercel.
- **Banco:** as colunas novas são opcionais e o app da Fase 0 funciona com a 005 aplicada. Para voltar o cálculo sem bônus, rode de novo `supabase/migrations/20261005120200_completion_rpcs.sql`: ele recria as duas funções de conclusão sem o bônus. As colunas e os dados continuam.

## Não implementado (fases seguintes)

Notificações push, resumo de domingo, PWA com service worker, lista de compras, regras novas de divisão, manutenção, cofre e login.
