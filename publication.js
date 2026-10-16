import fs from 'node:fs';
import path from 'node:path';
import { isApparel, productSizes, sizeStock } from './public/sizes.js';

export function publicationIssues(product, catalog, uploadDir, publicPhotoBase = '') {
  const issues = [];
  if (!String(product.name || '').trim()) issues.push('nome');
  if (!catalog.productCategories?.includes(product.category)) issues.push('categoria');
  if (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0) issues.push('preço');
  if (product.priceConfirmed !== true) issues.push('preço não confirmado');
  const photos = [product.image, ...(Array.isArray(product.photos) ? product.photos : [])].filter(Boolean);
  const uploaded = photos.length > 0 && photos.every(url => {
    const match = /^\/uploads\/([a-f0-9-]+\.(?:png|jpg|webp))$/i.exec(String(url));
    if (match && fs.existsSync(path.join(uploadDir, match[1]))) return true;
    return Boolean(publicPhotoBase && String(url).startsWith(publicPhotoBase) &&
      /^[a-f0-9-]+\.(?:png|jpg|webp)$/i.test(String(url).slice(publicPhotoBase.length)));
  });
  if (!uploaded || !product.image) issues.push('foto real enviada pelo painel');
  const shirt = /^camisas?\b/i.test(String(product.category)) || /\bcamisa\b/i.test(String(product.name));
  if (shirt && !catalog.categories?.some(team => team.id === (product.team_id || product.team) && team.is_active !== false)) issues.push('time / clube ativo');
  if (isApparel(product) && !productSizes(product).length) issues.push('tamanhos');
  if (isApparel(product) && productSizes(product).length && !productSizes(product).some(size => sizeStock(product, size) > 0)) issues.push('estoque por tamanho');
  if (product.customizable && (!Array.isArray(product.personalizationFields) || product.personalizationFields.length === 0)) issues.push('campos de personalização');
  if (!['ready','order'].includes(product.fulfillment)) issues.push('tipo de entrega');
  if (product.fulfillment === 'ready' && (product.stock == null || Number(product.stock) <= 0)) issues.push('estoque disponível');
  return issues;
}

export function normalizedCatalog(catalog, uploadDir, publicPhotoBase = '') {
  return { ...catalog, products: catalog.products.map(product => {
    const requestedStatus = product.available === true ? 'published' : product.status === 'draft' ? 'draft' : 'inactive';
    const status = requestedStatus === 'published' && publicationIssues(product, catalog, uploadDir, publicPhotoBase).length
      ? 'draft' : requestedStatus;
    const sizes = productSizes(product);
    const sizeStock = product.sizeStock
      ? { ...product.sizeStock, ...(Object.hasOwn(product.sizeStock, 'XG') ? { G1: product.sizeStock.G1 ?? product.sizeStock.XG } : {}) } : null;
    if (sizeStock) delete sizeStock.XG;
    return { ...product, sizes, ...(sizeStock ? { sizeStock } : {}), status, available: status === 'published' };
  }) };
}
