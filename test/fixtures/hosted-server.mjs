import fs from 'node:fs';

const initialCatalog = {
  settings: { name: 'Wesllen Imports', whatsapp: '5511999999999' },
  productCategories: ['Bonés', 'Camisas'], categories: [], products: [], banners: [], promotions: []
};
const stateFile = process.env.FIXTURE_STATE_FILE;
let catalog = stateFile && fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : initialCatalog;
let updatedAt = new Date().toISOString();
const quotes = [];
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input);
  const method = options.method || 'GET';
  if (url.pathname.endsWith('/wesllen_catalog')) {
    if (method === 'GET') return Response.json([{ document: catalog, updated_at: updatedAt }]);
    if (method === 'PATCH' && url.searchParams.get('updated_at') !== `eq.${updatedAt}`) return Response.json([]);
    const update = JSON.parse(options.body);
    catalog = update.document;
    updatedAt = update.updated_at || new Date().toISOString();
    if (stateFile) fs.writeFileSync(stateFile, JSON.stringify(catalog));
    return method === 'PATCH' ? Response.json([{ document: catalog, updated_at: updatedAt }]) : new Response('', { status: 201 });
  }
  if (url.pathname.endsWith('/wesllen_quotes')) {
    if (method === 'GET') return Response.json(quotes.map(payload => ({ payload })));
    quotes.unshift(JSON.parse(options.body).payload);
    return new Response('', { status: 201 });
  }
  if (url.pathname.includes('/storage/v1/object/')) return Response.json({ Key: url.pathname });
  return new Response('', { status: 404 });
};
const { createServer } = await import('node:http');
const { default: handler } = await import('../../api/index.js');
createServer(handler).listen(Number(process.env.PORT), '127.0.0.1', () => {
  process.stdout.write(`Wesllen Imports: http://localhost:${process.env.PORT}\n`);
});
