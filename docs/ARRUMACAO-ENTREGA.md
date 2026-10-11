# Arrumação técnica: Next 15, React 19 e divisão do NinhoApp

Branch: `arrumacao`, feita a partir da `reuniao-ia`. **Sem merge automático.** **Sem migration.**

## O que mudou
- **Next.js 14.2.35 → 15.5.27.**
  - A 15.5.27 é a versão mais recente da linha 15, que ainda recebe correções de segurança.
  - A linha 14 não recebe mais atualizações.
- **React 18 → 19** (`react`, `react-dom` e os tipos).
  - O código não usava nenhuma das APIs que mudaram no Next 15 (`cookies()`, `headers()`, `params` assíncronos).
  - O único ajuste foi um `useRef` em `hooks/useRotinas.ts`, que no React 19 precisa de valor inicial.
- **O `postcss` continua fixado em 8.5.28** (override de segurança). A auditoria de produção (`npm audit --omit=dev`) acusa **0 vulnerabilidades**.
- **NinhoApp dividido:** as janelas e peças de UI saíram para `components/AppModals.tsx` (356 linhas):
  - Tarefa, Sugestões, Pet, Cão, Rotina, Energia e Reunião;
  - o horário rápido;
  - os ajudantes de nome e categoria.

  O `NinhoApp.tsx` caiu de 2.092 para 1.750 linhas. Cada arquivo importa só o que usa. **Nada mudou no comportamento.**

## Perfis "Integrante" (só conferência, nada é apagado)
- **De onde vêm:** a versão antiga, sem login, criava um perfil "Integrante" para cada aparelho anônimo.
- **O app não usa mais esses perfis:** desde o login por e-mail, quem é da casa vem de `household_members`.
- **Por que não apagamos agora:** apagar dados em produção é destrutivo e fica para uma decisão de vocês.

Para ver quantos existem, rode no SQL Editor (só leitura):
```sql
select p.name,
       count(*)                                         as perfis,
       count(*) filter (where u.is_anonymous)           as anonimos,
       count(*) filter (where m.user_id is not null)    as ligados_a_conta,
       max(u.last_sign_in_at)                           as ultimo_acesso
from public.profiles p
left join auth.users u on u.id = p.id
left join public.household_members m on m.user_id = p.id
group by p.name
order by perfis desc;
```
Se aparecerem perfis anônimos sem conta e sem acesso recente, preparo uma migration que **guarda uma cópia** antes de remover, para vocês decidirem.

## Testes
- **Unitários:** 298/298.
- **Build de produção:** ok, com o Next 15.5.27.
- **Regressão de ponta a ponta** (r1–r23, no app compilado com Next 15): veja o resultado na mensagem de entrega.

## Como desfazer
Não mesclar, ou `git revert`. A volta para o Next 14 é só o `package.json` e o `package-lock.json` desta branch.
