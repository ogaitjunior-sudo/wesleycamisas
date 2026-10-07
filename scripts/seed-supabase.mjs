import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSupabaseStore } from '../supabase-store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'data', 'catalog.json');
const store = createSupabaseStore({ url: process.env.SUPABASE_URL, secret: process.env.SUPABASE_SECRET_KEY });
if (!store) throw new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY somente no ambiente do terminal.');
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(catalog.products) || !catalog.settings) throw new Error('Catálogo local inválido.');
await store.verify();
if (await store.readCatalog()) throw new Error('O Supabase já contém um catálogo. Importação cancelada para preservar os dados existentes.');
try {
  await store.insertCatalogIfEmpty(catalog);
} catch (error) {
  if (/\(409(?:,|\))/.test(String(error?.message))) throw new Error('O Supabase já contém um catálogo. Importação cancelada para preservar os dados existentes.');
  throw error;
}
console.log(`Catálogo local importado para o Supabase: ${catalog.products.length} itens. Revise no painel antes de publicar.`);
