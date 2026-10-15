import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupPostalAddress } from '../address.js';

test('consulta CEP válido e devolve somente campos necessários do endereço', async () => {
  const result = await lookupPostalAddress('01001-000', async (url) => {
    assert.equal(url, 'https://viacep.com.br/ws/01001000/json/');
    return { ok: true, json: async () => ({
      logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP', ibge: '3550308'
    }) };
  });
  assert.deepEqual(result, { postalCode: '01001000', street: 'Praça da Sé', district: 'Sé', city: 'São Paulo', state: 'SP' });
});

test('CEP inválido, inexistente e serviço indisponível têm mensagens claras', async () => {
  await assert.rejects(lookupPostalAddress('123', async () => { throw Error('não deve consultar'); }), /8 números/);
  await assert.rejects(lookupPostalAddress('99999999', async () => ({ ok: true, json: async () => ({ erro: true }) })), /não encontrado/);
  await assert.rejects(lookupPostalAddress('01001000', async () => { throw Error('conexão'); }), /Preencha os campos manualmente/);
});
