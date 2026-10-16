export const SIZES = ['PP', 'P', 'M', 'G', 'GG', 'G1', 'G2', 'G3'];

export const isApparel = product => /\b(camisa|camiseta|blusa|moletom|jaqueta|calça|short|bermuda|vestido|regata|agasalho)s?\b/i.test(`${product.category || ''} ${product.name || ''}`);

export function productSizes(product) {
  const selected = new Set((Array.isArray(product.sizes) ? product.sizes : []).map(size => size === 'XG' ? 'G1' : size));
  return SIZES.filter(size => selected.has(size));
}

export function sizeStock(product, size) {
  if (!productSizes(product).includes(size)) return 0;
  // Nunca atribua o estoque geral legado a uma numeração sem conferência humana.
  if (!product.sizeStock) return 0;
  return Object.hasOwn(product.sizeStock, size) ? Number(product.sizeStock[size]) : 0;
}

export function cartWithChangedSize(cart, products, index, nextSize) {
  const item = cart[index];
  const product = products.find(entry => entry.id === item?.productId);
  if (!item || !product || !productSizes(product).includes(nextSize)) throw new Error('Tamanho indisponível.');
  if (item.size === nextSize) return cart;
  const otherQuantity = cart.reduce((sum,entry,position)=>sum+(position!==index && entry.productId===item.productId && entry.size===nextSize ? Number(entry.quantity) : 0),0);
  if (otherQuantity + Number(item.quantity) > sizeStock(product,nextSize))
    throw new Error(`Existe apenas ${Math.max(0,sizeStock(product,nextSize)-otherQuantity)} unidade(s) disponível(is) neste tamanho.`);
  const key=JSON.stringify([item.productId,nextSize,item.personalization]);
  const merged=cart.findIndex((entry,position)=>position!==index && entry.key===key);
  const next=cart.map(entry=>({...entry}));
  if (merged >= 0) {
    if (Number(next[merged].quantity) + Number(item.quantity) > 99) throw new Error('Quantidade máxima por item atingida.');
    next[merged].quantity += Number(item.quantity);
    next.splice(index,1);
  } else next[index]={...item,size:nextSize,key};
  return next;
}
