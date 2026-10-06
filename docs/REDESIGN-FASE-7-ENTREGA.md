# Redesign · Fase 7: Cães

Branch: `redesign-fase-7`, criada a partir da `redesign-fase-6` (as Fases 5 e 6 ainda não foram mescladas). **Sem merge automático.**

## Preservado
Rotinas dos cães (diárias e periódicas, com rodízio e quem fez), modo filhote com registro rápido de acidentes, cadastro e remoção de pets.

## Novo
- **Perfil** (✎ no cartão):
  - foto opcional, reduzida para 256 px e guardada no próprio registro (funciona offline e sem serviço externo);
  - nascimento (o cartão mostra a idade), sexo, fase, observações.
- **Alimentação:**
  - ração, gramas por dia e refeições;
  - **estoque** em kg, contado a partir do dia em que foi informado. O cartão mostra "estoque para ~N dias";
  - com 7 dias ou menos, o botão **"🛒 pôr na lista"** adiciona a ração às Compras.
- **Saúde:** vacina, vermífugo, antipulgas, medicamento, consulta, banho, peso e outro.
  - **Cada registro guarda:**
    - data;
    - **repetir a cada N dias**, com sugestões: vacina 1 ano, vermífugo 90, antipulgas 30, banho 15;
    - **próxima aplicação** (calculada e editável);
    - dose/produto, veterinário(a), observação e **anexo/link** (carteirinha, receita);
    - quem registrou.
  - **"Saúde" no cartão:** as próximas aplicações dos próximos 60 dias, com atrasado, em breve e em N dias. Vale sempre o registro mais recente de cada cuidado.
  - **Peso:** o cartão mostra o último peso.
  - **Histórico:** lista completa, com editar e apagar (com confirmação).
- **Lembretes:**
  - as próximas aplicações aparecem em **Início › Cães › Cuidados próximos** (14 dias);
  - e na **Agenda da casa** como "Cuidado dos cães".
  - A notificação no celular fica para a etapa de notificações.
- **Filhote:**
  - registro rápido (mantido);
  - **corrigir registro** (cômodo, dia, horário, observação);
  - **excluir com confirmação**;
  - **evolução semanal** (6 semanas) com tendência;
  - **locais mais frequentes**;
  - **período do dia** (madrugada, manhã, tarde, noite).
- **Sem diagnóstico veterinário:** o app só registra e lembra, e o formulário diz isso.

## Migration 020 — `supabase/migrations/20261019120000_caes_saude.sql`
- **`dogs`:** + `birth_date`, `sex`, `photo` (só imagem `data:image/…`, até ~250 KB), `food_brand`, `food_g_day`, `meals_day`, `food_stock_kg`, `food_stock_on`, `notes`.
- **Tabela nova `dog_health`:** tipos fixos de cuidado, sem "diagnóstico". Com segurança por casa e Realtime.
- **`puppy_accidents`:** + `notes`.
- **Não apaga nada** e pode rodar mais de uma vez.
- **Sem a 020, o app funciona como antes:** perfil simples, sem saúde. A correção e a exclusão de acidentes já funcionam.

### Procedimento
Aplicar **a 019 antes**, se ainda não foi.

**Conferência:**
```sql
select to_regclass('public.dog_health') is not null as saude,
       exists (select 1 from information_schema.columns where table_name = 'dogs' and column_name = 'food_g_day') as racao,
       exists (select 1 from information_schema.columns where table_name = 'puppy_accidents' and column_name = 'notes') as filhote;
```
O esperado é `true | true | true`.

## Testes
- **Unitários:** 192/192. Novo: `tests/caes.test.ts` (7), cobrindo:
  - próximas aplicações (vale o mais recente);
  - próxima data sugerida;
  - peso atual;
  - idade;
  - estoque de ração;
  - período do dia no fuso da casa;
  - estatísticas do filhote.
- **Banco** (`supabase/tests/99b-caes.test.sql`), nos 3 cenários:
  - perfil e alimentação;
  - foto só como imagem guardada;
  - limites de refeições;
  - tipos de cuidado sem diagnóstico;
  - histórico;
  - correção de acidente;
  - rotinas preservadas;
  - outra casa não vê.
- **Build:** ok.
- **Ponta a ponta:** todas ok:
  - foto enviada e reduzida;
  - perfil e estoque, com estoque baixo indo para a lista de compras;
  - vacina com a próxima sugerida e ajustada;
  - peso;
  - histórico, apagar;
  - Início e Agenda lembrando;
  - filhote com estatísticas, corrigir e excluir;
  - a Sabrina vê no celular, sem rolagem lateral;
  - nenhum erro de página.
- **Regressão das Fases 1, 3 e 6:** ok.

## Como desfazer
- **App:** não mesclar, ou `git revert`.
- **Banco:**
  - `drop table if exists public.dog_health;` apaga só o histórico de saúde;
  - as colunas novas podem ficar.
