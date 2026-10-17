# Diagnóstico do frete — 16/10/2026

## Causa confirmada no site publicado

- `GET /api/catalog` retorna `settings.shippingEnabled: false`. Por isso o checkout oculta o botão de cálculo e mostra “Cálculo automático indisponível” antes de chamar o Melhor Envio.
- No painel da loja, “Cálculo automático” estava em **NÃO**. O CEP de origem cadastrado é `88823-678`; a consulta de endereço do próprio site retornou Içara/SC.
- No primeiro exame, o único produto publicado tinha peso `0,25 kg` e dimensões `25 × 5 × 30 cm`. Depois, o catálogo foi atualizado: agora há seis produtos disponíveis, todos com peso e dimensões positivos.
- Na Vercel, o projeto `wesleycamisas` tinha `MELHOR_ENVIO_TOKEN` em Production, mas faltava `MELHOR_ENVIO_USER_AGENT`. A variável foi adicionada em Production com o contato público da loja. A Vercel informou que um novo deployment é necessário para ela entrar em vigor.
- `MELHOR_ENVIO_SANDBOX` não aparecia nas variáveis do projeto nem entre as variáveis compartilhadas vinculadas; a configuração visível é de produção.

## Código preparado localmente

- O checkout passa a consultar o frete automaticamente após oito dígitos de CEP e a recotar quando o carrinho muda, mantendo a seleção da modalidade, o total e o WhatsApp.
- Um endpoint autenticado `/api/admin/shipping/status` mostra as condições que bloqueiam o frete, sem retornar o token.
- Erros de HTTP e ausência de modalidades do Melhor Envio passam a ser registrados no servidor, com ocultação do token no corpo da resposta.
- `npm test`: 31 testes aprovados. `npm run check`: aprovado.
- A execução do verificador contra `https://www.wesllenimports.com.br/` parou antes das cotações com `shippingEnabled=false`, confirmando que a versão pública ainda não permite o teste real.

## Validação real em implantação isolada

- Uma implantação protegida na Vercel foi criada com as variáveis de produção, sem associar `www.wesllenimports.com.br` a ela. Somente nessa cópia de teste, o cálculo foi habilitado e usado o CEP de origem `88823-678`, previamente conferido como Içara/SC. A configuração compartilhada da loja não foi alterada.
- O Melhor Envio retornou dez modalidades com preço e prazo para cada CEP testado: São Paulo `01001-000` (PAC R$ 23,23, 6 dias; SEDEX R$ 46,59, 2 dias), Rio de Janeiro `20040-020` (PAC R$ 28,00, 7 dias; SEDEX R$ 59,34, 3 dias) e Salvador `40026-032` (PAC R$ 63,88, 7 dias; SEDEX R$ 81,97, 3 dias).
- O checkout da implantação isolada serve o código novo de cotação automática. O domínio público ainda serve o código antigo, confirmado pelo conteúdo de `shop.js`.
- O catálogo compartilhado recebeu novos produtos durante a auditoria e continua com `shippingEnabled=false`. A API pública omite o CEP de origem deliberadamente; ele deve ser reconferido no painel antes de ativar o cálculo para os clientes. A última leitura no painel mostrou `88823-678`.

## Validação pendente antes da publicação

1. Conferir no checkout de teste que as três cotações aparecem, a seleção soma o frete ao total e mudanças de CEP/quantidade/produto recotam.
2. Publicar apenas o commit da correção, sem o ajuste temporário usado na implantação isolada.
3. Conferir o CEP de origem `88823-678` e ativar o cálculo no painel da loja.
4. Executar `npm run shipping:live-check -- https://www.wesllenimports.com.br/` e conferir o checkout público após a publicação. O script consulta o endereço e exige modalidades reais com preço e prazo para os três CEPs.

Nenhuma alteração foi enviada ao domínio público. O valor real do token não foi exposto nem copiado. Não há preço ou prazo fictício.
