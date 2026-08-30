/* Atualização ativa dos PWAs João Caiçara — força checagem da versão publicada sem depender do cache HTTP. */
(() => {
  const escopo = location.pathname.startsWith('/pdv/')
    ? '/pdv/'
    : (location.pathname.startsWith('/garcom/') ? '/garcom/' : null);
  if (!escopo) return;

  let verificando = false;
  let carregandoComanda = false;

  function garantirComandaPdv() {
    if (escopo !== '/pdv/') return;
    try {
      if (window.PDV_COMANDA_VISIBLE_RUNTIME === 'v3') {
        window.PdvComandaVisibleV3?.renderizar?.();
        return;
      }
      if (carregandoComanda || document.querySelector('script[data-pdv-comanda-visible="v3"]')) return;
      carregandoComanda = true;
      const script = document.createElement('script');
      script.src = '/pdv/comanda-visible-v2.js?v=3&direct=1';
      script.async = false;
      script.dataset.pdvComandaVisible = 'v3';
      script.onload = () => {
        carregandoComanda = false;
        try { window.PdvComandaVisibleV3?.renderizar?.(); } catch (_) {}
      };
      script.onerror = () => {
        carregandoComanda = false;
        console.warn('Falha ao carregar a visualização da comanda do PDV.');
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (erro) {
      carregandoComanda = false;
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
    garantirComandaPdv
  });
})();
