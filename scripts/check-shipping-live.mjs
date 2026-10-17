const origin = new URL(process.argv[2] || 'https://www.wesllenimports.com.br/');
if (origin.protocol !== 'https:') throw new Error('Informe uma URL HTTPS da loja.');

const destinations = [
  ['São Paulo/SP', '01001000'],
  ['Rio de Janeiro/RJ', '20040020'],
  ['Salvador/BA', '40026032']
];

async function readJson(path, options) {
  const response = await fetch(new URL(path, origin), { ...options, signal: AbortSignal.timeout(20_000) });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} — ${payload.error || 'resposta inesperada'}`);
  return payload;
}

const catalog = await readJson('/api/catalog', { cache: 'no-store' });
if (catalog.settings?.shippingEnabled !== true) throw new Error('O catálogo publicado ainda informa shippingEnabled=false.');
const product = catalog.products.find(entry => {
  const dimensions = entry.shipping || {};
  return entry.available && Object.values(dimensions).length === 4 && Object.values(dimensions).every(value => Number(value) > 0) &&
    (!entry.sizes?.length || entry.sizes.some(size => Number(entry.sizeStock?.[size] ?? entry.stock) > 0));
});
if (!product) throw new Error('Não há produto disponível com peso, medidas e estoque para testar.');
const size = product.sizes?.find(value => Number(product.sizeStock?.[value] ?? product.stock) > 0) || '';
const items = [{ productId: product.id, size, quantity: 1, personalization: {} }];

for (const [city, postalCode] of destinations) {
  const address = await readJson(`/api/address/cep?cep=${postalCode}`);
  if (`${address.city}/${address.state}` !== city) throw new Error(`CEP ${postalCode} não corresponde a ${city}.`);
  const quote = await readJson('/api/shipping/quote', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postalCode, items })
  });
  if (quote.postalCode !== postalCode || !Array.isArray(quote.options) || !quote.options.length ||
      !quote.options.some(option => Number.isInteger(option.priceCents) && option.priceCents >= 0 && Number.isInteger(option.deliveryDays) && option.deliveryDays >= 0)) {
    throw new Error(`Cotação inválida para ${city}.`);
  }
  console.log(`${city} (${postalCode}): ${quote.options.map(option => `${option.company || option.name} ${option.name} R$ ${(option.priceCents / 100).toFixed(2)} / ${option.deliveryDays} dia(s)`).join(' | ')}`);
}
