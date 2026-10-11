# Faxinão com IA

Branch: `faxinao`, feita a partir da `main` 675b800. **Sem merge automático.**

## Como usar
1. **Casa › Faxinão** (ou **Ação rápida › Faxinão com IA**).
2. **Despeje tudo o que precisa ser feito**, do seu jeito. Pode escrever, tocar nos atalhos (🛁 banheiro, 🍳 cozinha, 🛏️ roupa de cama…) ou **🎤 falar**, pelo microfone do celular, nos navegadores que permitem.
3. **Escolha quem participa** (as duas ou só uma) e o **tempo disponível**, se houver limite.
4. **✨ Organizar com IA.** A IA devolve os passos **na ordem que rende mais**:
   - **o que demora sozinho começa primeiro**, marcado com ⏳: máquina de lavar, produto agindo no box. O passo de terminar fica mais para frente;
   - **de cima para baixo e do seco para o molhado:** pó → varrer/aspirar → pano;
   - **agrupado por cômodo;** banheiro e cozinha depois dos cômodos secos; chão de dentro para fora; quintal e lixo no fim;
   - **"prender as cachorras"** antes de chão molhado ou produto forte;
   - **pausa para água** a cada ~45 min;
   - **dividido entre vocês duas**, equilibrando o tempo, com tempo estimado em cada passo e até 3 dicas.
5. **Confira antes de começar:**
   - dá para mudar o nome;
   - subir e descer passos;
   - trocar quem faz (G, S ou as duas);
   - ajustar os minutos;
   - adicionar ou tirar passos.

   O resumo mostra o tempo de cada uma.
6. **▶ Começar agora** abre o modo **ao vivo**:
   - cronômetro e barra de progresso;
   - **o "agora" de cada uma**, com o próximo passo;
   - **✓ Feito**, **Depois** (manda para o fim) ou **pular**;
   - "Todos os passos" para marcar ou desmarcar qualquer um;
   - **as duas marcam ao mesmo tempo sem perder nada**, porque o banco grava cada marcação de uma vez;
   - a tela da outra atualiza em tempo real. Se a conexão cair no celular, o app confere de novo a cada 8 s.
7. **Encerrar faxinão:** se ainda faltar algo, o app avisa antes. O resumo fica em "Últimos faxinões" (tempo, quantos passos cada uma fez e quantos foram pulados).

## Extras
- **Modelos:** "Salvar como modelo" guarda o plano ("Faxinão de sábado"), e **▶ Usar** cria um rascunho novo com um toque.
- **Sem IA:** se a IA não responder, ou não estiver configurada naquele endereço, **"Usar na ordem que escrevi"** monta o plano com a lista na ordem digitada, em rodízio entre vocês.
- **Início:** enquanto houver um faxinão em andamento, aparece um cartão com o progresso e o "agora" de quem está usando o celular.
- **Telegram:** "**faxinão: banheiro, cozinha, roupa de cama, quintal**" faz o bot organizar e responder com a lista numerada (quem faz e minutos). O plano fica como **rascunho no app** (Casa › Faxinão) para conferir e começar. O /ajuda foi atualizado.

## Segurança e uso
- **Quem pede:** a rota `/api/ai/faxinao` exige login de alguém desta casa.
- **O pedido vai para a IA marcado como dado.** Também vão os primeiros nomes, o nome das cachorras e o tempo disponível.
- **Limite:** 20 faxinões organizados por casa a cada 24 h.
- **Modelo:** `claude-opus-5-5`, com saída estruturada, esforço baixo e fallback automático.
- **Custo:** cerca de 1 a 3 centavos de dólar por faxinão.
- **Ajuste junto:** a mensagem de recusa da IA, que falava em "arquivo", agora serve para qualquer pedido.

## Migration 030: `supabase/migrations/20261029120000_faxinao.sql`
- **`faxinoes`:** o plano, com título, passos, dicas, situação (rascunho, andamento, feito ou modelo), quem criou, começo e fim.
  - **É da casa:** as duas veem e marcam, pela mesma regra das outras tabelas da casa.
  - Limites: até 60 passos e tamanho conferido.
- **`ninho_faxinao_step`:** marca um passo como feito, pulado, desfeito ou "depois" numa gravação só.
  - Não marca faxinão já encerrado.
  - Recusa ações desconhecidas.
- **Tempo real ligado.** Termina recarregando a lista de tabelas.
- **A 011, o rollback e a pós-checagem** passaram a conhecer a tabela nova.
- **Pode rodar mais de uma vez. Não apaga nada.**
- **Sem a migration:** a aba avisa que falta a atualização; o resto do app funciona.

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro → Run.
3. **Conferência:**
   ```sql
   select to_regclass('public.faxinoes') is not null as tabela,
          (select count(*) from pg_policies where tablename = 'faxinoes') as politicas,
          to_regprocedure('public.ninho_faxinao_step(uuid,text,text,text)') is not null as funcao;
   ```
   O esperado é `true | 1 | true`.

## Testes
- **Unitários:** 287/287. Novo: `tests/faxinao.test.ts` (5), cobrindo:
  - conferência do plano da IA;
  - só uma pessoa;
  - sem IA (rodízio);
  - tempo de cada uma;
  - "agora" e "em seguida";
  - resumo, modelo e contexto.
- **Banco** (`supabase/tests/99l-faxinao.test.sql`), nos 3 cenários:
  - as duas marcam passos diferentes sem apagar a outra;
  - "depois" vai para o fim;
  - desfazer;
  - ação inválida é recusada;
  - faxinão encerrado não muda;
  - outra casa não vê nem marca;
  - sem login: nada.
- **Ponta a ponta** (`r19`). **Todas ok**:
  - **organizar:**
    - ação rápida e atalhos de cômodo;
    - pedido à IA com as regras de ordem;
    - contexto com quem participa, tempo, cachorras e o pedido marcado como dado;
    - rascunho com 6 passos e resumo "52 min · Giovanna 52 · Sabrina 27";
  - **editar:** mover, trocar quem faz, minutos, adicionar e tirar; começa com a ordem editada;
  - **ao vivo:**
    - cartão no Início da Sabrina com o "agora" dela;
    - cada uma vê o próprio passo;
    - **as duas marcam juntas e nada se perde**, e uma vê o progresso da outra;
    - "Depois" e "pular";
    - cronômetro;
    - encerrar, com o resumo "Giovanna 1 · Sabrina 1 · 1 pulado";
  - **sem IA:** aviso, "Usar na ordem que escrevi", salvar como modelo e usar o modelo;
  - **Telegram:** "faxinão: pia e lixo" vira lista numerada e rascunho no app criado pela Sabrina;
  - **celular com texto maior:** sem rolagem lateral;
  - **acessibilidade (axe):** zero problemas no computador, no celular e no Noturno. O axe achou contraste baixo no nome "(você)" do cartão, e foi corrigido.
- **Regressão (r1–r18):** veja o resultado na mensagem de entrega.

## Como desfazer
- **App:** não mesclar, ou `git revert`.
- **Banco (opcional):**
  ```sql
  drop function if exists public.ninho_faxinao_step(uuid,text,text,text);
  drop table if exists public.faxinoes;
  ```
