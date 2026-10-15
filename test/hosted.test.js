import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const getPort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

test('modo Vercel preserva sessão, catálogo e configurações com Supabase simulado', async () => {
  const tempDir = fs.mkdtempSync(path.join(root, '.release-test-'));
  const salt = crypto.randomBytes(16).toString('hex');
  const password = crypto.randomBytes(20).toString('base64url');
  const hash = `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
  const port = await getPort();
  const env = { ...process.env, VERCEL:'1', NODE_ENV:'production', PORT:String(port),
    DATA_DIR:path.join(tempDir, 'absent-hosted-data'), FIXTURE_STATE_FILE:path.join(tempDir, 'catalog.json'),
    ADMIN_PASSWORD_HASH:hash, SUPABASE_URL:'https://example.supabase.co', SUPABASE_SECRET_KEY:'sb_secret_fixture' };
  const start = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['test/fixtures/hosted-server.mjs'], { cwd:root, env, stdio:['ignore','pipe','pipe'] });
    const timer = setTimeout(() => reject(new Error('Servidor hospedado não iniciou.')), 5000);
    let stderr = '';
    child.stderr.on('data', data => { stderr += String(data); });
    child.stdout.on('data', data => { if (String(data).includes('Wesllen Imports:')) { clearTimeout(timer); resolve(child); } });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Servidor terminou: ${code}. ${stderr}`)); });
  });
  let child;
  const base = `http://127.0.0.1:${port}`;
  try {
    child = await start();
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(`${base}/app.js`)).status, 200);
    const manifestResponse = await fetch(`${base}/manifest.webmanifest`);
    assert.equal(manifestResponse.status, 200);
    assert.match(manifestResponse.headers.get('content-type'), /^application\/manifest\+json/);
    assert.equal(manifestResponse.headers.get('cache-control'), 'no-store');
    const manifest = await manifestResponse.json();
    assert.equal(manifest.display, 'standalone');
    const workerResponse = await fetch(`${base}/sw.js`);
    assert.equal(workerResponse.status, 200);
    assert.equal(workerResponse.headers.get('cache-control'), 'no-store');
    assert.match(await workerResponse.text(), /wesllen-pwa-[a-f0-9]{12}/);
    for (const icon of manifest.icons) {
      const response = await fetch(`${base}${icon.src}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /^image\/png/);
    }
    assert.equal((await fetch(`${base}/api/catalog`)).status, 200);
    assert.equal((await fetch(`${base}/admin`, { redirect:'manual' })).status, 302);
    const login = await fetch(`${base}/api/admin/login`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({password}) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(`${base}/api/admin/catalog`, {headers:{cookie}})).status, 200);
    const upload = await fetch(`${base}/api/admin/upload`, { method:'POST', headers:{cookie,'content-type':'application/json'},
      body:JSON.stringify({data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl+7GQAAAAASUVORK5CYII='}) });
    assert.equal(upload.status, 200);
    const photo = (await upload.json()).url;
    assert.match(photo, /^https:\/\/example\.supabase\.co\/storage\/v1\/object\/public\/wesllen-products\//);
    const catalog = await (await fetch(`${base}/api/admin/catalog`, {headers:{cookie}})).json();
    catalog.products.push({id:'test-bone',name:'Boné de teste',category:'Bonés',price:50,priceConfirmed:true,image:photo,photos:[],available:true,fulfillment:'order',customizable:false});
    catalog.products.push({id:'test-shirt',name:'Camisa Flamengo de teste',category:'Camisas',team_id:'flamengo',team:'flamengo',sizes:['M'],price:149.9,priceConfirmed:true,image:photo,photos:[],available:true,status:'published',fulfillment:'order',customizable:true,personalizationFields:['name','number'],personalizationPrice:25});
    catalog.settings.announcement = 'Configuração persistida';
    catalog.settings.internalToken = 'somente-no-painel';
    assert.equal((await fetch(`${base}/api/admin/catalog`, {method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(catalog)})).status, 200);
    const published = await fetch(`${base}/api/catalog`);
    assert.equal(published.headers.get('cache-control'), 'no-store');
    const publicCatalog = await published.json();
    assert.equal(publicCatalog.products.length, 2);
    assert.equal(publicCatalog.settings.internalToken, undefined);
    assert.equal(publicCatalog.products.find(product => product.id === 'test-shirt')?.team_id, 'flamengo');
    assert.equal(publicCatalog.products.find(product => product.id === 'test-shirt')?.image, photo);
    const quote = await fetch(`${base}/api/quotes`, { method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({items:[{productId:'test-bone',quantity:1}],customer:{name:'Cliente Teste',city:'Cidade Teste'}}) });
    assert.equal(quote.status, 200);
    assert.match((await quote.json()).url, /^https:\/\/wa\.me\//);
    child.kill();
    await new Promise(resolve => child.once('exit', resolve));
    child = await start();
    const persisted = await (await fetch(`${base}/api/admin/catalog`, {headers:{cookie}})).json();
    assert.equal(persisted.settings.announcement, 'Configuração persistida');
    assert.equal(persisted.settings.internalToken, 'somente-no-painel');
    assert.equal(persisted.products.find(product => product.id === 'test-shirt')?.price, 149.9);
    assert.equal((await (await fetch(`${base}/api/catalog`)).json()).products.length, 2);
    persisted.products.find(product => product.id === 'test-shirt').available = false;
    persisted.products.find(product => product.id === 'test-shirt').status = 'inactive';
    assert.equal((await fetch(`${base}/api/admin/catalog`, {method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(persisted)})).status, 200);
    assert.equal((await (await fetch(`${base}/api/catalog`)).json()).products.some(product => product.id === 'test-shirt'), false);
    persisted.products = persisted.products.filter(product => product.id !== 'test-bone');
    persisted.revision = (await (await fetch(`${base}/api/admin/catalog`, {headers:{cookie}})).json()).revision;
    assert.equal((await fetch(`${base}/api/admin/catalog`, {method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(persisted)})).status, 200);
    assert.equal((await (await fetch(`${base}/api/catalog`)).json()).products.length, 0);
    assert.equal((await (await fetch(`${base}/api/admin/catalog`, {headers:{cookie}})).json()).products.some(product => product.id === 'test-bone'), false);
  } finally {
    child?.kill();
    if (path.dirname(path.resolve(tempDir)) !== root) throw new Error('Diretório temporário fora do projeto.');
    fs.rmSync(tempDir, {recursive:true,force:true});
  }
});
