export const SIZES = ['PP', 'P', 'M', 'G', 'GG', 'G1', 'G2', 'G3'];

export const isApparel = product => /\b(camisa|camiseta|blusa|moletom|jaqueta|calça|short|bermuda|vestido|regata|agasalho)s?\b/i.test(`${product.category || ''} ${product.name || ''}`);

export function productSizes(product) {
  const selected = new Set((Array.isArray(product.sizes) ? product.sizes : []).map(size => size === 'XG' ? 'G1' : size));
  return SIZES.filter(size => selected.has(size));
}

export function sizeStock(product, size) {
  if (product.sizeStock) return Object.hasOwn(product.sizeStock, size) ? Number(product.sizeStock[size]) : 0;
  // Catálogos antigos só tinham estoque total. Mantemos esse limite até a edição no painel.
  return product.fulfillment === 'ready' && product.stock != null ? Number(product.stock) : 99;
}
