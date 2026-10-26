# Melhorias 13: pausar tarefa, compras por lugar, despensa → jantar, estações, álbum e ícone do app

Branch: `melhorias-13`, feita a partir da `main` (f19da8b). **Sem merge automático.**

## 1. ⏸ Pausar tarefa
- **Onde:** no menu da tarefa (Início › ⋯), em **⏸ Pausar por um tempo**.
- **Opções:** 1 semana, 2 semanas, 1 mês, ou "até" um dia escolhido.
- **Também no formulário** da tarefa, no campo "⏸ Pausada até".
- **Pausada a tarefa:**
  - some de Hoje, do Telegram e das notificações;
  - não pesa na divisão nem no Sprint;
  - não conta para a "Casa em dia".
- **Volta sozinha** no dia seguinte ao fim da pausa.
- **Na lista da Casa** aparece o selo `⏸ até 15/11`. Tocar nele despausa.
- **A IA do Telegram** também sabe que a tarefa está pausada.
- **Pontual não pausa:** para ela, muda-se a data.

## 2. 🛒 Compras por lugar, com preço
- **Lugar de cada item:** mercado, feira, açougue, padaria, pet shop, farmácia, atacado, online ou outro.
- **Sem lugar escolhido, o app deduz pelo corredor:** farmácia → farmácia, pets → pet shop, o resto → mercado.
- **Filtro por lugar** no topo da lista. Fica lembrado no aparelho e o modo mercado segue o filtro.
- **Preço pago** fica no editar do item (✎).
  - Na lista aparece "última R$ 7,50", tirado do histórico.
  - No topo aparece **≈ quanto deve dar** pela última compra, e de quantos itens se sabe o preço.
- **Item que entra de novo** vai para o lugar onde foi comprado da última vez (ex.: arroz → atacado).

## 3. 🥫 Da despensa para o jantar
- **Em Casa › Jantar, o cartão "Com o que vence logo"** sugere receitas (as suas e as compartilhadas) que usam algo da despensa que vence hoje, em até 3 dias ou na semana.
  - O vencido fica de fora.
  - Primeiro aparecem as que usam mais coisa e a mais urgente.
- **Um toque** abre o planejamento no primeiro dia livre, com os ingredientes da receita.
- **Na Despensa, no "Usar logo",** há o atalho "🍲 N ideias de jantar com isso".
- **Como o nome é comparado:** por palavra importante, sem acento e sem plural. "Peito de frango" combina com "Frango congelado".

## 4. 🗓 Checklists de estação (Casa › 💡 Sugestões)
Cinco pacotes, com datas do hemisfério sul:

| Pacote | Quando | Tarefas |
|---|---|---|
| ☀️ Verão | 01/12 a 20/03 | ar-condicionado, ventiladores, antipulgas, roupa de cama leve, telas, água parada |
| 🌧️ Época de chuva | 01/11 a 31/03 | ralos e calhas, infiltração, armários, capas de chuva |
| ❄️ Inverno | 01/06 a 31/08 | cobertores, chuveiro, ventilar, caminhas dos cães |
| 🎄 Fim de ano | 10/12 a 31/12 | faxina, doações, validades, geladeira, ceia |
| 🧳 Volta das férias | 4 dias a partir de quando quiser | malas, roupa, geladeira, mercado, plantas, pó |

- **Ao abrir um pacote:** dá para desmarcar tarefas e mudar o "de" e o "até". O que vocês já têm aparece marcado como "já tem".
- **As que repetem** entram com período, então somem sozinhas no fim da estação.
- **As de uma vez** entram como pontual na data de início.
- **Tudo entra alternando** entre vocês.
- **Precisa da migration 039.**

## 5. 📸 Álbum do Ninho (Nós › 📸 Álbum)
- **Fotos da casa, dos cães, de vocês e de passeios**, com legenda e data.
  - A foto é reduzida no celular (~200 KB) e guardada com miniatura.
  - As duas veem, editam a legenda e apagam.
- **Linha do tempo por mês** junto com os marcos do casal: reuniões, sprints e desafios.
- **Filtro** por tipo.
- **🕰 Neste dia:** fotos do mesmo dia em anos anteriores.

## 6. 📱 Ícone do app (no lugar do widget)
Um app instalado pelo navegador não consegue pôr widget na tela inicial, nem no Android nem no iPhone. O que dá para fazer, e foi feito:
- **Número no ícone:** quantas coisas ainda faltam para você hoje.
  - Atualiza quando o app abre e com o bom dia (notificação).
  - Funciona no Android/Chrome e no iPhone com o app na tela de início e as notificações ligadas.
- **Atalhos novos** ao segurar o ícone: **Minhas tarefas de hoje** e **Lista de compras**, além dos que já existiam.

## Migration 040: `supabase/migrations/20261108120000_pausa_compras_album.sql`
- **`tasks.paused_until`** (date).
- **`shopping_items.store`**, só da lista de lugares, e **`shopping_items.price`** (≥ 0).
- **`album_photos`**, com a regra de acesso da casa (`household_member`). Já registrada na 011, no rollback e na pós-checagem.
- **`ninho_day_on_track`:** ignora a diária essencial pausada.
- **Não destrutiva. Pode rodar mais de uma vez.**
- **Sem a migration** (testado): não aparece "Pausar", a lista de compras fica como antes e o álbum avisa "migration 040".

### Procedimento (Supabase de produção)
1. **Backup:** como sempre.
2. **Migration:** SQL Editor → aba nova → cole o arquivo inteiro → Run.
3. **Conferência:**
   ```sql
   select (select count(*) from information_schema.columns where table_schema = 'public'
             and ((table_name = 'tasks' and column_name = 'paused_until') or (table_name = 'shopping_items' and column_name in ('store', 'price')))) as colunas,
          (select count(*) from pg_policies where tablename = 'album_photos' and policyname = 'household_member') as album;
   ```
   O esperado é `3 | 1`.

## Testes
- **Unitários:** `tests/melhorias13.test.ts` (14), com dados fictícios. Cobrem:
  - pausa;
  - lugar, preço e quanto deve dar;
  - comparação de alimentos e jantares;
  - janelas das estações (inclusive o verão, que atravessa o ano);
  - linha do tempo do álbum;
  - número do bom dia.
- **Ajuste de teste:** em `tests/melhorias8.test.ts`, o teste do manifest agora espera os 6 atalhos.
- **Banco:** `supabase/tests/99v-pausa-compras-album.test.sql`, nos 3 cenários. Cobre:
  - colunas e regras;
  - "Casa em dia" com a pausada;
  - lugar e preço conferidos;
  - álbum: a outra da casa vê e edita, outra casa não vê nem grava.
- **Ponta a ponta:** r40. Cobre:
  - as seis partes, com axe;
  - o app sem a migration.
- **Regressão (r1–r40):** 40/40 OK, rodada no código final junto com a `revisao-ux`, que inclui esta entrega por inteiro.
