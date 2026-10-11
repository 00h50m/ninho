# Água em copinhos, Objetivos e Humor do mês

Branch: `objetivos-humor`, feita a partir da `main` c915150. **Sem merge automático.**

Inspirada nos prints do Direct Line. Tudo é **por pessoa** e **privado por padrão**.

## 💧 Água em copinhos (Início e Meu dia)
- **Copinhos:** a meta vira copinhos (2 L em copos de 250 ml = 8 copos; até 12 na tela).
  - Tocar num copo vazio bebe mais um copo.
  - Tocar no **último copo cheio** desfaz. Os outros cheios não respondem ao toque, para não desfazer sem querer.
- **Nível:** um "tanque" acima dos copos enche até a meta, com uma ondinha, e mostra **"Meta batida 🎉"** quando chega.
- **Movimento reduzido:** com "Movimento reduzido" ligado (Ajustes) ou no sistema, a onda e as animações ficam paradas.
- **Botões de antes:** "+1 copo" e "+500 ml" continuam no Meu dia.

## 🎯 Objetivos (Meu dia › Hoje, no topo)
- **Tipos:**

  | Tipo | Exemplo | Como o progresso conta |
  |---|---|---|
  | Peso | "perder 12 kg até dezembro" | sozinho, pelos pesos da Evolução e da bioimpedância; serve para perder ou ganhar |
  | Treinos | "40 treinos até o fim do ano" | sozinho, pelos treinos registrados no período |
  | Água | "30 dias batendo a meta" | sozinho, pelos dias com a meta de água |
  | Outro | "12 livros" | qualquer número, com o botão "Somar progresso" |

- **O que cada objetivo mostra:**
  - meta e prazo ("Perder 12 kg (chegar a 60 kg) até 12/03/27");
  - barra de progresso, "8% · 1 de 12 kg · faltam 11";
  - peso agora, dias restantes, **ritmo necessário** (ex.: 0,5 kg por semana) e quanto já era esperado pelo prazo;
  - um selo: "Em andamento", "Um pouco atrás do ritmo" ou "Concluído 🎉".
- **Encerrar:** "Marcar como concluído" quando chega a 100%. **Arquivar** tira o objetivo da lista e guarda o histórico.
- **Início:** o cartão Meu dia mostra o primeiro objetivo com a barra ("🎯 Emagrecer 8%").
- **Compartilhar:**
  - "Objetivos" tem compartilhamento próprio.
  - O **% de um objetivo de peso** só aparece para a outra se "Evolução física" também estiver compartilhada. Sem isso, ela vê só o nome.

## 😊 Humor do mês (Meu dia › Hoje)
- **Calendário:** o humor do **check-in diário** de cada dia aparece como emoji, com hoje marcado e navegação entre meses.
- **Números:** dias registrados (7 e 30 dias) e **humor predominante no mês**, com % e vezes (ex.: "😄 Ótimo · 50% dos dias registrados (3x)").
- **O que acompanha os dias melhores:**
  - compara os dias **depois de dormir na meta**, **com treino** e **com a água na meta**;
  - exemplo: "✨ Nos dias depois de dormir na meta, seu humor costuma ser melhor.";
  - só fala com pelo menos 3 dias de cada lado e diferença clara.
- **"Como está hoje? →"** leva ao check-in do Início, quando ainda não foi feito.
- **Sem banco novo:** usa o check-in que já existe.

## Migration 029: `supabase/migrations/20261028120000_objetivos.sql`
- **`personal_goals`:**
  - título, tipo, unidade, valor inicial, meta, começo, prazo e situação;
  - conferências: tipos conhecidos, meta maior que 0 e prazo depois do começo.
- **`personal_logs`:** passa a aceitar o tipo `objetivo` (o "Somar progresso"). Só a regra de tipos muda; nenhum registro é alterado. A troca se pula se já estiver feita.
- **Privacidade:** igual ao Meu dia, com a chave própria `objetivo`.
- **Tempo real ligado.** Termina recarregando a lista de tabelas.
- **Pode rodar mais de uma vez. Não apaga nada.**
- **Sem a migration:** o cartão de objetivos não aparece; o resto funciona.

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro → Run.
3. **Conferência:**
   ```sql
   select to_regclass('public.personal_goals') is not null as tabela,
          (select count(*) from pg_policies where tablename = 'personal_goals') as politicas,
          (select count(*) from pg_constraint where conname = 'personal_logs_kind_check4') as regra_tipos;
   ```
   O esperado é `true | 2 | 1`.

## Testes
- **Unitários:** 282/282. Novo: `tests/goals.test.ts` (7):
  - **peso:** perder e ganhar; engordar não conta como progresso; ritmo necessário; prazo;
  - **treinos e água:** contam só dentro do período;
  - **"outro":** soma; "atrás do ritmo"; concluído; sem dados;
  - **humor:** calendário começando no domingo, humor predominante, e o que acompanha os dias melhores (só com dados suficientes).
- **Banco** (`supabase/tests/99k-objetivos.test.sql`), nos 3 cenários:
  - a dona cria e soma progresso, e "refeição" continua aceita;
  - tipo e prazo conferidos;
  - a outra não vê até o compartilhamento;
  - "Evolução física" não libera os objetivos, e "objetivo" libera;
  - a outra não cria nem altera;
  - outra casa e sem login: nada.
- **Ponta a ponta** (`r18`). **Todas ok**:
  - **copinhos:**
    - 8 copinhos no Início; tocar bebe;
    - no Meu dia: "0,8 L de 2 L"; o último copo desfaz e os outros não;
    - meta batida com comemoração e tanque em 100%;
  - **objetivos:**
    - o peso inicial vem do último registro;
    - salvo; "8% · 1 de 12 kg · faltam 11", 152 dias, 0,5 kg por semana;
    - Início com 8%;
    - "Outro" com "Somar progresso" (17%);
    - arquivar;
  - **humor:**
    - emojis no calendário e hoje marcado;
    - 6 dias registrados e humor predominante;
    - o que acompanha os dias melhores;
    - navegar entre meses;
    - atalho para o check-in;
  - **privacidade:**
    - a Sabrina não vê nada até o compartilhamento;
    - depois, vê o objetivo sem o % de peso;
    - com "Evolução física" também compartilhada, vê os 8%;
  - **celular com texto maior:** sem rolagem lateral;
  - **movimento reduzido:** onda parada;
  - **acessibilidade (axe):** zero problemas no computador, no celular e no Noturno.
- **Testes antigos:** r9 e r11 agora tocam num copinho do Início em vez do botão "+1 copo".
- **Regressão (r1–r18):** veja o resultado na mensagem de entrega.

## Como desfazer
- **App:** não mesclar, ou `git revert`.
- **Banco (opcional):** `drop table if exists public.personal_goals;`. Os progressos somados ficam em `personal_logs` com o tipo `objetivo`.
