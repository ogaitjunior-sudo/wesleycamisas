import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
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

test('produção protege o painel e mantém catálogo, upload, edição e pedido', async () => {
  const dataDir = fs.mkdtempSync(path.join(root, '.release-test-'));
  const salt = crypto.randomBytes(16).toString('hex');
  const password = crypto.randomBytes(20).toString('base64url');
  const hash = `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
  const baseEnv = { ...process.env, NODE_ENV:'production', DATA_DIR:dataDir, PORT:String(await getPort()) };
  const accessFile = path.join(dataDir, 'admin-access.txt');
  let child;
  let uploaded;
  try {
    const sourceCatalog=path.join(root, 'data/catalog.json');
    if(fs.existsSync(sourceCatalog))fs.copyFileSync(sourceCatalog,path.join(dataDir,'catalog.json'));
    assert.notEqual(spawnSync(process.execPath, ['server.js'], { cwd:root, env:{...baseEnv, ADMIN_PASSWORD_HASH:''} }).status, 0);
    fs.writeFileSync(accessFile, 'temporary development credential');
    assert.notEqual(spawnSync(process.execPath, ['server.js'], { cwd:root, env:{...baseEnv, ADMIN_PASSWORD_HASH:hash} }).status, 0);
    fs.unlinkSync(accessFile);
    const oldPassword=crypto.randomBytes(16).toString('base64url');
    const oldSalt=crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(path.join(dataDir,'admin.json'),JSON.stringify({salt:oldSalt,hash:crypto.scryptSync(oldPassword,oldSalt,64).toString('hex')}));

    child = spawn(process.execPath, ['server.js'], { cwd:root, env:{...baseEnv, ADMIN_PASSWORD_HASH:hash}, stdio:['ignore','pipe','pipe'] });
    await new Promise((resolve, reject) => {
      const timer=setTimeout(()=>reject(new Error('Servidor não iniciou.')),5000);
      let stderr='';child.stderr.on('data',data=>{stderr+=String(data);});
      child.stdout.on('data',data=>{if(String(data).includes('Wesllen Imports:')){clearTimeout(timer);resolve();}});
      child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Servidor terminou: ${code}. ${stderr}`));});
    });
    const base=`http://127.0.0.1:${baseEnv.PORT}`;
    fs.writeFileSync(accessFile, 'temporary development credential');
    assert.equal((await fetch(`${base}/data/admin-access.txt`)).status,404);
    fs.unlinkSync(accessFile);
    assert.equal((await fetch(`${base}/admin`, {redirect:'manual'})).status,302);
    assert.equal((await fetch(`${base}/admin.html`, {redirect:'manual'})).status,302);
    assert.equal((await fetch(`${base}/api/admin/catalog`, {method:'PUT',headers:{'content-type':'application/json'},body:'{}'})).status,401);
    assert.equal((await fetch(`${base}/api/admin/catalog`)).status,401);
    assert.equal((await fetch(`${base}/api/admin/login`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'invalid'})})).status,401);
    assert.equal((await fetch(`${base}/api/admin/login`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:oldPassword})})).status,401);
    const login=await fetch(`${base}/api/admin/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(`${base}/admin`,{headers:{cookie}})).status,200);
    assert.equal((await fetch(`${base}/api/admin/password`,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({password:'another-secret'})})).status,409);

    const publicBefore=await (await fetch(`${base}/api/catalog`)).json();
    assert.equal(publicBefore.products.length,0);
    const catalog=await (await fetch(`${base}/api/admin/catalog`,{headers:{cookie}})).json();
    assert.equal(catalog.products.length,8);
    assert.ok(catalog.products.every(product=>!product.available));
    const expectedPhone=catalog.settings.whatsapp||'5511999999999';
    catalog.settings.whatsapp=expectedPhone;
    catalog.products[0].available=true;
    const save=async()=>fetch(`${base}/api/admin/catalog`,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(catalog)});
    const incompleteSave=await save();
    assert.equal(incompleteSave.status,200);
    assert.equal((await incompleteSave.json()).unpublished.length,1);
    assert.equal((await (await fetch(`${base}/api/catalog`)).json()).products.length,0);
    catalog.products[0].available=false;
    const draft={id:'release-empty-draft',name:'',category:'',price:0,image:'',photos:[],available:true,fulfillment:'ready',stock:null,sizes:[]};
    catalog.products.push(draft);
    assert.equal((await save()).status,200);
    assert.equal((await (await fetch(`${base}/api/catalog`)).json()).products.length,0);
    assert.equal((await (await fetch(`${base}/api/admin/catalog`,{headers:{cookie}})).json()).products.find(p=>p.id===draft.id).available,false);
    catalog.products.pop();
    const unavailableQuote=await fetch(`${base}/api/quotes`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({items:[{productId:catalog.products[0].id,size:'G',quantity:1}],customer:{name:'Cliente Teste',city:'Cidade Teste'}})});
    assert.equal(unavailableQuote.status,400);

    const upload=await fetch(`${base}/api/admin/upload`,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl+7GQAAAAASUVORK5CYII='})});
    assert.equal(upload.status,200);
    uploaded=(await upload.json()).url;
    const product={...catalog.products[0],id:'release-test-product',name:'Produto de teste temporário',image:uploaded,photos:[],price:11.11,priceConfirmed:false,available:true,fulfillment:'ready',stock:3,personalizationFields:['name','number']};
    catalog.products.push(product);
    catalog.settings.instagram='https://www.instagram.com/perfil_teste/';
    catalog.settings.instagramEnabled=true;
    assert.equal((await save()).status,200);
    assert.equal((await (await fetch(`${base}/api/catalog`)).json()).products.some(p=>p.id===product.id),false);
    product.priceConfirmed=true;
    assert.equal((await save()).status,200);
    let observed=await (await fetch(`${base}/api/catalog`)).json();
    assert.equal(observed.products.find(p=>p.id===product.id).image,uploaded);
    assert.equal(observed.settings.instagramEnabled,true);
    product.price=22.22;
    assert.equal((await save()).status,200);
    observed=await (await fetch(`${base}/api/catalog`)).json();
    assert.equal(observed.products.find(p=>p.id===product.id).price,22.22);

    const quote=await fetch(`${base}/api/quotes`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({items:[{productId:product.id,size:'G',quantity:2,personalization:{name:'TESTE ÁÇÚ',number:'10'}}],customer:{name:'Cliente Teste',city:'Cidade Teste',note:''}})});
    assert.equal(quote.status,200);
    const result=await quote.json();
    assert.ok(result.url.startsWith(`https://wa.me/${expectedPhone}?text=`));
    assert.match(decodeURIComponent(result.url),/TESTE ÁÇÚ/);
    product.image='';
    assert.equal((await save()).status,200);
    assert.equal((await (await fetch(`${base}/api/catalog`)).json()).products.some(p=>p.id===product.id),false);
    assert.equal((await (await fetch(`${base}/api/admin/catalog`,{headers:{cookie}})).json()).products.find(p=>p.id===product.id).available,false);
    catalog.products=catalog.products.filter(p=>p.id!==product.id);
    catalog.settings.instagram='';
    catalog.settings.instagramEnabled=false;
    assert.equal((await save()).status,200);
  } finally {
    child?.kill();
    if(uploaded)fs.rmSync(path.join(root,'public',uploaded),{force:true});
    assert.equal(path.dirname(path.resolve(dataDir)),root);
    fs.rmSync(dataDir,{recursive:true,force:true});
  }
});
