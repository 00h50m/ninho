# Fase 3 — Casa: entrega

Branch: `fase-3-casa`, criada a partir da `main` (que já tem as Fases 0, 1 e 2). Sem merge na `main` e sem deploy.

## O que foi feito

| Item | Como funciona |
|---|---|
| **✦ Divisão inteligente** | Para tarefas sem dona fixa (↻): **quem fez por último passa a vez**. Se uma cobriu a outra, a vez se ajusta sozinha. Se uma já está com bem mais carga (o que é fixo dela, mais o que fez na semana com peso menor), a próxima vai para a outra. Sem histórico, vale o rodízio antigo. Diárias são decididas a cada dia; semanais, quinzenais e mensais, uma vez por período (não trocam de dona no meio da semana). O resultado é o mesmo nos dois celulares e no bom dia, e não muda durante o dia. |
| **Por que é minha vez?** | No celular, em **⋯** numa tarefa aparece, por exemplo: *"Vez da Sabrina: Giovanna fez da última vez (ontem)"*. |
| **Escolher o jeito** | Em **Semana › Divisão da carga**: ✦ Inteligente (padrão) ou ↻ Rodízio fixo. Vale para a casa toda. |
| **🛒 Compras** (aba nova) | Lista compartilhada **ao vivo**. Escrever "2 kg arroz" separa a quantidade, e a categoria é escolhida sozinha (dá para trocar). A lista segue a ordem dos corredores do mercado e mostra quem pediu e quem riscou. Um item repetido não duplica; se estava riscado, volta para a lista. **Finalizar compra** tira os riscados (com Desfazer) e oferece marcar a tarefa "Mercado semanal". **Comprar de novo** traz os itens mais comprados dos últimos 4 meses, a um toque. |
| **🔧 Manutenção** | Em **Tarefas › Manutenção**: coisas de tempos em tempos, com **19 modelos prontos** (filtro do ar, caixa d'água, dedetização, V10, antirrábica, vermífugo, antipulgas, unhas, revisão do carro, óleo, dentista…). Para cada modelo dá para dizer quando foi a última vez. **✓ Feita** vale +3 XP, entra no placar, calcula a próxima data e pode ser desfeito. |
| **Hoje** | Cartão de manutenção (atrasadas e que vencem em até 3 dias, com ✓ Feita) e resumo da lista de compras. |
| **Notificações** | **Bom dia:** inclui a manutenção que vence no dia, a dela ou a sem responsável. **Resumo de domingo:** avisa a manutenção da semana seguinte. Os dois usam a divisão escolhida pela casa. |

## Banco (migration 007)

`supabase/migrations/20261008120000_casa.sql` só acrescenta:

- `households.split_mode` (`smart` | `rotation`, padrão `smart`).
- `shopping_items`, com índice único por item aberto, e `ninho_add_shopping_item`, que não duplica e reabre um item riscado.
- `maintenance_items` e `maintenance_log`, com `ninho_next_due` (meses do calendário: 31/01 + 1 mês = 28/02), `ninho_complete_maintenance` (+3 XP, sem duplicar) e `ninho_undo_maintenance`.
- RLS no modelo atual, funções bloqueadas para `anon` e tabelas novas no Realtime.

## O que você precisa fazer

1. **SQL Editor do Supabase:**
   1. Rode a `supabase/migrations/20261008120000_casa.sql`.
   2. Depois rode `supabase/scripts/post-migration-check.sql`. Tudo deve sair `ok`.
2. **Merge** da `fase-3-casa` na `main`, só depois do passo 1. Não há variável nova na Vercel.

Se o app novo for publicado antes da migration, Hoje, Tarefas e Cães continuam funcionando com o rodízio antigo. As abas Compras e Manutenção avisam que falta atualizar o banco.

## Resultados

- `npm run typecheck`: sem erros.
- `npm test`: 115 testes passando (24 novos).
  - Divisão: quem fez por último, cobertura, equilíbrio, estabilidade no dia e na semana, rotinas dos cães agrupadas, modo rodízio igual ao antigo.
  - Compras: categoria automática, quantidade, ordem do mercado, comprar de novo.
  - Manutenção: próxima data igual à do banco, rótulos, quem recebe no bom dia.
  - Mensagens das notificações.
- `npm run test:db`: tudo passando nos **3 cenários** (banco novo, legado e o schema real de produção), com as migrations aplicadas duas vezes.
  - Compras sem duplicar e com reabertura.
  - Manutenção com XP, sem duplicar, e o desfazer.
  - Recusa de dados inválidos e bloqueio para `anon`.
- `npm run build`: sem erros.
- **Ponta a ponta em modo produção** (Playwright, com o banco local migrado), 28 verificações ok e nenhum erro de página:
  - divisão e explicação da vez;
  - troca de modo;
  - adicionar, repetir, riscar, finalizar, desfazer, comprar de novo e remover;
  - modelos e formulário de manutenção;
  - feita com +3 XP e desfazer;
  - cartões em Hoje;
  - bom dia com manutenção (Web Push real, descriptografado);
  - sem rolagem lateral no celular.

## Riscos e observações

- **Ao vivo entre os dois celulares não foi testado aqui.** O ambiente local não tem o servidor Realtime do Supabase. As tabelas estão na publicação, conferido no teste do banco, e o app escuta inserções, alterações e exclusões. A confirmação vem no uso real: uma adiciona e a outra vê aparecer.
- **A divisão muda de dona hoje.** Ao ligar a versão nova, algumas tarefas sem dona podem trocar de pessoa em relação ao rodízio antigo, porque agora vale quem fez por último. Para voltar ao jeito antigo: Semana › ↻ Rodízio fixo.
- **Conclusões antigas sem autoria** ("não identificado") não contam para "quem fez por último". Nesses casos vale o equilíbrio ou o rodízio.
- **Lista de compras visível a qualquer usuário do app**, como o resto dos dados, no modelo anônimo atual. Fica resolvido com o login (fase final).
- **IA:** a divisão é por regras, sem IA. É grátis, instantânea, funciona sem internet e dá o mesmo resultado nos dois celulares. Uma IA (Claude) sugerindo ajustes na reunião semanal fica para a próxima fase, junto com o Telegram.

## Como desfazer

- **App:** não fazer o merge, ou promover o deploy anterior na Vercel.
- **Só a divisão:** Semana › ↻ Rodízio fixo.
- **Banco:** as tabelas novas não são usadas pelas versões anteriores do app e podem ficar.

## Próximas fases (propostas)

- **Fase 4 — Telegram, IA e Finapp:**
  - bot do Telegram com o bom dia, avisos e comandos ("/compras leite");
  - IA sugerindo a divisão na reunião semanal;
  - integração com o Finapp, a definir conforme o que ele oferece (API, exportação ou webhook).
- **Fase final — Login e cofre:** login de verdade, permissões por casa e cofre (garantias, manuais, contatos, wifi).
