import { homeTeams } from './home-teams.js';
import { withDemoProducts } from './demo-products.js';
const $ = selector => document.querySelector(selector);
const money = value => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let catalog = { settings:{}, categories:[], products:[] };
let cart = [];
let filter = { category:'', team:'', promo:false, query:'', all:false };
let activeProduct = null;
let currentPhoto = 0;
let toastTimer;
try { cart = JSON.parse(localStorage.getItem('wesllen-cart') || '[]'); if (!Array.isArray(cart)) cart=[]; } catch { cart=[]; }

function art(product, className='product-visual', photoIndex=0) {
  const photos = [product.image, ...(product.photos || [])].filter(Boolean);
  if (photos[photoIndex]) return `<div class="${className}"><img class="upload-image" src="${escapeHtml(photos[photoIndex])}" alt="${escapeHtml(product.name)}"></div>`;
  return `<div class="${className} pending-photo"><img class="placeholder-image" src="/assets/foto-pendente.svg" alt="Foto do produto em breve"></div>`;
}
function activePrice(product) { return Number(product.promoPrice || product.price || 0); }
function hasPersonalization(item) { return Object.values(item.personalization || {}).some(Boolean); }
function unitPrice(product, item) { return activePrice(product) + (product.customizable && hasPersonalization(item) ? Number(product.personalizationPrice || 0) : 0); }
function saveCart() { localStorage.setItem('wesllen-cart', JSON.stringify(cart)); renderCart(); }
function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('visible'),3200); }
function currentProducts() {
  return catalog.products.filter(product => product.available && (!filter.category || product.category===filter.category) && (!filter.team || product.team===filter.team || (filter.team==='brasileirao' && ['flamengo','palmeiras','corinthians','bahia','vitoria'].includes(product.team))) && (!filter.promo || product.promotion || product.promoPrice) && (!filter.query || `${product.name} ${product.description} ${product.category} ${product.team}`.toLowerCase().includes(filter.query)));
}
function renderTeams() {
  const teams=homeTeams(catalog.categories);
  $('#team-list').innerHTML = teams.length ? teams.map(team => `<a class="team-card" href="/times/${encodeURIComponent(team.slug)}"><span class="team-emblem"><img src="${escapeHtml(team.logo_url||'/assets/escudo-pendente.svg')}" alt="" loading="lazy"></span><strong>${escapeHtml(team.name)}</strong></a>`).join('') : '<p class="teams-empty">Os times escolhidos para destaque aparecerão aqui.</p>';
}
function card(product) {
  return `<article class="product-card">${art(product)}${product.badge && product.image ? `<span class="badge">${escapeHtml(product.badge)}</span>` : ''}<div class="product-info"><h3 title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</h3><p class="product-price">${product.promoPrice ? `<span class="old-price">${money(product.price)}</span>` : ''}${money(activePrice(product))}</p>${product.demo?'<p class="demo-price-note">Preço ilustrativo · sem pedidos</p>':''}<button class="btn btn-gold" data-product="${escapeHtml(product.id)}">VER PRODUTO</button></div></article>`;
}
function renderProducts() {
  const products = currentProducts();
  const featured = !filter.category && !filter.team && !filter.promo && !filter.query && !filter.all;
  const shown = featured ? products.filter(p=>p.featured).slice(0,4) : products;
  const title = filter.query ? 'RESULTADOS DA BUSCA' : filter.team ? 'CAMISAS DO SEU TIME' : filter.promo ? 'PROMOÇÕES' : filter.category ? filter.category.toUpperCase() : filter.all ? 'TODOS OS PRODUTOS' : 'MAIS VENDIDAS';
  $('#products-title').textContent=title;
  $('#showcase-grid').innerHTML=shown.map(card).join('');
  $('#empty-state').hidden=shown.length>0;
  $('#showcase-grid').hidden=shown.length===0;
  $('#filter-status').hidden=!filter.category&&!filter.team&&!filter.promo&&!filter.query;
  if (!$('#filter-status').hidden) $('#filter-status').innerHTML=`${shown.length} produto${shown.length===1?'':'s'} encontrado${shown.length===1?'':'s'} <button id="reset-filter">Limpar filtro</button>`;
  renderTeams();
}
function renderCategories() {
  const categoryCards=[['Canecas','Personalizadas','caneca-preta'],['Bonés','Estilosos','bone-wesllen'],['Presentes','Personalizados','chaveiro-futebol'],['Produtos','Importados','kit-importados']];
  $('#category-grid').innerHTML=categoryCards.map(([title,subtitle,id])=>{const product=catalog.products.find(p=>p.id===id && p.available);if(!product)return '';return `<button class="category-card" data-category="${escapeHtml(product.category)}" aria-label="${title} ${subtitle}"><div class="category-art">${art(product,'category-art-image')}</div><strong>${title.toUpperCase()}</strong><small>${subtitle}</small></button>`;}).join('');
  $('#categorias').hidden=!$('#category-grid').children.length;
}
function updateHeader() {
  const settings=catalog.settings;
  const shopName=settings.name,words=shopName.trim().split(/\s+/),last=words.pop();document.querySelector('.brand').setAttribute('aria-label',`${shopName}, início`);document.querySelector('.footer-identity').setAttribute('aria-label',`${shopName}, voltar ao início`);document.querySelector('.brand-name').innerHTML=`${escapeHtml(words.join(' '))} <strong>${escapeHtml(last)}</strong>`;document.querySelector('.footer-brand').innerHTML=`${escapeHtml(words.join(' '))} <span>${escapeHtml(last)}</span>`;document.querySelector('.site-footer>div>p').textContent=settings.slogan;
  document.title=`${shopName} | Camisas e Personalizados`;document.querySelector('.site-footer>small').innerHTML=`© <span id="year"></span> ${escapeHtml(shopName)}. Pagamento e entrega combinados pelo WhatsApp.`;
  const footerLinks=document.querySelector('.site-footer .footer-links');let address=$('#footer-address');if(settings.address){if(!address){address=document.createElement('span');address.id='footer-address';footerLinks.append(address);}address.textContent=settings.address;}else if(address)address.remove();
  const phone=String(settings.whatsapp||'').replace(/\D/g,'');
  if(phone) $('#footer-whatsapp').href=`https://wa.me/${phone}`;
  else $('#footer-whatsapp').removeAttribute('href');
  const insta=String(settings.instagram||'').trim();
  const instagramLink=$('#footer-instagram');
  let instagramValid=false;
  try { const url=new URL(insta);instagramValid=url.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(url.hostname)&&url.pathname.split('/').filter(Boolean).length>0; } catch {}
  instagramLink.hidden=!(settings.instagramEnabled && instagramValid);
  if(!instagramLink.hidden) instagramLink.href=insta;else instagramLink.removeAttribute('href');
  $('#year').textContent=new Date().getFullYear();
}
function setFilter(next) {
  filter={...filter,...next};
  if (next.query === '') $('#search-input').value='';
  if (next.category || next.team || next.promo || next.query) filter.all=true;
  renderProducts();
  $('#camisas').scrollIntoView({behavior:'smooth',block:'start'});
  $('#main-nav').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');
}
function resetFilter(scroll=true){filter={category:'',team:'',promo:false,query:'',all:false};$('#search-input').value='';renderProducts();if(scroll)$('#camisas').scrollIntoView({behavior:'smooth'});}
function openLayer(which){$('#overlay').hidden=false;$('#product-modal').hidden=which!=='product';$('#cart-drawer').hidden=which!=='cart';document.body.style.overflow='hidden';}
function closeLayers(){['#overlay','#product-modal','#cart-drawer'].forEach(selector=>$(selector).hidden=true);document.body.style.overflow='';}
function openProduct(id) {
  const product=catalog.products.find(p=>p.id===id);if(!product)return;
  activeProduct=product;currentPhoto=0;
  const photos=[product.image,...(product.photos||[])].filter(Boolean);
  $('#product-content').innerHTML=`<div class="product-layout"><div class="product-gallery"><div id="main-product-art">${art(product,'main-photo')}</div>${photos.length>1?`<div class="thumbnails">${photos.map((photo,index)=>`<button class="thumbnail ${index===0?'active':''}" data-photo="${index}" aria-label="Ver foto ${index+1}"><img src="${escapeHtml(photo)}" alt=""></button>`).join('')}</div>`:''}</div><div class="product-detail"><span class="kicker">${escapeHtml(product.category)} ${product.team?'• '+escapeHtml(catalog.categories.find(c=>c.id===product.team)?.name||''):''}</span><h2 id="product-name">${escapeHtml(product.name)}</h2><p class="detail-price">${product.promoPrice?`<span class="old-price">${money(product.price)}</span>`:''}${money(activePrice(product))}</p><p class="detail-description">${escapeHtml(product.description)}</p>${product.sizes?.length?`<div class="field-title">Tamanho</div><div class="sizes">${product.sizes.map(size=>`<button class="size-button" data-size="${escapeHtml(size)}" aria-pressed="false">${escapeHtml(size)}</button>`).join('')}</div>`:''}${product.customizable? product.category==='Canecas'?`<div class="field-title">PERSONALIZAÇÃO (OPCIONAL)</div><div class="personalize-fields"><label>Nome<input id="custom-name" maxlength="30" placeholder="Nome"></label><label>Frase<input id="custom-phrase" maxlength="100" placeholder="Frase"></label></div><label class="single-field">Observação<input id="custom-note" maxlength="150" placeholder="Detalhes do pedido"></label>`:`<div class="field-title">PERSONALIZAÇÃO (OPCIONAL)</div><div class="personalize-fields"><label>Nome na camisa<input id="custom-name" maxlength="30" placeholder="Seu nome"></label><label>Número<input id="custom-number" maxlength="3" inputmode="numeric" pattern="[0-9]*" placeholder="10"></label></div>`:''}${product.customizable && product.personalizationPrice?`<div class="price-extra">+ ${money(product.personalizationPrice)} pela personalização</div>`:''}<p class="detail-error" id="detail-error" role="alert" hidden></p><button class="btn btn-gold" id="add-to-cart">🛒 ADICIONAR AO CARRINHO</button></div></div>`;
  if (product.demo) {
    $('#add-to-cart').disabled = true;
    $('#add-to-cart').textContent = 'EXEMPLO · NÃO DISPONÍVEL PARA PEDIDOS';
    const note = document.createElement('p');
    note.className = 'demo-detail-note';
    note.textContent = 'Foto e preço ilustrativos. O produto real será cadastrado pelo administrador.';
    $('#add-to-cart').before(note);
  }
  openLayer('product');
}
function addToCart(){
  if(!activeProduct || activeProduct.demo)return;
  const size=$('.size-button.selected')?.dataset.size||'';
  if(activeProduct.sizes?.length && !size){$('#detail-error').hidden=false;$('#detail-error').textContent='Escolha um tamanho antes de adicionar.';return;}
  const personalization={name:$('#custom-name')?.value.trim()||'',number:$('#custom-number')?.value.trim()||'',phrase:$('#custom-phrase')?.value.trim()||'',note:$('#custom-note')?.value.trim()||''};
  if(personalization.number && !/^\d{1,3}$/.test(personalization.number)){ $('#detail-error').hidden=false;$('#detail-error').textContent='O número deve ter até três dígitos.';return; }
  const key=JSON.stringify([activeProduct.id,size,personalization]);
  const existing=cart.find(item=>item.key===key);
  if(existing)existing.quantity=Math.min(existing.quantity+1,99);else cart.push({key,productId:activeProduct.id,size,personalization,quantity:1});
  saveCart();closeLayers();toast('Produto adicionado ao carrinho.');
}
function renderCart(){
  cart=cart.filter(item=>catalog.products.some(p=>p.id===item.productId && p.available && !p.demo));
  const count=cart.reduce((sum,item)=>sum+item.quantity,0);$('#cart-count').textContent=count;
  $('#cart-items').innerHTML=cart.length?cart.map((item,index)=>{const product=catalog.products.find(p=>p.id===item.productId);return `<div class="cart-row">${art(product,'cart-thumb')}<div><h3>${escapeHtml(product.name)}</h3>${item.size?`<p>Tamanho: ${escapeHtml(item.size)}</p>`:''}${hasPersonalization(item)?`<p>Personalização: ${escapeHtml([item.personalization.name,item.personalization.number,item.personalization.phrase].filter(Boolean).join(' '))}</p>`:''}<strong>${money(unitPrice(product,item)*item.quantity)}</strong><div class="quantity"><button data-qty="-1" data-index="${index}" aria-label="Diminuir quantidade">−</button><span>${item.quantity}</span><button data-qty="1" data-index="${index}" aria-label="Aumentar quantidade">+</button></div></div><button class="remove-item" data-remove="${index}" aria-label="Remover ${escapeHtml(product.name)}">×</button></div>`;}).join(''):`<div class="cart-empty"><strong>Seu carrinho está vazio</strong><p>Escolha sua camisa ou presente para começar.</p></div>`;
  const total=cart.reduce((sum,item)=>{const product=catalog.products.find(p=>p.id===item.productId);return sum+unitPrice(product,item)*item.quantity;},0);
  $('#cart-total').textContent=money(total);
  $('#checkout-form').hidden=!cart.length;
}
async function checkout(event){
  event.preventDefault();if(!cart.length)return;
  const form=$('#checkout-form'),button=form.querySelector('button[type=submit]');
  const error=$('#checkout-error');error.hidden=true;
  const customer={name:$('#customer-name').value.trim(),city:$('#customer-city').value.trim(),note:$('#customer-note').value.trim()};
  if(!customer.name||!customer.city){error.textContent='Informe nome e cidade.';error.hidden=false;return;}
  const popup=window.open('about:blank','_blank');
  button.disabled=true;button.textContent='PREPARANDO PEDIDO...';
  try{
    const response=await fetch('/api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer,items:cart})});
    const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Não foi possível preparar o pedido.');
    if(popup)popup.location.href=payload.url;else window.location.href=payload.url;
    toast('Pedido preparado para o WhatsApp.');
  }catch(err){if(popup)popup.close();error.textContent=err.message;error.hidden=false;}
  finally{button.disabled=false;button.innerHTML='<span>◉</span> FINALIZAR PEDIDO NO WHATSAPP';}
}
document.addEventListener('click',event=>{
  const category=event.target.closest('[data-category]');if(category){event.preventDefault();location.href=`/catalogo?categoria=${encodeURIComponent(category.dataset.category)}`;return;}
  if(event.target.closest('[data-promo]')){event.preventDefault();location.href='/catalogo?categoria=Promoções';return;}
  const product=event.target.closest('[data-product]');if(product){location.href=`/produto?id=${encodeURIComponent(product.dataset.product)}`;return;}
  if(event.target.closest('[data-all-products]')){event.preventDefault();location.href='/catalogo';return;}
  if(event.target.closest('[data-personalize]')){event.preventDefault();location.href='/catalogo?categoria=Personalizados';return;}
  const size=event.target.closest('[data-size]');if(size){document.querySelectorAll('.size-button').forEach(x=>{x.classList.toggle('selected',x===size);x.setAttribute('aria-pressed',x===size?'true':'false')});return;}
  const photo=event.target.closest('[data-photo]');if(photo&&activeProduct){currentPhoto=Number(photo.dataset.photo);$('#main-product-art').innerHTML=art(activeProduct,'main-photo',currentPhoto);document.querySelectorAll('.thumbnail').forEach(x=>x.classList.toggle('active',x===photo));return;}
  if(event.target.closest('#add-to-cart')){addToCart();return;}
  const qty=event.target.closest('[data-qty]');if(qty){const item=cart[Number(qty.dataset.index)];if(item){item.quantity+=Number(qty.dataset.qty);if(item.quantity<=0)cart.splice(Number(qty.dataset.index),1);saveCart();}return;}
  const remove=event.target.closest('[data-remove]');if(remove){cart.splice(Number(remove.dataset.remove),1);saveCart();return;}
  if(event.target.closest('#reset-filter')||event.target.closest('#clear-filters')){resetFilter();return;}
});
$('#show-all-products').addEventListener('click',()=>{location.href='/catalogo';});
$('#show-all-teams').addEventListener('click',()=>{location.href='/times';});
$('#cart-open').addEventListener('click',()=>{location.href='/carrinho';});
$('#cart-close').addEventListener('click',closeLayers);
$('#product-close').addEventListener('click',closeLayers);
$('#overlay').addEventListener('click',closeLayers);
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeLayers()});
$('#checkout-form').addEventListener('submit',checkout);
$('#search-input').addEventListener('input',event=>{filter={category:'',team:'',promo:false,query:event.target.value.trim().toLowerCase(),all:true};renderProducts();});
$('#search-toggle').addEventListener('click',()=>{$('.search-box').classList.toggle('open');$('#search-input').focus()});
$('#menu-toggle').addEventListener('click',()=>{const nav=$('#main-nav');const open=nav.classList.toggle('open');$('#menu-toggle').setAttribute('aria-expanded',String(open));});
$('#whatsapp-float').addEventListener('click',()=>{const phone=String(catalog.settings.whatsapp||'').replace(/\D/g,'');if(!phone)return toast('WhatsApp da loja ainda não configurado.');window.open(`https://wa.me/${phone}?text=${encodeURIComponent(catalog.settings.defaultMessage||'Olá, Wesley! Gostaria de falar com a Wesllen Imports.')}`,'_blank','noopener');});
async function init(){
  try{const response=await fetch('/api/catalog');if(!response.ok)throw new Error();catalog=withDemoProducts(await response.json());updateHeader();renderTeams();renderProducts();renderCategories();renderCart();if(location.hash==='#carrinho')openLayer('cart');}
  catch{$('#showcase-grid').innerHTML='<div class="empty-state"><h3>Não foi possível carregar a loja</h3><p>Atualize a página para tentar novamente.</p></div>';}
}
init();
