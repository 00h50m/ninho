# Testes de ponta a ponta (só locais)

Sobe uma cópia completa do Ninho na própria máquina, com dados fictícios, e roda os testes
no navegador (Playwright). Nada sai da máquina:

- **Telegram, Anthropic e Sobrou** são falsos;
- **o login** é imitado por um gateway de teste.

## Pré-requisitos

- **PostgreSQL 16:** `initdb`, `pg_ctl` e `psql` em `/usr/lib/postgresql/16/bin`, rodando como o usuário `postgres`.
- **Node 20 ou mais novo.**
- **Playwright** instalado globalmente, com o Chromium.
- **Internet** só na primeira vez, para baixar o PostgREST (`e2e/.bin`).

## Uso

```bash
bash e2e/stack/up.sh        # banco + PostgREST + gateway + falsos + app montado (porta 3124)
bash e2e/run.sh             # todos os testes, do mais novo ao mais antigo
bash e2e/run.sh r58 r57     # só alguns
bash e2e/stack/down.sh      # para tudo
```

Cada teste começa de um banco limpo (`e2e/stack/reset.sh` copia o modelo `ninho_tpl`).

| Onde fica | O quê |
|---|---|
| `/tmp/ninho-e2e/shots/rNN` | capturas de tela |
| `/tmp/ninho-e2e/falha-rNN.log` | saída completa de um teste que falhou |

## Peças

| Arquivo | O que faz |
|---|---|
| `stack/up.sh` | Postgres (54330) com as migrations e `seed.sql`, PostgREST (3001), gateway (54321), falsos (9555/9556/9557) e o app em modo produção (3124). |
| `stack/gateway.js` | Imita o login do Supabase (e-mail e senha, sessão, cadastro) e repassa a API para o PostgREST. |
| `stack/fakes.js` | Telegram, Anthropic e Sobrou falsos. Guardam as chamadas para os testes conferirem. |
| `stack/seed.sql` | Casa de teste com duas pessoas, dois cães e algumas tarefas. **Dados fictícios.** |
| `stack/token.js` | Chaves anônima e de serviço do teste (JWT assinado com um segredo que só existe aqui). |
| `tests/e2e-rNN.js` | Um arquivo por entrega. |

As senhas e chaves daqui são só de teste. Nunca use nada disto em produção.
