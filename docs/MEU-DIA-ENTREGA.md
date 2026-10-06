# Meu dia (a parte individual de cada uma)

Branch: `meu-dia` (a partir da `main` 7161204). **Sem merge automático.**

## O que é
Uma área só sua, em **Rotinas › Meu dia**, com quatro abas: Hoje, Treinos, Evolução e Metas e privacidade.

**Hoje:**
- **Água:**
  - "+1 copo" (do tamanho que você escolher), "+500 ml" e "desfazer";
  - barra até a meta;
  - 🔥 dias seguidos na meta.
- **Sono:**
  - "dormi" e "acordei", o que funciona atravessando a meia-noite;
  - qualidade (boa, ok ou ruim);
  - média dos últimos 7 dias;
  - aviso quando ficou abaixo da meta.
- **Autocuidado e pausas:** checklist do dia. Os itens são seus: pausa de 5 minutos, alongar, tomar sol, skincare, ler 10 minutos… dá para trocar.
- **Remédios e vitaminas:**
  - doses de hoje por horário;
  - marcar como tomada;
  - "atrasado" quando passou do horário.
  - É só lembrete e registro, sem orientação de saúde.
- **Treino:** treinos e minutos da semana, mais "Registrar treino".
- **A outra hoje:** só o que ela escolheu compartilhar.

**Treinos:**
- **Registro:**
  - tipo (musculação, corrida, caminhada, bike, yoga/pilates, funcional, natação, outro);
  - duração e intensidade.
  - Na musculação e no funcional: **exercícios com séries, repetições e carga (kg)**. O nome sugere os exercícios que você já fez.
- **Evolução da carga** por exercício:
  - gráfico com a maior carga de cada dia;
  - variação total (ex.: +12,5 kg).
- **Histórico,** com apagar.

**Evolução:**
- **Medições:** peso, cintura, quadril, braço, peito e % de gordura (preencha só o que quiser).
- **Gráfico** por medida, com a variação desde a primeira medição.

**Metas e privacidade:**
- **O que a outra pode ver:** chave por item (água, sono, autocuidado, remédios, treinos, evolução). Começa tudo desligado.
- **Metas:** água, copo e sono.
- **Itens de autocuidado.**
- **Remédios:** cadastrar, editar e parar. O histórico fica.

**Atalhos:**
- **Cartão "Meu dia" no Início:** água com "+1 copo", sono e doses pendentes.
- **"Meu dia"** nas ações rápidas.

Dieta e calorias continuam fora, como combinado.

## Privacidade (garantida pelo banco, não só pela tela)
- **Só a dona grava:** cada uma só cria, altera ou apaga os **próprios** registros, metas e remédios. Quem é quem vem da conta logada (`ninho_my_who`), não de um valor enviado pelo app.
- **A outra só lê o compartilhado:** só consegue **ler** os registros dos itens que a dona compartilhou. O que não foi compartilhado **nem chega ao celular dela**. O teste ponta a ponta confere isso olhando a resposta do servidor.
- **Mudar o compartilhamento vale na hora.**
- **Outra casa e quem não está logado** não veem nada.
- **Metas e itens de autocuidado** (não os registros) ficam visíveis para a casa. É assim que a outra sabe a meta de água para mostrar "0,5 / 2,5 L".
- **Depende da 011:** essas regras valem com a segurança por casa (migration 011) ativa, que é o caso da produção. Sem a 011, o app funciona, mas sem a separação.

## Migration 021 — `supabase/migrations/20261020120000_meu_dia.sql`
- **Tabelas:**
  - `personal_settings`: metas, o que compartilhar e itens de autocuidado;
  - `personal_logs`: água, sono, autocuidado, remédio, treino e corpo;
  - `personal_meds`: remédios.
- **Funções:**
  - `ninho_my_who`: quem é a pessoa logada nesta casa;
  - `ninho_personal_shared`: se aquele item foi compartilhado.
- **Políticas privadas:** `personal_read` e `personal_write`.
- **Realtime:** em registros e metas.
- **A 011 também foi ajustada:** quem rodar a 011 de novo mantém as regras privadas, porque essas tabelas **não** entram na regra geral "toda a casa vê tudo".
- **Não apaga nada** e pode rodar mais de uma vez.

### Procedimento (Supabase de produção)
1. **Backup:** como nas fases anteriores. A 021 só cria coisas novas.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro (a primeira linha começa com `-- ═══`) → Run, sem nada selecionado.
3. **Conferência:**
   ```sql
   select to_regclass('public.personal_logs') is not null as tabelas,
          (select count(*) from pg_policies where tablename in ('personal_settings','personal_logs','personal_meds')) as politicas,
          (select count(*) from pg_policies where tablename like 'personal_%' and policyname = 'allow_all_auth') as abertas;
   ```
   O esperado é `true | 6 | 0`.

Sem a 021, a aba e o cartão não aparecem e o resto funciona normalmente.

## Testes
- **Unitários:** 202/202. Novo: `tests/meudia.test.ts` (10), cobrindo:
  - água do dia e dias seguidos;
  - sono atravessando a meia-noite e média;
  - doses e atraso;
  - treinos da semana;
  - série de cargas;
  - medidas e variação.
- **Banco** (`supabase/tests/99c-meudia.test.sql`), nos 3 cenários:
  - a dona vê tudo;
  - a outra só vê o compartilhado;
  - remédio não compartilhado é privado;
  - não grava, não altera e não apaga no Meu dia da outra;
  - não muda o compartilhamento da outra;
  - compartilhar libera na hora;
  - tipo fora da lista (ex.: dieta) é recusado;
  - outra casa e quem não está logado não veem nada.
- **Build:** ok.
- **Ponta a ponta** (login real, 011 ativa, Giovanna no computador e Sabrina no celular): **todas ok**:
  - cartão no Início e atalho;
  - água (2 copos + 500 ml = 1 L, desfazer);
  - sono 23:30 → 06:45 = 7,25 h com qualidade;
  - autocuidado marcar e desmarcar;
  - meta 2,5 L e compartilhar só a água;
  - remédio com 2 horários: o atrasado aparece e some ao tomar;
  - treino com 2 exercícios e cargas;
  - gráfico de carga (3 pontos, +12,5 kg, valor ao passar o mouse, tabela, troca de exercício);
  - medição com gráfico de peso (-1,4 kg) e cintura;
  - **a Sabrina recebe do servidor só a água da Giovanna**: vê "0,5 / 2,5 L", sem sono e sem treinos;
  - Giovanna desliga o compartilhamento: a Sabrina não vê nada;
  - "+1 copo" pelo Início;
  - celular sem rolagem lateral em todas as abas;
  - nenhum erro de página.
- **Regressão das Fases 1 a 7 e dos modelos (r1–r8):** todas ok. Um teste antigo foi ajustado: agora são 12 atalhos, com "Meu dia".

## Limites
- **Lembrete de remédio:** só aparece com o app aberto (doses "atrasado"). O aviso no celular com o app fechado fica para a etapa de notificações.
- **Gráficos:** cada um mostra uma medida por vez, sem comparar as duas pessoas. É de propósito: não é ranking.

## Como desfazer
- **App:** não mesclar, ou `git revert`.
- **Banco (opcional):** apaga só o Meu dia.
  ```sql
  drop table if exists public.personal_logs, public.personal_meds, public.personal_settings;
  drop function if exists public.ninho_personal_shared(uuid,text,text);
  drop function if exists public.ninho_my_who(uuid);
  ```
