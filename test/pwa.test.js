import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('manifesto define instalação e ícones reais da marca', () => {
  const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const buffer = fs.readFileSync(`public${icon.src}`);
    assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const size = Number(icon.sizes.split('x')[0]);
    assert.equal(buffer.readUInt32BE(16), size);
    assert.equal(buffer.readUInt32BE(20), size);
  }
});

test('service worker mantém catálogo e painel na rede e usa página offline só em falha de navegação', async () => {
  const listeners = new Map();
  const cacheData = new Map();
  const cache = name => {
    if (!cacheData.has(name)) cacheData.set(name, new Map());
    const entries = cacheData.get(name);
    return {
      match: async request => entries.get(typeof request === 'string' ? request : request.url),
      put: async (request, response) => { entries.set(request.url, response); },
      keys: async () => [...entries.keys()].map(url => new Request(url)),
      delete: async request => entries.delete(request.url)
    };
  };
  let offline = false;
  let revision = 0;
  const context = {
    self: { location: { origin: 'https://loja.test' }, addEventListener: (type, fn) => listeners.set(type, fn) },
    caches: { open: async name => cache(name), match: async path => path === '/offline.html' ? new Response('Sem conexão') : undefined },
    fetch: async () => {
      if (offline) throw new Error('offline');
      const response = new Response(`versão ${++revision}`, { status: 200 });
      Object.defineProperty(response, 'type', { value: 'basic' });
      return response;
    },
    Request, Response, URL, Error, Promise
  };
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), context);
  const request = (url, mode = 'same-origin') => {
    let response;
    listeners.get('fetch')({ request: { method: 'GET', url: `https://loja.test${url}`, mode }, respondWith: value => { response = value; } });
    return response;
  };
  assert.equal(request('/api/catalog'), undefined);
  assert.equal(request('/api/quotes'), undefined);
  assert.equal(request('/admin'), undefined);
  assert.equal(request('/admin.js'), undefined);
  assert.equal(request('/uploads/foto.png'), undefined);
  assert.equal((await (await request('/catalogo', 'navigate')).text()), 'versão 1');
  assert.equal((await (await request('/catalogo', 'navigate')).text()), 'versão 2');
  offline = true;
  assert.equal((await (await request('/catalogo', 'navigate')).text()), 'Sem conexão');
  offline = false;
  assert.equal((await (await request('/shop.js')).text()), 'versão 3');
  offline = true;
  assert.equal((await (await request('/shop.js')).text()), 'versão 3');
});
