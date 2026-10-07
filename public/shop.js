import { withDemoProducts } from './demo-products.js';
const $ = selector => document.querySelector(selector);
const money = value => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const brandLogo = '/assets/logo-wesllen-oficial.png';
const params = new URLSearchParams(location.search);
const page = document.body.dataset.page;
let catalog = { settings: {}, categories: [], products: [] };
let cart = [];
let currentProduct = null;
let selectedSize = '';
let quantity = 1;
let toastTimer;
let shippingQuote = null;
let selectedShipping = null;
let shippingRequest = 0;
let submittingOrder = false;
try { cart = JSON.parse(localStorage.getItem('wesllen-cart') || '[]'); if (!Array.isArray(cart)) cart = []; } catch { cart = []; }

function photo(product, className, photoIndex = 0) {
  const photos = [product.image, ...(product.photos || [])].filter(Boolean);
  if (photos[photoIndex]) return `<div class="${className}"><img class="upload-image" src="${escapeHtml(photos[photoIndex])}" alt="${escapeHtml(product.name)}"></div>`;
  return `<div class="${className} pending-photo"><img class="placeholder-image" src="/assets/foto-pendente.svg" alt="Foto do produto em breve"></div>`;
}
const activePrice = product => Number(product.promoPrice || product.price || 0);
const hasPersonalization = personalization => Object.values(personalization || {}).some(Boolean);
const unitPrice = (product, personalization) => activePrice(product) + (product.customizable && hasPersonalization(personalization) ? Number(product.personalizationPrice || 0) : 0);
const productUrl = product => `/produto?id=${encodeURIComponent(product.id)}`;
const teamName = id => catalog.categories.find(team => team.id === id)?.name || '';
const isPurchasable = product => Boolean(product?.available && !product?.demo) && !(product.fulfillment === 'ready' && product.stock != null && Number(product.stock) <= 0);
const stockLimit = product => product?.fulfillment === 'ready' && product.stock != null ? Number(product.stock) : 99;
const cartCountFor = productId => cart.filter(item=>item.productId===productId).reduce((sum,item)=>sum+Number(item.quantity||0),0);

function chrome() {
  const nav = [['INÍCIO','/'],['CAMISAS','/catalogo?categoria=Camisas'],['PERSONALIZADOS','/catalogo?categoria=Personalizados'],['CANECAS','/catalogo?categoria=Canecas'],['BONÉS','/catalogo?categoria=Bon%C3%A9s'],['PROMOÇÕES','/catalogo?categoria=Promo%C3%A7%C3%B5es']];
  $('#shop-header').innerHTML = `<header class="site-header shop-header"><button class="icon-button mobile-only" id="shop-menu-toggle" aria-label="Abrir menu" aria-expanded="false"><span class="hamburger"></span></button><a class="brand" href="/" aria-label="Wesllen Imports, início"><span class="brand-mark"><img src="${brandLogo}" alt="" class="brand-logo"></span><span class="brand-name">WESLLEN <strong>IMPORTS</strong></span></a><nav class="main-nav" id="shop-main-nav" aria-label="Navegação principal">${nav.map(([label,url])=>`<a href="${url}" ${page==='catalogo' && label==='CAMISAS' ? '' : ''}>${label}</a>`).join('')}</nav><div class="header-actions"><form class="search-box" id="shop-search-form"><label class="sr-only" for="shop-search">Buscar produtos</label><input id="shop-search" type="search" placeholder="Buscar produtos..." autocomplete="off"><button type="submit" aria-label="Buscar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 5 5"/></svg></button></form><button class="icon-button search-mobile mobile-only" id="shop-search-toggle" aria-label="Abrir busca"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 5 5"/></svg></button><a class="icon-button account-link" href="#contato" aria-label="Contato"><svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3.5"/><path d="M4.5 21c0-4 3-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/></svg></a><button class="icon-button cart-trigger" id="shop-cart-open" aria-label="Abrir carrinho"><svg viewBox="0 0 24 24"><path d="M2 3h2l2 12h13l2-9H5"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><span class="cart-count" id="shop-cart-count">0</span></button></div></header>`;
  $('#shop-footer').innerHTML = `<footer class="site-footer shop-footer" id="contato"><div><a class="shop-footer-brand" href="/"><span class="brand-mark"><img src="${brandLogo}" alt="" class="brand-logo"></span><span>WESLLEN <strong>IMPORTS</strong></span></a><p>Paixão pelo Futebol</p></div><nav aria-label="Rodapé"><a href="/catalogo">Produtos</a><a href="/catalogo?categoria=Camisas">Camisas</a><a href="/catalogo?categoria=Personalizados">Personalizados</a><a href="/catalogo?categoria=Canecas">Canecas</a><a href="/catalogo?categoria=Bon%C3%A9s">Bonés</a><a href="/catalogo?categoria=Presentes">Presentes</a><a href="/catalogo?categoria=Importados">Importados</a><a href="/catalogo?categoria=Promo%C3%A7%C3%B5es">Promoções</a></nav><div class="footer-links"><strong>ATENDIMENTO VIA WHATSAPP</strong><a id="shop-whatsapp" target="_blank" rel="noopener">WhatsApp</a><a id="shop-instagram" target="_blank" rel="noopener" hidden>Instagram</a></div><small>© ${new Date().getFullYear()} Wesllen Imports. Pagamento e entrega combinados pelo WhatsApp.</small></footer>`;
  document.body.insertAdjacentHTML('beforeend', '<a class="shop-whatsapp-float" id="shop-whatsapp-float" target="_blank" rel="noopener" aria-label="Fale com a Wesllen Imports" title="Fale com a Wesllen Imports"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20.4 11.5a8.4 8.4 0 0 1-12.6 7.3L3 20.3l1.5-4.7a8.4 8.4 0 1 1 15.9-4.1Z"/><path d="M8.3 8.4c.6 3 2.7 5.2 5.7 6.1l1.8-1.2 1.7 1c-.2 1.4-1.3 2.2-2.8 2.1-3.6-.3-7.8-4.5-8.1-8.1-.1-1.5.7-2.6 2.1-2.8l1.1 1.7-1.2 1.8Z"/></svg><em>Fale com a Wesllen Imports</em></a>');
  $('#shop-menu-toggle').addEventListener('click', () => { const open = $('#shop-main-nav').classList.toggle('open'); $('#shop-menu-toggle').setAttribute('aria-expanded', String(open)); });
  $('#shop-search-toggle').addEventListener('click', () => { $('#shop-search-form').classList.toggle('open'); $('#shop-search').focus(); });
  $('#shop-search-form').addEventListener('submit', event => { event.preventDefault(); const query = $('#shop-search').value.trim(); location.href = query ? `/catalogo?busca=${encodeURIComponent(query)}` : '/catalogo'; });
  $('#shop-cart-open').addEventListener('click', () => { if (page === 'carrinho') window.scrollTo({top:0,behavior:'smooth'}); else location.href='/carrinho'; });
  $('#shop-overlay').addEventListener('click', closeCart);
  updateCartCount();
}

function updateContact() {
  const phone = String(catalog.settings.whatsapp || '').replace(/\D/g, '');
  const name=String(catalog.settings.name);
  document.querySelectorAll('.shop-title-row .shop-eyebrow,.cart-page-heading .shop-eyebrow').forEach(element=>{ element.textContent=name.toUpperCase(); });
  document.title=document.title.replace('Wesllen Imports',name);document.querySelector('.shop-footer>small').textContent=`© ${new Date().getFullYear()} ${name}. Pagamento e entrega combinados pelo WhatsApp.`;
  const words=name.trim().split(/\s+/),last=words.pop(),first=escapeHtml(words.join(' '));document.querySelector('.shop-header .brand-name').innerHTML=`${first} <strong>${escapeHtml(last)}</strong>`;document.querySelector('.shop-footer-brand>span:last-child').innerHTML=`${first} <strong>${escapeHtml(last)}</strong>`;
  document.querySelector('.shop-footer>div>p').textContent=catalog.settings.slogan;
  const footerLinks=document.querySelector('.shop-footer .footer-links');
  if(catalog.settings.address){let address=$('#shop-address');if(!address){address=document.createElement('span');address.id='shop-address';footerLinks.append(address);}address.textContent=catalog.settings.address;}
  document.querySelectorAll('.shop-footer-brand,.shop-header .brand').forEach(link=>link.setAttribute('aria-label',name));
  const whatsapp = $('#shop-whatsapp');
  if (phone) whatsapp.href = `https://wa.me/${phone}`;
  else { whatsapp.removeAttribute('href'); whatsapp.setAttribute('aria-disabled', 'true'); }
  const float = $('#shop-whatsapp-float');
  if (phone) float.href = `https://wa.me/${phone}?text=${encodeURIComponent(catalog.settings.defaultMessage||'')}`;
  else float.hidden = true;
  const instagram = String(catalog.settings.instagram || '').trim();
  const instagramLink=$('#shop-instagram');
  let instagramValid=false;
  try { const url=new URL(instagram);instagramValid=url.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(url.hostname)&&url.pathname.split('/').filter(Boolean).length>0; } catch {}
  instagramLink.hidden=!(catalog.settings.instagramEnabled && instagramValid);
  if(!instagramLink.hidden)instagramLink.href=instagram;else instagramLink.removeAttribute('href');
}

function badge(product) {
  if (product.demo) return 'DEMONSTRAÇÃO';
  if (product.promotion || (product.promoPrice && Number(product.promoPrice) < Number(product.price))) return 'PROMOÇÃO';
  if(product.new)return 'NOVO';
  if(product.bestseller)return 'MAIS VENDIDO';
  const raw = String(product.badge || '').toLowerCase();
  if (raw.includes('novo')) return 'NOVO';
  if (raw.includes('vendido')) return 'MAIS VENDIDO';
  if (raw.includes('personaliz')) return 'PERSONALIZÁVEL';
  return product.customizable ? 'PERSONALIZÁVEL' : '';
}

function productCard(product) {
  const seal = badge(product);
  return `<article class="shop-product-card">${photo(product,'shop-card-photo')}${seal && product.image ? `<span class="shop-badge">${seal}</span>` : ''}<div class="shop-card-info"><p class="shop-card-category">${escapeHtml(product.category)}</p><h3>${escapeHtml(product.name)}</h3><div class="shop-card-price">${product.promoPrice ? `<s>${money(product.price)}</s>` : ''}<strong>${money(activePrice(product))}</strong></div>${product.demo?'<p class="demo-price-note">Preço ilustrativo · sem pedidos</p>':''}<a class="btn btn-gold" href="${productUrl(product)}">VER PRODUTO <span>›</span></a></div></article>`;
}

function priceMatches(product, range) {
  const price = activePrice(product);
  if (!range) return true;
  if (range === '0-50') return price <= 50;
  if (range === '50-100') return price > 50 && price <= 100;
  if (range === '100-200') return price > 100 && price <= 200;
  return price > 200;
}

function renderCatalog() {
  const category = $('#filter-category').value;
  const team = $('#filter-team').value;
  const size = $('#filter-size').value;
  const range = $('#filter-price').value;
  const query = String(params.get('busca') || '').trim().toLocaleLowerCase('pt-BR');
  const shown = catalog.products.filter(product => {
    if (!product.available) return false;
    if (category === 'Promoções' ? !(product.promotion || (product.promoPrice && Number(product.promoPrice) < Number(product.price))) : category && product.category !== category) return false;
    if (team && (product.team_id||product.team) !== team) return false;
    if (size && !(product.sizes || []).includes(size)) return false;
    if (!priceMatches(product, range)) return false;
    return !query || `${product.name} ${product.description} ${product.category} ${teamName(product.team_id||product.team)}`.toLocaleLowerCase('pt-BR').includes(query);
  });
  $('#catalog-results-title').textContent = category || (query ? 'RESULTADOS DA BUSCA' : 'TODOS OS PRODUTOS');
  $('#result-count').textContent = `${shown.length} produto${shown.length === 1 ? '' : 's'} encontrado${shown.length === 1 ? '' : 's'}`;
  $('#catalog-grid').innerHTML = shown.map(productCard).join('');
  $('#catalog-empty').hidden = shown.length > 0;
  $('#catalog-grid').hidden = shown.length === 0;
}

function clearFilters() {
  ['#filter-category','#filter-team','#filter-size','#filter-price'].forEach(selector => { $(selector).value = ''; });
  params.delete('busca');
  history.replaceState(null, '', '/catalogo');
  $('#shop-search').value = '';
  renderCatalog();
}

function initCatalog() {
  $('#filter-category').innerHTML='<option value="">Todas as categorias</option>'+[...(catalog.productCategories||[]),'Promoções'].map(category=>`<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  $('#filter-team').innerHTML += catalog.categories.filter(team=>team.is_active).map(team => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join('');
  const category = params.get('categoria');
  const team = params.get('time');
  if ([...$('#filter-category').options].some(option => option.value === category)) $('#filter-category').value = category;
  if ([...$('#filter-team').options].some(option => option.value === team)) $('#filter-team').value = team;
  $('#shop-search').value = params.get('busca') || '';
  ['#filter-category','#filter-team','#filter-size','#filter-price'].forEach(selector => $(selector).addEventListener('change', renderCatalog));
  $('#clear-filters').addEventListener('click', clearFilters);
  $('#empty-clear').addEventListener('click', clearFilters);
  renderCatalog();
}

function teamTile(team) {
  return `<a class="team-library-card" href="/times/${encodeURIComponent(team.slug)}"><span class="team-library-logo"><img src="${escapeHtml(team.logo_url||'/assets/escudo-pendente.svg')}" alt="" loading="lazy"></span><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml([team.country,team.league].filter(Boolean).join(' · ')||team.category)}</small></a>`;
}
function initTeams() {
  const slug=decodeURIComponent(location.pathname.slice('/times/'.length));
  const sorted=catalog.categories.filter(team=>team.is_active).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order)||a.name.localeCompare(b.name,'pt-BR'));
  if(location.pathname==='/times') {
    document.title=`Times / Clubes | ${catalog.settings.name}`;
    $('#teams-parent-link').hidden=true;
    $('#teams-parent-separator').hidden=true;
    $('#teams-breadcrumb').textContent='Times / Clubes';
    $('#teams-page').innerHTML=`<div class="team-library-heading"><p class="shop-eyebrow">WESLLEN IMPORTS</p><h1>TIMES / CLUBES</h1><p>Escolha um time para ver as camisas disponíveis.</p></div>${['Brasil','Europa','Seleções','Retrô'].map(group=>{const teams=sorted.filter(team=>team.category===group);return teams.length?`<section class="team-library-group"><h2>${escapeHtml(group)}</h2><div class="team-library-grid">${teams.map(teamTile).join('')}</div></section>`:'';}).join('')}`;
    return;
  }
  const team=sorted.find(item=>item.slug===slug);
  if(!team){$('#teams-page').innerHTML='<div class="catalog-empty"><h1>Time não encontrado</h1><a class="btn btn-gold" href="/times">VER TIMES</a></div>';return;}
  const products=catalog.products.filter(product=>product.available&&['Camisas','Personalizados'].includes(product.category)&&(product.team_id||product.team)===team.id);
  document.title=`Camisas do ${team.name} | ${catalog.settings.name}`;
  $('#teams-breadcrumb').textContent=team.name;
  const heading=team.category==='Seleções'?(team.id==='selecoes'?'CAMISAS DE SELEÇÕES':`CAMISAS · ${team.name.toLocaleUpperCase('pt-BR')}`):team.category==='Retrô'?'CAMISAS RETRÔ':`CAMISAS DO ${team.name.toLocaleUpperCase('pt-BR')}`;
  $('#teams-page').innerHTML=`<div class="team-detail-heading"><div class="team-detail-logo"><img src="${escapeHtml(team.logo_url||'/assets/escudo-pendente.svg')}" alt="Escudo de ${escapeHtml(team.name)}"></div><div><p class="shop-eyebrow">${escapeHtml([team.country,team.league].filter(Boolean).join(' · ')||team.category)}</p><h1>${escapeHtml(heading)}</h1><p>${products.length} ${products.length===1?'produto disponível':'produtos disponíveis'}</p></div></div>${products.length?`<div class="catalog-grid">${products.map(productCard).join('')}</div>`:'<div class="catalog-empty"><h2>Nenhuma camisa disponível no momento</h2><p>Este time já está na biblioteca. Os produtos aparecerão aqui quando forem ativados.</p><a class="btn btn-outline" href="/times">VER OUTROS TIMES</a></div>'}`;
}

function customizationFields(product) {
  if (!product.customizable) return '';
  const shirt = product.category === 'Camisas' || product.category === 'Personalizados';
  const fields=product.personalizationFields|| (shirt?['name','number']:['name','phrase','note']);
  const inputs={name:`<label>${shirt?'Nome na camisa':'Nome'}<input id="custom-name" maxlength="30" autocomplete="off" placeholder="${shirt?'WESLEY':'Nome'}"></label>`,number:'<label>Número<input id="custom-number" maxlength="3" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="10"></label>',phrase:'<label>Frase<input id="custom-phrase" maxlength="100" autocomplete="off" placeholder="Sua frase"></label>',note:'<label>Observação<textarea id="custom-note" maxlength="150" rows="2" placeholder="Detalhes da personalização"></textarea></label>'};
  return `<div class="shop-customize"><h2>PERSONALIZAÇÃO OPCIONAL</h2><div class="shop-custom-fields ${shirt?'':'shop-custom-fields-other'}">${fields.map(field=>inputs[field]||'').join('')}</div>${shirt&&fields.includes('name')&&fields.includes('number')?'<p class="shop-example">Exemplo: <strong>WESLEY · 10</strong></p>':''}</div>`;
}

function renderProduct() {
  const product = catalog.products.find(item => item.id === params.get('id'));
  if (!product || !product.available) { $('#product-page').innerHTML = '<div class="catalog-empty product-missing"><h1>Produto não encontrado</h1><p>Veja os produtos disponíveis no catálogo.</p><a class="btn btn-gold" href="/catalogo">VER CATÁLOGO</a></div>'; return; }
  currentProduct = product;
  document.title = `${product.name} | Wesllen Imports`;
  $('#breadcrumb-product').textContent = product.name;
  const photos = [product.image, ...(product.photos || [])].filter(Boolean);
  const imageCount = Math.max(1, photos.length);
  $('#product-page').innerHTML = `<article class="shop-product-layout"><section class="shop-gallery" aria-label="Galeria de imagens"><div id="shop-main-photo">${photo(product,'shop-large-photo')}</div><div class="shop-thumbnails">${Array.from({length:imageCount},(_,index)=>`<button class="shop-thumbnail ${index===0?'selected':''}" type="button" data-photo="${index}" aria-label="Ver foto ${index+1}" aria-pressed="${index===0}">${photo(product,'shop-thumbnail-photo',index)}</button>`).join('')}</div></section><section class="shop-product-info"><p class="shop-eyebrow">${escapeHtml(product.category)}${product.team ? ` · ${escapeHtml(teamName(product.team))}` : ''}</p>${badge(product) && (product.image || product.promoPrice) ? `<span class="shop-product-badge">${badge(product)}</span>` : ''}<h1>${escapeHtml(product.name)}</h1><div class="shop-detail-prices">${product.promoPrice ? `<s>${money(product.price)}</s>` : ''}<strong>${money(activePrice(product))}</strong></div><p class="shop-description">${escapeHtml(product.description)}</p><p class="shop-stock ${product.available ? 'in-stock' : 'out-of-stock'}"><span></span>${product.available ? 'Disponível' : 'Indisponível no momento'}</p>${product.sizes?.length ? `<div class="shop-sizes"><h2>Tamanho <small id="selected-size-label">Selecione</small></h2><div role="group" aria-label="Selecione o tamanho">${product.sizes.filter(size=>['P','M','G','GG','XG'].includes(size)).map(size=>`<button type="button" class="shop-size" data-size="${escapeHtml(size)}" aria-pressed="false">${escapeHtml(size)}</button>`).join('')}</div></div>` : ''}${customizationFields(product)}<div class="shop-quantity-row"><div><span>Quantidade</span><div class="shop-quantity"><button type="button" id="qty-minus" aria-label="Diminuir quantidade">−</button><output id="qty-value">1</output><button type="button" id="qty-plus" aria-label="Aumentar quantidade">+</button></div></div><div class="shop-item-total"><span>Total do item</span><strong id="item-total">${money(activePrice(product))}</strong></div></div><div id="price-breakdown" class="shop-price-breakdown"></div><p id="product-error" class="shop-error" role="alert" hidden></p><button type="button" class="btn btn-gold shop-add" id="add-to-cart" ${product.available ? '' : 'disabled'}>ADICIONAR AO CARRINHO <span>›</span></button><p class="shop-product-note">O produto será adicionado ao carrinho para revisar seu pedido.</p></section></article>`;
  if(!product.image)$('#product-page .shop-product-badge')?.remove();
  const stock=$('.shop-stock');stock.classList.toggle('in-stock',isPurchasable(product));stock.classList.toggle('out-of-stock',!isPurchasable(product));stock.innerHTML=`<span></span>${!isPurchasable(product)?'Indisponível no momento':product.fulfillment==='order'?'POR ENCOMENDA':product.stock!=null?`PRONTA ENTREGA · ${product.stock} disponíveis`:'Disponível'}`;
  $('#add-to-cart').disabled=!isPurchasable(product);
  if (product.demo) {
    stock.innerHTML = '<span></span>EXEMPLO DE VITRINE';
    $('#add-to-cart').textContent = 'EXEMPLO · NÃO DISPONÍVEL PARA PEDIDOS';
    $('#product-page .shop-product-note').textContent = 'Foto e preço ilustrativos. Wesley poderá substituir este exemplo por um produto real no painel.';
  }
  $('#product-page').addEventListener('input', updateProductTotal);
  updateProductTotal();
}

function personalization() {
  return { name: $('#custom-name')?.value.trim() || '', number: $('#custom-number')?.value.trim() || '', phrase: $('#custom-phrase')?.value.trim() || '', note: $('#custom-note')?.value.trim() || '' };
}
function updateProductTotal() {
  if (!currentProduct) return;
  const extra = currentProduct.customizable && hasPersonalization(personalization()) ? Number(currentProduct.personalizationPrice || 0) : 0;
  $('#item-total').textContent = money((activePrice(currentProduct) + extra) * quantity);
  $('#price-breakdown').innerHTML = `<span>Produto ${money(activePrice(currentProduct))}</span>${extra ? `<span>Personalização + ${money(extra)}</span>` : ''}<span>Quantidade × ${quantity}</span>`;
  $('#qty-value').textContent = quantity;
}
function addToCart() {
  if (!isPurchasable(currentProduct)) return;
  const error = $('#product-error'); error.hidden = true;
  if(cartCountFor(currentProduct.id)+quantity>stockLimit(currentProduct)){error.textContent='Quantidade acima do estoque disponível.';error.hidden=false;return;}
  if (currentProduct.sizes?.length && !selectedSize) { error.textContent = 'Selecione um tamanho antes de adicionar ao carrinho.'; error.hidden = false; return; }
  const custom = personalization();
  if (custom.number && !/^\d{1,3}$/.test(custom.number)) { error.textContent = 'O número deve conter até três dígitos.'; error.hidden = false; return; }
  const key = JSON.stringify([currentProduct.id, selectedSize, custom]);
  const existing = cart.find(item => item.key === key);
  if (existing) existing.quantity = Math.min(99, existing.quantity + quantity);
  else cart.push({ key, productId: currentProduct.id, size: selectedSize, personalization: custom, quantity });
  saveCart();
  toast('Produto adicionado ao carrinho.');
  openCart();
}

function saveCart() { localStorage.setItem('wesllen-cart', JSON.stringify(cart)); updateCartCount(); renderCart(); if (page === 'carrinho') { const recalculate=Boolean(shippingQuote); invalidateShipping('O carrinho mudou. Calcule o frete novamente.'); renderCartPage(); if(recalculate) calculateCartShipping(); } }
function updateCartCount() { $('#shop-cart-count').textContent = cart.reduce((sum,item) => sum + Number(item.quantity || 0), 0); }
function toast(message) { const el = $('#shop-toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3000); }
function renderCart() {
  const before=cart.length;cart = cart.filter(item => catalog.products.some(product => product.id === item.productId && isPurchasable(product)));if(cart.length!==before)localStorage.setItem('wesllen-cart',JSON.stringify(cart));
  const total = cart.reduce((sum,item) => { const product = catalog.products.find(p => p.id === item.productId); return sum + unitPrice(product,item.personalization) * item.quantity; }, 0);
  $('#shop-cart').innerHTML = `<div class="shop-cart-head"><h2 id="shop-cart-title">Meu Carrinho</h2><button type="button" id="shop-cart-close" aria-label="Fechar carrinho">×</button></div><div class="shop-cart-items">${cart.length ? cart.map((item,index) => { const product = catalog.products.find(p => p.id === item.productId); return `<div class="shop-cart-item">${photo(product,'shop-cart-photo')}<div><a href="${productUrl(product)}">${escapeHtml(product.name)}</a>${item.size ? `<small>Tamanho: ${escapeHtml(item.size)}</small>` : ''}${hasPersonalization(item.personalization) ? `<small>Personalização: ${escapeHtml([item.personalization.name,item.personalization.number,item.personalization.phrase].filter(Boolean).join(' '))}</small>` : ''}<strong>${money(unitPrice(product,item.personalization) * item.quantity)}</strong><div class="shop-cart-qty"><button type="button" data-cart-qty="-1" data-index="${index}" aria-label="Diminuir quantidade">−</button><span>${item.quantity}</span><button type="button" data-cart-qty="1" data-index="${index}" aria-label="Aumentar quantidade">+</button></div></div><button type="button" class="shop-remove" data-remove="${index}" aria-label="Remover ${escapeHtml(product.name)}">×</button></div>`; }).join('') : '<div class="shop-cart-empty">Seu carrinho está vazio.</div>'}</div><div class="shop-cart-bottom"><div><span>Total dos produtos</span><strong>${money(total)}</strong></div>${cart.length ? '<a class="btn btn-gold" href="/carrinho">VER CARRINHO <span>›</span></a>' : '<a class="btn btn-outline" href="/catalogo">VER PRODUTOS</a>'}</div>`;
  $('#shop-cart-close').addEventListener('click', closeCart);
  updateCartCount();
}
function openCart() { renderCart(); $('#shop-overlay').hidden = false; $('#shop-cart').hidden = false; document.body.style.overflow = 'hidden'; }
function closeCart() { $('#shop-overlay').hidden = true; $('#shop-cart').hidden = true; document.body.style.overflow = ''; }

function renderCartPage() {
  const available = catalog.products.filter(product => isPurchasable(product));
  const before=cart.length;cart = cart.filter(item => available.some(product => product.id === item.productId));if(cart.length!==before)localStorage.setItem('wesllen-cart',JSON.stringify(cart));
  const count = cart.reduce((sum,item) => sum + item.quantity, 0);
  const total = cart.reduce((sum,item) => { const product = available.find(p => p.id === item.productId); return sum + unitPrice(product,item.personalization) * item.quantity; }, 0);
  $('#cart-line-count').textContent = `${count} ${count === 1 ? 'item' : 'itens'}`;
  $('#cart-page-total').textContent = money(total);
  $('#cart-submit').disabled = cart.length === 0 || submittingOrder || (catalog.settings?.shippingEnabled === true && !selectedShipping);
  $('#cart-page-items').innerHTML = cart.length ? cart.map((item,index) => {
    const product = available.find(p => p.id === item.productId);
    const custom = [item.personalization?.name,item.personalization?.number,item.personalization?.phrase].filter(Boolean).join(' ');
    return `<article class="cart-page-item"><a class="cart-page-image" href="${productUrl(product)}" aria-label="Ver ${escapeHtml(product.name)}">${photo(product,'cart-page-photo')}</a><div class="cart-page-details"><h3><a href="${productUrl(product)}">${escapeHtml(product.name)}</a></h3>${item.size ? `<p><strong>Tamanho:</strong> ${escapeHtml(item.size)}</p>` : ''}${product.model ? `<p><strong>Modelo:</strong> ${escapeHtml(product.model)}</p>` : ''}${custom ? `<p><strong>Personalização:</strong> ${escapeHtml(custom)}</p>` : ''}${item.personalization?.note ? `<p><strong>Observação do produto:</strong> ${escapeHtml(item.personalization.note)}</p>` : ''}<div class="cart-page-qty"><button type="button" data-page-qty="-1" data-index="${index}" aria-label="Diminuir quantidade de ${escapeHtml(product.name)}">−</button><span aria-label="Quantidade ${item.quantity}">${item.quantity}</span><button type="button" data-page-qty="1" data-index="${index}" aria-label="Aumentar quantidade de ${escapeHtml(product.name)}">+</button></div></div><div class="cart-page-prices"><div><span>Preço unitário</span><strong>${money(unitPrice(product,item.personalization))}</strong></div><div><span>Subtotal</span><strong>${money(unitPrice(product,item.personalization) * item.quantity)}</strong></div></div><button type="button" class="cart-page-remove" data-page-remove="${index}" aria-label="Remover ${escapeHtml(product.name)}">Remover</button></article>`;
  }).join('') : '<div class="cart-page-empty"><h3>Seu carrinho está vazio</h3><p>Escolha seus produtos no catálogo para começar.</p></div>';
  updateCartCount();
  renderShippingTotal(total);
}

function cartSignature() { return JSON.stringify(cart.map(item=>({productId:item.productId,size:item.size,personalization:item.personalization,quantity:item.quantity}))); }
function invalidateShipping(message) {
  shippingRequest++;
  shippingQuote=null;selectedShipping=null;
  if(page!=='carrinho'||catalog.settings?.shippingEnabled!==true)return;
  $('#cart-shipping-options').innerHTML='';
  $('#cart-shipping-status').textContent=message;
  $('#cart-shipping-status').classList.remove('error');
  $('#cart-shipping-calculate').disabled=false;
  $('#cart-shipping-calculate').textContent='CALCULAR FRETE';
  renderShippingTotal();
  $('#cart-submit').disabled=true;
}
function renderShippingTotal(productsTotal) {
  if(page!=='carrinho'||catalog.settings?.shippingEnabled!==true)return;
  const total=productsTotal??cart.reduce((sum,item)=>{const product=catalog.products.find(p=>p.id===item.productId);return product?sum+unitPrice(product,item.personalization)*item.quantity:sum;},0);
  $('#cart-shipping-summary').hidden=!selectedShipping;
  $('#cart-shipping-price').textContent=selectedShipping?money(selectedShipping.priceCents/100):'—';
  $('#cart-grand-total').textContent=selectedShipping?money(Math.round(total*100+selectedShipping.priceCents)/100):'—';
}
async function calculateCartShipping() {
  if(catalog.settings?.shippingEnabled!==true)return;
  const postalCode=$('#cart-postal-code').value.replace(/\D/g,'');
  invalidateShipping('Consultando opções de entrega...');
  const request=shippingRequest,signature=cartSignature();
  const status=$('#cart-shipping-status'),button=$('#cart-shipping-calculate');
  if(!/^\d{8}$/.test(postalCode)){status.textContent='Informe um CEP válido com 8 números.';status.classList.add('error');return;}
  if(!cart.length){status.textContent='Adicione um produto antes de calcular o frete.';status.classList.add('error');return;}
  button.disabled=true;button.textContent='CALCULANDO...';
  try {
    const response=await fetch('/api/shipping/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({postalCode,items:cart})});
    const result=await response.json();
    if(request!==shippingRequest||signature!==cartSignature()||postalCode!==$('#cart-postal-code').value.replace(/\D/g,''))return;
    if(!response.ok)throw new Error(result.error||'Não foi possível calcular o frete.');
    shippingQuote={...result,signature};
    $('#cart-shipping-options').innerHTML=result.options.map(option=>`<label class="cart-shipping-option"><input type="radio" name="shipping-option" value="${escapeHtml(option.id)}"><span>${escapeHtml([option.company,option.name].filter(Boolean).join(' · '))}<small>Prazo estimado: ${Number(option.deliveryDays)} dia(s) útil(eis)</small></span><strong>${money(option.priceCents/100)}</strong></label>`).join('');
    status.textContent='Escolha uma opção de entrega para continuar.';
  } catch(error) {if(request===shippingRequest){status.textContent=error.message;status.classList.add('error');}}
  finally {if(request===shippingRequest){button.disabled=false;button.textContent='CALCULAR FRETE';}}
}

async function submitCart(event) {
  event.preventDefault();
  const error = $('#cart-submit-error'); error.hidden = true;
  if (!cart.length) { error.textContent = 'Adicione um produto ao carrinho.'; error.hidden = false; return; }
  const customer = { name:$('#cart-customer-name').value.trim(), city:$('#cart-customer-city').value.trim(), note:$('#cart-customer-note').value.trim() };
  if (!customer.name || !customer.city) { error.textContent = 'Informe seu nome e sua cidade.'; error.hidden = false; return; }
  if(catalog.settings?.shippingEnabled===true){
    customer.postalCode=$('#cart-postal-code').value.replace(/\D/g,'');customer.address=$('#cart-customer-address').value.trim();customer.state=$('#cart-customer-state').value.trim().toUpperCase();
    if(!shippingQuote||!selectedShipping||shippingQuote.signature!==cartSignature()||shippingQuote.postalCode!==customer.postalCode){error.textContent='Calcule e escolha o frete antes de finalizar.';error.hidden=false;return;}
    if(!customer.address||!customer.city||!/^[A-Z]{2}$/.test(customer.state)){error.textContent='Informe endereço, cidade e UF da entrega.';error.hidden=false;return;}
  }
  const button = $('#cart-submit');
  const popup = window.open('about:blank','_blank');
  submittingOrder=true;button.disabled = true; button.textContent = 'PREPARANDO PEDIDO...';
  try {
    const response = await fetch('/api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer,items:cart,shipping:selectedShipping})});
    const payload = await response.json();
    if (!response.ok) { if(response.status===409&&catalog.settings?.shippingEnabled===true)invalidateShipping('O frete mudou. Calcule novamente antes de finalizar.');throw new Error(payload.error || 'Não foi possível preparar o pedido.'); }
    if (popup) popup.location.href = payload.url; else location.href = payload.url;
  } catch (failure) {
    if (popup) popup.close();
    error.textContent = failure.message; error.hidden = false;
  } finally {
    submittingOrder=false;button.disabled = !cart.length || (catalog.settings?.shippingEnabled===true&&!selectedShipping); button.innerHTML = 'FINALIZAR PEDIDO NO WHATSAPP <span>↗</span>';
  }
}

function initCartPage() {
  renderCartPage();
  if(catalog.settings?.shippingEnabled===true){
    $('#cart-shipping-section').hidden=false;
    $('#cart-postal-code').required=true;$('#cart-customer-address').required=true;$('#cart-customer-state').required=true;
    $('#cart-shipping-calculate').addEventListener('click',calculateCartShipping);
    $('#cart-postal-code').addEventListener('input',()=>invalidateShipping('CEP alterado. Calcule o frete novamente.'));
    $('#cart-shipping-options').addEventListener('change',event=>{const option=shippingQuote?.options.find(entry=>entry.id===event.target.value);selectedShipping=option||null;renderShippingTotal();$('#cart-submit').disabled=!selectedShipping;});
  }
  $('#cart-checkout-form').addEventListener('submit',submitCart);
}

document.addEventListener('click', event => {
  const size = event.target.closest('[data-size]');
  if (size) { selectedSize = size.dataset.size; document.querySelectorAll('.shop-size').forEach(button => { const active = button === size; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); }); $('#selected-size-label').textContent = selectedSize; $('#product-error').hidden = true; return; }
  const thumb = event.target.closest('[data-photo]');
  if (thumb && currentProduct) { const index = Number(thumb.dataset.photo); $('#shop-main-photo').innerHTML = photo(currentProduct,'shop-large-photo',index); document.querySelectorAll('.shop-thumbnail').forEach(button => { const active = button === thumb; button.classList.toggle('selected',active); button.setAttribute('aria-pressed',String(active)); }); return; }
  if (event.target.closest('#qty-minus')) { quantity = Math.max(1, quantity - 1); updateProductTotal(); return; }
  if (event.target.closest('#qty-plus')) { quantity = Math.min(99, stockLimit(currentProduct), quantity + 1); updateProductTotal(); return; }
  if (event.target.closest('#add-to-cart')) { addToCart(); return; }
  const cartQty = event.target.closest('[data-cart-qty]');
  if (cartQty) { const index = Number(cartQty.dataset.index); if (cart[index]) { const delta=Number(cartQty.dataset.cartQty),product=catalog.products.find(p=>p.id===cart[index].productId);if(delta>0&&cartCountFor(product.id)>=stockLimit(product)){toast('Estoque disponível atingido.');return;}cart[index].quantity += delta; if (cart[index].quantity < 1) cart.splice(index,1); saveCart(); } return; }
  const remove = event.target.closest('[data-remove]');
  if (remove) { cart.splice(Number(remove.dataset.remove),1); saveCart(); return; }
  const pageQty = event.target.closest('[data-page-qty]');
  if (pageQty) { const index = Number(pageQty.dataset.index); if (cart[index]) { const delta=Number(pageQty.dataset.pageQty),product=catalog.products.find(p=>p.id===cart[index].productId);if(delta>0&&cartCountFor(product.id)>=stockLimit(product)){toast('Estoque disponível atingido.');return;}cart[index].quantity = Math.max(0,Math.min(99,cart[index].quantity + delta)); if (cart[index].quantity === 0) cart.splice(index,1); saveCart(); } return; }
  const pageRemove = event.target.closest('[data-page-remove]');
  if (pageRemove) { cart.splice(Number(pageRemove.dataset.pageRemove),1); saveCart(); }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeCart(); });

async function init() {
  chrome();
  try {
    const response = await fetch('/api/catalog');
    if (!response.ok) throw new Error('Falha no catálogo');
    catalog = withDemoProducts(await response.json());
    updateContact();
    if (page === 'catalogo') initCatalog(); else if (page === 'carrinho') initCartPage(); else if(page==='times') initTeams(); else renderProduct();
    if (location.hash === '#carrinho') openCart();
  } catch {
    const target = page === 'catalogo' ? '#catalog-grid' : page==='times' ? '#teams-page' : page==='carrinho' ? '#cart-page-items' : '#product-page';
    $(target).innerHTML = '<div class="catalog-empty"><h2>Não foi possível carregar os produtos</h2><p>Atualize a página para tentar novamente.</p></div>';
  }
}
init();
