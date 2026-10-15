# Auditoria da loja Wesllen Imports — 14/10/2026

## 1. Problemas encontrados

- O painel salvava imagem e textos do banner, mas o carrossel público não os lia.
- O produto personalizável não mostrava nome e número sobre a foto.
- Fotos de produtos usavam `object-fit: cover`, podendo cortar a peça.
- Chamadas de personalização podiam levar a um produto de demonstração indisponível.
- O carrinho podia falhar ao ler uma lista corrompida do armazenamento local.
- A Home não tinha `h1`; faltavam canonical, Open Graph, `robots.txt` e sitemap gerado a partir do catálogo.
- Nomes longos de times podiam ultrapassar seus cards.

## 2. Correções aplicadas

- O carrossel lê o catálogo público sem cache e incorpora o banner configurado no painel. Mantém os slides existentes. Quando não há imagem enviada, usa fundo preto e dourado próprio; links para produtos não publicados levam ao catálogo.
- A página do produto mostra uma prévia ilustrativa de nome e número sobre a foto, com atualização imediata e aviso de que posição e cor podem variar na peça final.
- As fotos de produtos passam a preservar a imagem inteira, com carregamento adiado nas miniaturas e cards.
- Chamadas de personalização sem produto real publicado levam ao catálogo de personalizados.
- O carrinho descarta itens inválidos ao ler o armazenamento local.
- A Home recebeu `h1`; o servidor fornece metadados, canonical, `robots.txt` e sitemap com produtos publicados. O painel, carrinho e produtos inexistentes recebem `noindex`; prévias Vercel também.
- Nomes de times podem quebrar linha dentro dos cards.

## 3. Melhorias e preservação

Identidade visual, logomarca, catálogo existente, pedidos, pagamentos por WhatsApp e integrações atuais foram preservados. Não houve exclusão de dados reais, alteração de DNS nem publicação de código. `PUBLIC_SITE_URL` foi documentada para definir o domínio canônico definitivo.

## 4. Resultado dos testes

- `npm run build`: passou. Neste projeto, o build executa a checagem de sintaxe JavaScript (`npm run check`). Não existem TypeScript, script de lint ou compilação de pacote frontend configurados.
- `npm test`: **21/21 passaram**, incluindo testes de painel, publicação, catálogo, pedido, frete, Supabase simulado, Vercel simulado e PWA.
- Navegação visual local em 390, 768 e 1280 px: Home, catálogo, times, carrinho e login do painel abriram sem rolagem horizontal; imagens carregadas não estavam quebradas. A prévia de personalização foi conferida em 390 px com nome e número.
- Rotas locais `/robots.txt` e `/sitemap.xml`: HTTP 200. Canonical foi encontrado em Home, catálogo, produto e time. `/admin` redirecionou para login.
- O teste de integração precisou de acesso a `127.0.0.1`, bloqueado na execução inicial pelo sandbox; passou integralmente quando a conexão local foi liberada.

## 5. Painel administrativo

Os testes automatizados passaram para autenticação, upload, edição de catálogo e persistência local/simulada. A página de login foi inspecionada em três larguras. Não houve login ou escrita no painel de produção, pois as credenciais de produção não estavam disponíveis neste ambiente.

## 6. Publicação automática de produtos

O código lê o catálogo pelo banco em cada requisição, publica somente itens completos e mantém rascunhos ocultos. Os testes de publicação e modo Vercel passaram com serviço simulado. Não foi possível validar a publicação real no projeto Supabase ou no domínio público nesta sessão.

## 7. Carrinho e frete

Os testes passaram para quantidades, personalização, subtotal, total, revalidação da cotação e mensagem do WhatsApp. O cálculo usa Melhor Envio quando habilitado e não inventa cotações. Não havia token nem configuração do serviço neste ambiente, então uma cotação real não foi testada.

## 8. PWA

Manifesto, ícones e política do service worker passaram nos testes. A API do catálogo continua fora do cache do PWA. Instalação física em Android e iPhone e atualização de uma instalação já existente não foram testadas em dispositivos reais.

## 9. Pendências

1. Configurar os segredos privados e `PUBLIC_SITE_URL` no ambiente de publicação; validar o Supabase real, RLS, Storage, login e publicação de um produto real sem apagar ou substituir dados.
2. Configurar e testar o Melhor Envio com CEP e medidas reais antes de ativar frete automático.
3. Revisar preços, fotos, estoque, WhatsApp e banners no painel; desativar a vitrine demonstrativa quando houver produtos reais suficientes.
4. Medir Core Web Vitals no domínio de produção e verificar instalação PWA em Android e iPhone reais.
5. Confirmar o fluxo completo no domínio publicado, inclusive chegada da mensagem ao WhatsApp do vendedor. Não foi enviado pedido real nesta auditoria.

## 10. Status final

**NÃO APTO PARA PUBLICAÇÃO AINDA.** O código local passou nos testes disponíveis, mas as integrações e os dados reais de produção ainda não foram validados. Nenhuma alteração foi publicada automaticamente.
