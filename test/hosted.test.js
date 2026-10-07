import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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

test('modo Vercel mantém sessão assinada e usa banco e Storage externos', async () => {
  const salt = crypto.randomBytes(16).toString('hex');
  const password = crypto.randomBytes(20).toString('base64url');
  const hash = `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
  const port = await getPort();
  const env = { ...process.env, VERCEL:'1', NODE_ENV:'production', PORT:String(port),
    DATA_DIR:path.join(root, 'test', 'fixtures', 'absent-hosted-data'),
    ADMIN_PASSWORD_HASH:hash, SUPABASE_URL:'https://example.supabase.co', SUPABASE_SECRET_KEY:'sb_secret_fixture' };
  const start = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['test/fixtures/hosted-server.mjs'], { cwd:root, env, stdio:['ignore','pipe','pipe'] });
    const timer = setTimeout(() => reject(new Error('Servidor hospedado não iniciou.')), 5000);
    let stderr = '';
    child.stderr.on('data', data => { stderr += String(data); });
    child.stdout.on('data', data => { if (String(data).includes('Wesllen Imports:')) { clearTimeout(timer); resolve(child); } });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Servidor terminou: ${code}. ${stderr}`)); });
  });
  let child = await start();
  const base = `http://127.0.0.1:${port}`;
  try {
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(`${base}/app.js`)).status, 200);
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
    assert.equal((await fetch(`${base}/api/admin/catalog`, {method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(catalog)})).status, 200);
    assert.equal((await (await fetch(`${base}/api/catalog`)).json()).products.length, 1);
    const quote = await fetch(`${base}/api/quotes`, { method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({items:[{productId:'test-bone',quantity:1}],customer:{name:'Cliente Teste',city:'Cidade Teste'}}) });
    assert.equal(quote.status, 200);
    assert.match((await quote.json()).url, /^https:\/\/wa\.me\//);
    child.kill();
    await new Promise(resolve => child.once('exit', resolve));
    child = await start();
    assert.equal((await fetch(`${base}/api/admin/catalog`, {headers:{cookie}})).status, 200);
  } finally {
    child.kill();
  }
});
