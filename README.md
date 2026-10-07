# Wesllen Imports

Loja de camisas, personalizados e presentes com carrinho e pedido pelo WhatsApp. Não há pagamento online.

## Prévia local

Com Node.js 20 ou superior, execute `npm start` ou abra `iniciar-loja.bat`. A loja abre em <http://localhost:3000/>, o catálogo em `/catalogo` e o painel em `/admin`. Sem sessão válida, `/admin` redireciona para `/admin/login`.

Na primeira execução **local de desenvolvimento**, o servidor cria uma senha temporária aleatória em `data/admin-access.txt`. Esse arquivo é ignorado pelo Git e é removido quando a senha é trocada no painel. Nunca use essa senha para produção.

## Painel e dados

O painel permite gerir produtos, fotos, categorias, banners, promoções e configurações. Na prévia local sem Supabase, produtos, configurações e orçamentos ficam em `data`; fotos enviadas ficam em `public/uploads`. Com `SUPABASE_URL` e `SUPABASE_SECRET_KEY` configurados, catálogo e orçamentos ficam no banco Supabase e fotos novas vão para Supabase Storage. A loja nunca envia a chave secreta ao navegador. Não sirva `data` como conteúdo público.

Em **Configurações**, nome, slogan, WhatsApp, URL do Instagram, chave **Instagram ativo**, endereço, mensagem de atendimento e valor padrão da personalização são gerenciados em um lugar. O Instagram só aparece com a chave ativa e uma URL HTTPS válida de perfil. O WhatsApp do pedido usa o mesmo número cadastrado ali, com o pedido completo calculado pelo servidor. O número atual foi preservado; confira-o antes de publicar.

O banner de personalização enviado por Wesley está otimizado em WebP e integra o carrossel da Home. Sete produtos de **demonstração** aparecem para ilustrar a vitrine: Brasil, duas opções do Flamengo, Real Madrid, Palmeiras, boné e camisa personalizável. As fotos foram geradas para esta prévia, sem escudos oficiais; nomes e preços são ilustrativos. Esses exemplos não são gravados como produtos no Supabase, não entram no carrinho e não geram pedidos. Em **Configurações**, Wesley pode ocultar todos de uma vez ou desmarcar exemplos individualmente. Para substituí-los, cadastre produtos reais pelo painel e depois desligue os exemplos.

Os oito itens iniciais continuam no painel como rascunhos inativos. Um produto real só fica público com nome, categoria, preço confirmado por Wesley no painel, foto enviada pelo painel, tamanhos quando for camisa e tipo de entrega; pronta entrega também exige estoque maior que zero. Produtos personalizáveis exigem campos de personalização definidos. O servidor mantém itens incompletos inativos mesmo quando alguém tenta ativá-los. Confirme as fotos e revise nomes, preços e disponibilidade antes de ativar.

## Preparação para produção

### Cálculo de frete por CEP

O frete automático usa somente a cotação da API Melhor Envio. Não compra etiqueta nem altera o pagamento por WhatsApp. Ele começa **desativado**, preservando o pedido atual. Para ativar, crie uma conta no Melhor Envio e configure no servidor `MELHOR_ENVIO_TOKEN` com permissão `shipping-calculate` e `MELHOR_ENVIO_USER_AGENT` no formato `Wesllen Imports (email-tecnico@dominio.com)`. Esses valores são segredos do backend; nunca use prefixos públicos. Para testar com uma conta sandbox, use também `MELHOR_ENVIO_SANDBOX=1` e o token correspondente.

No painel, informe o CEP de origem em **Configurações** e o peso em kg, largura, altura e comprimento em cm de cada produto ativo. Depois ative **Cálculo automático**. O servidor recusa a ativação sem token, CEP de origem ou medidas dos produtos ativos. O cliente informa CEP e endereço no carrinho, escolhe uma modalidade e vê o total. Antes de gravar o orçamento e montar o WhatsApp, o servidor consulta o frete de novo e recusa valores alterados ou desatualizados. CEP, endereço, modalidade, prazo e preço ficam no orçamento já existente; não há nova migração SQL.

Execute `npm run build` e `npm test`. Wesley deve criar uma senha definitiva privada. Em um terminal local confiável, execute **interativamente** `npm run admin:hash` e digite a senha no prompt oculto. O script produz o formato `scrypt$<sal de 32 caracteres hexadecimais>$<hash de 128 caracteres hexadecimais>`, exatamente o formato aceito pelo servidor. Copie o resultado diretamente para o segredo de ambiente `ADMIN_PASSWORD_HASH` da hospedagem; não envie a senha ou o hash por chat, documentação, código, Git ou logs. Em produção, configure também `NODE_ENV=production`, `HOST=0.0.0.0` e a `PORT` da hospedagem. Use HTTPS. Depois, Wesley deve conferir o login em `/admin` com a senha escolhida e que uma senha errada é recusada, sem registrar as tentativas em relatórios.

O servidor recusa iniciar em produção se `ADMIN_PASSWORD_HASH` estiver ausente ou inválido, ou se `data/admin-access.txt` ainda existir. Retire o arquivo temporário de desenvolvimento do ambiente de produção. `data/admin.json` não é necessário quando o hash vem do ambiente. O painel mostrará que a senha é gerenciada pelo servidor.

Para montar uma pasta de prévia do deploy sem credenciais ou dados locais, use `npm run release:prepare`. O comando cria `release-preview-*` com o código e recursos públicos, sem `data`, senhas, orçamentos ou uploads locais. Essa pasta é ignorada pelo Git. O catálogo deve estar no Supabase e as fotos reais devem ser enviadas pelo painel após configurar o Storage. O arquivo `data/admin-access.txt` também não é servido pela aplicação, que expõe somente `public/`.

Nenhuma publicação é feita por este projeto automaticamente.

## Times e clubes

A página **Times / Clubes** do painel reúne 20 clubes do Brasil, 23 clubes internacionais, 16 seleções nacionais, além dos grupos legados Seleções e Retrô. Os 43 escudos de clubes e os 16 das seleções vieram das URLs dos manifestos entregues por Wesley e foram incluídos em `public/assets/team-logos/`; cada download foi associado pelo nome do manifesto e verificado como PNG válido de até 5 MB. O SVG do card genérico “Seleções” também veio do pacote de Wesley e foi conferido antes de ser incluído. Um escudo enviado pelo painel tem prioridade sobre a imagem incluída no site. Wesley ainda pode enviar PNG ou WebP transparente pelo painel; o upload vai para `team-logos/` dentro do bucket `wesllen-products` (ou `public/uploads/team-logos` na prévia local). O card Retrô continua com indicação neutra. Esta inclusão de arquivos públicos não exige nova migração SQL.

A loja salva os times no documento `wesllen_catalog`, sem depender de tabelas auxiliares. As tentativas das migrações 002 e 003 foram retiradas após erros no trigger; **não execute esses arquivos**. Wesley aplicou [a migração 004](supabase/sql-editor/004_wesllen_selecoes_catalogo.sql) e confirmou 16 seleções no resultado do SQL Editor. Ela remove o trigger defeituoso caso exista e acrescenta apenas seleções ausentes, sem alterar produtos, preços ou times já editados.

Na Home, aparecem somente times ativos, marcados para Home e com pelo menos uma camisa ativa. O botão **Ver todos** abre `/times`; cada clube usa `/times/<slug>` e mostra exclusivamente as suas camisas. Para camisas novas, selecione um time na lista pesquisável do formulário de produto. Produtos antigos mantêm o texto legado e recebem `team_id` quando há correspondência; um vínculo desconhecido continua pendente até ser escolhido no painel.

## Supabase e Vercel

1. No projeto Supabase correto, cole [a migração SQL](supabase/sql-editor/001_wesllen_setup.sql) no **SQL Editor** e execute. Confira as duas linhas finais com `rowsecurity = true`. Esta migração cria somente as tabelas privadas de catálogo e orçamentos; não contém produtos ou credenciais. Para mudanças futuras no banco, salve outro arquivo SQL e aplique-o no editor antes do código correspondente.
2. Em **Storage**, crie pelo painel um bucket **público** chamado `wesllen-products`, limitado a 5 MB e aos formatos `image/png`, `image/jpeg` e `image/webp`. O bucket é público apenas para leitura de fotos; o upload ocorre no servidor após autenticação no painel. O Storage deve ser administrado pela API ou pelo painel, não por edições diretas nas tabelas internas do Storage.
3. No terminal privado do computador do Wesley, configure `SUPABASE_URL` com a URL HTTPS do projeto (a URL terminada em `/rest/v1/` também é aceita) e `SUPABASE_SECRET_KEY` com a chave **secret** atual. Não copie a chave para `.env.example`, código, Git, navegador ou comandos que a imprimam. A chave **publishable** não é necessária nesta arquitetura, pois somente o servidor acessa o Supabase.
4. Após aplicar a migração, execute **uma vez** `npm run supabase:seed` no projeto local. Ele copia o catálogo local existente, inclusive as configurações da loja, para o Supabase. O comando recusa sobrescrever um catálogo que já exista. Os rascunhos incompletos continuam ocultos. Revise o resultado pelo painel. Se as fotos reais existentes ainda estiverem em `/uploads`, envie-as novamente pelo painel para que fiquem no Storage; o servidor da Vercel não mantém uploads locais.
5. Importe `ogaitjunior-sudo/wesleycamisas` na Vercel, com a **raiz do repositório (`./`)** como Root Directory. Configure `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `ADMIN_PASSWORD_HASH` como variáveis privadas de ambiente para Preview e Production antes do primeiro deploy. O hash administrativo é gerado interativamente por `npm run admin:hash`. Não use prefixo `NEXT_PUBLIC_` ou `VITE_` nessas variáveis. A função `api/index.js` encaminha as rotas ao mesmo servidor Node usado localmente; `vercel.json` inclui os arquivos públicos na função e reescreve as rotas. O servidor recusa iniciar na Vercel se faltarem Supabase ou hash administrativo. Vercel fornece `VERCEL=1` automaticamente; não é preciso configurar `PORT` manualmente.
6. Após configurar os segredos, faça um **deploy Preview** primeiro e teste Home, catálogo, login, upload, edição, carrinho, WhatsApp e URLs diretas como `/produto` e `/times/flamengo`. Depois publique Production e confira o domínio gerado. Com o repositório conectado, novos pushes podem gerar deployments automaticamente.

A chave secreta compartilhada em uma conversa deve ser substituída por outra chave no painel Supabase antes de produção. Use a nova chave somente nos segredos do servidor da Vercel.
