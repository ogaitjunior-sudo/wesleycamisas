import { isDeepStrictEqual } from 'node:util';

const bucket = 'wesllen-products';

function unavailable(message) {
  return Object.assign(new Error(message), { status: 503 });
}

function projectBase(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/i.test(parsed.hostname) ||
      !['/', '/rest/v1', '/rest/v1/'].includes(parsed.pathname) || parsed.search || parsed.hash) {
    throw new Error('SUPABASE_URL deve ser a URL HTTPS do projeto Supabase.');
  }
  return parsed.origin;
}

export function createSupabaseStore({ url, secret, fetchImpl = fetch }) {
  if (!url && !secret) return null;
  if (!url || !secret) throw new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY juntos no servidor.');
  const base = projectBase(url);
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(secret)) throw new Error('SUPABASE_SECRET_KEY inválida.');
  const publicPhotoBase = `${base}/storage/v1/object/public/${bucket}/`;

  async function request(route, options = {}) {
    let response;
    try {
      response = await fetchImpl(`${base}${route}`, {
        ...options,
        headers: { apikey: secret, ...options.headers },
        signal: AbortSignal.timeout(15_000)
      });
    } catch {
      throw unavailable('Não foi possível conectar ao Supabase.');
    }
    if (!response.ok) {
      let code = '', message = '';
      try { const error = await response.json(); code = String(error.code || ''); message = String(error.message || ''); } catch {}
      if (route === '/rest/v1/rpc/wesllen_confirm_sale' && code === 'P0001')
        throw Object.assign(new Error(message || 'Não foi possível confirmar a venda.'), { status: 409 });
      throw unavailable(`Supabase recusou a operação (${response.status}${code ? `, ${code}` : ''}). Confira a migração, permissões e o bucket.`);
    }
    const content = await response.text();
    return content ? JSON.parse(content) : null;
  }

  const jsonHeaders = { 'Content-Type': 'application/json' };
  return {
    publicPhotoBase,
    async verify() {
      await request('/rest/v1/wesllen_catalog?id=eq.1&select=id');
    },
    async readCatalog() {
      const rows = await request('/rest/v1/wesllen_catalog?id=eq.1&select=document');
      return rows[0]?.document || null;
    },
    async readCatalogSnapshot() {
      const rows = await request('/rest/v1/wesllen_catalog?id=eq.1&select=document,updated_at');
      return rows[0] ? { document: rows[0].document, revision: rows[0].updated_at } : null;
    },
    async writeCatalog(document, expectedRevision) {
      if (expectedRevision) {
        const filter = new URLSearchParams({ id: 'eq.1', updated_at: `eq.${expectedRevision}` });
        const rows = await request(`/rest/v1/wesllen_catalog?${filter}`, {
          method: 'PATCH', headers: { ...jsonHeaders, Prefer: 'return=representation' },
          body: JSON.stringify({ document, updated_at: new Date(Math.max(Date.now(), Date.parse(expectedRevision) + 1)).toISOString() })
        });
        if (!rows.length) throw Object.assign(new Error('O catálogo foi alterado em outra sessão. Recarregue o painel antes de salvar.'), { status: 409 });
      } else {
        await request('/rest/v1/wesllen_catalog?on_conflict=id', {
          method: 'POST', headers: { ...jsonHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ id: 1, document, updated_at: new Date().toISOString() })
        });
      }
      const saved = (await request('/rest/v1/wesllen_catalog?id=eq.1&select=document'))[0]?.document;
      if (!isDeepStrictEqual(saved, document)) {
        throw unavailable('O Supabase não confirmou os dados salvos. Verifique os gatilhos da tabela wesllen_catalog e tente novamente.');
      }
    },
    async insertCatalogIfEmpty(document) {
      await request('/rest/v1/wesllen_catalog', {
        method: 'POST', headers: { ...jsonHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ id: 1, document, updated_at: new Date().toISOString() })
      });
    },
    async readQuotes() {
      const rows = await request('/rest/v1/wesllen_quotes?select=payload&order=created_at.desc&limit=2000');
      return rows.map(row => row.payload);
    },
    async writeQuote(quote) {
      await request('/rest/v1/wesllen_quotes', {
        method: 'POST', headers: { ...jsonHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ id: quote.id, created_at: quote.createdAt, payload: quote })
      });
    },
    async readSales() {
      const rows = await request('/rest/v1/wesllen_sales?select=id,quote_id,items,confirmed_at&order=confirmed_at.desc&limit=2000');
      return rows.map(row => ({ id: row.id, quoteId: row.quote_id, items: row.items, confirmedAt: row.confirmed_at }));
    },
    async confirmSale(sale) {
      return request('/rest/v1/rpc/wesllen_confirm_sale', {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ p_id: sale.id, p_quote_id: sale.quoteId || null, p_items: sale.items })
      });
    },
    async uploadPhoto(filename, mime, bytes) {
      await request(`/storage/v1/object/${bucket}/${filename}`, {
        method: 'POST', headers: { 'Content-Type': mime, 'x-upsert': 'false' }, body: bytes
      });
      return `${publicPhotoBase}${filename}`;
    }
  };
}
