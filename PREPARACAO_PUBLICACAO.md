# Preparação para publicação — 15/10/2026

## Configuração atual

- A Vercel está conectada a `ogaitjunior-sudo/wesleycamisas`.
- `wesllenimports.com.br` e `www.wesllenimports.com.br` aparecem com **Valid Configuration**. O domínio principal redireciona para `www`, que está associado a Production. Não é necessário alterar DNS.
- `PUBLIC_SITE_URL=https://www.wesllenimports.com.br/` foi adicionada somente a Production. A Vercel informou que a variável entra em vigor no próximo deploy. As variáveis existentes de Supabase e acesso administrativo foram preservadas.
- O código lê o catálogo do Supabase a cada requisição, responde sem cache e mostra somente produtos completos e publicados. A vitrine atualiza o catálogo sem novo deploy para cada produto. Esta conclusão é da revisão do código; não houve escrita nem validação em produção nesta etapa.

## Publicação pendente

As alterações estão na branch local `auto-publicacao-produtos`. A `main` remota não recebeu mudanças mais recentes e é ancestral da branch de correções, permitindo integração por avanço direto, sem conflito. Nenhum commit foi enviado ao GitHub e nenhum deploy foi iniciado nesta etapa.

Quando houver autorização para publicar, atualizar a `main` no GitHub com o commit local preparado. Essa ação acionará o deploy de Production na Vercel. O valor de `PUBLIC_SITE_URL` passará a valer nesse deploy. Não executar novamente a migração nem a importação inicial do Supabase existente.

## Frete

O Melhor Envio continua opcional para esta publicação. Faltam `MELHOR_ENVIO_TOKEN` e `MELHOR_ENVIO_USER_AGENT` na Vercel, além do CEP de origem e das medidas dos produtos no painel para ativar o cálculo automático. Enquanto estiver desligado, o pedido segue pelo WhatsApp com frete a combinar e sem valor de frete fictício. Nenhum pagamento automático foi adicionado.

Esta etapa não incluiu testes de homologação, alterações de produtos ou mudanças de credenciais, domínio e Supabase.
