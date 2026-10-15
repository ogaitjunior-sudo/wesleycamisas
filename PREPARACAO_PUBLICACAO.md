# Preparação para publicação — 15/10/2026

As alterações estão preparadas localmente. Não houve envio ao GitHub, publicação na Vercel nem alteração de dados no Supabase. Esta etapa não incluiu testes.

## O que falta fazer

1. **Corrigir o DNS em Registro.br.** Os servidores autoritativos atuais são `a.auto.dns.br` e `b.auto.dns.br`. O domínio `wesllenimports.com.br` não retorna registro A e `www.wesllenimports.com.br` não existe no DNS. No painel de DNS, cadastrar o registro **A** de `@` para `216.198.79.1` e o **CNAME** de `www` para `ecb32f2213fc1c3c.vercel-dns-017.com.`. Esses são os valores que a Vercel indica para o projeto `wesleycamisas` nesta data. Preservar os demais registros, especialmente os de e-mail. A Vercel já tem os dois nomes associados ao projeto: o domínio principal redireciona para `www`, que está marcado como Production. O endereço `wesleycamisas.vercel.app` está válido.
2. **Configurar o Melhor Envio na Vercel**, se o frete automático deve estar ativo ao abrir a loja. Faltam `MELHOR_ENVIO_TOKEN` (token de produção com permissão de cotação `shipping-calculate`) e `MELHOR_ENVIO_USER_AGENT` (nome da aplicação e e-mail técnico no formato exigido pelo serviço). Inserir os valores apenas como variáveis privadas da Vercel. No painel da loja, cadastrar o CEP de origem e peso, largura, altura e comprimento de cada produto publicado; então ativar o cálculo automático. Enquanto isso não for feito, o frete permanece a combinar com a loja e o total final fica pendente na mensagem do WhatsApp.
3. **Autorizar a publicação quando estiver pronto.** O projeto Vercel está conectado a `ogaitjunior-sudo/wesleycamisas`; as correções permanecem na branch local `auto-publicacao-produtos`. Os deploys dessa branch são de Preview; os deploys de `main` são de Production. Portanto, o envio da branch criará uma prévia e a integração em `main` publicará em produção. Antes disso, definir `PUBLIC_SITE_URL` na Vercel como `https://www.wesllenimports.com.br/`, para os links canônicos e o sitemap. Não executar novamente a migração nem a importação inicial do Supabase existente.

## Código preparado

O painel grava produtos e imagens por meio do servidor no Supabase. A API pública lê o catálogo a cada requisição, responde sem cache e retorna somente produtos completos e publicados. A vitrine consulta a API sem cache e atualiza o catálogo ao recuperar foco ou periodicamente. Produtos desativados são retirados da API pública. Isso foi confirmado pela leitura do código, sem operação de escrita nem validação da publicação em produção nesta etapa.
