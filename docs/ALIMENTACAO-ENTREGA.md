# Etapa 2: Alimentação (base)

Branch: `alimentacao`, feita a partir da `main` com a etapa 1 já mesclada. **Sem merge automático.**

Nova aba **Meu dia → Alimentação**. É **por pessoa** e **privada por padrão**: a outra só vê se a dona compartilhar "Alimentação" em "Metas e privacidade".

## O que tem
- **Perfil e meta.** No primeiro uso, a pessoa preenche:
  - sexo (para o cálculo), ano de nascimento, altura e peso;
  - nível de atividade **sem contar os treinos**;
  - objetivo (emagrecer, manter ou ganhar) e ritmo (0,25 a 1 kg por semana);
  - peso desejado e meta manual (a da nutricionista, por exemplo), os dois opcionais.

  **Como a meta é calculada:**
  - **Gasto do dia:** fórmula de Mifflin-St Jeor multiplicada pelo nível de atividade.
  - **Ajuste pelo objetivo:** a meta é o gasto menos (ou mais) 7.700 kcal por kg, dividido pelos 7 dias da semana.
  - **Mínimo seguro:** a meta nunca fica abaixo de **1.200 kcal (mulheres) ou 1.500 kcal (homens)**. Quando o ritmo escolhido pediria menos, a tela avisa.
  - **Meta manual abaixo do mínimo:** é aceita, mas aparece um alerta.
  - **Peso:** o informado no perfil entra na **Evolução** e vale para os cálculos.
- **Saldo do dia:**
  - quanto **resta** (ou quanto passou);
  - **meta**, **comido** e **treino** (+kcal);
  - proteína, carboidrato e gordura.
- **Refeição por texto.** A pessoa escolhe a refeição (café, almoço, lanche, jantar, ceia, outro) e escreve do jeito que fala, por exemplo "2 ovos mexidos, 1 pão francês com manteiga e café com leite". Depois toca em **Conferir**.
  - **Cada item aparece com gramas e calorias**, e dá para trocar o alimento, a quantidade ou a medida (unidade, fatia, colher, concha, copo, g…) antes de salvar.
  - **O leitor entende:**
    - números, "meia", "duas";
    - medidas caseiras e plurais;
    - "100 g de arroz" e "suco 300 ml";
    - "com" separando itens, como em "pão com manteiga". Quando o "com" faz parte do nome, como em "café com leite", fica um item só.
  - **Item que não está na tabela:** fica marcado. A pessoa escolhe um parecido ou informa as calorias; sem isso, ele fica de fora.
- **Tabela de alimentos:** cerca de 130 alimentos do dia a dia brasileiro, por 100 g.
  - **Fonte:** valores baseados na **TACO (UNICAMP)**, com referências equivalentes quando a TACO não traz o preparo.
  - **Medidas caseiras:** colher, concha, fatia, unidade etc.
- **Meus alimentos:** para o que não está na tabela, como o rótulo de uma barrinha ou uma receita da casa. O alimento cadastrado passa a ser reconhecido no texto e ganha da tabela.
- **Calorias do treino:** vêm dos treinos já registrados, pelo tipo, intensidade e minutos, multiplicando o MET pelo peso e pelas horas. Aparecem como estimativa e **somam à meta do dia**.
- **Calorias da semana:** barras dos últimos 7 dias com a linha da meta, detalhe ao tocar e tabela com os valores.
- **Peso com previsão:**
  - o gráfico usa os pesos da Evolução;
  - **linha do peso desejado** e **linha tracejada de previsão** no ritmo planejado;
  - tendência das últimas 4 semanas em kg por semana, com a data prevista nesse ritmo;
  - campo para registrar o peso de hoje.
- **Esconder as calorias:**
  - o dia vira palavras ("Ainda tem espaço hoje", "Na medida", "Passou um pouco hoje");
  - somem os números de kcal, o gráfico de calorias e as calorias na conferência;
  - o peso continua aparecendo.
- **Início:** o cartão Meu dia ganha a linha da alimentação, como "🍽️ restam 972 kcal" (ou em palavras, se as calorias estiverem escondidas).
- **Compartilhado:** a outra vê no resumo "… hoje" **quantas refeições** foram registradas. O peso continua privado: só aparece se "Evolução física" também for compartilhada.
- **Aviso fixo:** "São estimativas para o dia a dia. Para um plano individual, gestação ou alguma condição de saúde, fale com nutricionista ou médica."

## Ajustes que vieram junto
- **Gráficos de linha (Evolução e Peso):**
  - os pontos tocáveis estavam dentro de um elemento marcado como imagem, e o leitor de tela não chegava neles. Agora é um grupo navegável (achado pelo axe);
  - o gráfico ganhou a linha de previsão e a linha de referência.
- **Gráfico de barras da semana:** virou um componente só, usado no Sono (horas) e na Alimentação (kcal).
- **Migration 025:** a troca da regra de tipos agora se pula quando já aceita `parar`. Assim, rodar a 025 de novo depois da 026 não dá erro.

## Migration 026: `supabase/migrations/20261025120000_alimentacao.sql`
- **`personal_food_profile`:** perfil e meta de cada pessoa, com os valores conferidos (altura de 120 a 230 cm, ritmo de 0 a 1 kg por semana, meta manual de 1.000 a 5.000 kcal…).
- **`personal_foods`:** os alimentos próprios.
- **`personal_logs`:** passa a aceitar o tipo `refeicao` (valor = kcal; itens em `data`). Só a regra de tipos muda; nenhum registro é alterado.
- **Privacidade:** igual ao resto do Meu dia.
  - Só a dona grava.
  - A outra só lê se a dona compartilhar "Alimentação".
  - Outra casa e quem não fez login não veem nada.
- **Tempo real ligado.** Termina recarregando a lista de tabelas (`notify pgrst`).
- **Pode rodar mais de uma vez. Não apaga nada.**
- **Sem a migration, o app continua funcionando:** a aba mostra que falta a atualização do banco.

A `011`, o rollback e a pós-checagem também passaram a conhecer as tabelas novas.

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro (a primeira linha começa com `-- ═══`) → Run.
3. **Conferência:**
   ```sql
   select to_regclass('public.personal_food_profile') is not null as perfil,
          to_regclass('public.personal_foods') is not null as alimentos,
          (select count(*) from pg_policies where tablename in ('personal_food_profile','personal_foods')) as politicas,
          (select count(*) from pg_constraint where conname = 'personal_logs_kind_check3') as regra_tipos;
   ```
   O esperado é `true | true | 4 | 1`.

## Testes
- **Unitários:** 264/264. Novo: `tests/nutricao.test.ts` (14), cobrindo:
  - **meta:** conta conferida à mão, mínimo seguro, manter, ganhar e meta manual;
  - **leitura do texto:** quantidades, medidas, plurais, "com", nome mais específico, alimento próprio, item desconhecido e apelidos sem repetição na tabela;
  - **cálculos:** MET, saldo com treino, palavras do dia, tendência, data prevista e refeição pelo horário.
- **Banco** (`supabase/tests/99h-alimentacao.test.sql`), nos 3 cenários:
  - a dona cria perfil, alimento e refeição;
  - valores absurdos e tipos desconhecidos são recusados;
  - a outra não vê nem cria;
  - compartilhar libera só a alimentação, e "Parar de…" continua fechado;
  - a outra não altera;
  - outra casa e sem login: nada.
- **Ponta a ponta** (`r15`), com as duas pessoas logadas. **Todas ok**:
  - **perfil:** prévia de 1.940 kcal de gasto e meta de 1.390 kcal; perfil e peso gravados;
  - **refeição por texto:**
    - 4 itens com gramas e kcal, total de 422 kcal;
    - trocar para 2 pães leva a 572 kcal;
    - gravado;
  - **item desconhecido:** marcado, e as calorias informadas à mão entram no total;
  - **treino:** 1.390 + 343 − 761 = **972 kcal restam**;
  - **semana:** barras certas, com a meta;
  - **peso:**
    - tendência de −0,5 kg por semana e previsão;
    - linhas de previsão e de peso desejado;
    - registro pelo cartão;
  - **Meus alimentos:** cadastro e reconhecimento no texto;
  - **apagar refeição.**
  - **Esconder calorias:** dia em palavras, sem gráfico de calorias e sem kcal na conferência.
  - **Privacidade:**
    - a Sabrina não vê nada até o compartilhamento;
    - depois do compartilhamento, ela vê só quantas refeições;
    - na aba dela aparece só o perfil dela.
  - **Início:** com a linha da alimentação.
  - **Celular com texto maior:** sem rolagem lateral.
  - **Acessibilidade (axe):** zero problemas no computador, no celular com texto maior e no Noturno.
- **Regressão (r1–r14):** veja o resultado na mensagem de entrega.

## Como desfazer
- **App:** não mesclar, ou `git revert`.
- **Banco (opcional):**
  ```sql
  drop table if exists public.personal_food_profile;
  drop table if exists public.personal_foods;
  ```
  As refeições ficam em `personal_logs` com o tipo `refeicao` e podem ser apagadas com `delete from public.personal_logs where kind = 'refeicao';`.
