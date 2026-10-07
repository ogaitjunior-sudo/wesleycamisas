// Vitrine ilustrativa. Estes itens não são cadastrados no banco nem aceitam pedidos.
// O administrador pode ocultar a vitrine em Configurações quando tiver fotos e preços reais.
const shirtSizes = ['P', 'M', 'G', 'GG', 'XG'];

export const demoProducts = [
  { id: 'demo-brasil-amarela', name: 'Camisa Brasil Amarela · demonstração', category: 'Camisas', team: 'selecao-brasil', price: 189.90, image: '/assets/demo/brasil.webp', description: 'Exemplo ilustrativo de camisa amarela e verde. Foto e preço de demonstração.', sizes: shirtSizes, featured: true },
  { id: 'demo-flamengo-rubro-negra', name: 'Camisa Flamengo Rubro-Negra · demonstração', category: 'Camisas', team: 'flamengo', price: 179.90, image: '/assets/demo/flamengo-rubro-negra.webp', description: 'Exemplo ilustrativo de camisa vermelha e preta. Foto e preço de demonstração.', sizes: shirtSizes, featured: true },
  { id: 'demo-flamengo-branca', name: 'Camisa Flamengo Branca · demonstração', category: 'Camisas', team: 'flamengo', price: 179.90, image: '/assets/demo/flamengo-branca.webp', description: 'Exemplo ilustrativo de segundo modelo em branco, vermelho e preto. Foto e preço de demonstração.', sizes: shirtSizes, featured: true },
  { id: 'demo-real-madrid-branca', name: 'Camisa Real Madrid Branca · demonstração', category: 'Camisas', team: 'real-madrid', price: 199.90, image: '/assets/demo/real-madrid.webp', description: 'Exemplo ilustrativo de camisa branca com detalhes dourados. Foto e preço de demonstração.', sizes: shirtSizes, featured: true },
  { id: 'demo-palmeiras-verde', name: 'Camisa Palmeiras Verde · demonstração', category: 'Camisas', team: 'palmeiras', price: 179.90, image: '/assets/demo/palmeiras.webp', description: 'Exemplo ilustrativo de camisa verde com detalhes brancos. Foto e preço de demonstração.', sizes: shirtSizes },
  { id: 'demo-bone-preto', name: 'Boné Preto Dourado · demonstração', category: 'Bonés', team: '', price: 69.90, image: '/assets/demo/bone-preto.webp', description: 'Exemplo ilustrativo de boné preto com símbolo dourado. Foto e preço de demonstração.', sizes: [] },
  { id: 'demo-personalizada-preta', name: 'Camisa Preta Personalizável · demonstração', category: 'Personalizados', team: 'selecao-brasil', price: 159.90, image: '/assets/demo/personalizada-preta.webp', description: 'Exemplo ilustrativo de camisa para nome e número. Foto e preço de demonstração.', sizes: shirtSizes, customizable: true, personalizationPrice: 25 }
].map(product => ({ ...product, team_id: product.team, available: true, demo: true, badge: 'DEMONSTRAÇÃO', fulfillment: 'order', photos: [], promotion: false }));

export function withDemoProducts(catalog) {
  if (catalog?.settings?.demoShowcaseEnabled === false) return catalog;
  const products = Array.isArray(catalog.products) ? catalog.products : [];
  const existingIds = new Set(products.map(product => product.id));
  const hiddenIds = new Set(Array.isArray(catalog?.settings?.demoHiddenIds) ? catalog.settings.demoHiddenIds : []);
  return { ...catalog, products: [...products, ...demoProducts.filter(product => !existingIds.has(product.id) && !hiddenIds.has(product.id))] };
}
