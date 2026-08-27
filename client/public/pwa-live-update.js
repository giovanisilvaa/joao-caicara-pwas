/* Atualização ativa dos PWAs João Caiçara — força checagem da versão publicada sem depender do cache HTTP. */
(() => {
  if (!('serviceWorker' in navigator)) return;

  const escopo = location.pathname.startsWith('/pdv/')
    ? '/pdv/'
    : (location.pathname.startsWith('/garcom/') ? '/garcom/' : null);
  if (!escopo) return;

  const serviceWorkerUrl = `${escopo}service-worker.js`;
  let verificando = false;

  async function verificarAtualizacao() {
    if (verificando || navigator.onLine === false) return;
    verificando = true;
    try {
      const registro = await navigator.serviceWorker.register(serviceWorkerUrl, {
        scope: escopo,
        updateViaCache: 'none'
      });
      await registro.update();
    } catch (erro) {
      console.warn('Falha ao verificar atualização do PWA:', erro);
    } finally {
      verificando = false;
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
  void verificarAtualizacao();

  window.JoaoCaicaraPwaUpdate = Object.freeze({ verificar: verificarAtualizacao, escopo });
})();
