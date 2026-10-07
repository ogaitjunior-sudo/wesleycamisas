// Change this list to reorder, add or remove slides. Image variants are optional.
const slides = [
  {
    type: 'video',
    src: '/assets/hero-wesllen-video-fast.mp4',
    poster: '/assets/hero-wesllen-poster.jpg',
    label: 'Vídeo de apresentação da Wesllen Imports',
    desktopPosition: 'center center',
    tabletPosition: 'center center',
    mobilePosition: 'center center',
    href: ''
  },
  {
    type: 'image',
    desktop: '/assets/hero-personalize-wesllen.webp',
    tablet: '',
    mobile: '',
    alt: 'Wesllen Imports: personalize sua camisa com seu nome e número. Exemplo WESLEY 10 em preto e dourado.',
    desktopPosition: 'center center',
    tabletPosition: 'right center',
    mobilePosition: 'right center',
    href: '',
    brandCorrection: 'WESLLEN IMPORTS',
    mobileCopy: {
      eyebrow: 'WESLLEN IMPORTS · SUA CAMISA, SUA HISTÓRIA',
      title: 'PERSONALIZE DO SEU JEITO!',
      description: 'Seu nome, seu número e a paixão pelo futebol em uma camisa feita para você.',
      benefits: ['NOME E NÚMERO', 'VÁRIOS TIMES', 'ESCOLHA DO TAMANHO', 'PRODUTOS PERSONALIZADOS']
    },
    hotspots: [
      { label: 'CRIAR MEU PERSONALIZADO ›', href: '/catalogo?categoria=Personalizados', x: 92, y: 575, width: 738, height: 90, embedded: true }
    ]
  },
  {
    type: 'image',
    desktop: '/assets/hero-wesllen-1.png',
    tablet: '',
    mobile: '',
    alt: 'Wesllen Imports: camisas de futebol, boné, caneca e presentes em preto e dourado',
    desktopPosition: 'center center',
    tabletPosition: '0% center',
    mobilePosition: '10% center',
    href: ''
  },
  {
    type: 'image',
    desktop: '/assets/hero-wesllen-2.png',
    tablet: '',
    mobile: '',
    alt: 'Vista sua paixão e personalize do seu jeito com nome e número',
    desktopPosition: 'center center',
    tabletPosition: '0% center',
    mobilePosition: '0% center',
    href: '',
    hotspots: [
      { label: 'Ver camisas', href: '/catalogo?categoria=Camisas', x: 79, y: 622, width: 408, height: 99 },
      { label: 'Personalizar agora', href: '/catalogo?categoria=Personalizados', x: 507, y: 622, width: 432, height: 99 }
    ]
  },
  {
    type: 'image',
    desktop: '/assets/hero-wesllen-3.png',
    tablet: '',
    mobile: '',
    alt: 'Wesllen Imports: camisas, personalizados, bonés e canecas',
    desktopPosition: 'center center',
    tabletPosition: '0% center',
    mobilePosition: '0% center',
    href: '',
    hotspots: [
      { label: 'Ver produtos', href: '/catalogo', x: 75, y: 633, width: 449, height: 96 },
      { label: 'Camisas', href: '/catalogo?categoria=Camisas', x: 1474, y: 112, width: 438, height: 122 },
      { label: 'Personalizados', href: '/catalogo?categoria=Personalizados', x: 1474, y: 240, width: 438, height: 120 },
      { label: 'Bonés', href: '/catalogo?categoria=Bon%C3%A9s', x: 1474, y: 368, width: 438, height: 121 },
      { label: 'Canecas', href: '/catalogo?categoria=Canecas', x: 1474, y: 499, width: 438, height: 129 }
    ]
  }
];

const carousel = document.querySelector('#hero-carousel');
const stage = document.querySelector('#hero-carousel-stage');
const dots = document.querySelector('#hero-carousel-dots');
const status = document.querySelector('#hero-carousel-status');
const responsiveActions = document.querySelector('#hero-carousel-responsive-actions');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const panels = [];
const dotButtons = [];
let activeIndex = -1;
let timer;
let activationId = 0;
let isInView = false;
let pointerStart = null;
let suppressClick = false;
let pointerOver = false;
let focusWithin = false;

function makeImage(slide) {
  const picture = document.createElement('picture');
  if (slide.mobile) {
    const source = document.createElement('source');
    source.media = '(max-width: 600px)';
    source.dataset.srcset = slide.mobile;
    picture.append(source);
  }
  if (slide.tablet) {
    const source = document.createElement('source');
    source.media = '(max-width: 1100px)';
    source.dataset.srcset = slide.tablet;
    picture.append(source);
  }
  const image = document.createElement('img');
  image.dataset.src = slide.desktop;
  image.alt = slide.alt;
  image.decoding = 'async';
  image.loading = 'lazy';
  picture.append(image);
  return picture;
}

function makeVideo(slide, index) {
  const video = index === 0 ? document.querySelector('#hero-first-video') || document.createElement('video') : document.createElement('video');
  if (video.getAttribute('src') !== slide.src) video.src = slide.src;
  video.poster = slide.poster || '';
  video.preload = index === 0 ? 'auto' : 'metadata';
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.autoplay = index === 0;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('aria-label', slide.label);
  video.disablePictureInPicture = true;
  video.addEventListener('play', () => {
    if ((activeIndex >= 0 && activeIndex !== index) || document.hidden) video.pause();
  });
  video.addEventListener('ended', () => {
    if (activeIndex === slides.indexOf(slide)) activate(activeIndex + 1);
  });
  video.addEventListener('error', () => {
    if (activeIndex === slides.indexOf(slide) && !reducedMotion.matches) scheduleNext();
  });
  return video;
}

function createSlide(slide, index) {
  const panel = index === 0 ? document.querySelector('#hero-first-panel') || document.createElement('div') : document.createElement('div');
  panel.className = `hero-carousel-slide${index === 0 ? ' is-active' : ''}`;
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-roledescription', 'slide');
  panel.setAttribute('aria-label', `${index + 1} de ${slides.length}: ${slide.label || slide.alt}`);
  panel.setAttribute('aria-hidden', String(index !== 0));
  panel.inert = index !== 0;
  panel.style.setProperty('--desktop-position', slide.desktopPosition || 'center center');
  panel.style.setProperty('--tablet-position', slide.tabletPosition || slide.desktopPosition || 'center center');
  panel.style.setProperty('--mobile-position', slide.mobilePosition || slide.tabletPosition || 'center center');
  const media = slide.type === 'video' ? makeVideo(slide, index) : makeImage(slide);
  if (slide.href) {
    const link = document.createElement('a');
    link.href = slide.href;
    link.setAttribute('aria-label', slide.label || slide.alt);
    link.append(media);
    panel.append(link);
  } else {
    if (media.parentElement !== panel) panel.append(media);
  }
  if (slide.brandCorrection) {
    const correction = document.createElement('span');
    correction.className = 'hero-carousel-brand-correction';
    const brand = document.createElement('strong');
    brand.textContent = slide.brandCorrection;
    correction.append(brand, document.createTextNode(' · SUA CAMISA, SUA HISTÓRIA'));
    panel.append(correction);
  }
  for (const hotspot of slide.hotspots || []) {
    const link = document.createElement('a');
    link.className = `hero-carousel-hotspot${hotspot.embedded ? ' hero-carousel-hotspot--embedded' : ''}`;
    link.href = hotspot.href;
    link.setAttribute('aria-label', hotspot.label);
    link.title = hotspot.label;
    link.hidden = true;
    panel.append(link);
  }
  panel.querySelector('img')?.addEventListener('load', () => layoutHotspots(index));
  if (!panel.isConnected) stage.append(panel);
  panels.push(panel);

  const dot = document.createElement('button');
  dot.type = 'button';
  dot.className = 'hero-carousel-dot';
  dot.setAttribute('aria-label', `Ir para slide ${index + 1}: ${slide.label || slide.alt}`);
  dot.setAttribute('aria-current', 'false');
  dot.addEventListener('click', () => activate(index, true));
  dots.append(dot);
  dotButtons.push(dot);
}

function layoutHotspots(index) {
  const image = panels[index]?.querySelector('img');
  if (!image?.naturalWidth) return;
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  const [horizontal = '50%', vertical = '50%'] = getComputedStyle(image).objectPosition.split(/\s+/);
  const factor = value => value === 'left' || value === 'top' ? 0 : value === 'right' || value === 'bottom' ? 1 : value === 'center' ? .5 : Number.parseFloat(value) / 100 || 0;
  const offsetX = (width - renderedWidth) * factor(horizontal);
  const offsetY = (height - renderedHeight) * factor(vertical);
  panels[index].querySelectorAll('.hero-carousel-hotspot').forEach((link, hotspotIndex) => {
    const target = slides[index].hotspots[hotspotIndex];
    const x = offsetX + target.x * scale;
    const y = offsetY + target.y * scale;
    const w = target.width * scale;
    const h = target.height * scale;
    link.style.left = `${x}px`;
    link.style.top = `${y}px`;
    link.style.width = `${w}px`;
    link.style.height = `${h}px`;
    link.hidden = x + w <= 0 || y + h <= 0 || x >= width || y >= height;
  });
}

function renderResponsiveActions(slide) {
  responsiveActions.replaceChildren();
  responsiveActions.dataset.kind = slide.mobileCopy ? 'personalize' : '';
  responsiveActions.dataset.count = String(slide.hotspots?.length || 0);
  if (slide.mobileCopy) {
    const copy = document.createElement('div');
    copy.className = 'hero-carousel-mobile-copy';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'hero-carousel-mobile-eyebrow';
    eyebrow.textContent = slide.mobileCopy.eyebrow;
    const heading = document.createElement('h2');
    heading.textContent = slide.mobileCopy.title;
    const description = document.createElement('p');
    description.textContent = slide.mobileCopy.description;
    const benefits = document.createElement('ul');
    for (const value of slide.mobileCopy.benefits) {
      const item = document.createElement('li');
      item.textContent = value;
      benefits.append(item);
    }
    copy.append(eyebrow, heading, description, benefits);
    responsiveActions.append(copy);
  }
  for (const hotspot of slide.hotspots || []) {
    const link = document.createElement('a');
    link.href = hotspot.href;
    link.textContent = hotspot.label;
    responsiveActions.append(link);
  }
  responsiveActions.hidden = !slide.hotspots?.length && !slide.mobileCopy;
}

function ensureImage(index) {
  if (slides[index]?.type !== 'image') return null;
  const panel = panels[index];
  const image = panel.querySelector('img');
  if (image.dataset.src) {
    panel.querySelectorAll('source[data-srcset]').forEach(source => {
      source.srcset = source.dataset.srcset;
      delete source.dataset.srcset;
    });
    image.loading = 'eager';
    image.src = image.dataset.src;
    delete image.dataset.src;
  }
  return image;
}

function stopPlayback() {
  clearTimeout(timer);
  if (activeIndex < 0) return;
  const video = panels[activeIndex].querySelector('video');
  if (video) {
    video.pause();
    try { video.currentTime = 0; } catch { /* Metadata may not be ready. */ }
  }
}

function scheduleNext() {
  clearTimeout(timer);
  if (reducedMotion.matches || !isInView || document.hidden || pointerOver || focusWithin) return;
  timer = setTimeout(() => activate(activeIndex + 1), 5000);
}

function startPlayback() {
  if (!isInView || document.hidden || activeIndex < 0) return;
  const video = panels[activeIndex].querySelector('video');
  if (!video) {
    if (!reducedMotion.matches) scheduleNext();
    return;
  }
  const attempt = video.play();
  if (attempt?.catch) attempt.catch(() => scheduleNext());
}

async function activate(index, manual = false) {
  const next = (index + slides.length) % slides.length;
  const request = ++activationId;
  const image = ensureImage(next);
  if (image && !image.complete) {
    await Promise.race([
      image.decode().catch(() => {}),
      new Promise(resolve => setTimeout(resolve, 2500))
    ]);
  }
  if (request !== activationId) return;
  stopPlayback();
  activeIndex = next;
  panels.forEach((panel, panelIndex) => {
    const selected = panelIndex === next;
    panel.classList.toggle('is-active', selected);
    panel.setAttribute('aria-hidden', String(!selected));
    panel.inert = !selected;
    dotButtons[panelIndex].setAttribute('aria-current', String(selected));
  });
  layoutHotspots(next);
  renderResponsiveActions(slides[next]);
  status.textContent = `Slide ${next + 1} de ${slides.length}: ${slides[next].label || slides[next].alt}`;
  ensureImage((next + 1) % slides.length);
  startPlayback();
}

slides.forEach(createSlide);
new ResizeObserver(() => panels.forEach((_, index) => layoutHotspots(index))).observe(stage);
carousel.addEventListener('pointerenter', () => { pointerOver = true; clearTimeout(timer); });
carousel.addEventListener('pointerleave', () => {
  pointerOver = false;
  if (!panels[activeIndex]?.querySelector('video')) scheduleNext();
});
carousel.addEventListener('focusin', () => { focusWithin = true; clearTimeout(timer); });
carousel.addEventListener('focusout', event => {
  if (carousel.contains(event.relatedTarget)) return;
  focusWithin = false;
  if (!panels[activeIndex]?.querySelector('video')) scheduleNext();
});
document.querySelector('#hero-carousel-prev').addEventListener('click', () => activate(activeIndex - 1, true));
document.querySelector('#hero-carousel-next').addEventListener('click', () => activate(activeIndex + 1, true));

stage.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  pointerStart = { x: event.clientX, y: event.clientY };
});
stage.addEventListener('pointerup', event => {
  if (!pointerStart) return;
  const deltaX = event.clientX - pointerStart.x;
  const deltaY = event.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return;
  suppressClick = true;
  activate(activeIndex + (deltaX < 0 ? 1 : -1), true);
  setTimeout(() => { suppressClick = false; }, 0);
});
stage.addEventListener('pointercancel', () => { pointerStart = null; });
stage.addEventListener('click', event => {
  if (!suppressClick) return;
  event.preventDefault();
  event.stopPropagation();
  suppressClick = false;
}, true);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPlayback();
  else startPlayback();
});
reducedMotion.addEventListener?.('change', () => {
  stopPlayback();
  startPlayback();
});
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => {
    const visible = entries[0]?.isIntersecting || false;
    if (visible === isInView) return;
    isInView = visible;
    if (visible) startPlayback();
    else stopPlayback();
  }, { threshold: 0.15 }).observe(carousel);
} else {
  isInView = true;
}
activate(0);
