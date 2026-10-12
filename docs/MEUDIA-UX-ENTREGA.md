# Meu dia mais fácil + passo a passo do Sobrou!

Branch: `meudia-ux`, feita a partir da `sobrou-diagnostico` (inclui o cartão do Sobrou que diz o que falta). **Sem merge automático.** **Sem SQL.**

## Meu dia › Hoje
- **Resumo do dia no topo**, com um botão por área:
  - 💧 água (ex.: 0,75/2 L);
  - 😴 sono;
  - 🍽️ quanto resta de calorias;
  - 💊 remédios tomados e atrasados;
  - 🌿 autocuidado;
  - 🏋️ treinos da semana.

  Cada botão leva ao cartão. O da comida abre a Alimentação. Fica verde quando a meta é batida e vermelho quando há remédio atrasado.
- **Ordem nova** (o que se marca no dia vem primeiro): Água, Autocuidado, Remédios e Treino, Sono, Objetivos, Parar de… e Humor.
- **Cartões vazios saem do caminho:**
  - Remédios e "Parar de…" só aparecem quando há algo cadastrado (o cadastro continua em Metas e privacidade);
  - Objetivos sem nenhum vira um convite curto no fim, com **+ Criar objetivo**.
- **No computador:** Remédios e Treino ficam empilhados numa coluna, então não sobra buraco na grade.
- **Corrigido:** no computador, o dia de hoje no calendário de humor ficava espremido (o "12" grudava no "11"). Era um nome de estilo repetido de outra tela.
- **Água com 2 casas:** 250 ml aparece como 0,25 L (antes arredondava para 0,3).

## Meu dia › Alimentação
- **Atalhos no topo:** Plano, Registrar, Refeições de hoje, Semana, Peso e Meus alimentos.
- **Meus alimentos** virou um cartão visível; antes ficava escondido num menu recolhido no fim. O menu agora é só "Minha meta de calorias".
- **Plano já salvo:** na primeira vez que abre a Alimentação, os alimentos do plano entram sozinhos em Meus alimentos, com o aviso de quantos entraram. Isso acontece uma vez por plano. Se você remover algum, ele não volta sozinho; o botão **Lançar** fica de reserva.

## Ajustes › 💰 Ligar o Sobrou! ao Ninho (passo a passo)
1. **Gerar** um segredo forte no próprio aparelho (não vai para servidor nenhum), com o botão **copiar**.
2. **Vercel do Sobrou:** o nome `NINHO_RESUMO_TOKEN` (copiar), o valor e quais ambientes marcar.
3. **Vercel do Ninho:** `SOBROU_RESUMO_TOKEN` e `SOBROU_API_URL` (copiar). Você cola o endereço do Sobrou e o app mostra exatamente o que usar (só o começo do endereço, ex.: `https://seu-sobrou.vercel.app`). Avisa se faltar o https://.
4. **Redeploy** dos dois apps, com o caminho na Vercel.
5. **Testar a ligação:**
   - ✓ **Ligado**, com a sobra do mês;
   - ou o que falta na Vercel do Ninho;
   - ou "o segredo precisa ser igual nos dois";
   - ou "confira o endereço e o redeploy".

O cartão do Sobrou no Início, quando ainda não está ligado ou dá erro, tem o botão **Ver o passo a passo**, que leva direto para cá.

## Testes
- **Unitários:** 309/309.
- **Ponta a ponta** (`r27`):
  - **Hoje:** o resumo com as 5 áreas (sem remédio cadastrado, sem esse atalho); Remédios e "Parar de…" escondidos quando vazios; convite de objetivo; o dia de hoje no calendário com o tamanho certo no computador; o atalho da comida abre a Alimentação;
  - **Alimentação:** 6 atalhos; Meus alimentos visível; o atalho leva até lá;
  - **Sobrou:** o cartão com erro oferece o passo a passo e leva aos Ajustes; gera o segredo; copiar o segredo e o nome da variável; o endereço limpo; o aviso de endereço incompleto; o teste com o Sobrou fora do ar, com segredo diferente e ligado (com a sobra);
  - **celular:** sem rolagem lateral;
  - **acessibilidade (axe):** sem problemas no Hoje, na Alimentação, no passo a passo e no Noturno.
- **r25** atualizado para o lançamento automático: entram 7 ao abrir; um removido não volta sozinho; o botão Lança.
- **r18:** o botão novo de objetivo, o calendário e "0,75 L".
- **Regressão (r1–r27): 27/27 OK.** Ajustes só nos testes, para o novo layout: o cartão "Parar de…" vazio fica fora do Hoje (r14), Meus alimentos virou cartão (r15), "+ Novo" no cartão de objetivos (r18), botão do Treino por id (r9), "Tentar de novo" ao lado do "passo a passo" (r24) e o aviso de quantos alimentos entraram é esperado assim que aparece (r25).

## Como desfazer
Não mesclar, ou `git revert`.
