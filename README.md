# Gerador de Currículos — Microlins Cacoal

Site estático baseado no `index.html` fornecido. Usa **GitHub** (código), **Render Static Site** (hospedagem) e **Supabase Auth + Database** (login e currículos salvos).

## 1. Supabase
1. Crie um projeto em https://supabase.com/dashboard.
2. Abra **SQL Editor** e execute o arquivo `supabase.sql` inteiro.
3. Em **Project Settings > API / API Keys**, copie **Project URL** e a chave **publishable** (ou chave `anon` legada) e cole em `config.js`. **Nunca coloque a chave `service_role` ou secreta no frontend**.
4. Em **Authentication > Providers > Email**, habilite Email. Para uso público, mantenha a confirmação de e-mail ativada.

## 2. GitHub
1. Crie um repositório privado ou público (se público, lembre que `config.js` estará visível; isso é esperado para chave publicável protegida com RLS).
2. Envie todos os arquivos da pasta para a raiz do repositório. **Não envie apenas o zip**.

## 3. Render
1. Acesse https://dashboard.render.com/ > **New > Static Site** (ou **New > Blueprint** para usar `render.yaml`).
2. Conecte o repositório do GitHub.
3. Para Static Site manual, use: **Build command** `echo pronto` e **Publish directory** `.`.
4. Publique e copie a URL `https://...onrender.com`.
5. No Supabase, abra **Authentication > URL Configuration** e configure **Site URL** com essa URL. Acrescente a URL em **Redirect URLs** (por exemplo `https://seu-site.onrender.com/**`) para links de confirmação e recuperação.

## Como funciona
- Qualquer visitante pode preencher e imprimir usando **Salvar em PDF** (impressão do navegador; escolha "Salvar como PDF").
- Para salvar/abrir/excluir currículos na nuvem, o visitante precisa criar conta e entrar.
- RLS protege os registros para que cada conta veja apenas os próprios currículos.
- O usuário deve revisar os dados antes de compartilhar. O site não precisa coletar CPF ou endereço completo.
- Não existe painel administrativo nem acesso institucional a currículos de outros usuários nesta versão.

## Testes recomendados
- Criar conta A, confirmar e-mail, salvar currículo; sair e entrar de novo; reabrir.
- Criar conta B e verificar que nenhum currículo da conta A aparece.
- Testar impressão em A4 em desktop e celular.
- Testar recuperação de senha; o Supabase fornece o link de redefinição. Ao abrir o link de recuperação, a página solicita uma nova senha pelo navegador.

## Privacidade
O nome, contato, escolaridade e experiência são dados pessoais. Crie uma política de privacidade e defina retenção/exclusão de contas antes de lançar publicamente. O Supabase hospeda os dados conforme a região configurada no projeto. Evite inserir credenciais secretas no GitHub.
