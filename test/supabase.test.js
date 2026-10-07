import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseStore } from '../supabase-store.js';
import { publicationIssues } from '../publication.js';

test('Supabase usa somente a chave no servidor e persiste catálogo, pedidos e fotos', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const method = options.method || 'GET';
    const value = method === 'GET' && url.includes('wesllen_catalog') ? [{ document: { products: [] } }]
      : method === 'GET' && url.includes('wesllen_quotes') ? [{ payload: { id: 'quote-1' } }]
      : null;
    return new Response(value === null ? '' : JSON.stringify(value), { status: method === 'GET' ? 200 : 201 });
  };
  const store = createSupabaseStore({
    url: 'https://example.supabase.co/rest/v1/', secret: 'sb_secret_fixture', fetchImpl
  });
  assert.deepEqual(await store.readCatalog(), { products: [] });
  await store.writeCatalog({ products: [{ id: 'shirt' }] });
  await store.insertCatalogIfEmpty({ products: [{ id: 'draft' }] });
  assert.deepEqual(await store.readQuotes(), [{ id: 'quote-1' }]);
  await store.writeQuote({ id: 'quote-2', createdAt: '2026-10-07T00:00:00Z' });
  const photo = await store.uploadPhoto('12345678-1234-1234-1234-123456789abc.png', 'image/png', Buffer.from('PNG'));
  assert.equal(photo, 'https://example.supabase.co/storage/v1/object/public/wesllen-products/12345678-1234-1234-1234-123456789abc.png');
  assert.equal(calls.length, 6);
  assert.ok(calls.every(call => call.options.headers.apikey === 'sb_secret_fixture'));
  assert.ok(calls.every(call => !call.options.headers.Authorization));
  assert.ok(calls.every(call => !call.url.includes('sb_secret_')));
  assert.match(calls[1].options.headers.Prefer, /resolution=merge-duplicates/);
  assert.equal(new URL(calls[2].url).search, '');
  assert.ok(!calls[2].options.headers.Prefer.includes('resolution=merge-duplicates'));
  assert.equal(calls[5].options.headers['Content-Type'], 'image/png');
});

test('seed recebe conflito sem sobrescrever catálogo existente', async () => {
  const store = createSupabaseStore({
    url: 'https://example.supabase.co', secret: 'sb_secret_fixture',
    fetchImpl: async (_url, options) => new Response(JSON.stringify({ code:'23505' }), { status:options.method === 'POST' ? 409 : 200 })
  });
  await assert.rejects(store.insertCatalogIfEmpty({ products: [] }), /\(409, 23505\)/);
});

test('publicação aceita apenas foto remota do bucket configurado', () => {
  const base = 'https://example.supabase.co/storage/v1/object/public/wesllen-products/';
  const product = {
    name: 'Produto real', category: 'Bonés', price: 50, priceConfirmed: true,
    image: `${base}12345678-1234-1234-1234-123456789abc.webp`, photos: [],
    fulfillment: 'order', customizable: false
  };
  const catalog = { productCategories: ['Bonés'] };
  assert.deepEqual(publicationIssues(product, catalog, '.', base), []);
  assert.ok(publicationIssues({ ...product, image: 'https://invalid.example/photo.webp' }, catalog, '.', base).includes('foto real enviada pelo painel'));
});
