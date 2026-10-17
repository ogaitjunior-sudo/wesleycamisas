# Diagnóstico do frete — 16/10/2026

## Causa confirmada no site publicado

- `GET /api/catalog` retorna `settings.shippingEnabled: false`. Por isso o checkout oculta o botão de cálculo e mostra “Cálculo automático indisponível” antes de chamar o Melhor Envio.
- No painel da loja, “Cálculo automático” estava em **NÃO**. O CEP de origem cadastrado é `88823-678`; a consulta de endereço do próprio site retornou Içara/SC.
- No primeiro exame, o único produto publicado tinha peso `0,25 kg` e dimensões `25 × 5 × 30 cm`. Depois, o catálogo foi atualizado: agora há seis produtos disponíveis, todos com peso e dimensões positivos.
- Na Vercel, o projeto `wesleycamisas` tinha `MELHOR_ENVIO_TOKEN` em Production, mas faltava `MELHOR_ENVIO_USER_AGENT`. A variável foi adicionada em Production com o contato público da loja. A Vercel informou que um novo deployment é necessário para ela entrar em vigor.
- `MELHOR_ENVIO_SANDBOX` não aparecia nas variáveis do projeto nem entre as variáveis compartilhadas vinculadas; a configuração visível é de produção.

## Código preparado localmente

- O checkout passa a consultar o frete automaticamente após oito dígitos de CEP e a recotar quando o carrinho muda, mantendo a seleção da modalidade, o total e o WhatsApp.
- O bloco “Calcular frete” ganhou um campo de CEP sincronizado com o CEP dos dados de entrega; antes, o botão aparecia separado do único campo editável e a tentativa de cálculo mostrava “Informe um CEP válido com 8 números”.
- Um endpoint autenticado `/api/admin/shipping/status` mostra as condições que bloqueiam o frete, sem retornar o token.
- Erros de HTTP e ausência de modalidades do Melhor Envio passam a ser registrados no servidor, com ocultação do token no corpo da resposta.
- `npm test`: 31 testes aprovados. `npm run check`: aprovado.
- A execução do verificador contra `https://www.wesllenimports.com.br/` parou antes das cotações com `shippingEnabled=false`, confirmando que a versão pública ainda não permite o teste real.

## Validação real em implantação isolada

- Uma implantação protegida na Vercel foi criada com as variáveis de produção, sem associar `www.wesllenimports.com.br` a ela. Somente nessa cópia de teste, o cálculo foi habilitado e usado o CEP de origem `88823-678`, previamente conferido como Içara/SC. A configuração compartilhada da loja não foi alterada.
- O Melhor Envio retornou dez modalidades com preço e prazo para cada CEP testado: São Paulo `01001-000` (PAC R$ 23,23, 6 dias; SEDEX R$ 46,59, 2 dias), Rio de Janeiro `20040-020` (PAC R$ 28,00, 7 dias; SEDEX R$ 59,34, 3 dias) e Salvador `40026-032` (PAC R$ 63,88, 7 dias; SEDEX R$ 81,97, 3 dias).
- O checkout da implantação isolada serve o código novo de cotação automática. O domínio público ainda serve o código antigo, confirmado pelo conteúdo de `shop.js`.
- Na implantação isolada atualizada, o comprador digitou `48400-000` no novo campo de CEP e enviou uma captura do checkout com modalidades reais, preços e prazos. Para o produto de R$ 110,00, selecionou Correios PAC por R$ 74,56; a captura seguinte confirmou o total de R$ 184,56 no resumo.
- A versão atualizada também foi consultada diretamente para os três CEPs exigidos e retornou dez modalidades em cada um, com os mesmos preços e prazos de PAC registrados acima.
- O catálogo compartilhado recebeu novos produtos durante a auditoria e continua com `shippingEnabled=false`. A API pública omite o CEP de origem deliberadamente; ele deve ser reconferido no painel antes de ativar o cálculo para os clientes. A última leitura no painel mostrou `88823-678`.

## Publicação e validação no domínio da loja

- Os commits da correção foram enviados para `main` e a Vercel associou o deployment `dpl_6VTpAPCckvPeCX9Goi6VmRoUWte6` a `www.wesllenimports.com.br`. O ajuste temporário da implantação isolada não foi enviado ao repositório.
- O responsável pela loja ativou “Cálculo automático” no painel. A API pública passou a retornar `shippingEnabled: true`.
- `npm run shipping:live-check -- https://www.wesllenimports.com.br/` passou para São Paulo, Rio de Janeiro e Salvador, com dez modalidades reais, preço e prazo em cada CEP. Não há configuração pendente no Melhor Envio ou na Vercel identificada nesta validação.
- O comprador confirmou em captura do checkout de teste a cotação e a soma do PAC ao pedido. O domínio público usa o mesmo código corrigido e o cálculo foi confirmado pela API após a ativação. A finalização continua pelo WhatsApp.

## Ajuste de personalização identificado depois

- As camisas personalizáveis estão cadastradas com R$ 35,00 adicionais. A regra confirmada pelo responsável é cobrar esse valor apenas quando o cliente escolher a personalização, avisando o preço antes dos campos.
- A página do produto agora começa com “Sem personalização” e mostra a opção “Quero personalizar + R$ 35,00”. Os campos só aparecem quando essa opção é escolhida; um pedido sem personalização continua com o preço anunciado. Uma captura de teste confirmou a camisa do Grêmio em R$ 75,00 sem personalização.
- A primeira implantação de teste dessa interface falhou ao abrir o produto porque a prévia tentou ler um nome ausente. O caso foi corrigido e uma nova captura confirmou a página funcionando antes da publicação desse ajuste.

O valor real do token não foi exposto nem copiado. Não há preço ou prazo fictício.
