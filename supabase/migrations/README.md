# Migrations do Ninho

Execute os arquivos desta pasta em ordem crescente antes de publicar o código que depende deles.

Para a Fase 1, aplique `202610030001_phase1_stabilization.sql` no projeto Supabase atual. A migration:

- preserva os registros existentes;
- completa tabelas e colunas ausentes;
- identifica registros históricos de XP duplicados sem apagá-los;
- torna conclusão e XP transacionais e idempotentes;
- mantém temporariamente as políticas permissivas do acesso anônimo.

Depois da execução, valide no SQL Editor:

```sql
select public.ninho_today();
select public.get_household_xp(id) from public.households limit 1;
select public.get_streak(id) from public.households limit 1;
```

Para a Fase 2, aplique em seguida `202610040001_phase2_task_occurrences.sql`. A migration:

- adiciona as regras de recorrência às tarefas-modelo;
- cria `task_occurrences` e migra todas as conclusões antigas;
- preserva as chaves de XP já existentes;
- gera ocorrências futuras de forma idempotente;
- adiciona operações transacionais para concluir, desfazer, adiar e ignorar ocorrências.

Valide após a execução:

```sql
select public.generate_task_occurrences(id, public.ninho_today() + 62, null)
from public.households;

select task_id, original_scheduled_date, scheduled_date, status, count(*)
from public.task_occurrences
group by task_id, original_scheduled_date, scheduled_date, status
having count(*) > 1;
```

A segunda consulta deve retornar zero linhas. Execute a Fase 2 somente depois da Fase 1.

O `supabase-schema.sql` é o schema canônico para um banco novo. Em banco existente, use sempre as migrations.
