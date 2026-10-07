const SHIPPING_ENDPOINT = 'https://melhorenvio.com.br/api/v2/me/shipment/calculate';
const SANDBOX_ENDPOINT = 'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate';

function shippingError(message, status = 422) {
  return Object.assign(new Error(message), { status });
}

export function normalizePostalCode(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(digits)) throw shippingError('Informe um CEP válido com 8 números.');
  return digits;
}

export function shippingMeasurements(product) {
  const shipping = product?.shipping || {};
  const result = {
    width: Number(shipping.width),
    height: Number(shipping.height),
    length: Number(shipping.length),
    weight: Number(shipping.weight)
  };
  if (Object.values(result).some(value => !Number.isFinite(value) || value <= 0)) {
    throw shippingError(`Peso e medidas de ${product?.name || 'um produto'} ainda não estão cadastrados. Fale com a loja.`, 409);
  }
  return result;
}

export async function calculateShipping({ postalCode, items, catalog, token, userAgent, sandbox = false, fetchImpl = fetch }) {
  const destination = normalizePostalCode(postalCode);
  const origin = normalizePostalCode(catalog.settings?.shippingOriginCep);
  if (!token || !userAgent || !/\([^()\s]+@[^()\s]+\)/.test(userAgent)) {
    throw shippingError('O cálculo de frete ainda não está configurado pela loja.', 503);
  }
  const products = items.map(item => {
    const product = catalog.products.find(entry => entry.id === item.productId);
    if (!product) throw shippingError('Um produto não está mais disponível. Atualize o carrinho.', 409);
    return {
      id: product.id,
      ...shippingMeasurements(product),
      insurance_value: item.unitPrice,
      quantity: item.quantity
    };
  });
  let response;
  try {
    response = await fetchImpl(sandbox ? SANDBOX_ENDPOINT : SHIPPING_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': userAgent
      },
      body: JSON.stringify({ from: { postal_code: origin }, to: { postal_code: destination }, products, options: { receipt: false, own_hand: false } }),
      signal: AbortSignal.timeout(12_000)
    });
  } catch {
    throw shippingError('Não foi possível consultar o frete agora. Tente novamente em instantes.', 503);
  }
  if (response.status === 400 || response.status === 422) throw shippingError('CEP inexistente ou dados de envio inválidos. Confira o CEP e tente novamente.');
  if (response.status === 401 || response.status === 403) throw shippingError('O serviço de frete precisa ser configurado pela loja.', 503);
  if (!response.ok) throw shippingError('O serviço de frete está indisponível. Tente novamente em instantes.', 503);
  let result;
  try { result = await response.json(); } catch { throw shippingError('O serviço de frete retornou uma resposta inválida.', 503); }
  if (!Array.isArray(result)) throw shippingError('O serviço de frete retornou uma resposta inválida.', 503);
  const options = result.filter(entry => !entry.error).map(entry => {
    const price = Number(entry.custom_price ?? entry.price);
    const days = Number(entry.custom_delivery_time ?? entry.delivery_time);
    const id = String(entry.id ?? '');
    const company = String(entry.company?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const name = String(entry.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!id || !name || !Number.isFinite(price) || price < 0 || !Number.isInteger(days) || days < 0) return null;
    return { id, name, company, priceCents: Math.round(price * 100), deliveryDays: days };
  }).filter(Boolean);
  if (!options.length) throw shippingError('Não há opções de entrega para este CEP e os produtos escolhidos.');
  return { postalCode: destination, options };
}
