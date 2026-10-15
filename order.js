import crypto from 'node:crypto';

export const money = amount => `R$ ${Number(amount).toFixed(2).replace('.', ',')}`;
const singleLine = (value, limit) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
const multiLine = (value, limit) => String(value ?? '').replace(/\r/g, '').trim().slice(0, limit);

export function lineForItem(item) {
  const lines = [`Produto: ${item.productName}`];
  if (item.size) lines.push(`Tamanho: ${item.size}`);
  if (item.model) lines.push(`Modelo: ${item.model}`);
  const custom = [item.personalization.name, item.personalization.number, item.personalization.phrase].filter(Boolean).join(' ');
  if (custom) lines.push(`Personalização: ${custom}`);
  if (item.personalization.note) lines.push(`Observação do produto: ${item.personalization.note}`);
  lines.push(`Quantidade: ${item.quantity}`);
  lines.push(`Preço unitário: ${money(item.unitPrice)}`);
  lines.push(`Subtotal do item: ${money(item.unitPrice * item.quantity)}`);
  return lines.join('\n');
}

export function orderItemsFrom(rawItems, catalog) {
  if (!Array.isArray(rawItems) || !rawItems.length || rawItems.length > 50) throw new Error('O carrinho está vazio ou inválido.');

  const requested=new Map();
  for(const raw of rawItems)requested.set(raw.productId,(requested.get(raw.productId)||0)+Number(raw.quantity));
  for(const [productId,quantity] of requested){const product=catalog.products.find(entry=>entry.id===productId);if(product?.fulfillment==='ready'&&product.stock!=null&&quantity>Number(product.stock))throw new Error(`Estoque insuficiente para ${product.name}.`);}

  return rawItems.map(raw => {
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
}

export function quoteFrom(payload, catalog, shipping = null) {
  const customer = payload.customer || {};
  const name = singleLine(customer.name, 100);
  const city = singleLine(customer.city, 100);
  const note = multiLine(customer.note, 500);
  if (!name || !city) throw new Error('Informe nome e cidade.');
  const items = orderItemsFrom(payload.items, catalog);

  const productsTotal = Math.round(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100) / 100;
  const shippingEnabled = catalog.settings?.shippingEnabled === true;
  const postalCode = String(customer.postalCode || '').replace(/\D/g, '');
  const phone = String(customer.phone || '').replace(/\D/g, '');
  const street = singleLine(customer.street, 150);
  const number = singleLine(customer.number, 20);
  const complement = singleLine(customer.complement, 100);
  const district = singleLine(customer.district, 100);
  if ((phone || street || number || district) && (!/^\d{10,13}$/.test(phone) || !street || !number || !district)) {
    throw new Error('Informe WhatsApp, rua, número e bairro para a entrega.');
  }
  const address = street ? `${street}, ${number}${complement ? ` — ${complement}` : ''} — ${district}` : singleLine(customer.address, 240);
  const state = singleLine(customer.state, 2).toUpperCase();
  if (shippingEnabled && (!/^\d{8}$/.test(postalCode) || !address || !/^[A-Z]{2}$/.test(state))) throw new Error('Informe CEP, endereço e UF da entrega.');
  if (!shippingEnabled && postalCode && !/^\d{8}$/.test(postalCode)) throw new Error('Informe um CEP com 8 números ou deixe o campo vazio.');
  if (shippingEnabled && (!shipping || shipping.postalCode !== postalCode || !Number.isInteger(shipping.priceCents) || shipping.priceCents < 0)) throw new Error('Calcule novamente o frete antes de finalizar.');
  const total = Math.round(productsTotal * 100 + (shippingEnabled ? shipping.priceCents : 0)) / 100;
  const storeName=singleLine(catalog.settings?.name,100)||'Wesllen Imports';
  const shippingLines = shippingEnabled
    ? `\nTransportadora: ${shipping.company || shipping.name}\nModalidade: ${shipping.name}\nPrazo estimado: ${shipping.deliveryDays} dia(s) útil(eis)\nFrete: ${money(shipping.priceCents / 100)}`
    : '\nFrete: pendente de cotação com a loja';
  const deliveryLines = `${phone ? `\nWhatsApp do cliente: ${phone}` : ''}${postalCode ? `\nCEP de destino: ${postalCode.slice(0,5)}-${postalCode.slice(5)}` : ''}${address ? `\nEndereço: ${address}` : ''}\nCidade${state ? '/UF' : ''}: ${city}${state ? `/${state}` : ''}`;
  const message = `🛍️ *NOVO PEDIDO — ${storeName.toLocaleUpperCase('pt-BR')}*\n\nOlá! Gostaria de confirmar este pedido.\n\n${items.map((item,index)=>`👕 *PRODUTO ${index+1}*\n${lineForItem(item)}`).join('\n\n━━━━━━━━━━━━━━━━\n\n')}\n\n━━━━━━━━━━━━━━━━\n\n📦 *ENTREGA*\nCliente: ${name}${deliveryLines}${shippingLines}${note ? `\nObservação: ${note}` : ''}\n\n━━━━━━━━━━━━━━━━\n\n💰 *RESUMO*\nSUBTOTAL: ${money(productsTotal)}\nFrete: ${shippingEnabled?money(shipping.priceCents/100):'a combinar'}\n*${shippingEnabled?`TOTAL DO PEDIDO: ${money(total)}`:'TOTAL DO PEDIDO: a confirmar após definir o frete'}*\n\nGostaria de combinar a forma de pagamento pelo WhatsApp.`;
  return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), customer: { name, city, note, ...(phone ? { phone } : {}), ...(postalCode ? { postalCode } : {}), ...(address ? { address } : {}), ...(state ? { state } : {}) }, items, productsTotal, shipping: shippingEnabled ? shipping : null, total, message };
}
