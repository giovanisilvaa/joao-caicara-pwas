/* Mantém o resumo de vendas do PDV estável entre logout/login e reconecta /vendas após autenticação. */
(() => {
  if (window.PdvVendasAuthReconnectReady) return;

  const CACHE_KEY = 'historico_vendas_caicara';
  let refVendas = null;

  function lerCacheLocal() {
    try {
      const dados = JSON.parse(localStorage.getItem(CACHE_KEY)) || [];
      return Array.isArray(dados) ? dados.filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }

  function salvarCacheLocal(vendas) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(vendas));
    } catch (_) {}
  }

  function aplicarNoRuntime(vendas) {
    const lista = Array.isArray(vendas) ? vendas.filter(Boolean) : [];
    try { vendasCacheDiario = lista.slice(); } catch (_) {}
    try {
      if (typeof atualizarPainelDiario === 'function') atualizarPainelDiario();
    } catch (_) {}
    try {
      const modal = document.getElementById('modal-historico');
      if (modal?.style?.display === 'flex' && typeof window.renderizarHistorico === 'function') {
        window.renderizarHistorico();
      }
    } catch (_) {}
    return lista;
  }

  function restaurarCacheLocal() {
    return aplicarNoRuntime(lerCacheLocal());
  }

  function vendasDoSnapshot(snapshot) {
    const vendas = [];
    snapshot?.forEach?.(child => {
      const venda = child.val?.();
      if (venda) vendas.push(venda);
    });
    return vendas.sort((a, b) => (Number(b?.criadoEm) || 0) - (Number(a?.criadoEm) || 0));
  }

  function aoValor(snapshot) {
    const vendas = vendasDoSnapshot(snapshot);
    salvarCacheLocal(vendas);
    aplicarNoRuntime(vendas);
  }

  function aoErro(erro) {
    console.warn('Leitura de vendas indisponível; mantendo último histórico local:', erro?.code || erro?.message || erro);
    restaurarCacheLocal();
  }

  function desconectar() {
    if (!refVendas) return;
    try { refVendas.off('value', aoValor); } catch (_) {}
    refVendas = null;
  }

  function conectar() {
    const firebaseAuth = window.firebase?.auth?.();
    const firebaseDb = window.firebase?.database?.();
    if (!firebaseAuth?.currentUser || !firebaseDb) {
      restaurarCacheLocal();
      return false;
    }

    desconectar();
    refVendas = firebaseDb.ref('vendas');
    refVendas.on('value', aoValor, aoErro);
    return true;
  }

  function iniciar() {
    restaurarCacheLocal();

    const firebaseAuth = window.firebase?.auth?.();
    if (!firebaseAuth || typeof firebaseAuth.onAuthStateChanged !== 'function') {
      setTimeout(iniciar, 150);
      return;
    }

    firebaseAuth.onAuthStateChanged(user => {
      if (user) conectar();
      else {
        desconectar();
        restaurarCacheLocal();
      }
    });

    if (firebaseAuth.currentUser) conectar();
  }

  window.PdvVendasAuthReconnectReady = true;
  window.PdvVendasAuthReconnect = Object.freeze({
    restaurar: restaurarCacheLocal,
    reconectar: conectar
  });

  iniciar();
})();
