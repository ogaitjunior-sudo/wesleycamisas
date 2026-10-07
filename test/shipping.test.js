import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateShipping, normalizePostalCode } from '../shipping.js';
import { orderItemsFrom, quoteFrom } from '../order.js';

const catalog = {
  settings: { name: 'Wesllen Imports', shippingEnabled: true, shippingOriginCep: '48400-000' },
  products: [{ id: 'camisa', name: 'Camisa de teste', available: true, fulfillment: 'order', price: 149.90, sizes: ['G'], customizable: true, personalizationPrice: 25, shipping: { width: 25, height: 5, length: 30, weight: 0.4 } }]
};
const cart = [{ productId: 'camisa', size: 'G', quantity: 2, personalization: { name: 'TESTE', number: '10' } }];
const credentials = { token: 'test-only', userAgent: 'Wesllen Imports (teste@example.com)' };
const provider = async (_url, request) => {
  assert.equal(request.headers.Authorization, 'Bearer test-only');
  const body = JSON.parse(request.body);
  assert.equal(body.from.postal_code, '48400000');
  assert.equal(body.to.postal_code, '40000000');
  assert.equal(body.products[0].quantity, 2);
  assert.equal(body.products[0].weight, 0.4);
  return { ok: true, json: async () => [
    { id: 1, name: 'PAC', company: { name: 'Correios' }, custom_price: '22.50', custom_delivery_time: 6 },
    { id: 2, name: 'SEDEX', company: { name: 'Correios' }, price: '35.90', delivery_time: 2 },
    { id: 3, name: 'Indisponível', error: 'sem entrega' }
  ] };
};

test('CEP, opções e medidas são validados e enviados ao serviço de frete', async () => {
  assert.equal(normalizePostalCode('40000-000'), '40000000');
  assert.throws(() => normalizePostalCode('123'), /CEP válido/);
  const items = orderItemsFrom(cart, catalog);
  const quote = await calculateShipping({ postalCode: '40000-000', items, catalog, ...credentials, fetchImpl: provider });
  assert.equal(quote.options.length, 2);
  assert.deepEqual(quote.options.map(option => option.priceCents), [2250, 3590]);
  await assert.rejects(calculateShipping({ postalCode: '123', items, catalog, ...credentials, fetchImpl: provider }), /CEP válido/);
  await assert.rejects(calculateShipping({ postalCode: '40000000', items, catalog: { ...catalog, products: [{ ...catalog.products[0], shipping: {} }] }, ...credentials, fetchImpl: provider }), /Peso e medidas/);
});

test('o pedido soma o frete uma vez e registra entrega no WhatsApp e no painel', async () => {
  const items = orderItemsFrom(cart, catalog);
  const shipping = (await calculateShipping({ postalCode: '40000000', items, catalog, ...credentials, fetchImpl: provider })).options[0];
  const customer = { name: 'Cliente Teste', city: 'Salvador', state: 'BA', address: 'Rua de Teste, 10', postalCode: '40000-000' };
  const quote = quoteFrom({ customer, items: cart }, catalog, { ...shipping, postalCode: '40000000' });
  assert.equal(quote.productsTotal, 349.8);
  assert.equal(quote.total, 372.3);
  assert.equal(quote.shipping.priceCents, 2250);
  assert.equal(quote.customer.postalCode, '40000000');
  assert.match(quote.message, /Frete: Correios · PAC/);
  assert.match(quote.message, /Prazo estimado: 6 dia\(s\)/);
  assert.match(quote.message, /Total do pedido: R\$ 372,30/);
  assert.match(quote.message, /Cidade\/UF: Salvador\/BA/);
  assert.throws(() => quoteFrom({ customer, items: cart }, catalog, { ...shipping, postalCode: '12345678' }), /Calcule novamente/);
});

test('trocar modalidade ou quantidade recalcula o total sem duplicar o frete', async () => {
  const customer={name:'Cliente Teste',city:'Salvador',state:'BA',address:'Rua de Teste, 10',postalCode:'40000000'};
  const options=(await calculateShipping({postalCode:customer.postalCode,items:orderItemsFrom(cart,catalog),catalog,...credentials,fetchImpl:provider})).options;
  const first=quoteFrom({customer,items:cart},catalog,{...options[0],postalCode:customer.postalCode});
  const alternate=quoteFrom({customer,items:cart},catalog,{...options[1],postalCode:customer.postalCode});
  const less=quoteFrom({customer,items:[{...cart[0],quantity:1}]},catalog,{...options[0],postalCode:customer.postalCode});
  assert.equal(first.total,372.3);
  assert.equal(alternate.total,385.7);
  assert.equal(less.total,197.4);
});

test('CEP inexistente e ausência de modalidade exibem erro amigável', async () => {
  const items = orderItemsFrom(cart, catalog);
  await assert.rejects(calculateShipping({ postalCode: '40000000', items, catalog, ...credentials, fetchImpl: async () => ({ status: 422, ok: false }) }), /CEP inexistente/);
  await assert.rejects(calculateShipping({ postalCode: '40000000', items, catalog, ...credentials, fetchImpl: async () => ({ ok: true, json: async () => [] }) }), /Não há opções/);
});
