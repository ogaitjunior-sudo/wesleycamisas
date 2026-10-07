import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareTeamsCatalog } from '../teams.js';
import { homeTeams, HOME_TEAM_LIMIT } from '../public/home-teams.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl+7GQAAAAASUVORK5CYII=';

test('times destacados aparecem sem produtos e respeitam a ordem e o limite', () => {
  const categories = Array.from({ length: 12 }, (_, index) => ({
    id: `time-${index}`, name: `Time ${index}`, is_active: true,
    show_on_home: true, sort_order: 12 - index
  }));
  categories[11].is_active = false;
  const selected = homeTeams(categories);
  assert.equal(HOME_TEAM_LIMIT, 10);
  assert.equal(selected.length, 10);
  assert.equal(selected[0].id, 'time-10');
  assert.equal(selected.at(-1).id, 'time-1');
});

test('escudos incluídos são padrão, sem substituir uploads ou remoções do painel', () => {
  const catalog = prepareTeamsCatalog({ categories: [
    { id:'real-madrid', logo_url:'' },
    { id:'flamengo', logo_url:'/uploads/team-logos/existente.png' },
    { id:'palmeiras', logo_url:'', logo_disabled:true }
  ], products:[] });
  assert.equal(catalog.categories.find(team=>team.id==='real-madrid').logo_url,'/assets/team-logos/real-madrid.png');
  assert.equal(catalog.categories.find(team=>team.id==='selecao-brasil').logo_url,'/assets/team-logos/selecao-brasil.png');
  assert.equal(catalog.categories.find(team=>team.id==='selecoes').logo_url,'/assets/team-logos/selecoes.svg');
  assert.equal(catalog.categories.find(team=>team.id==='flamengo').logo_url,'/uploads/team-logos/existente.png');
  assert.equal(catalog.categories.find(team=>team.id==='palmeiras').logo_url,'');
});

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('times do painel, produto relacionado e persistência local', async () => {
  const dataDir = fs.mkdtempSync(path.join(root, '.teams-test-'));
  const salt = crypto.randomBytes(16).toString('hex');
  const password = crypto.randomBytes(20).toString('base64url');
  const hash = `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const env = { ...process.env, DATA_DIR:dataDir, PORT:String(port), NODE_ENV:'production', ADMIN_PASSWORD_HASH:hash, SUPABASE_URL:'', SUPABASE_SECRET_KEY:'' };
  fs.writeFileSync(path.join(dataDir,'catalog.json'),JSON.stringify({
    settings:{ name:'Wesllen Imports', slogan:'Paixão pelo Futebol', whatsapp:'', instagram:'', instagramEnabled:false },
    productCategories:['Camisas'], categories:[], products:[], banners:[], promotions:[]
  }));
  let child;
  const uploads=[];
  const start = async () => {
    child = spawn(process.execPath,['server.js'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject) => {
      const timer=setTimeout(()=>reject(new Error('Servidor de teste não iniciou.')),5000);
      let stderr='';
      child.stderr.on('data',chunk=>{stderr+=String(chunk);});
      child.stdout.on('data',chunk=>{if(String(chunk).includes('Wesllen Imports:')){clearTimeout(timer);resolve();}});
      child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Servidor terminou: ${code}. ${stderr}`));});
    });
  };
  const stop = async () => { if (!child) return; const current=child; child=null; current.kill(); await new Promise(resolve=>current.once('exit',resolve)); };
  try {
    await start();
    assert.equal((await fetch(`${base}/times`)).status,200);
    assert.equal((await fetch(`${base}/times/real-madrid`)).status,200);
    assert.equal((await fetch(`${base}/api/admin/catalog`)).status,401);
    const login=await fetch(`${base}/api/admin/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
    assert.equal(login.status,200);
    let cookie=login.headers.get('set-cookie').split(';')[0];
    const admin=async()=> (await fetch(`${base}/api/admin/catalog`,{headers:{cookie}})).json();
    const save=async document=>fetch(`${base}/api/admin/catalog`,{method:'PUT',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(document)});
    const catalog=await admin();
    assert.equal(catalog.categories.filter(team=>team.category==='Brasil'&&team.id!=='brasileirao').length,20);
    assert.equal(catalog.categories.filter(team=>team.category==='Europa').length,23);
    const selections=catalog.categories.filter(team=>team.category==='Seleções'&&team.id!=='selecoes');
    assert.equal(selections.length,16);
    assert.equal(selections.find(team=>team.id==='selecao-brasil').logo_url,'/assets/team-logos/selecao-brasil.png');
    assert.equal(selections.find(team=>team.id==='selecao-japao').name,'Japão');
    assert.equal(catalog.categories.find(team=>team.id==='real-madrid').slug,'real-madrid');
    assert.equal(catalog.categories.find(team=>team.id==='real-madrid').logo_url,'/assets/team-logos/real-madrid.png');
    assert.equal((await fetch(`${base}/assets/team-logos/real-madrid.png`)).status,200);
    const video = await fetch(`${base}/assets/hero-wesllen-video-fast.mp4`, { headers: { Range: 'bytes=0-1023' } });
    assert.equal(video.status, 206);
    assert.equal(video.headers.get('content-type'), 'video/mp4');
    assert.equal(video.headers.get('accept-ranges'), 'bytes');
    assert.equal((await video.arrayBuffer()).byteLength, 1024);
    const poster = await fetch(`${base}/assets/hero-wesllen-poster.jpg`);
    assert.equal(poster.status, 200);
    assert.equal(poster.headers.get('content-type'), 'image/jpeg; charset=utf-8');

    const upload=async kind=>{
      const response=await fetch(`${base}/api/admin/upload`,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({kind,data:`data:image/png;base64,${pixel}`})});
      assert.equal(response.status,200);
      const {url}=await response.json();uploads.push(url);return url;
    };
    const logo=await upload('team-logo');
    assert.match(logo,/^\/uploads\/team-logos\//);
    assert.equal((await fetch(`${base}${logo}`)).status,200);
    const photo=await upload('product');
    const real=catalog.categories.find(team=>team.id==='real-madrid');
    real.logo_url=logo;real.sort_order=0;real.show_on_home=true;
    catalog.products.push({id:'teams-test-shirt',name:'Camisa de teste',description:'Somente homologação',category:'Camisas',team_id:'real-madrid',team:'real-madrid',price:99,priceConfirmed:true,promoPrice:null,image:photo,photos:[],available:true,fulfillment:'ready',stock:2,sizes:['G'],customizable:false});
    assert.equal((await save(catalog)).status,200);
    let publicCatalog=await (await fetch(`${base}/api/catalog`)).json();
    assert.equal(publicCatalog.products.filter(product=>product.team_id==='real-madrid').length,1);
    assert.equal(publicCatalog.products.filter(product=>product.team_id==='flamengo').length,0);
    real.is_active=false;
    assert.equal((await save(catalog)).status,200);
    publicCatalog=await (await fetch(`${base}/api/catalog`)).json();
    assert.equal(publicCatalog.categories.find(team=>team.id==='real-madrid').is_active,false);
    await stop();
    await start();
    const secondLogin=await fetch(`${base}/api/admin/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
    cookie=secondLogin.headers.get('set-cookie').split(';')[0];
    const persisted=await admin();
    assert.equal(persisted.categories.find(team=>team.id==='real-madrid').logo_url,logo);
    assert.equal(persisted.categories.find(team=>team.id==='real-madrid').is_active,false);
    assert.equal(persisted.products.find(product=>product.id==='teams-test-shirt').team_id,'real-madrid');
  } finally {
    await stop();
    for(const url of uploads)fs.rmSync(path.join(root,'public',url.replace(/^\//,'')),{force:true});
    fs.rmSync(dataDir,{recursive:true,force:true});
  }
});
