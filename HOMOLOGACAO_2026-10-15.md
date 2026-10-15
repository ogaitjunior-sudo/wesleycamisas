# Homologação final — 15/10/2026

**Registro histórico:** os resultados de testes abaixo são da revisão anterior. As correções locais feitas depois deste registro não foram submetidas a novos testes ou build, conforme a orientação posterior de não realizar homologação nesta etapa.

## Estado

**NÃO APTO PARA PUBLICAÇÃO.** O código local passou nos testes, mas não houve homologação com escrita em um projeto Supabase separado nem cotação real de frete. O responsável confirmou que ainda não há ambiente de testes. Nenhuma alteração desta etapa foi publicada na Vercel ou gravada nos dados reais.

## Resultado por área

| Área | Resultado verificado | Pendência |
| --- | --- | --- |
| Supabase | A Vercel tem `SUPABASE_URL` e `SUPABASE_SECRET_KEY` em Production e Preview. A vitrine do Preview carregou, o que indica leitura do catálogo pela aplicação implantada. O SQL do repositório habilita RLS e restringe as tabelas ao papel de serviço. | A conta Supabase disponível no navegador recebeu “You do not have access to this project”. Não foram conferidas diretamente as tabelas, as políticas efetivas de RLS, o bucket, a persistência real de imagens nem a escrita de produtos. A existência das variáveis não valida seus valores ou permissões. |
| Painel | `ADMIN_PASSWORD_HASH` está configurada em Production e Preview. No servidor local isolado, login, salvamento de configurações e permanência após recarga funcionaram. Cadastro de rascunho funcionou; publicação incompleta foi impedida com indicação dos dados faltantes. O teste do modo Vercel simulado cobriu cadastro, edição, desativação, exclusão e persistência após reinício. | Login e operações com escrita no painel implantado não foram testados; não havia senha administrativa de teste nem projeto Supabase separado confirmado. |
| Publicação automática | O servidor lê o catálogo a cada requisição e responde `/api/catalog` com `Cache-Control: no-store`. O teste hospedado simulado confirmou camisa na categoria e time corretos, foto, preço, persistência após reinício e ocultação após desativar. O service worker não intercepta a API do catálogo. | Falta publicar uma camisa de homologação em Supabase de teste e conferir sua aparição no Preview sem deploy. |
| Frete | CEP inválido, dados de envio, composição do total e recotação antes do pedido passaram com provedor simulado. O código só permite ativar frete com token, agente de usuário, CEP de origem e medidas. | `MELHOR_ENVIO_TOKEN` e `MELHOR_ENVIO_USER_AGENT` não estão configuradas na Vercel; não foi possível obter preço e prazo reais para CEPs válidos ou inválidos. |
| WhatsApp | Testes verificaram itens, personalização, subtotal, frete, total e link `wa.me`. O servidor recalcula valores antes de salvar o orçamento. | Não foi enviado pedido ou mensagem real, nem confirmada a chegada ao vendedor. Sem frete real, o fluxo completo com frete segue pendente. Nenhum pagamento automático foi implementado. |
| PWA | Manifesto, ícones, versão do service worker e exclusão de catálogo, painel e uploads do cache passaram nos testes. A vitrine consulta o catálogo sem cache e atualiza ao recuperar foco ou em intervalo de 30 segundos. | Instalação e atualização em Android/iPhone, inclusive app já instalado, não foram testadas em dispositivos reais. |
| Responsividade | A auditoria anterior inspecionou 390, 768 e 1280 px. A navegação atual abriu Home e painel; a tentativa de impor 390 px nesta etapa manteve a largura efetiva do navegador em 1536 px. | Revalidar os pontos de quebra atuais em um navegador móvel ou emulação que aplique a largura solicitada. |

## Testes desta etapa

- `npm test`: **21/21 aprovados**.
- `npm run build`: aprovado; neste projeto, o comando executa verificação de sintaxe.
- `git diff --check`: sem erro de whitespace. Os avisos de conversão LF/CRLF são informativos.
- O ambiente de teste local foi isolado em diretório temporário e removido após os testes.

## Correções e proteções locais

- A API pública usa lista permitida de configurações, impedindo que campos internos adicionados ao catálogo sejam enviados ao navegador.
- O teste do modo Vercel simulado agora persiste o catálogo entre processos e cobre edição, desativação e exclusão.
- Os scripts de teste com escrita em Supabase exigem `SUPABASE_TEST_PROJECT=1` e um marcador de homologação no catálogo remoto antes de alterar dados.
- Os comandos de auditoria somente leitura e de teste com escrita estão documentados no README.

## Limitações registradas

1. A escrita no Supabase real, as permissões efetivas e o Storage não foram verificados. O responsável dispensou a criação de outro projeto e a homologação nesta etapa. Nenhum teste com escrita será executado no Preview ou em Production.
2. `MELHOR_ENVIO_TOKEN` e `MELHOR_ENVIO_USER_AGENT` não estavam configuradas na Vercel; o frete automático real permanece indisponível. O projeto não usa cotação simulada em produção.
3. Os domínios personalizados apareciam como “Invalid Configuration” na Vercel. O alias `wesleycamisas.vercel.app` estava válido. O domínio não foi modificado.
4. As alterações de código permanecem locais. Uma publicação em produção exige autorização do responsável.

**Credenciais e valores secretos não constam deste relatório.**
