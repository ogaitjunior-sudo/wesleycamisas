import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { demoProducts, withDemoProducts } from '../public/demo-products.js';

test('vitrine demonstrativa preserva produtos reais e pode ser desligada no painel', () => {
  const real = { id: 'produto-real', name: 'Produto real' };
  const catalog = { settings: {}, products: [real] };
  const preview = withDemoProducts(catalog);
  assert.equal(preview.products[0], real);
  assert.equal(preview.products.length, demoProducts.length + 1);
  assert.equal(catalog.products.length, 1);
  assert.deepEqual(withDemoProducts({ ...catalog, settings: { demoShowcaseEnabled: false } }).products, [real]);
  assert.equal(withDemoProducts({ ...catalog, settings: { demoHiddenIds: ['demo-bone-preto'] } }).products.some(product => product.id === 'demo-bone-preto'), false);
  assert.equal(new Set(demoProducts.map(product => product.id)).size, demoProducts.length);
  for (const product of demoProducts) {
    assert.equal(product.demo, true);
    assert.equal(product.badge, 'DEMONSTRAÇÃO');
    assert.ok(fs.statSync(path.join('public', product.image.slice(1))).size > 0);
  }
});
