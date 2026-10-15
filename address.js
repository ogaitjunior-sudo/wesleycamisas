export async function lookupPostalAddress(value, fetchImpl = fetch) {
  const postalCode = String(value ?? '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(postalCode)) throw Object.assign(new Error('Informe um CEP com 8 números.'), { status: 422 });
  let response;
  try {
    response = await fetchImpl(`https://viacep.com.br/ws/${postalCode}/json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6_000)
    });
  } catch {
    throw Object.assign(new Error('Não foi possível buscar o endereço agora. Preencha os campos manualmente.'), { status: 503 });
  }
  if (!response.ok) throw Object.assign(new Error('Não foi possível buscar o endereço. Preencha os campos manualmente.'), { status: 503 });
  let data;
  try { data = await response.json(); } catch {
    throw Object.assign(new Error('Resposta inválida da consulta de CEP. Preencha os campos manualmente.'), { status: 503 });
  }
  if (data?.erro) throw Object.assign(new Error('CEP não encontrado. Confira o número ou preencha o endereço manualmente.'), { status: 404 });
  if (!data?.localidade || !/^[A-Z]{2}$/.test(String(data.uf || '').toUpperCase())) {
    throw Object.assign(new Error('A consulta de CEP não retornou um endereço válido. Preencha os campos manualmente.'), { status: 503 });
  }
  return {
    postalCode,
    street: String(data?.logradouro || '').slice(0, 150),
    district: String(data?.bairro || '').slice(0, 100),
    city: String(data?.localidade || '').slice(0, 100),
    state: String(data?.uf || '').slice(0, 2).toUpperCase()
  };
}
