(() => {
  if (!window.isSecureContext) return;

  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const safari = /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
  let installEvent = null;
  let registration = null;
  let updateRequested = false;
  let installButton;
  let updateBanner;

  function ensureInstallButton() {
    if (standalone() || (!installEvent && !(ios && safari))) {
      installButton?.remove();
      installButton = null;
      return;
    }
    if (installButton) return;
    installButton = document.createElement('button');
    installButton.type = 'button';
    installButton.className = 'pwa-install';
    installButton.textContent = '↧  Instalar aplicativo';
    installButton.addEventListener('click', async () => {
      if (installEvent) {
        const prompt = installEvent;
        installEvent = null;
        ensureInstallButton();
        await prompt.prompt();
        await prompt.userChoice;
        return;
      }
      if (ios && safari) showIosInstructions();
    });
    document.body.append(installButton);
  }

  function showIosInstructions() {
    const backdrop = document.createElement('div');
    backdrop.className = 'pwa-dialog-backdrop';
    backdrop.innerHTML = '<section class="pwa-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-dialog-title"><button class="pwa-dialog-close" type="button" aria-label="Fechar instruções">×</button><img src="/icons/icon-192.png" alt=""><h2 id="pwa-dialog-title">Instale a Wesllen Imports</h2><p>No Safari, toque em <strong>Compartilhar</strong> (ícone de quadrado com seta) e escolha <strong>Adicionar à Tela de Início</strong>.</p><button class="pwa-dialog-ok" type="button">Entendi</button></section>';
    const close = () => { backdrop.remove(); installButton?.focus(); };
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop || event.target.closest('.pwa-dialog-close,.pwa-dialog-ok')) close();
    });
    backdrop.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    document.body.append(backdrop);
    backdrop.querySelector('.pwa-dialog-close').focus();
  }

  function shoppingInProgress() {
    if (/^\/(?:produto|carrinho)(?:\/|$)/.test(location.pathname)) return true;
    if (document.querySelector('#product-modal:not([hidden]), #cart-drawer:not([hidden]), #shop-cart:not([hidden])')) return true;
    return [...document.querySelectorAll('input, textarea')].some(field =>
      field.id !== 'search-input' && field.type !== 'search' && field.type !== 'hidden' && String(field.value || '').trim()
    );
  }

  function offerUpdate() {
    if (!registration?.waiting || updateBanner) return;
    updateBanner = document.createElement('div');
    updateBanner.className = 'pwa-update';
    updateBanner.setAttribute('role', 'status');
    updateBanner.innerHTML = '<span>Nova versão da loja disponível.</span><button class="pwa-update-now" type="button">Atualizar</button><button class="pwa-update-later" type="button" aria-label="Atualizar depois">×</button>';
    updateBanner.querySelector('.pwa-update-now').addEventListener('click', () => {
      if (shoppingInProgress()) {
        updateBanner.querySelector('span').textContent = 'Conclua sua compra ou personalização antes de atualizar.';
        return;
      }
      updateRequested = true;
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });
    updateBanner.querySelector('.pwa-update-later').addEventListener('click', () => { updateBanner.remove(); updateBanner = null; });
    document.body.append(updateBanner);
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installEvent = event;
    if (document.body) ensureInstallButton();
  });
  window.addEventListener('appinstalled', () => { installEvent = null; ensureInstallButton(); });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updateRequested) location.reload();
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    ensureInstallButton();
    if (!('serviceWorker' in navigator)) return;
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      if (registration.waiting) offerUpdate();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate();
        });
      });
      const check = () => { if (navigator.onLine) registration.update().catch(() => {}); };
      window.addEventListener('online', check);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
      setInterval(check, 60 * 60 * 1000);
      check();
    } catch (error) {
      console.warn('Não foi possível ativar o modo aplicativo:', error);
    }
  });
})();
