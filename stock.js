import { isApparel, productSizes, sizeStock } from './public/sizes.js';

export function saleItemsFrom(rawItems, catalog) {
  if (!Array.isArray(rawItems) || !rawItems.length || rawItems.length > 50) throw new Error('Informe os itens da venda.');
  const grouped = new Map();
  for (const raw of rawItems) {
    const product = catalog.products.find(entry => entry.id === raw.productId);
    if (!product) throw new Error('Produto não encontrado.');
    const size = raw.size === 'XG' ? 'G1' : String(raw.size || '');
    const sizes = productSizes(product);
    if ((isApparel(product) || sizes.length) && !sizes.includes(size)) throw new Error(`Escolha um tamanho cadastrado para ${product.name}.`);
    if (!sizes.length && size) throw new Error(`Tamanho indisponível para ${product.name}.`);
    const quantity = Number(raw.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('Quantidade inválida.');
    const key = JSON.stringify([product.id, size]);
    grouped.set(key, { productId: product.id, size, quantity: (grouped.get(key)?.quantity || 0) + quantity });
  }
  const items = [...grouped.values()];
  for (const item of items) {
    const product = catalog.products.find(entry => entry.id === item.productId);
    if (!item.size && product.stock == null) continue;
    const stock = item.size ? sizeStock(product, item.size) : Number(product.stock);
    if (!Number.isSafeInteger(stock) || stock < item.quantity) throw new Error(`Estoque insuficiente para ${product.name}${item.size ? ` no tamanho ${item.size}` : ''}.`);
  }
  return items;
}

export function applySale(catalog, items) {
  const next = structuredClone(catalog);
  for (const item of items) {
    const product = next.products.find(entry => entry.id === item.productId);
    if (item.size) {
      product.sizeStock[item.size] -= item.quantity;
      product.stock = Object.values(product.sizeStock).reduce((sum, count) => sum + count, 0);
    } else if (product.stock != null) product.stock -= item.quantity;
  }
  return next;
}
