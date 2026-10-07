import { createSupabaseStore } from '../supabase-store.js';

const store = createSupabaseStore({ url: process.env.SUPABASE_URL, secret: process.env.SUPABASE_SECRET_KEY });
if (!store) throw new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY somente no ambiente do terminal.');
const catalog = await store.readCatalog();
if (!catalog || !Array.isArray(catalog.products)) throw new Error('Catálogo Supabase ausente ou inválido.');
const response = await fetch(`${new URL(process.env.SUPABASE_URL).origin}/storage/v1/object/list/wesllen-products`, {
  method:'POST',
  headers:{apikey:process.env.SUPABASE_SECRET_KEY,'content-type':'application/json'},
  body:JSON.stringify({prefix:'',limit:100}),
  signal:AbortSignal.timeout(15_000)
});
if (!response.ok) throw new Error(`Listagem do bucket falhou (HTTP ${response.status}).`);
const files = await response.json();
console.log(JSON.stringify({
  catalogRows:1,
  products:catalog.products.length,
  activeProducts:catalog.products.filter(product => product.available === true).length,
  testProducts:catalog.products.filter(product => String(product.id || '').startsWith('homologacao-')).length,
  bucketRootEntries:files.length
}));
