-- Cenário legado: fotografa as contagens ANTES das migrations.
create schema if not exists test_meta;
create table test_meta.counts_before as
select 'tasks' t, count(*) n from public.tasks union all
select 'task_completions', count(*) from public.task_completions union all
select 'dogs', count(*) from public.dogs union all
select 'dog_routines', count(*) from public.dog_routines union all
select 'dog_completions', count(*) from public.dog_completions union all
select 'weekly_settings', count(*) from public.weekly_settings union all
select 'weekly_meetings', count(*) from public.weekly_meetings union all
select 'xp_history', count(*) from public.xp_history union all
select 'puppy_accidents', count(*) from public.puppy_accidents union all
select 'profiles', count(*) from public.profiles union all
select 'households', count(*) from public.households;
