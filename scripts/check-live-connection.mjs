import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createSupabaseStore } from '../supabase-store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = createSupabaseStore({ url: process.env.SUPABASE_URL, secret: process.env.SUPABASE_SECRET_KEY });
if (!store) throw new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY somente no ambiente do terminal.');
const tempDir = fs.mkdtempSync(path.join(root, '.live-test-'));
const testId = `homologacao-${crypto.randomUUID()}`;
const base = new URL(process.env.SUPABASE_URL).origin;
let uploadedPhoto = '';
let child;
let cookie = '';
const result = { catalogRead:false, adminRead:false, created:false, edited:false, deactivated:false, persisted:false, photoPublic:false, cleaned:false };

async function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const { port } = socket.address();
      socket.close(() => resolve(port));
    });
  });
}
const port = await freePort();
const local = `http://127.0.0.1:${port}`;
async function start() {
  child = spawn(process.execPath, ['server.js'], {
    cwd:root,
    env:{...process.env, PORT:String(port), DATA_DIR:tempDir, NODE_ENV:'development', VERCEL:'', ADMIN_PASSWORD_HASH:''},
    stdio:['ignore','pipe','pipe']
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Servidor local não iniciou.')), 10_000);
    let error = '';
    child.stderr.on('data', data => { error += String(data); });
    child.stdout.on('data', data => { if (String(data).includes('Wesllen Imports:')) { clearTimeout(timer); resolve(); } });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Servidor local encerrou (${code}): ${error}`)); });
  });
}
async function stop() {
  if (!child) return;
  const running = child;
  child = null;
  if (running.exitCode === null) {
    running.kill();
    await new Promise(resolve => running.once('exit', resolve));
  }
}
async function localJson(route, options = {}) {
  const response = await fetch(`${local}${route}`, options);
  const content = await response.json();
  if (!response.ok) throw new Error(`${route}: HTTP ${response.status}: ${content.error || 'erro'}`);
  return content;
}
async function login() {
  const access = fs.readFileSync(path.join(tempDir, 'admin-access.txt'), 'utf8');
  const password = /^Senha inicial: (.+)$/m.exec(access)?.[1];
  if (!password) throw new Error('Senha temporária de homologação ausente.');
  const response = await fetch(`${local}/api/admin/login`, {
    method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({password})
  });
  if (!response.ok) throw new Error('Login de homologação falhou.');
  cookie = response.headers.get('set-cookie')?.split(';')[0] || '';
  if (!cookie) throw new Error('Cookie de administração ausente.');
}
async function adminCatalog() {
  return localJson('/api/admin/catalog', {headers:{cookie}});
}
async function save(catalog) {
  return localJson('/api/admin/catalog', {
    method:'PUT', headers:{cookie,'content-type':'application/json'}, body:JSON.stringify(catalog)
  });
}
async function removePhoto() {
  if (!uploadedPhoto.startsWith(store.publicPhotoBase)) return;
  const filename = uploadedPhoto.slice(store.publicPhotoBase.length);
  if (!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(filename)) throw new Error('Caminho da foto de homologação inválido.');
  const response = await fetch(`${base}/storage/v1/object/wesllen-products`, {
    method:'DELETE', headers:{apikey:process.env.SUPABASE_SECRET_KEY,'content-type':'application/json'},
    body:JSON.stringify({prefixes:[filename]})
  });
  if (!response.ok) throw new Error(`Falha ao remover foto de homologação (HTTP ${response.status}).`);
}

try {
  await store.verify();
  const initial = await store.readCatalog();
  if (!initial || initial.products?.length !== 8 || initial.products.some(product => product.id === testId)) throw new Error('Catálogo remoto inesperado; teste cancelado para preservar dados existentes.');
  await start();
  if (!(await fetch(local)).ok || !(await fetch(`${local}/catalogo`)).ok) throw new Error('Páginas locais não abriram.');
  const publicBefore = await localJson('/api/catalog');
  if (publicBefore.products.some(product => product.id === testId)) throw new Error('Produto de teste já aparece publicamente.');
  result.catalogRead = true;
  await login();
  const catalog = await adminCatalog();
  if (catalog.products.length !== 8) throw new Error('Painel não leu os oito rascunhos do Supabase.');
  result.adminRead = true;

  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP8tUWOgYGBiQEMABaWAdDzw9+AAAAAAElFTkSuQmCC';
  const upload = await localJson('/api/admin/upload', {
    method:'POST', headers:{cookie,'content-type':'application/json'},
    body:JSON.stringify({data:`data:image/png;base64,${png}`})
  });
  uploadedPhoto = upload.url;
  const publicPhoto = await fetch(uploadedPhoto);
  result.photoPublic = publicPhoto.ok && Buffer.from(await publicPhoto.arrayBuffer()).equals(Buffer.from(png, 'base64'));
  if (!result.photoPublic) throw new Error('Foto enviada pelo painel não abre pela URL pública.');

  catalog.products.push({
    id:testId, name:'Produto de homologação', description:'Somente teste temporário',
    category:'Bonés', team:'', price:1.11, promoPrice:null, image:uploadedPhoto, photos:[],
    priceConfirmed:true, available:true, fulfillment:'order', stock:null,
    featured:false, bestseller:false, new:false, promotion:false, customizable:false,
    personalizationPrice:0, personalizationFields:[], sizes:[]
  });
  await save(catalog);
  result.created = (await localJson('/api/catalog')).products.some(product => product.id === testId && product.image === uploadedPhoto);
  if (!result.created) throw new Error('Produto criado não aparece no catálogo público.');

  const updated = await adminCatalog();
  const product = updated.products.find(entry => entry.id === testId);
  product.name = 'Produto de homologação editado';
  product.price = 2.22;
  await save(updated);
  result.edited = (await localJson('/api/catalog')).products.some(entry => entry.id === testId && entry.name === product.name && entry.price === 2.22);
  if (!result.edited) throw new Error('Edição não apareceu no catálogo público.');

  await stop();
  await start();
  result.persisted = (await localJson('/api/catalog')).products.some(entry => entry.id === testId && entry.price === 2.22);
  if (!result.persisted) throw new Error('Produto não persistiu após reinício do servidor.');
  await login();
  const afterRestart = await adminCatalog();
  afterRestart.products.find(entry => entry.id === testId).available = false;
  await save(afterRestart);
  result.deactivated = !(await localJson('/api/catalog')).products.some(entry => entry.id === testId) &&
    (await adminCatalog()).products.some(entry => entry.id === testId && entry.available === false);
  if (!result.deactivated) throw new Error('Desativação não ocultou o produto.');
} finally {
  await stop();
  try {
    const current = await store.readCatalog();
    if (current?.products?.some(product => product.id === testId)) {
      await store.writeCatalog({ ...current, products:current.products.filter(product => product.id !== testId) });
    }
    await removePhoto();
    const finalCatalog = await store.readCatalog();
    result.cleaned = finalCatalog?.products?.length === 8 && !finalCatalog.products.some(product => product.id === testId);
  } finally {
    if (path.dirname(path.resolve(tempDir)) !== root) throw new Error('Diretório temporário fora do projeto; limpeza cancelada.');
    fs.rmSync(tempDir, { recursive:true, force:true });
  }
  console.log(JSON.stringify(result));
}
if (Object.values(result).some(value => value !== true)) process.exitCode = 1;
