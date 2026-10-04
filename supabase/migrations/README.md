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

O `supabase-schema.sql` é o schema canônico para um banco novo. Em banco existente, use sempre as migrations.

