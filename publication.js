import fs from 'node:fs';
import path from 'node:path';

export function publicationIssues(product, catalog, uploadDir, publicPhotoBase = '') {
  const issues = [];
  if (!String(product.name || '').trim()) issues.push('nome');
  if (!catalog.productCategories?.includes(product.category)) issues.push('categoria');
  if (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0) issues.push('preço');
  if (product.priceConfirmed !== true) issues.push('preço não confirmado');
  const photos = [product.image, ...(Array.isArray(product.photos) ? product.photos : [])].filter(Boolean);
  const uploaded = photos.some(url => {
    const match = /^\/uploads\/([a-f0-9-]+\.(?:png|jpg|webp))$/i.exec(String(url));
    if (match && fs.existsSync(path.join(uploadDir, match[1]))) return true;
    return Boolean(publicPhotoBase && String(url).startsWith(publicPhotoBase) &&
      /^[a-f0-9-]+\.(?:png|jpg|webp)$/i.test(String(url).slice(publicPhotoBase.length)));
  });
  if (!uploaded) issues.push('foto real enviada pelo painel');
  const shirt = product.category === 'Camisas' || /\bcamisa\b/i.test(String(product.name));
  if (shirt && !catalog.categories?.some(team => team.id === (product.team_id || product.team))) issues.push('time / clube');
  if (shirt && (!Array.isArray(product.sizes) || !product.sizes.some(size => ['P','M','G','GG','XG'].includes(size)))) issues.push('tamanhos');
  if (product.customizable && (!Array.isArray(product.personalizationFields) || product.personalizationFields.length === 0)) issues.push('campos de personalização');
  if (!['ready','order'].includes(product.fulfillment)) issues.push('tipo de entrega');
  if (product.fulfillment === 'ready' && (product.stock == null || Number(product.stock) <= 0)) issues.push('estoque disponível');
  return issues;
}

export function normalizedCatalog(catalog, uploadDir, publicPhotoBase = '') {
  return { ...catalog, products: catalog.products.map(product => ({
    ...product,
    available: product.available === true && publicationIssues(product, catalog, uploadDir, publicPhotoBase).length === 0
  })) };
}
