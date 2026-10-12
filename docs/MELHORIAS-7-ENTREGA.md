# 7 melhorias num merge (+ água com lembrete e formulários)

Branch: `melhorias-7`, feita a partir da `main` (84ee1cb). **Sem merge automático.**

## O que muda

### 1. 🗓️ Cardápio da semana (Meu dia › Alimentação)
- **Montar cardápio da semana:**
  - a IA monta 7 dias a partir de hoje com o plano da nutricionista, Meus alimentos e as refeições salvas;
  - fica perto da meta de calorias e de proteína;
  - aceita preferências opcionais (ex.: "marmita no almoço, sem peixe"). Elas vão marcadas como dado, não como instrução.
- **Valores:** o que bate com Meus alimentos (ou com a tabela do Ninho) usa o valor do cadastro. O resto aparece como estimativa da IA.
- **Navegação:** um botão por dia. Hoje vem selecionado, com o total de kcal e de proteína do dia.
- **Lançar:** cada refeição de hoje é registrada com um toque.
- **🛒 Lista de compras:**
  - soma os ingredientes de hoje até o fim do cardápio (ovos 2 + 3 = "5 unidades"; gramas viram kg);
  - água, café e temperos ficam de fora;
  - você desmarca o que já tem e manda o resto para a lista da casa. O que já está aberto na lista não duplica.
- **Montar outro:** o novo fica ativo e o anterior vira histórico. Limite de 6 cardápios por dia (`ai_log` kind `cardapio`).

### 2. 💪 Proteína do dia
- **Cartão:** mostra quanto falta, com barra de progresso.
- **Meta:**
  - por padrão, 1,6 g/kg para emagrecer ou ganhar e 1,2 g/kg para manter;
  - ao emagrecer com peso desejado, a conta usa o peso desejado.
  - Em **Editar perfil e meta** dá para escolher o valor (0,5 a 3 g/kg), com a prévia em gramas.
- **Sugestões:**
  - até 3 ideias com Meus alimentos, ordenadas pela proteína por caloria;
  - em porções inteiras e cabendo nas calorias que restam, com uma ideia por alimento ("Whey 20 g" e "Whey 30 g" contam como uma);
  - **Lançar** registra na refeição do horário.
- **Esconder as calorias:** com essa opção ligada, o cartão não aparece.

### 3. 🏷️ Rótulo pelo Telegram
- **Como usar:** mande a foto da tabela nutricional com "rótulo" na legenda (também vale "tabela" ou "cadastrar…"), por exemplo "rótulo iogurte grego".
- **O que o bot faz:**
  - se a legenda bate com um alimento que já existe, propõe **conferir** esse alimento (dá preferência aos "para conferir");
  - senão, propõe **cadastrar** o alimento novo.
  - Só grava depois do **Confirmar**. Ao confirmar, o alimento fica conferido.
- **Sem a legenda:** a foto continua sendo lida como foto do prato.

### 4. 🔢 Código de barras (Meus alimentos)
- **Como usar:**
  - digite os números de baixo das barras;
  - no Chrome/Android também dá para tirar a foto do código (BarcodeDetector).
  - O dígito verificador é conferido antes de buscar.
- **Busca:** o servidor do Ninho consulta a base pública **Open Food Facts** (sem chave, sem IA, com identificação no user-agent).
- **Resultado:**
  - preenche o formulário com a porção do rótulo (ou 100 g), kcal e macros, para conferir;
  - produto fora da base ou sem calorias leva à sugestão de usar a foto do rótulo.

### 5. 🌿 Resumo da semana no Telegram (domingo)
- **Onde:** o resumo de domingo ganha a parte "Seu Meu dia na semana", **só com os dados de quem recebe**.
- **O que mostra:**
  - sono (média e noites na meta), água (dias na meta), comida (dias registrados, média de kcal e de proteína contra as metas), treinos, peso (variação na semana) e humor que mais apareceu;
  - **✨ Melhorou:** o que avançou em relação à semana anterior.
- **Esconder as calorias:** sem kcal nem peso.
- **Nada registrado:** sem essa parte.

### 6. 💰 Avisos do Sobrou
- **Mensagem da manhã no Telegram:** contas que vencem **hoje ou amanhã** e "⚠️ o mês está fechando no vermelho". Só com o Sobrou ligado (uma busca por rodada; se falhar, não atrapalha a mensagem).
- **Início:** com a sobra projetada negativa, o cartão do Sobrou fica em destaque vermelho, com aviso.

### 7. ⬇️ Exportar meus dados (Meu dia › Metas)
- **Arquivos:** CSV de refeições (com proteína, carboidrato e gordura), peso e medidas, sono, água (por dia), treinos, remédios tomados, Meus alimentos e refeições salvas.
- **Formato:**
  - ponto e vírgula, decimal com vírgula e BOM: abre certo no Excel e no Planilhas;
  - textos que começam com `=`, `+`, `-` ou `@` não viram fórmula.
- **Privacidade:** só os dados de quem baixa. O arquivo é montado no próprio aparelho.

### 8. 💧 Água: lembrete com "+1 copo" e pop-up
- **Widget na tela inicial:** é recurso de app nativo; um app web instalado (PWA) não consegue criar.
- **Lembretes** (Ajustes › Notificações › 💧 Água, desligado por padrão):
  - de 1h30 em 1h30, das 9h30 às 20h, **só quando está atrás do ritmo** (a meta vai de 0 às 8h até 100% às 21h);
  - o texto diz quanto já bebeu e quantos copos faltam.
- **"💧 +1 copo" na própria notificação** (Android/Chrome):
  - registra sem abrir o app e confirma com o novo total;
  - funciona com um bilhete assinado pelo servidor, que vale só para aquela pessoa, aquele dia e aquela quantidade, por 12 h;
  - tocar duas vezes no mesmo aviso não conta dobrado; bilhete alterado, de outra chave ou vencido é recusado.
  - No iPhone, tocar no aviso abre o pop-up.
- **Pop-up no app**, no estilo da imagem: total grande, "último copo: há 2 h", os copinhos (tocar enche, tocar no último desfaz), **+1 copo** e **Hoje não**.
  - Abre sozinho, para quem registrou água nos últimos 7 dias, quando está atrás do ritmo e sem beber há 90 min, das 9h às 21h, no máximo a cada 2 h.
  - "Hoje não" desliga até o dia seguinte.
  - Pelo lembrete, sempre abre.

### 9. Formulários que não quebram
- **Linhas de campos:**
  - viraram grade que se ajusta à largura: nada passa da borda e os campos alinham pela base mesmo quando um rótulo quebra;
  - o nome ocupa duas colunas.
- **Meus alimentos:**
  - Nome, Porção e "Gramas ou ml" em cima; kcal, proteína, carboidrato e gordura embaixo;
  - no celular, 2 colunas com o nome inteiro.
- **"Opcional":** saiu do rótulo e foi para dentro do campo (proteína, carboidrato, gordura, peso desejado e meta manual).
- **Proteína:** mostra o padrão ("padrão 1,6").

## Migration 033: `supabase/migrations/20261101120000_cardapio_proteina.sql`
- **`personal_menus`:**
  - cardápio em JSON (objeto, até 120 mil caracteres);
  - semana, preferências e se está ativo;
  - políticas privadas do Meu dia (`personal_read`/`personal_write`, leitura compartilhada com "refeição") e tempo real.
- **`personal_food_profile.protein_g_kg`:** opcional, com limite de 0,5 a 3.
- **Listas de segurança:** a 011, o rollback e a pós-checagem passaram a conhecer a tabela e a coluna novas.
- **Não destrutiva. Pode rodar mais de uma vez.**
- **Sem a migration** (testado): a Alimentação carrega, a proteína usa a sugestão, o cartão do cardápio não aparece e o perfil grava sem a coluna.

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro → Run.
3. **Conferência:**
   ```sql
   select to_regclass('public.personal_menus') is not null as tabela,
          (select count(*) from pg_policies where tablename = 'personal_menus') as politicas,
          (select count(*) from information_schema.columns where table_name = 'personal_food_profile' and column_name = 'protein_g_kg') as proteina;
   ```
   O esperado é `true | 2 | 1`.

## Configuração
- **Nada novo na Vercel.**
- **`OFF_API_URL`:** existe só para os testes locais (base falsa). Em produção, usa o endereço oficial do Open Food Facts.

## Testes
- **Unitários:** `tests/melhorias7.test.ts` (14), com dados fictícios. Cobrem meta e ideias de proteína, cardápio (conferência, compras somadas, contexto), código de barras (dígito verificador, Open Food Facts), resumo da semana, avisos do Sobrou, CSV e a legenda do rótulo.
- **Banco:** `supabase/tests/99o-cardapio-proteina.test.sql`, nos 3 cenários (novo, legado e produção). Cobre privacidade, compartilhar, outra casa, sem login, formato e limite da proteína.
- **Ponta a ponta:** r29, com Open Food Facts, Sobrou e Telegram falsos. Cobre as 7 melhorias, celular com texto maior, Noturno, axe, privacidade e funcionamento sem a migration.
- **Água:** r30 ("+1 copo" com bilhete, repetido, falsificado, vencido; pop-up pelo lembrete, copos, desfazer, "hoje não", celular, Noturno, axe) e testes unitários do ritmo, do pop-up e do bilhete.
- **Regressão (r1–r30): 30/30 OK.** Ajustes só nos testes: 7 atalhos na Alimentação (r27), 11 tabelas privadas do Meu dia (r9) e "hoje não" da água nos testes que não são sobre água (o pop-up abre sozinho no horário).
