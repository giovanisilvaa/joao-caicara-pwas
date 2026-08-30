/* Atualização ativa dos PWAs João Caiçara — força checagem da versão publicada sem depender do cache HTTP. */
(() => {
  const escopo = location.pathname.startsWith('/pdv/')
    ? '/pdv/'
    : (location.pathname.startsWith('/garcom/') ? '/garcom/' : null);
  if (!escopo) return;

  let verificando = false;
  let carregandoComanda = false;
  let observadorReparoPdv = null;

  function repararComandaPdv() {
    if (escopo !== '/pdv/') return;
    try {
      // Remove a camada antiga v2 que escondia propositalmente #order-items.
      document.getElementById('pdv-comanda-visible-v2-style')?.remove();
      document.getElementById('pdv-comanda-visible-v2')?.remove();

      // Compatibilidade extra para desktops que ainda executem um hotfix antigo em cache.
      document.querySelectorAll('style').forEach(style => {
        const texto = style.textContent || '';
        if (texto.includes('.order-panel #order-items{display:none!important}')) {
          style.remove();
        }
      });

      const itens = document.getElementById('order-items');
      if (itens) {
        itens.style.setProperty('display', 'block', 'important');
        itens.style.setProperty('visibility', 'visible', 'important');
        itens.style.setProperty('opacity', '1', 'important');
        itens.style.setProperty('flex', '1 1 220px', 'important');
        itens.style.setProperty('min-height', '180px', 'important');
        itens.style.setProperty('max-height', '45vh', 'important');
        itens.style.setProperty('overflow-y', 'auto', 'important');
      }
    } catch (erro) {
      console.warn('Falha ao reparar a área da comanda do PDV:', erro);
    }
  }

  function observarReparoPdv() {
    if (escopo !== '/pdv/' || observadorReparoPdv || !document.documentElement) return;
    observadorReparoPdv = new MutationObserver(() => repararComandaPdv());
    observadorReparoPdv.observe(document.documentElement, { childList: true, subtree: true });
    // O hotfix antigo pode ser injetado logo depois deste arquivo pelo service worker antigo.
    setTimeout(repararComandaPdv, 0);
    setTimeout(repararComandaPdv, 250);
    setTimeout(repararComandaPdv, 1000);
  }

  function garantirComandaPdv() {
    if (escopo !== '/pdv/') return;
    repararComandaPdv();
    observarReparoPdv();
    try {
      if (window.PDV_COMANDA_VISIBLE_RUNTIME === 'v3') {
        window.PdvComandaVisibleV3?.renderizar?.();
        repararComandaPdv();
        return;
      }
      if (carregandoComanda || document.querySelector('script[data-pdv-comanda-visible="v3"]')) return;
      carregandoComanda = true;
      const script = document.createElement('script');
      script.src = '/pdv/comanda-visible-v2.js?v=3&direct=2';
      script.async = false;
      script.dataset.pdvComandaVisible = 'v3';
      script.onload = () => {
        carregandoComanda = false;
        repararComandaPdv();
        try { window.PdvComandaVisibleV3?.renderizar?.(true); } catch (_) {}
        setTimeout(repararComandaPdv, 0);
      };
      script.onerror = () => {
        carregandoComanda = false;
        repararComandaPdv();
        console.warn('Falha ao carregar a visualização da comanda do PDV.');
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (erro) {
      carregandoComanda = false;
      repararComandaPdv();
      console.warn('Falha ao garantir a visualização da comanda do PDV:', erro);
    }
  }

  async function verificarAtualizacao() {
    garantirComandaPdv();
    if (!('serviceWorker' in navigator) || verificando || navigator.onLine === false) return;
    verificando = true;
    try {
      const serviceWorkerUrl = `${escopo}service-worker.js`;
      const registro = await navigator.serviceWorker.register(serviceWorkerUrl, {
        scope: escopo,
        updateViaCache: 'none'
      });
      await registro.update();
    } catch (erro) {
      console.warn('Falha ao verificar atualização do PWA:', erro);
    } finally {
      verificando = false;
      garantirComandaPdv();
    }
  }

  window.addEventListener('load', verificarAtualizacao, { once: true });
  window.addEventListener('online', verificarAtualizacao);
  window.addEventListener('focus', verificarAtualizacao);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') verificarAtualizacao();
  });

  // Se o sistema ficar aberto por horas, busca uma nova versão sem esperar o usuário reiniciar o app.
  setInterval(() => {
    if (document.visibilityState === 'visible') verificarAtualizacao();
  }, 60000);

  // Também verifica imediatamente, inclusive em PWAs já instalados.
  garantirComandaPdv();
  void verificarAtualizacao();

  window.JoaoCaicaraPwaUpdate = Object.freeze({
    verificar: verificarAtualizacao,
    escopo,
    garantirComandaPdv,
    repararComandaPdv
  });
})();