# Tarefas da casa com período (De … até …)

Branch: `tarefa-periodo`, feita a partir da `main` (0bcc02c). **Sem merge automático.**

## Como funciona
No formulário da tarefa (Casa › Tarefas › ✎, "+ Nova tarefa" ou o ✎ de uma Sugestão) há um campo novo: **Período**, com **De** e **Até**.
- **Opcional.** Vazio vale sempre, como antes.
- **Só uma das pontas também vale:** só "De" é "a partir de"; só "Até" é "até".
- **As duas pontas contam.** "De 01/12 até 15/12" inclui o dia 1 e o dia 15.
- **Dentro do período a tarefa segue a frequência e os dias da semana.** Por exemplo: diária, só sexta, de 01/12 até 15/12.
- **"Até" antes do "De":** o formulário avisa e não salva.
- **"Sem período"** limpa as duas datas.
- **Pontual não tem período.** Ela já tem a data dela.

**Fora do período a tarefa:**
- não aparece em Hoje, no Início, no Telegram (/hoje e bom dia) nem nas notificações;
- não pesa na divisão inteligente;
- não é sugerida no Sprint;
- não conta para a "Casa em dia".

Ela continua na lista da Casa, com um selo:
- `🗓 de 01/12 até 15/12`, dentro do período;
- `🗓 começa 01/12`, quando ainda não começou;
- `🗓 terminou 15/12`, quando já acabou. Aí dá para apagar, arquivar ou mudar as datas.

A IA do Telegram também vê o período de cada tarefa.

## Migration 039: `supabase/migrations/20261107120000_tarefa_periodo.sql`
- **`tasks.starts_on` e `tasks.ends_on`** (date, opcionais), com a regra "até ≥ de".
- **`ninho_day_on_track`** ("Casa em dia") passa a ignorar a diária essencial fora do período. O resto da função fica igual ao da 009.
- **Não apaga nada:** as tarefas atuais ficam sem período, ou seja, valem sempre.
- **Pode rodar mais de uma vez.** Já está registrada na pós-checagem.
- **Sem a migration** (testado): o campo Período fica escondido e o resto funciona como antes.

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro → Run.
3. **Conferência:**
   ```sql
   select count(*) as colunas from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name in ('starts_on', 'ends_on');
   ```
   O esperado é `2`.

## Testes
- **Unitários:** `tests/tarefa-periodo.test.ts` (6), com dados fictícios. Cobrem:
  - as pontas;
  - rótulo e estado;
  - Hoje com frequência e dias;
  - a divisão sem a tarefa fora do período;
  - o Sprint.
- **Banco:** `supabase/tests/99u-tarefa-periodo.test.sql`, nos 3 cenários. Cobre:
  - as colunas;
  - a regra "até ≥ de";
  - tarefas antigas sem período;
  - a "Casa em dia" dentro, antes e depois do período.
- **Ponta a ponta:** r39. Cobre:
  - o Início só com o que está no período;
  - os selos;
  - o formulário com o aviso;
  - gravar e limpar o período;
  - a pontual sem o campo;
  - a outra conta vendo os selos;
  - axe;
  - o app sem a migration.
- **Regressão (r1–r38):** 38/38 OK, mais o r39 desta entrega.
