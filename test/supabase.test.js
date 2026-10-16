import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseStore } from '../supabase-store.js';
import { publicationIssues, normalizedCatalog } from '../publication.js';

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

test('baixa confirmada usa RPC do Supabase e lista comprovantes persistidos', async () => {
  const calls=[];
  const store=createSupabaseStore({url:'https://example.supabase.co',secret:'sb_secret_fixture',fetchImpl:async (url,options)=>{
    calls.push({url,options});
    if (url.includes('wesllen_sales')) return Response.json([{id:'sale-1',quote_id:'quote-1',items:[{productId:'shirt',size:'G',quantity:1}],confirmed_at:'2026-10-16T12:00:00Z'}]);
    return Response.json({id:'sale-1',alreadyConfirmed:false});
  }});
  assert.deepEqual(await store.readSales(),[{id:'sale-1',quoteId:'quote-1',items:[{productId:'shirt',size:'G',quantity:1}],confirmedAt:'2026-10-16T12:00:00Z'}]);
  const result=await store.confirmSale({id:'sale-1',quoteId:'quote-1',items:[{productId:'shirt',size:'G',quantity:1}]});
  assert.equal(result.alreadyConfirmed,false);
  assert.equal(new URL(calls[1].url).pathname,'/rest/v1/rpc/wesllen_confirm_sale');
  assert.equal(JSON.parse(calls[1].options.body).p_quote_id,'quote-1');
  assert.ok(calls.every(call=>call.options.headers.apikey==='sb_secret_fixture'));
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
  assert.ok(publicationIssues({ ...product, photos:['https://invalid.example/second.webp'] }, catalog, '.', base).includes('foto real enviada pelo painel'));
  assert.ok(publicationIssues({ ...product, image:'', photos:[product.image] }, catalog, '.', base).includes('foto real enviada pelo painel'));
});

test('status publicado só entra na loja quando a camisa está completa', () => {
  const base = 'https://example.supabase.co/storage/v1/object/public/wesllen-products/';
  const shirt = { id:'real-test', name:'Camisa Real Madrid', category:'Camisas internacionais', team_id:'real-madrid',
    price:199, priceConfirmed:true, image:`${base}12345678-1234-1234-1234-123456789abc.webp`, photos:[],
    sizes:['M'], sizeStock:{M:1}, stock:1, fulfillment:'order', available:true, status:'published' };
  const catalog = { productCategories:['Camisas internacionais'], categories:[{id:'real-madrid',is_active:true}], products:[shirt] };
  assert.deepEqual(publicationIssues(shirt,catalog,'.',base),[]);
  assert.equal(normalizedCatalog(catalog,'.',base).products[0].status,'published');
  const soldOut=normalizedCatalog({...catalog,products:[{...shirt,fulfillment:'ready',sizeStock:{M:0},stock:0}]},'.',base).products[0];
  assert.equal(soldOut.status,'published');
  assert.equal(soldOut.stock,0);
  const incomplete = normalizedCatalog({...catalog,products:[{...shirt,image:''}]},'.',base).products[0];
  assert.equal(incomplete.status,'draft');
  assert.equal(incomplete.available,false);
  const inactive = normalizedCatalog({...catalog,products:[{...shirt,status:'inactive',available:false}]},'.',base).products[0];
  assert.equal(inactive.status,'inactive');
  assert.equal(inactive.available,false);
  const draft = normalizedCatalog({...catalog,products:[{...shirt,status:'draft',available:false}]},'.',base).products[0];
  assert.equal(draft.status,'draft');
  assert.equal(draft.available,false);
});
