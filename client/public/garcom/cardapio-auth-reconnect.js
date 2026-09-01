/* Mantém /cardapio sincronizado em tempo real depois do login real do Garçom. */
(() => {
  if (window.GARCOM_CARDAPIO_AUTH_RUNTIME === 'v21') return;
  window.GARCOM_CARDAPIO_AUTH_RUNTIME = 'v21';

  const EMAIL_GARCOM = 'garcom@acesso.joaocaicara.app';
  const RETRY_INICIAL_MS = 500;
  const RETRY_MAX_MS = 8000;
  let refCardapio = null;
  let callbackCardapio = null;
  let conectadoUid = null;
  let tentativaUid = null;
  let retryTimer = null;
  let retryMs = RETRY_INICIAL_MS;
  let geracao = 0;

  function authPrincipal() {
    try { return window.firebase?.auth?.() || null; } catch (_) { return null; }
  }

  function databasePrincipal() {
    try { return window.firebase?.database?.() || null; } catch (_) { return null; }
  }

  function usuarioValido(user) {
    return Boolean(user && !user.isAnonymous && String(user.email || '').toLowerCase() === EMAIL_GARCOM);
  }

  function normalizar(valor) {
    if (Array.isArray(valor)) return valor.filter(Boolean);
    if (valor && typeof valor === 'object') return Object.values(valor).filter(Boolean);
    return [];
  }

  function mensagemGrid(texto) {
    try {
      const grid = document.getElementById('grid-produtos-g');
      const listaAtual = (typeof produtos !== 'undefined' && Array.isArray(produtos)) ? produtos : [];
      if (grid && listaAtual.length === 0) grid.innerHTML = `<p class="msg-vazio">${texto}</p>`;
    } catch (_) {}
  }

  function aplicar(lista, user) {
    try { produtos = lista; } catch (_) {}
    try { localStorage.setItem('cardapio_caicara_cache', JSON.stringify(lista)); } catch (_) {}
    try { if (typeof renderizarTabsG === 'function') renderizarTabsG(); } catch (_) {}
    try {
      if (typeof renderizarProdutosG === 'function') renderizarProdutosG();
      else if (typeof filtrarCardapioG === 'function') filtrarCardapioG(categoriaAtual || 'favoritos');
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('garcom:cardapio-autenticado', {
        detail: { uid: user?.uid || null, itens: lista.length }
      }));
    } catch (_) {}
  }

  function cancelarRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }

  function limparListener() {
    if (refCardapio && callbackCardapio) {
      try { refCardapio.off('value', callbackCardapio); } catch (_) {}
    }
    refCardapio = null;
    callbackCardapio = null;
    conectadoUid = null;
    tentativaUid = null;
  }

  function desconectar() {
    geracao += 1;
    cancelarRetry();
    limparListener();
    retryMs = RETRY_INICIAL_MS;
  }

  function agendarRetry() {
    cancelarRetry();
    const espera = retryMs;
    retryMs = Math.min(RETRY_MAX_MS, retryMs * 2);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      const user = authPrincipal()?.currentUser || null;
      if (usuarioValido(user)) void conectar(user, true);
    }, espera);
  }

  async function conectar(user, forcar = false) {
    if (!usuarioValido(user)) {
      desconectar();
      return;
    }
    if (!forcar && conectadoUid === user.uid && refCardapio && callbackCardapio) return;
    if (!forcar && tentativaUid === user.uid && refCardapio && callbackCardapio) return;

    cancelarRetry();
    limparListener();
    tentativaUid = user.uid;
    mensagemGrid('Carregando cardápio...');

    const database = databasePrincipal();
    if (!database?.ref) {
      tentativaUid = null;
      mensagemGrid('Reconectando cardápio...');
      agendarRetry();
      return;
    }

    const minhaGeracao = ++geracao;
    try {
      if (typeof user.getIdToken === 'function') await user.getIdToken();
      if (minhaGeracao !== geracao || !usuarioValido(authPrincipal()?.currentUser)) return;

      refCardapio = database.ref('cardapio');
      callbackCardapio = snapshot => {
        if (minhaGeracao !== geracao) return;
        try {
          const lista = normalizar(snapshot.val());
          conectadoUid = user.uid;
          tentativaUid = null;
          retryMs = RETRY_INICIAL_MS;
          cancelarRetry();
          aplicar(lista, user);
        } catch (erro) {
          console.error('Falha ao aplicar cardápio autenticado no Garçom:', erro);
          conectadoUid = null;
          tentativaUid = null;
          mensagemGrid('Reconectando cardápio...');
          agendarRetry();
        }
      };

      refCardapio.on('value', callbackCardapio, erro => {
        if (minhaGeracao !== geracao) return;
        console.error('Falha ao sincronizar cardápio autenticado no Garçom:', erro);
        limparListener();
        mensagemGrid('Reconectando cardápio...');
        agendarRetry();
      });
    } catch (erro) {
      if (minhaGeracao !== geracao) return;
      console.warn('Aguardando autenticação do cardápio do Garçom:', erro);
      limparListener();
      mensagemGrid('Reconectando cardápio...');
      agendarRetry();
    }
  }

  function iniciar() {
    const auth = authPrincipal();
    if (!auth || typeof auth.onAuthStateChanged !== 'function') {
      setTimeout(iniciar, 150);
      return;
    }
    auth.onAuthStateChanged(user => void conectar(user));
    if (auth.currentUser) void conectar(auth.currentUser);
  }

  window.addEventListener('online', () => {
    const user = authPrincipal()?.currentUser || null;
    if (usuarioValido(user)) void conectar(user, true);
  });
  window.addEventListener('focus', () => {
    const user = authPrincipal()?.currentUser || null;
    if (usuarioValido(user) && !conectadoUid) void conectar(user, true);
  });

  window.GarcomCardapioAuthReconnect = Object.freeze({
    runtime: 'v21',
    recarregar: () => conectar(authPrincipal()?.currentUser, true),
    reconectar: () => conectar(authPrincipal()?.currentUser, true),
    desconectar
  });
  iniciar();
})();
