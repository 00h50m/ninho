# Etapa 3: Alimentação com IA

Branch: `alimentacao-ia`, feita a partir da `main` c3b06b5. **Sem merge automático.**

Tudo continua **por pessoa** e **privado por padrão**: a outra só vê se a dona compartilhar "Alimentação".

## Pedidos da revisão (incluídos nesta entrega)
- **Mais fácil de achar:**
  - **Computador:** com o Meu dia aberto, o menu lateral mostra as partes dele (Hoje, Alimentação, Treinos, Evolução, Metas e privacidade), cada uma a um clique.
  - **Celular:** o topo do Meu dia tem uma barra fixa com ícones (Hoje, Comida, Treinos, Corpo, Ajustes).
  - **Ação rápida (+):** ganhou **Comi** (abre a próxima refeição do plano que ainda falta marcar), **Registrar refeição** (já no campo de escrever), **Peso e medidas** (já no campo do peso) e **Foto de evolução**.
- **Dieta pré-registrada:**
  - **Cada refeição do plano** já aparece com os itens, as quantidades e as calorias.
  - **"✓ Comi"** registra tudo como está no plano, num toque, e **"desfazer"** apaga se tocou sem querer.
  - **"Ajustar"** abre os mesmos itens para trocar a opção ou a alternativa, mudar a quantidade (− / + ou digitando os gramas) e **adicionar algo a mais** (ex.: "1 colher de azeite").
  - **Na aba Alimentação**, o plano do dia fica no topo. "Minha meta e meus alimentos" e "Lembretes e trocar o plano" ficam recolhidos.
- **Aviso mais claro:** quando a leitura com IA não está configurada naquele endereço (ex.: preview sem as chaves), o app diz isso em vez de mostrar o nome técnico da variável.
- **Ritmo:** "0,25 kg/semana" aparecia como "0,3"; agora mostra o valor certo.
- **Meu dia no menu:** "Meu dia" virou um item próprio do menu, no computador e no celular, entre Início e Rotinas. Antes ficava escondido em Rotinas → aba Meu dia; a aba saiu de Rotinas.
  - O atalho do Início, a ação rápida e os links das notificações levam para o lugar novo.
  - No celular o menu de baixo passou a ter 6 botões, conferido sem rolagem lateral mesmo com o texto no maior tamanho.
- **PDF de até 15 MB** (antes, 3 MB).
  - A Vercel só aceita pedidos de até ~4,5 MB, então o app manda o arquivo em partes de ~3,4 MB.
  - O servidor confere que as partes são de quem pediu, junta, manda para a IA e **apaga as partes na hora**. Sobras com mais de 1 hora também são apagadas.
- **Medidas a partir de um arquivo:** em Evolução, o botão **"📄 Ler bioimpedância ou avaliação (PDF ou foto)"**.
  - A IA **copia** os valores do relatório, sem estimar: peso, % de gordura, massa muscular, gordura visceral, água corporal e as medidas em cm. Também traz a data do exame e uma observação (ex.: taxa metabólica basal).
  - Os campos chegam preenchidos para você **conferir e corrigir** antes de salvar.
  - Valores fora de faixas plausíveis são descartados. O arquivo não fica guardado.
- **Medição com data:** dá para registrar uma avaliação de outro dia.
- **Medidas novas:** massa muscular (kg), gordura visceral (nível), água corporal (%), coxa, panturrilha e pescoço (cm). Cada uma tem o seu gráfico.
- **Fotos de evolução:** frente, lado, costas ou outra, com data.
  - A galeria fica organizada por data.
  - **Comparar:** escolha a pose, o "antes" e o "depois", e as duas fotos aparecem lado a lado. Por padrão, a mais antiga com a mais recente.
  - **Tamanho:** cada foto é reduzida no celular para cerca de 200 KB (mais uma miniatura). A lista carrega só as miniaturas; a foto inteira só é buscada para ver ou comparar.
  - **Privacidade:** as fotos ficam **no banco, protegidas pela mesma regra do Meu dia**. Elas têm **compartilhamento próprio, "Fotos de evolução"**, desligado por padrão. Compartilhar "Evolução física" **não** mostra as fotos. Se você compartilhar, a outra pessoa vê as fotos, mas não pode apagar.


### 📋 Plano alimentar (Meu dia › Alimentação)
- **Enviar o plano:** a pessoa manda o **PDF** (até 15 MB) **ou fotos** do plano da nutricionista. A IA **organiza o que está escrito, sem inventar nada e sem mudar quantidades**:
  - refeições, com horário quando o plano diz;
  - opções ("Opção 1", "Opção 2");
  - alternativas dentro do item ("2 ovos **ou** 100 g de frango");
  - o que vale **só em dia de treino** ou **só em dia sem treino**;
  - regras (fim de semana, trocas…);
  - suplementos, água por dia e listas de substituição.
- **Conferir antes de salvar:** o plano aparece inteiro para comparar com o original. A pessoa escolhe **Salvar plano** ou **Descartar**.
- **O arquivo não fica guardado:** vai só para a leitura. No banco fica apenas o plano organizado. Trocar de plano guarda o anterior como inativo.
- **Seguir o plano no dia:**
  - **"Dia de treino" / "Dia sem treino":** escolhe sozinho pelo treino registrado hoje, e dá para trocar. O pré-treino e as trocas do dia sem treino aparecem conforme a escolha.
  - **"Comi"** em cada refeição: escolhe a opção e a alternativa de cada item, vê as calorias e registra. A refeição fica **✓ registrada** e entra no saldo do dia.
  - **Como as calorias são calculadas:** quando o alimento está na tabela do Ninho, usa a tabela com a quantidade do plano. Quando não está, usa a estimativa da IA e avisa.
  - **Suplementos do plano:** um toque cadastra cada um como remédio, com lembrete no horário.
  - **Água do plano:** um toque usa o valor do plano como a sua meta de água.
  - **"Regras e listas do plano"** ficam à mão, sem ocupar a tela.
  - **"Lembrar das refeições":** notificação no horário de cada refeição do plano, se ainda não marcou.
    - Fica de fora a refeição que só vale em dia de treino, porque o servidor não sabe se você vai treinar.
    - Também é possível desligar em Ajustes › Notificações › "Refeições do plano".
    - Tocar na notificação abre direto a Alimentação.
- **Sem perfil de calorias:** o plano também pode ser enviado e seguido antes de preencher o perfil.

### 📷 Foto do prato
- Em "Registrar refeição", o botão **📷 Foto do prato** abre a câmera. O que estiver escrito no campo ajuda a IA (ex.: "frango e arroz integral").
- A IA lista cada alimento com **gramas e calorias**:
  - o que a tabela do Ninho reconhece usa a tabela, com os gramas estimados pela foto;
  - o resto aparece como **"estimativa da IA"**, com as calorias editáveis.
- Dá para ajustar tudo antes de salvar, como na refeição por texto.
- A IA também avisa o que pode ter ficado incerto, por exemplo "o óleo do preparo não aparece".
- **A foto é reduzida no próprio celular e não fica guardada.**

### 💬 Telegram
- **Refeição por texto:** "almocei arroz, feijão e frango", "lanchei uma banana com pasta de amendoim". O bot mostra o resumo e só grava depois do ✅ Confirmar:
  > 🍽️ Lanche: Banana prata (70 g), Pasta de amendoim (15 g) · ≈ 157 kcal
- **Foto do prato:** mande a foto, de preferência com "almoço", "jantar"… na legenda. O bot baixa a maior versão, estima e pede confirmação. **A foto não fica guardada.**
- O /ajuda foi atualizado.

## Segurança e uso
- **Quem pede:** as rotas novas (`/api/ai/plano` e `/api/ai/prato`) exigem login de alguém **desta casa**. Nada é gravado por elas: quem salva é o app, depois da conferência, com as mesmas regras de privacidade de sempre.
- **Arquivo e legenda:** vão para a IA **marcados como dados, não como instruções**.
- **Limites por casa a cada 24 h:** 10 leituras de plano e 30 fotos de prato.
  - **Correção:** as sugestões da semana agora contam só o próprio uso. Antes, as mensagens do Telegram também entravam na conta das 6 sugestões por dia.
- **Modelo:** `claude-opus-5-5`, com saída estruturada (JSON de formato fixo), fallback automático e esforço baixo.
- **Custo:**
  - leitura de um plano: alguns milhares de tokens, na ordem de 5 a 15 centavos de dólar;
  - foto de prato: cerca de 1 a 2 centavos de dólar.

## Migration 028: `supabase/migrations/20261027120000_fotos_arquivos.sql`
- **`personal_photos`:** as fotos de evolução, com data, pose, miniatura e a foto em si (com limite de tamanho).
  - **Privacidade:** igual ao Meu dia, mas com o compartilhamento próprio `fotos`.
- **`ai_upload_parts`:** as partes temporárias do PDF grande.
  - Só o servidor vê: RLS ligada e sem regras, e o app não consegue ler nem gravar.
  - As partes são apagadas depois da leitura.
- **A `011`, o rollback e a pós-checagem** passaram a conhecer as tabelas novas.
- **Pode rodar mais de uma vez. Não apaga nada.**
- **Sem a 028:** o resto funciona. Só somem as fotos, e PDFs acima de ~3 MB não são lidos.

### Ordem no Supabase
Rode a **027** e depois a **028**, cada uma com a sua conferência:
```sql
select to_regclass('public.personal_photos') is not null as fotos,
       to_regclass('public.ai_upload_parts') is not null as partes,
       (select count(*) from pg_policies where tablename = 'personal_photos') as politicas_fotos,
       (select count(*) from pg_policies where tablename = 'ai_upload_parts') as politicas_partes;
```
O esperado para a 028 é `true | true | 2 | 0`.

## Migration 027: `supabase/migrations/20261026120000_plano_alimentar.sql`
- **`personal_diet_plans`:** o plano organizado, com título, nome do arquivo de origem, lembrete ligado ou não, e ativo ou não.
  - **Um plano ativo por pessoa.**
  - O formato é conferido: precisa ter a lista de refeições, com até 60 mil caracteres.
- **Privacidade:** igual ao resto do Meu dia (só a dona grava; a outra só lê se a dona compartilhar "Alimentação").
- **Tempo real ligado.** Termina recarregando a lista de tabelas.
- **Pode rodar mais de uma vez. Não apaga nada.**
- **Sem a migration:** o resto da Alimentação funciona; só o plano não aparece.

A `011`, o rollback e a pós-checagem também passaram a conhecer a tabela nova.

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro (a primeira linha começa com `-- ═══`) → Run.
3. **Conferência:**
   ```sql
   select to_regclass('public.personal_diet_plans') is not null as tabela,
          (select count(*) from pg_policies where tablename = 'personal_diet_plans') as politicas;
   ```
   O esperado é `true | 2`.
4. **Chave:** nada novo. Usa a `ANTHROPIC_API_KEY` que já está na Vercel.

## Testes
- **Unitários:** 272/272. Os testes usam um **plano fictício**; nada dos seus PDFs entra no código.
  - **Novo:** `tests/dietPlan.test.ts`:
    - conferência do plano;
    - dia de treino e dia sem treino;
    - alternativa vira item (pela tabela ou pela estimativa);
    - refeição pelo nome ou horário;
    - foto do prato.
  - **Ampliados:**
    - `tests/telegramAi.test.ts`: refeição pelo texto, com itens pela tabela ou pela estimativa e descarte do que vier vazio;
    - `tests/reminders.test.ts`: lembrete da refeição só para a dona e só se ainda não marcou.
- **Banco** (`supabase/tests/99i-plano.test.sql`), nos 3 cenários:
  - a dona salva o plano;
  - um ativo por pessoa;
  - plano sem refeições é recusado;
  - trocar de plano guarda o antigo;
  - a outra não vê nem cria até o compartilhamento, e não altera;
  - outra casa e sem login: nada.
- **Ponta a ponta** (`r16`), com a IA imitada localmente. **Todas ok**:
  - **ler o plano:**
    - o pedido sai certo (modelo, saída estruturada, fallback) e o PDF vai como documento;
    - instruções: só organizar, e o arquivo é dado;
    - a conferência mostra refeições, alternativas, treino, suplementos e água;
    - salvo sem o arquivo, e o uso fica registrado;
  - **seguir o plano:**
    - dia sem treino esconde o pré-treino; dia de treino mostra;
    - "Comi" com troca de alternativa (296 → 248 kcal) é gravado, marcado e entra no saldo;
    - dia sem treino mostra o almoço com o arroz extra;
  - **suplementos:** viram remédios com lembrete;
  - **água:** meta de 3 L;
  - **regras:** aparecem no plano;
  - **lembrete:**
    - liga e grava;
    - **push real** do almoço chega na hora, e o café, já marcado, não gera aviso;
    - o link da notificação abre a Alimentação;
  - **foto do prato:**
    - vai como imagem, com a legenda marcada como dado;
    - itens pela tabela com os gramas da IA, e o resto como estimativa;
    - total de 443 kcal, gravado;
  - **Telegram texto:** resumo de 157 kcal e Confirmar grava.
  - **Telegram foto:** baixa a maior versão, mostra o resumo "Jantar" pela legenda, e Cancelar não grava.
  - **Uso da IA:** contado por tipo.
  - **Privacidade:** a Sabrina não vê o plano da Giovanna e pode mandar o dela.
  - **Celular com texto maior:** sem rolagem lateral, inclusive na folha do "Comi".
  - **Acessibilidade (axe):** zero problemas no computador, no celular e no Noturno.
- **Unitários novos:**
  - `tests/bodyScan.test.ts`: faixas plausíveis, data até hoje e formato;
  - menu com 6 áreas.
  - Total: 275/275.
- **Banco** (`supabase/tests/99j-fotos.test.sql`), nos 3 cenários:
  - a dona guarda a foto;
  - pose e tamanho conferidos;
  - o app não grava partes de arquivo;
  - a outra não vê;
  - "Evolução física" não libera as fotos, e "fotos" libera;
  - a outra não apaga;
  - outra casa e sem login: nada.
- **Ponta a ponta** (`r17`). **Todas ok**:
  - **menu com Meu dia:** Rotinas sem a aba antiga, e o cartão do Início abre o Meu dia;
  - **PDF de 16 MB:** recusado com aviso, sem enviar nada;
  - **PDF de 9 MB:** chega inteiro à IA, conferido byte a byte, e as partes são apagadas;
  - **exame:**
    - vai como imagem, com instruções de só copiar;
    - 8 medidas e a data chegam preenchidas;
    - a correção da cintura é salva na data do exame;
    - aparece o gráfico da massa muscular;
  - **fotos:**
    - 3 fotos guardadas, reduzidas;
    - galeria por data;
    - comparação antes × depois com a foto inteira;
    - apagar funciona;
  - **privacidade:**
    - a Sabrina não vê as fotos;
    - "Evolução física" não mostra;
    - com "Fotos de evolução" ela vê as 2 fotos, sem o botão de apagar;
  - **celular:** 6 botões no menu, sem rolagem lateral, inclusive com o texto maior;
  - **acessibilidade (axe):** zero problemas no computador, no celular e no Noturno.
- **Ponta a ponta, layout novo:**
  - **r17:** partes do Meu dia no menu lateral, ação rápida levando ao campo certo, configurações recolhidas e barra do celular com nomes curtos.
  - **r16:** refeição pré-preenchida com itens, quantidades e kcal; "✓ Comi" em um toque e desfazer; "Ajustar" com + e − na quantidade e algo a mais.
- **Regressão (r1–r17):** veja o resultado na mensagem de entrega.
  - Os testes antigos do Meu dia agora entram pelo menu novo.
  - O r1 agora espera 6 áreas no menu.

## Como desfazer
- **App:** não mesclar, ou `git revert`.
- **Banco (opcional):**
  ```sql
  drop table if exists public.personal_diet_plans;
  drop table if exists public.personal_photos;
  drop table if exists public.ai_upload_parts;
  ```
  **Atenção:** apagar `personal_photos` apaga as fotos.
