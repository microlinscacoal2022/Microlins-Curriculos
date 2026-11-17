# Atualização Microlins Currículos — login obrigatório e modelo visual com foto

## Instalação
1. No repositório `microlinscacoal2022/Microlins-Curriculos`, substitua **somente** os arquivos `index.html` e `app.js` pelos dois desta atualização.
2. **Não** substitua `config.js`, pois ele já contém as credenciais públicas corretas do seu Supabase.
3. O Render republica a partir do GitHub. Recarregue o navegador com Ctrl+F5.
4. Teste com usuário existente: login, criação, foto, salvar, Meus currículos, visualizar, editar, PDF.

## Compatibilidade
Usa a mesma tabela `public.curriculos` e os mesmos campos (`nome`, `conteudo`, `usuario_id`). Currículos antigos permanecem disponíveis. Os novos campos e fotos são guardados dentro de `conteudo` (JSONB), sem alterar o SQL. Foto é reduzida no navegador antes do envio. PDFs são gerados pela opção Imprimir > Salvar como PDF.

## Segurança antes do lançamento
A confirmação de e-mail foi desativada temporariamente nos testes. Reative **Confirm email** em Supabase Authentication > Sign In / Providers e configure um SMTP com domínio de envio verificado antes de abrir cadastro ao público. Adicione aviso de privacidade e política de retenção apropriados antes de coletar dados de alunos, especialmente menores de idade. Não envie chave secreta ao GitHub.

## Modelo
O currículo replica a organização visual do exemplo enviado (faixa azul, foto circular, duas colunas, títulos azuis e seções). Não reutiliza a foto nem os dados da pessoa da imagem de referência.
