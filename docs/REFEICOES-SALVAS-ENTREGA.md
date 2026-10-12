# Refeições salvas (favoritas)

Branch: `refeicoes-salvas`, feita a partir da `alimentos-plano` (usa o "Montar com meus alimentos"). **Sem merge automático.**

## Como usar
- **Salvar:**
  - no **🧩 Montar com meus alimentos**, ou depois de **Conferir** uma refeição escrita, toque em **⭐ Salvar como refeição (para lançar depois)**;
  - o nome sugerido é a combinação, e dá para trocar (ex.: "Meu café de sempre");
  - **salvar não lança no dia.**
- **Lançar:** a faixa **⭐ Refeições salvas** aparece em Registrar refeição, com as mais usadas primeiro. **Lançar** registra na refeição escolhida (café, almoço…) com um toque, com todos os itens e as calorias.
- **Ajustar antes:** **ajustar** abre os itens para mudar quantidades ou tirar algo antes de salvar no dia. Dali dá para **⭐ Atualizar a refeição salva**, que muda a mesma salva sem criar outra.
- **Remover:** ✕ tira da lista de salvas. As refeições já lançadas continuam no histórico.
- **Telegram:** "**comi meu café de sempre**" (também almocei, jantei, lanchei, tomei…) reconhece a refeição salva e responde com os itens, as kcal e o **Confirmar**.
  - **Sem gastar IA.**
  - A refeição do dia vem da frase ("almocei…") ou, se não der para saber, do horário.
- **Privacidade:** igual ao resto do Meu dia. Só a dona vê e grava; a outra só vê se a dona compartilhar "refeição".

## Migration 031: `supabase/migrations/20261030120000_refeicoes_salvas.sql`
- **`personal_saved_meals`:**
  - nome (1 a 60 caracteres);
  - itens (lista de 1 a 30, com tamanho conferido);
  - total de kcal;
  - quantas vezes foi usada;
  - se está ativa.
- **Políticas privadas** do Meu dia (`personal_read`/`personal_write`) e tempo real ligado.
- **A 011, o rollback e a pós-checagem** passaram a conhecer a tabela nova.
- **Não destrutiva. Pode rodar mais de uma vez.**
- **Sem a migration:** a faixa não aparece e o resto da Alimentação funciona normalmente.

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro → Run.
3. **Conferência:**
   ```sql
   select to_regclass('public.personal_saved_meals') is not null as tabela,
          (select count(*) from pg_policies where tablename = 'personal_saved_meals') as politicas;
   ```
   O esperado é `true | 2`.

## Testes
- **Unitários:** `tests/savedMeals.test.ts` (4), cobrindo:
  - salvar só itens com calorias, com o total;
  - conferência do que vem do banco;
  - ½ porção e dobro;
  - achar a salva no Telegram (o nome mais longo ganha; só frases de "comi…").

  Total: 308/308.
- **Banco** (`supabase/tests/99m-refeicoes-salvas.test.sql`), nos 3 cenários:
  - a dona salva e conta os usos;
  - itens vazios ou fora de lista são recusados;
  - a outra não vê nem cria;
  - compartilhar "refeição" libera só a leitura;
  - outra casa não vê;
  - sem login, nada.
- **Ponta a ponta** (`r26`):
  - **salvar:** nome sugerido; 3 itens, 420 kcal; não lança no dia;
  - **lançar:** a faixa com itens e kcal; lançar no café; contar o uso;
  - **ajustar:** tirar um item; atualizar a mesma salva; lançar a ajustada;
  - **Telegram:** "comi meu café de sempre" reconhece a salva, no café, com Confirmar, **sem chamar a IA**, e grava ao confirmar;
  - **remover:** sai das salvas e as refeições lançadas ficam;
  - **a Sabrina não vê;**
  - **celular com texto maior:** sem rolagem lateral;
  - **acessibilidade (axe):** sem problemas no computador, no celular e no Noturno.
- **Regressão (r1–r26):** veja o resultado na mensagem de entrega.

## Como desfazer
- **App:** não mesclar, ou `git revert`.
- **Banco (opcional):**
  ```sql
  drop table if exists public.personal_saved_meals;
  ```
