/* Guardião de runtime do PDV — garante que módulos críticos substituam as funções legadas. */
(() => {
  const VERSAO = 'v40';
  const carregamentos = new Map();

  function carregarScript(src, chave) {
    if (carregamentos.has(chave)) return carregamentos.get(chave);
    const promessa = new Promise((resolve, reject) => {
      const existente = document.querySelector(`script[data-pdv-runtime="${chave}"]`);
      if (existente) {
        if (existente.dataset.carregado === 'true') return resolve();
        existente.addEventListener('load', () => resolve(), { once: true });
        existente.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.pdvRuntime = chave;
      script.addEventListener('load', () => { script.dataset.carregado = 'true'; resolve(); }, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.appendChild(script);
    });
    carregamentos.set(chave, promessa);
    return promessa;
  }

  async function garantirRuntime() {
    try {
      if (!window.MesaAtomic) {
        await carregarScript('/mesa-atomic.js?v=38', 'mesa-atomic');
      }
      if (window.PDV_CONCURRENCY_RUNTIME !== VERSAO || !String(window.adicionarProduto || '').includes('adicionarProdutoAtomico')) {
        await carregarScript('/pdv/mesa-concurrency.js?v=40', 'mesa-concurrency');
      }
      if (window.PDV_PRODUCTION_RUNTIME !== VERSAO || !String(window.imprimirProducao || '').includes('imprimirProducaoSeguro')) {
        await carregarScript('/pdv/pdv-production.js?v=40', 'pdv-production');
      }
      document.documentElement.dataset.pdvRuntime = VERSAO;
      window.PDV_RUNTIME_OK = true;
    } catch (erro) {
      window.PDV_RUNTIME_OK = false;
      console.error('Falha ao garantir runtime operacional do PDV:', erro);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', garantirRuntime, { once: true });
  } else {
    garantirRuntime();
  }

  window.PdvRuntimeGuard = Object.freeze({ versao: VERSAO, garantirRuntime });
})();
