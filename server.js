import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { quoteFrom, orderItemsFrom } from './order.js';
import { calculateShipping, shippingMeasurements } from './shipping.js';
import { normalizedCatalog, publicationIssues } from './publication.js';
import { createSupabaseStore } from './supabase-store.js';
import { prepareTeamsCatalog } from './teams.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
const uploadDir = path.join(publicDir, 'uploads');
const catalogFile = path.join(dataDir, 'catalog.json');
const quotesFile = path.join(dataDir, 'quotes.json');
const adminFile = path.join(dataDir, 'admin.json');
const accessFile = path.join(dataDir, 'admin-access.txt');
const sessions = new Map();
const port = Number(process.env.PORT || 3000);
const hosted = process.env.VERCEL === '1';
const production = process.env.NODE_ENV === 'production' || hosted;
const supabase = createSupabaseStore({ url: process.env.SUPABASE_URL, secret: process.env.SUPABASE_SECRET_KEY });
if (hosted && !supabase) throw new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY na Vercel.');
const publicPhotoBase = supabase?.publicPhotoBase || '';
const environmentHash = String(process.env.ADMIN_PASSWORD_HASH || '');
if ((production || environmentHash) && !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/i.test(environmentHash)) {
  throw new Error('Configure ADMIN_PASSWORD_HASH antes de iniciar a loja em produção.');
}
if (production && fs.existsSync(accessFile)) {
  throw new Error('Remova a senha temporária de desenvolvimento antes de iniciar em produção.');
}
if (!hosted) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
}

const initialCatalog = {
  settings: {
    name: 'Wesllen Imports',
    slogan: 'Paixão pelo Futebol',
    whatsapp: '',
    instagram: '',
    instagramEnabled: false,
    shippingEnabled: false,
    shippingOriginCep: '',
    announcement: 'Camisas importadas, personalização e presentes exclusivos',
    heroEyebrow: 'VISTA SUA',
    heroTitle: 'PAIXÃO',
    heroSubtitle: 'PERSONALIZE DO SEU JEITO!',
    heroDescription: 'Camisas importadas, personalização com nome e número e produtos exclusivos.',
    heroPrimaryLabel: 'VER CAMISAS',
    heroPrimaryLink: '/catalogo?categoria=Camisas',
    heroSecondaryLabel: 'PERSONALIZAR AGORA',
    heroSecondaryLink: '/produto?id=personalizada-10',
    address: '',
    defaultMessage: 'Olá, Wesley! Gostaria de falar com a Wesllen Imports.',
    defaultPersonalizationPrice: 25
  },
  productCategories: ['Camisas','Personalizados','Canecas','Bonés','Presentes','Importados'],
  categories: [
    { id: 'brasileirao', name: 'Brasileirão', emblem: '🇧🇷' },
    { id: 'real-madrid', name: 'Real Madrid', emblem: '👑' },
    { id: 'barcelona', name: 'Barcelona', emblem: '🔵' },
    { id: 'flamengo', name: 'Flamengo', emblem: '🔴' },
    { id: 'palmeiras', name: 'Palmeiras', emblem: '🟢' },
    { id: 'corinthians', name: 'Corinthians', emblem: '⚓' },
    { id: 'bahia', name: 'Bahia', emblem: '🔵' },
    { id: 'vitoria', name: 'Vitória', emblem: '🔴' },
    { id: 'selecoes', name: 'Seleções', emblem: '🏆' },
    { id: 'retro', name: 'Retrô', emblem: '⭐' }
  ],
  products: [
    { id: 'real-2627', name: 'Camisa Real Madrid 26/27', description: 'Camisa importada com acabamento premium e tecido leve para viver o futebol em qualquer ocasião.', category: 'Camisas', team: 'real-madrid', price: 189.9, promoPrice: null, image: '', photos: [], available: false, featured: true, bestseller: true, new: true, customizable: true, personalizationPrice: 25, sizes: ['P','M','G','GG','XG'], badge: 'Novo' },
    { id: 'flamengo-2627', name: 'Camisa Flamengo 26/27', description: 'O manto rubro-negro em uma versão importada para torcer com estilo.', category: 'Camisas', team: 'flamengo', price: 179.9, promoPrice: null, image: '', photos: [], available: false, featured: true, bestseller: true, new: false, customizable: true, personalizationPrice: 25, sizes: ['P','M','G','GG','XG'], badge: 'Mais vendido' },
    { id: 'barcelona-2627', name: 'Camisa Barcelona 26/27', description: 'Camisa importada azul e grená para vestir a paixão pelo Barça.', category: 'Camisas', team: 'barcelona', price: 189.9, promoPrice: null, image: '', photos: [], available: false, featured: true, bestseller: true, new: false, customizable: true, personalizationPrice: 25, sizes: ['P','M','G','GG','XG'], badge: 'Personalize' },
    { id: 'personalizada-10', name: 'Camisa Personalizada', description: 'Crie sua camisa com nome e número. Escolha o tamanho e faça do seu jeito.', category: 'Personalizados', team: 'brasileirao', price: 159.9, promoPrice: null, image: '', photos: [], available: false, featured: true, bestseller: false, new: false, customizable: true, personalizationPrice: 0, sizes: ['P','M','G','GG','XG'], badge: 'Personalize' },
    { id: 'caneca-preta', name: 'Caneca Personalizada', model: 'Preta', description: 'Caneca de cerâmica preta para presentear ou celebrar o seu time.', category: 'Canecas', team: '', price: 39.9, promoPrice: null, image: '', photos: [], available: false, featured: false, bestseller: false, new: false, customizable: true, personalizationPrice: 0, sizes: [], badge: '' },
    { id: 'bone-wesllen', name: 'Boné Esportivo', description: 'Boné com visual esportivo e ajuste confortável.', category: 'Bonés', team: '', price: 69.9, promoPrice: null, image: '', photos: [], available: false, featured: false, bestseller: false, new: false, customizable: false, personalizationPrice: 0, sizes: [], badge: '' },
    { id: 'chaveiro-futebol', name: 'Presente Personalizado', description: 'Um presente especial para quem vive o futebol todos os dias.', category: 'Presentes', team: '', price: 29.9, promoPrice: null, image: '', photos: [], available: false, featured: false, bestseller: false, new: false, customizable: true, personalizationPrice: 0, sizes: [], badge: '' },
    { id: 'kit-importados', name: 'Produto Importado', description: 'Acessórios esportivos selecionados pela Wesllen Imports.', category: 'Importados', team: '', price: 89.9, promoPrice: null, image: '', photos: [], available: false, featured: false, bestseller: false, new: false, customizable: false, personalizationPrice: 0, sizes: [], badge: '' }
  ],
  banners: [],
  promotions: []
};

function writeJson(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2));
  fs.renameSync(temp, file);
}
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
if (!hosted && !fs.existsSync(catalogFile)) writeJson(catalogFile, initialCatalog);
if (!hosted && !fs.existsSync(quotesFile)) writeJson(quotesFile, []);
if (!production && !environmentHash && !fs.existsSync(adminFile)) {
  const password = crypto.randomBytes(15).toString('base64url');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  writeJson(adminFile, { salt, hash });
  fs.writeFileSync(accessFile, `Painel Wesllen Imports\nURL: http://localhost:${port}/admin\nSenha inicial: ${password}\nTroque esta senha no painel após o primeiro acesso.\n`, { mode: 0o600 });
  console.log(`Senha inicial do painel salva em ${accessFile}`);
}

async function getCatalog() {
  if (!supabase) return prepareTeamsCatalog(readJson(catalogFile, initialCatalog));
  const catalog = await supabase.readCatalog();
  if (catalog) return prepareTeamsCatalog(catalog);
  if (hosted) throw Object.assign(new Error('Catálogo Supabase vazio. Importe o catálogo inicial antes de publicar.'), { status: 503 });
  return prepareTeamsCatalog(readJson(catalogFile, initialCatalog));
}
async function saveCatalog(catalog) {
  const prepared = prepareTeamsCatalog(catalog);
  if (supabase) await supabase.writeCatalog(prepared);
  else writeJson(catalogFile, prepared);
}
async function getQuotes() {
  return supabase ? supabase.readQuotes() : readJson(quotesFile, []);
}
async function saveQuote(quote) {
  if (supabase) await supabase.writeQuote(quote);
  else {
    const quotes = readJson(quotesFile, []);
    quotes.unshift(quote);
    writeJson(quotesFile, quotes.slice(0, 2000));
  }
}

function json(res, status, value, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(value));
}
function body(req, max = 8_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [];
    req.on('data', chunk => { size += chunk.length; if (size > max) { reject(new Error('Arquivo ou formulário muito grande.')); req.destroy(); } else chunks.push(chunk); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('JSON inválido.')); } });
    req.on('error', reject);
  });
}
function cookie(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').map(x => x.trim()).find(x => x.startsWith('wesllen_session='))?.split('=')[1] || '';
}
function isAdmin(req) {
  const token = cookie(req);
  if (hosted) {
    const [expiry, nonce, signature] = token.split('.');
    if (!expiry || !/^[a-f0-9]{32}$/.test(nonce || '') || !/^[a-f0-9]{64}$/.test(signature || '') || Number(expiry) < Date.now()) return false;
    const expected = crypto.createHmac('sha256', environmentHash).update(`${expiry}.${nonce}`).digest();
    return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
  }
  const expiry = sessions.get(token);
  if (!expiry) return false;
  if (expiry < Date.now()) { sessions.delete(token); return false; }
  return true;
}
function adminCredentials() {
  if (environmentHash) {
    const [, salt, hash] = environmentHash.split('$');
    return { salt, hash };
  }
  return readJson(adminFile, {});
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4' };
function serveFile(req, res, pathname) {
  const target = pathname === '/admin' || pathname === '/admin/login' ? '/admin.html' : pathname === '/catalogo' ? '/catalogo.html' : pathname === '/produto' ? '/produto.html' : pathname === '/carrinho' ? '/carrinho.html' : pathname === '/times' || /^\/times\/[^/]+$/.test(pathname) ? '/times.html' : pathname === '/' ? '/index.html' : pathname;
  let decoded;
  try { decoded = decodeURIComponent(target); } catch { return json(res, 400, { error: 'Caminho inválido.' }); }
  const resolved = path.resolve(publicDir, `.${decoded}`);
  if (!resolved.startsWith(publicDir + path.sep)) return json(res, 403, { error: 'Acesso negado.' });
  if (path.extname(resolved) === '.mp4') {
    return fs.stat(resolved, (error, stats) => {
      if (error || !stats.isFile()) return json(res, 404, { error: 'Página não encontrada.' });
      const range = req.headers.range;
      const match = range && /^bytes=(\d*)-(\d*)$/.exec(range);
      let start = 0;
      let end = stats.size - 1;
      if (range) {
        if (!match || (!match[1] && !match[2])) {
          res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
          return res.end();
        }
        if (match[1]) start = Number(match[1]);
        if (match[2]) end = Number(match[2]);
        if (!match[1]) start = Math.max(0, stats.size - end);
        if (match[1] && !match[2]) end = stats.size - 1;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stats.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
          return res.end();
        }
        end = Math.min(end, stats.size - 1);
      }
      res.writeHead(range ? 206 : 200, {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${stats.size}` } : {}),
        'Cache-Control': 'public, max-age=3600'
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(resolved, { start, end }).pipe(res);
    });
  }
  fs.readFile(resolved, (error, data) => {
    if (error) return json(res, 404, { error: 'Página não encontrada.' });
    res.writeHead(200, { 'Content-Type': `${mime[path.extname(resolved)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': resolved.includes('uploads') ? 'public, max-age=3600' : 'no-cache' });
    if (req.method === 'HEAD') res.end(); else res.end(data);
  });
}
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  if (!['GET','HEAD','POST','PUT','DELETE'].includes(req.method)) return json(res, 405, { error: 'Método não permitido.' });
  if (['POST','PUT','DELETE'].includes(req.method) && !sameOrigin(req)) return json(res, 403, { error: 'Origem não permitida.' });
  try {
    if ((pathname === '/admin' || pathname === '/admin.html') && !isAdmin(req)) {
      res.writeHead(302, { Location: '/admin/login', 'Cache-Control': 'no-store' });
      return res.end();
    }
    if (pathname === '/admin/login' && isAdmin(req)) {
      res.writeHead(302, { Location: '/admin', 'Cache-Control': 'no-store' });
      return res.end();
    }
    if (pathname === '/api/catalog' && req.method === 'GET') {
      const catalog = normalizedCatalog(await getCatalog(), uploadDir, publicPhotoBase);
      return json(res, 200, { ...catalog, products: catalog.products.filter(product => product.available) });
    }
    if (pathname === '/api/shipping/quote' && req.method === 'POST') {
      const payload = await body(req, 100_000);
      const catalog = normalizedCatalog(await getCatalog(), uploadDir, publicPhotoBase);
      if (catalog.settings?.shippingEnabled !== true) return json(res, 409, { error: 'Frete automático ainda não está ativo.' });
      const items = orderItemsFrom(payload.items, catalog);
      const quote = await calculateShipping({ postalCode: payload.postalCode, items, catalog, token: process.env.MELHOR_ENVIO_TOKEN, userAgent: process.env.MELHOR_ENVIO_USER_AGENT, sandbox: process.env.MELHOR_ENVIO_SANDBOX === '1' });
      return json(res, 200, quote);
    }
    if (pathname === '/api/admin/session' && req.method === 'GET') return json(res, 200, { authenticated: isAdmin(req), passwordManagedByEnvironment: Boolean(environmentHash) });
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      const { password } = await body(req, 4000);
      const admin = adminCredentials();
      if (!admin.salt || !admin.hash) return json(res, 503, { error: 'Acesso administrativo ainda não configurado.' });
      const attempt = crypto.scryptSync(String(password || ''), admin.salt, 64);
      const stored = Buffer.from(admin.hash, 'hex');
      if (attempt.length !== stored.length || !crypto.timingSafeEqual(attempt, stored)) return json(res, 401, { error: 'Senha incorreta.' });
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = Date.now() + 12 * 60 * 60 * 1000;
      if (!hosted) sessions.set(token, expiry);
      const session = hosted ? `${expiry}.${crypto.randomBytes(16).toString('hex')}` : token;
      const signed = hosted ? `${session}.${crypto.createHmac('sha256', environmentHash).update(session).digest('hex')}` : session;
      return json(res, 200, { ok: true }, { 'Set-Cookie': `wesllen_session=${signed}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${req.socket.encrypted || production ? '; Secure' : ''}` });
    }
    if (pathname === '/api/admin/logout' && req.method === 'POST') { sessions.delete(cookie(req)); return json(res, 200, { ok: true }, { 'Set-Cookie': 'wesllen_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }); }
    if (pathname.startsWith('/api/admin/') && !isAdmin(req)) return json(res, 401, { error: 'Entre no painel para continuar.' });
    if (pathname === '/api/admin/catalog' && req.method === 'GET') return json(res, 200, normalizedCatalog(await getCatalog(), uploadDir, publicPhotoBase));
    if (pathname === '/api/admin/catalog' && req.method === 'PUT') {
      const next = prepareTeamsCatalog(await body(req));
      if (!next || !Array.isArray(next.products) || !Array.isArray(next.categories) || !Array.isArray(next.productCategories) || !next.settings || typeof next.settings !== 'object') return json(res, 400, { error: 'Catálogo inválido.' });
      const instagram=String(next.settings.instagram||'').trim();
      if (instagram) {
        let valid=false;
        try { const url=new URL(instagram);valid=url.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(url.hostname)&&url.pathname.split('/').filter(Boolean).length>0; } catch {}
        if(!valid)return json(res,400,{error:'Informe uma URL válida do Instagram (https://www.instagram.com/perfil/).'});
      }
      next.settings.instagramEnabled=next.settings.instagramEnabled===true;
      next.settings.shippingEnabled=next.settings.shippingEnabled===true;
      next.settings.shippingOriginCep=String(next.settings.shippingOriginCep||'').replace(/\D/g,'');
      if(next.settings.shippingOriginCep&&!/^\d{8}$/.test(next.settings.shippingOriginCep))return json(res,400,{error:'Informe um CEP de origem com 8 números.'});
      if(next.settings.shippingEnabled&&!next.settings.shippingOriginCep)return json(res,400,{error:'Configure o CEP de origem antes de ativar o frete.'});
      if(next.settings.shippingEnabled&&(!process.env.MELHOR_ENVIO_TOKEN||!process.env.MELHOR_ENVIO_USER_AGENT))return json(res,409,{error:'Configure MELHOR_ENVIO_TOKEN e MELHOR_ENVIO_USER_AGENT no servidor antes de ativar o frete.'});
      const teamIds=new Set(),teamSlugs=new Set();
      for(const team of next.categories){
        if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(team.id||''))||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(team.slug||''))||!String(team.name||'').trim()||teamIds.has(team.id)||teamSlugs.has(team.slug))return json(res,400,{error:'Time inválido, duplicado ou com slug repetido.'});
        if(!['Brasil','Europa','Seleções','Retrô'].includes(team.category))return json(res,400,{error:'Categoria de time inválida.'});
        if(!Number.isInteger(Number(team.sort_order))||Number(team.sort_order)<0)return json(res,400,{error:'Ordem do time inválida.'});
        if(team.logo_url){
          const local=/^\/uploads\/team-logos\/[a-f0-9-]+\.(?:png|webp)$/i.exec(String(team.logo_url));
          const remote=Boolean(publicPhotoBase&&String(team.logo_url).startsWith(`${publicPhotoBase}team-logos/`)&&/^[a-f0-9-]+\.(?:png|webp)$/i.test(String(team.logo_url).slice(`${publicPhotoBase}team-logos/`.length)));
          const bundledFile=`${team.id}.${team.id==='selecoes'?'svg':'png'}`;
          const bundled=String(team.logo_url)===`/assets/team-logos/${bundledFile}`&&fs.existsSync(path.join(publicDir,'assets','team-logos',bundledFile));
          if(!bundled&&!remote&&!(local&&fs.existsSync(path.join(uploadDir,'team-logos',path.basename(local[0])))))return json(res,400,{error:'Envie o escudo PNG ou WebP pelo painel.'});
        }
        team.is_active=team.is_active===true;team.show_on_home=team.show_on_home===true;
        teamIds.add(team.id);teamSlugs.add(team.slug);
      }
      const chosenHomeTeams = next.categories.filter(team => team.is_active && team.show_on_home);
      if (chosenHomeTeams.length > 10) {
        const previous = prepareTeamsCatalog(await getCatalog());
        const previousChosen = new Set(previous.categories.filter(team => team.is_active && team.show_on_home).map(team => team.id));
        if (chosenHomeTeams.some(team => !previousChosen.has(team.id))) return json(res, 400, { error: 'A Home aceita no máximo 10 times em destaque.' });
      }
      const ids=new Set();
      for(const product of next.products){
        if(!product.id||ids.has(product.id)||!Number.isFinite(Number(product.price))||Number(product.price)<0) return json(res,400,{error:'Produto inválido ou duplicado.'});
        ids.add(product.id);
        if(product.stock!=null&&(!Number.isInteger(Number(product.stock))||Number(product.stock)<0))return json(res,400,{error:'Estoque inválido.'});
        if(product.promoPrice!=null&&(!Number.isFinite(Number(product.promoPrice))||Number(product.promoPrice)<=0||Number(product.promoPrice)>=Number(product.price)))return json(res,400,{error:'Preço promocional inválido.'});
        if(product.promotion&&!product.promoPrice)return json(res,400,{error:'Promoção precisa de preço promocional.'});
        if(product.fulfillment&&!['ready','order'].includes(product.fulfillment))return json(res,400,{error:'Tipo de entrega inválido.'});
        product.team_id=String(product.team_id??product.team??'');
        if(product.team_id&&!teamIds.has(product.team_id))return json(res,400,{error:'Selecione um time cadastrado para o produto.'});
        if(product.team_id)product.team=product.team_id;
        if(product.shipping!=null){
          if(typeof product.shipping!=='object'||Array.isArray(product.shipping))return json(res,400,{error:'Peso e medidas inválidos.'});
          product.shipping=Object.fromEntries(['weight','width','height','length'].map(key=>[key,product.shipping[key]==null||product.shipping[key]===''?null:Number(product.shipping[key])]));
          if(Object.values(product.shipping).some(value=>value!=null&&(!Number.isFinite(value)||value<=0)))return json(res,400,{error:'Peso e medidas devem ser maiores que zero.'});
        }
        if(next.settings.shippingEnabled&&product.available){
          try{shippingMeasurements(product);}catch{return json(res,400,{error:`Cadastre peso e medidas de ${product.name} antes de ativar o frete.`});}
        }
      }
      const unpublished = next.products.filter(product => product.available && publicationIssues(product, next, uploadDir, publicPhotoBase).length)
        .map(product => ({ id: product.id, missing: publicationIssues(product, next, uploadDir, publicPhotoBase) }));
      await saveCatalog(normalizedCatalog(next, uploadDir, publicPhotoBase));
      return json(res, 200, { ok: true, unpublished });
    }
    if (pathname === '/api/admin/quotes' && req.method === 'GET') return json(res, 200, await getQuotes());
    if (pathname === '/api/admin/password' && req.method === 'PUT') {
      if (environmentHash) return json(res, 409, { error: 'Senha gerenciada pela configuração segura do servidor.' });
      const payload = await body(req, 4000);
      if (String(payload.password || '').length < 10) return json(res, 400, { error: 'Use pelo menos 10 caracteres.' });
      const salt = crypto.randomBytes(16).toString('hex');
      writeJson(adminFile, { salt, hash: crypto.scryptSync(payload.password, salt, 64).toString('hex') });
      if (fs.existsSync(accessFile)) fs.unlinkSync(accessFile);
      return json(res, 200, { ok: true });
    }
    if (pathname === '/api/admin/upload' && req.method === 'POST') {
      const payload = await body(req);
      const teamLogo=payload.kind==='team-logo';
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(payload.data || ''));
      if (!match) return json(res, 400, { error: 'Envie PNG, JPEG ou WebP.' });
      if(teamLogo&&match[1]==='jpeg')return json(res,400,{error:'Use PNG ou WebP para escudos.'});
      const bytes = Buffer.from(match[2], 'base64');
      if (bytes.length > 5_000_000) return json(res, 400, { error: 'Imagem acima de 5 MB.' });
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      const filename = `${teamLogo?'team-logos/':''}${crypto.randomUUID()}.${ext}`;
      const url = supabase ? await supabase.uploadPhoto(filename, `image/${match[1]}`, bytes) : `/uploads/${filename}`;
      if (!supabase) {fs.mkdirSync(path.dirname(path.join(uploadDir,filename)),{recursive:true});fs.writeFileSync(path.join(uploadDir, filename), bytes);}
      return json(res, 200, { url });
    }
    if (pathname === '/api/quotes' && req.method === 'POST') {
      const payload = await body(req, 100_000);
      const catalog = normalizedCatalog(await getCatalog(), uploadDir, publicPhotoBase);
      let shipping = null;
      if (catalog.settings?.shippingEnabled === true) {
        const items = orderItemsFrom(payload.items, catalog);
        const fresh = await calculateShipping({ postalCode: payload.customer?.postalCode, items, catalog, token: process.env.MELHOR_ENVIO_TOKEN, userAgent: process.env.MELHOR_ENVIO_USER_AGENT, sandbox: process.env.MELHOR_ENVIO_SANDBOX === '1' });
        const selected = fresh.options.find(option => option.id === String(payload.shipping?.id || ''));
        if (!selected || selected.priceCents !== Number(payload.shipping?.priceCents) || selected.deliveryDays !== Number(payload.shipping?.deliveryDays)) return json(res, 409, { error: 'O frete mudou ou não está mais disponível. Calcule novamente antes de finalizar.' });
        shipping = { ...selected, postalCode: fresh.postalCode };
      }
      const quote = quoteFrom(payload, catalog, shipping);
      const phone = String(catalog.settings.whatsapp || '').replace(/\D/g, '');
      if (!phone) return json(res, 422, { error: 'O WhatsApp da loja ainda não está configurado.' });
      await saveQuote(quote);
      return json(res, 200, { id: quote.id, message: quote.message, url: `https://wa.me/${phone}?text=${encodeURIComponent(quote.message)}` });
    }
    if (req.method === 'GET' || req.method === 'HEAD') return serveFile(req, res, pathname);
    return json(res, 404, { error: 'Recurso não encontrado.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado.';
    return json(res, error?.status || 400, { error: message });
  }
});
// A Vercel chama o mesmo servidor pela função Node; localmente ele usa uma porta normal.
export default function handler(req, res) {
  server.emit('request', req, res);
}
if (!hosted) {
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Wesllen Imports: http://localhost:${port}`));
}
