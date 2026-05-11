# 🏠 Ninho — Guia de instalação passo a passo

Siga cada passo na ordem. Leva cerca de 35 minutos.

---

## PARTE 1 — Criar conta no GitHub (5 min)

1. Acesse **github.com**
2. Clique em **Sign up**
3. Escolha um email e senha
4. Confirme o email que chegar na caixa de entrada
5. Pronto — conta criada

---

## PARTE 2 — Criar conta no Supabase e banco de dados (10 min)

1. Acesse **supabase.com**
2. Clique em **Start your project**
3. Faça login com sua conta do GitHub (botão "Continue with GitHub")
4. Clique em **New project**
5. Preencha:
   - **Name:** ninho
   - **Database Password:** escolha uma senha forte (guarde em algum lugar)
   - **Region:** South America (São Paulo)
6. Clique em **Create new project** e aguarde ~2 minutos

### Criar as tabelas do banco:

7. No menu lateral esquerdo, clique em **SQL Editor**
8. Clique em **New query**
9. Abra o arquivo `supabase-schema.sql` deste projeto
10. Copie TODO o conteúdo do arquivo
11. Cole na caixa de texto do SQL Editor
12. Clique no botão **Run** (ou Ctrl+Enter)
13. Deve aparecer "Success" — tabelas criadas!

### Pegar as chaves de acesso:

14. No menu lateral, clique em **Project Settings** (ícone de engrenagem)
15. Clique em **API**
16. Copie e guarde dois valores:
    - **Project URL** (começa com https://...)
    - **anon public** (começa com eyJ...)

---

## PARTE 3 — Subir o projeto no GitHub (5 min)

1. Acesse **github.com** (logado)
2. Clique no **+** no canto superior direito → **New repository**
3. Preencha:
   - **Repository name:** ninho
   - Deixe **Public** marcado
4. Clique em **Create repository**
5. Na próxima tela, clique em **uploading an existing file**
6. Arraste TODOS os arquivos e pastas deste projeto para a área de upload
   - ATENÇÃO: não inclua a pasta `node_modules` (ela não existe ainda, ok)
7. Clique em **Commit changes**

---

## PARTE 4 — Deploy no Vercel (10 min)

1. Acesse **vercel.com**
2. Clique em **Sign Up** → **Continue with GitHub**
3. Autorize o Vercel a acessar seu GitHub
4. Clique em **Add New Project**
5. Encontre o repositório **ninho** e clique em **Import**
6. Na tela de configuração:
   - **Framework Preset:** Next.js (deve detectar automático)
   - Expanda a seção **Environment Variables**
   - Adicione a primeira variável:
     - **Name:** `NEXT_PUBLIC_SUPABASE_URL`
     - **Value:** cole a Project URL que você copiou no Passo 16
   - Clique em **Add**
   - Adicione a segunda variável:
     - **Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **Value:** cole o anon public que você copiou no Passo 16
   - Clique em **Add**
7. Clique em **Deploy**
8. Aguarde ~3 minutos
9. Aparecerá uma tela com confetes e a URL do seu site! 🎉
   - Será algo como: `ninho-abc123.vercel.app`

---

## PARTE 5 — Configurar autenticação no Supabase (3 min)

1. Volte ao **supabase.com** → seu projeto
2. No menu lateral, clique em **Authentication**
3. Clique em **URL Configuration**
4. No campo **Site URL**, cole a URL do Vercel (ex: `https://ninho-abc123.vercel.app`)
5. No campo **Redirect URLs**, cole: `https://ninho-abc123.vercel.app/auth/callback`
6. Clique em **Save**

---

## PARTE 6 — Instalar no tablet Android (5 min)

1. Abra o **Chrome** no tablet
2. Digite a URL do Vercel na barra de endereços
3. Aguarde o site carregar
4. Toque nos **3 pontinhos** no canto superior direito
5. Toque em **"Adicionar à tela inicial"**
6. Confirme com **"Adicionar"**
7. O ícone do Ninho aparecerá na tela inicial do tablet
8. Abra pelo ícone — vai abrir em tela cheia, sem barra do navegador

---

## PARTE 7 — Primeiro acesso e configuração (5 min)

### Integrante 1 (quem criou):
1. Abra o Ninho
2. Digite seu email e clique em **Enviar código**
3. Verifique o email e cole o código de 6 dígitos
4. Digite seu nome
5. Clique em **Criar nova casa**
6. Você está dentro! 🏠

### Compartilhar com a parceira:
1. No app, vá em **Configurações** (canto superior)
2. Copie o **Código de convite** (8 caracteres)
3. Mande para a parceira via WhatsApp

### Integrante 2:
1. Abra a URL do Vercel no celular
2. Faça o mesmo processo de login com email
3. Na etapa de setup, clique em **Entrar em casa existente**
4. Cole o código de convite
5. Pronto — estão conectadas no mesmo Ninho!

---

## PARTE 8 — Adicionar as primeiras tarefas

1. Toque no botão **+** verde no canto inferior direito
2. Digite o nome da tarefa (ex: "Louça diária")
3. Escolha a categoria (Cozinha)
4. Escolha o peso (Leve)
5. Escolha a frequência (Diária)
6. Escolha responsável (ou deixe "Qualquer uma")
7. Horário é opcional — só preencha se quiser notificação
8. Toque em **Criar tarefa**

**Sugestão de primeiras tarefas para cadastrar:**
- Louça diária (Cozinha / Leve / Diária)
- Limpar bancada (Cozinha / Leve / Diária)
- Ração dos cães manhã (Cães / Leve / Diária)
- Ração dos cães noite (Cães / Leve / Diária)
- Passeio manhã (Cães / Médio / Diária)
- Passeio tarde (Cães / Médio / Diária)
- Varrer/aspirar (Geral / Médio / Semanal)
- Banheiro completo (Banheiro / Pesado / Semanal)
- Lavanderia (Lavanderia / Pesado / Semanal)

---

## Problemas comuns

**"Código inválido" no login:**
Verifique o spam. O código expira em 1 hora.

**Site não carrega no tablet:**
Verifique se o Wi-Fi está ativo. O site precisa de internet.

**Tarefas não sincronizam:**
Puxe para baixo para atualizar. Se persistir, faça logout e login novamente.

**Erro no deploy do Vercel:**
Verifique se as variáveis de ambiente foram copiadas sem espaços extras.

---

## Suporte

Se travar em qualquer passo, descreva exatamente onde parou
e o que aparece na tela — é fácil resolver com orientação.
