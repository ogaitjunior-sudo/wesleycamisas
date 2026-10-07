import crypto from 'node:crypto';

export const money = amount => `R$ ${Number(amount).toFixed(2).replace('.', ',')}`;
const singleLine = (value, limit) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
const multiLine = (value, limit) => String(value ?? '').replace(/\r/g, '').trim().slice(0, limit);

export function lineForItem(item) {
  const lines = [`${item.quantity}x ${item.productName}`];
  if (item.size) lines.push(`Tamanho: ${item.size}`);
  if (item.model) lines.push(`Modelo: ${item.model}`);
  const custom = [item.personalization.name, item.personalization.number, item.personalization.phrase].filter(Boolean).join(' ');
  if (custom) lines.push(`Personalização: ${custom}`);
  if (item.personalization.note) lines.push(`Observação do produto: ${item.personalization.note}`);
  lines.push(`Valor: ${money(item.unitPrice)}`);
  if (item.quantity > 1) lines.push(`Subtotal: ${money(item.unitPrice * item.quantity)}`);
  return lines.join('\n');
}

export function quoteFrom(payload, catalog) {
  const customer = payload.customer || {};
  const name = singleLine(customer.name, 100);
  const city = singleLine(customer.city, 100);
  const note = multiLine(customer.note, 500);
  if (!name || !city) throw new Error('Informe nome e cidade.');
  if (!Array.isArray(payload.items) || !payload.items.length || payload.items.length > 50) throw new Error('O carrinho está vazio ou inválido.');

  const requested=new Map();
  for(const raw of payload.items)requested.set(raw.productId,(requested.get(raw.productId)||0)+Number(raw.quantity));
  for(const [productId,quantity] of requested){const product=catalog.products.find(entry=>entry.id===productId);if(product?.fulfillment==='ready'&&product.stock!=null&&quantity>Number(product.stock))throw new Error(`Estoque insuficiente para ${product.name}.`);}

  const items = payload.items.map(raw => {
    const product = catalog.products.find(entry => entry.id === raw.productId && entry.available);
    if (!product) throw new Error('Um produto não está mais disponível. Atualize o carrinho.');
    const quantity = Number(raw.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('Quantidade inválida.');
    const size = singleLine(raw.size, 10);
    if (product.sizes?.length && !product.sizes.includes(size)) throw new Error(`Escolha um tamanho para ${product.name}.`);
    const personalization = {
      name: singleLine(raw.personalization?.name, 30),
      number: singleLine(raw.personalization?.number, 3),
      phrase: singleLine(raw.personalization?.phrase, 100),
      note: multiLine(raw.personalization?.note, 150)
    };
    if (personalization.number && !/^\d{1,3}$/.test(personalization.number)) throw new Error('Número de personalização inválido.');
    if (!product.customizable && Object.values(personalization).some(Boolean)) throw new Error(`${product.name} não aceita personalização.`);
    if(product.personalizationFields){for(const [field,value] of Object.entries(personalization))if(value&&!product.personalizationFields.includes(field))throw new Error(`O campo ${field} não está disponível para ${product.name}.`);}
    const personalized = product.customizable && Object.values(personalization).some(Boolean);
    const basePrice = Number(product.promoPrice || product.price);
    const unitPrice = basePrice + (personalized ? Number(product.personalizationPrice || 0) : 0);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('Preço inválido no catálogo.');
    return { productId: product.id, productName: product.name, model: singleLine(product.model, 60), quantity, size, personalization, unitPrice };
  });

  const total = Math.round(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100) / 100;
  const storeName=singleLine(catalog.settings?.name,100)||'Wesllen Imports';
  const message = `Olá, Wesley! Quero fazer este pedido na ${storeName}:\n\n${items.map(lineForItem).join('\n\n')}\n\nTotal dos produtos: ${money(total)}\n\nNome: ${name}\nCidade: ${city}${note ? `\n\nObservação:\n${note}` : ''}\n\nGostaria de combinar a forma de pagamento e a entrega.`;
  return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), customer: { name, city, note }, items, total, message };
}
