import crypto from 'node:crypto';
import zlib from 'node:zlib';

const base = new URL(process.env.SUPABASE_URL || '');
const secret = process.env.SUPABASE_SECRET_KEY || '';
if (base.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/i.test(base.hostname) || !/^sb_secret_[A-Za-z0-9_-]+$/.test(secret)) {
  throw new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY somente no ambiente do terminal.');
}
const bucket = 'wesllen-products';
const origin = base.origin;
const prefix = `_homologacao/${crypto.randomUUID()}/`;
const attempted = [];
const results = {};

async function request(route, options = {}, authenticated = true) {
  const response = await fetch(`${origin}${route}`, {
    ...options,
    headers: { ...(authenticated ? { apikey: secret } : {}), ...options.headers },
    signal: AbortSignal.timeout(30_000)
  });
  return response;
}
async function body(response) {
  try { return await response.json(); } catch { return {}; }
}
function requireOk(response, label) {
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
}
async function list() {
  const response = await request(`/storage/v1/object/list/${bucket}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 100 })
  });
  requireOk(response, 'Listagem do Storage');
  return body(response);
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type);
  let crc = 0xffffffff;
  for (const byte of name) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  name.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}
function largePng() {
  const width = 1400, height = 1300;
  const pixels = crypto.randomBytes(width * height * 3);
  const rows = Buffer.alloc(height * (1 + width * 3));
  for (let row = 0; row < height; row++) pixels.copy(rows, row * (1 + width * 3) + 1, row * width * 3, (row + 1) * width * 3);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(rows, { level: 0 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const fixtures = [
  ['png', 'image/png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP8tUWOgYGBiQEMABaWAdDzw9+AAAAAAElFTkSuQmCC', 'base64')],
  ['jpg', 'image/jpeg', Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDuKKKK/Mj6o//Z', 'base64')],
  ['webp', 'image/webp', Buffer.from('UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoCAAIAAUAmJaACdLoB+AADsAD+8sp//fAn3gT7wJ/vF/+emUQWb0sAAAA=', 'base64')]
];

try {
  const bucketResponse = await request(`/storage/v1/bucket/${bucket}`);
  requireOk(bucketResponse, 'Bucket');
  const configured = await body(bucketResponse);
  if (configured.public !== true || Number(configured.file_size_limit) !== 5_000_000 ||
      ['image/png','image/jpeg','image/webp'].some(mime => !configured.allowed_mime_types?.includes(mime)) || configured.allowed_mime_types.length !== 3) {
    throw new Error('Configuração do bucket não corresponde ao solicitado.');
  }
  results.bucket = true;

  for (const [extension, mime, bytes] of fixtures) {
    const path = `${prefix}sample.${extension}`;
    attempted.push(path);
    const upload = await request(`/storage/v1/object/${bucket}/${path}`, { method:'POST', headers:{ 'Content-Type':mime, 'x-upsert':'false' }, body:bytes });
    requireOk(upload, `${mime} upload`);
    const publicResponse = await request(`/storage/v1/object/public/${bucket}/${path}`, {}, false);
    requireOk(publicResponse, `${mime} URL pública`);
    if (!Buffer.from(await publicResponse.arrayBuffer()).equals(bytes)) throw new Error(`${mime}: arquivo público difere do enviado.`);
    results[extension] = true;
  }

  const visible = await list();
  for (const [extension] of fixtures) if (!visible.some(file => file.name === `sample.${extension}`)) throw new Error(`${extension}: arquivo ausente da listagem do bucket.`);
  results.listed = true;

  const tooLarge = largePng();
  if (tooLarge.length <= 5_000_000) throw new Error('Fixture grande inválida.');
  const largePath = `${prefix}large.png`;
  attempted.push(largePath);
  const largeResponse = await request(`/storage/v1/object/${bucket}/${largePath}`, { method:'POST', headers:{ 'Content-Type':'image/png' }, body:tooLarge });
  const largeError = await body(largeResponse);
  results.largeRejected = !largeResponse.ok && /size|large|limit|exceed|entity/i.test(`${largeError.code || ''} ${largeError.error || ''} ${largeError.message || ''}`);
  if (!results.largeRejected) throw new Error(`Arquivo acima de 5 MB não foi rejeitado por limite (HTTP ${largeResponse.status}).`);

  const textPath = `${prefix}invalid.txt`;
  attempted.push(textPath);
  const textResponse = await request(`/storage/v1/object/${bucket}/${textPath}`, { method:'POST', headers:{ 'Content-Type':'text/plain' }, body:Buffer.from('arquivo de homologacao') });
  const textError = await body(textResponse);
  results.mimeRejected = !textResponse.ok && /mime|type|content/i.test(`${textError.code || ''} ${textError.error || ''} ${textError.message || ''}`);
  if (!results.mimeRejected) throw new Error(`Tipo não permitido não foi rejeitado por MIME (HTTP ${textResponse.status}).`);
} finally {
  if (attempted.length) {
    const deletion = await request(`/storage/v1/object/${bucket}`, {
      method:'DELETE', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ prefixes: attempted })
    });
    requireOk(deletion, 'Remoção das imagens de homologação');
    const remaining = await list();
    results.cleaned = !remaining.some(file => attempted.some(path => path.endsWith(`/${file.name}`)));
    if (!results.cleaned) throw new Error('Restaram imagens de homologação no bucket.');
  }
  console.log(JSON.stringify(results));
}
