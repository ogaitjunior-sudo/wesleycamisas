import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Vercel envia rotas à função Node e inclui os recursos públicos', () => {
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  assert.equal(config.functions['api/index.js'].includeFiles, 'public/**');
  assert.deepEqual(config.rewrites, [{ source: '/(.*)', destination: '/api/index.js' }]);
  assert.ok(fs.existsSync('api/index.js'));
});
