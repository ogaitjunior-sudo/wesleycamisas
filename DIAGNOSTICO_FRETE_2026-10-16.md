# Diagnóstico do frete — 16/10/2026

## Causa confirmada no site publicado

- `GET /api/catalog` retorna `settings.shippingEnabled: false`. Por isso o checkout oculta o botão de cálculo e mostra “Cálculo automático indisponível” antes de chamar o Melhor Envio.
- No painel da loja, “Cálculo automático” estava em **NÃO**. O CEP de origem cadastrado é `88823-678`; a consulta de endereço do próprio site retornou Içara/SC.
- O único produto publicado tinha peso `0,25 kg` e dimensões `25 × 5 × 30 cm`. Esses dados não explicam a desativação atual.
- Na Vercel, o projeto `wesleycamisas` tinha `MELHOR_ENVIO_TOKEN` em Production, mas faltava `MELHOR_ENVIO_USER_AGENT`. A variável foi adicionada em Production com o contato público da loja. A Vercel informou que um novo deployment é necessário para ela entrar em vigor.
- `MELHOR_ENVIO_SANDBOX` não aparecia nas variáveis do projeto nem entre as variáveis compartilhadas vinculadas; a configuração visível é de produção.

## Código preparado localmente

- O checkout passa a consultar o frete automaticamente após oito dígitos de CEP e a recotar quando o carrinho muda, mantendo a seleção da modalidade, o total e o WhatsApp.
- Um endpoint autenticado `/api/admin/shipping/status` mostra as condições que bloqueiam o frete, sem retornar o token.
- Erros de HTTP e ausência de modalidades do Melhor Envio passam a ser registrados no servidor, com ocultação do token no corpo da resposta.
- `npm test`: 31 testes aprovados. `npm run check`: aprovado.
- A execução do verificador contra `https://www.wesllenimports.com.br/` parou antes das cotações com `shippingEnabled=false`, confirmando que a versão pública ainda não permite o teste real.

## Validação pendente antes da publicação

1. Colocar o User-Agent em vigor numa implantação de teste que não altere o domínio público.
2. Ativar o cálculo automático no catálogo somente após o ambiente de teste aceitar a configuração.
3. Executar `npm run shipping:live-check -- https://URL-DE-TESTE/`. O script consulta o endereço e exige modalidades reais com preço e prazo para São Paulo (`01001-000`), Rio de Janeiro (`20040-020`) e Salvador (`40026-032`). Os três CEPs foram confirmados no ViaCEP; `40020-000` foi descartado porque o ViaCEP o retorna como inexistente.
4. Conferir no checkout de teste que as três cotações aparecem, a seleção soma o frete ao total e mudanças de CEP/quantidade/produto recotam.
5. Inspecionar os logs do servidor se o provedor recusar qualquer chamada. A presença do token na Vercel não comprova validade ou escopo `shipping-calculate`.

Nenhuma alteração de código foi publicada. O valor real do token não foi exposto nem copiado. Não há preço ou prazo fictício.
