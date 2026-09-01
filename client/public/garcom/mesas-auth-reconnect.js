/* Reconecta /mesas somente depois que a conta real do Garçom estiver autenticada.
 * Preserva o último estado conhecido e recupera automaticamente listeners cancelados
 * durante transições de autenticação ou oscilações momentâneas de rede.
 */
(() => {
  if (window.GARCOM_MESAS_AUTH_RUNTIME === 'v38') return;
  window.GARCOM_MESAS_AUTH_RUNTIME = 'v38';

  const EMAIL_GARCOM = 'garcom@acesso.joaocaicara.app';
  const RETRY_INICIAL_MS = 500;
  const RETRY_MAX_MS = 8000;
  let refMesas = null;
  let callbackMesas = null;
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

  const normalizar = valor => {
    if (typeof window.normalizarMesas === 'function') return window.normalizarMesas(valor);
    const origem = valor && typeof valor === 'object' ? valor : {};
    const resultado = {};
    Object.keys(origem).forEach(numero => {
      const mesa = origem[numero] && typeof origem[numero] === 'object' ? origem[numero] : {};
      const itens = Array.isArray(mesa.itens)
        ? mesa.itens
        : (mesa.itens && typeof mesa.itens === 'object' ? Object.values(mesa.itens) : []);
      resultado[numero] = {
        ...mesa,
        itens: itens.filter(Boolean),
        cliente: typeof mesa.cliente === 'string' ? mesa.cliente : '',
        abertura: mesa.abertura || null
      };
    });
    return resultado;
  };

  const pedidoNovo = mesa => Boolean(
    mesa && Array.isArray(mesa.itens) && mesa.itens.some(item => item && item.enviado === false && item.rascunho !== true)
  );

  function atualizarStatus(texto, estado) {
    try {
      if (typeof atualizarStatusConexaoG === 'function') atualizarStatusConexaoG(texto, estado);
    } catch (_) {}
  }

  function cancelarRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }

  function limparListener() {
    if (refMesas && callbackMesas) {
      try { refMesas.off('value', callbackMesas); } catch (_) {}
    }
    refMesas = null;
    callbackMesas = null;
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
    atualizarStatus('🟠 reconectando mesas', 'sync-pending');
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
    if (!forcar && conectadoUid === user.uid && refMesas && callbackMesas) return;
    if (!forcar && tentativaUid === user.uid && refMesas && callbackMesas) return;

    cancelarRetry();
    limparListener();
    tentativaUid = user.uid;
    atualizarStatus('🟠 sincronizando mesas', 'sync-pending');

    const database = databasePrincipal();
    if (!database?.ref) {
      tentativaUid = null;
      agendarRetry();
      return;
    }

    const minhaGeracao = ++geracao;
    try {
      if (typeof user.getIdToken === 'function') await user.getIdToken();
      if (minhaGeracao !== geracao || !usuarioValido(authPrincipal()?.currentUser)) return;

      refMesas = database.ref('mesas');
      callbackMesas = snap => {
        if (minhaGeracao !== geracao) return;
        try {
          const anteriores = (typeof mesas === 'object' && mesas) ? mesas : {};
          const atualizadas = normalizar(snap.val());
          const novos = Object.keys(atualizadas).filter(numero => pedidoNovo(atualizadas[numero]) && !pedidoNovo(anteriores[numero]));
          mesas = atualizadas;
          conectadoUid = user.uid;
          tentativaUid = null;
          retryMs = RETRY_INICIAL_MS;
          cancelarRetry();
          if (typeof renderizarMesasG === 'function') renderizarMesasG();
          if (typeof mesaSelecionada !== 'undefined' && mesaSelecionada && mesas[mesaSelecionada] && typeof renderizarComandaG === 'function') {
            renderizarComandaG();
          }
          if (typeof notificarNovoPedidoG === 'function') novos.forEach(numero => notificarNovoPedidoG(numero));
          atualizarStatus('🟢 Firebase online · sincronizado', 'sync-ok');
          try {
            window.dispatchEvent(new CustomEvent('garcom:mesas-autenticadas', {
              detail: { uid: user.uid, quantidade: Object.keys(atualizadas).length }
            }));
          } catch (_) {}
        } catch (erro) {
          console.error('Falha ao aplicar mesas autenticadas:', erro);
          limparListener();
          agendarRetry();
        }
      };

      refMesas.on('value', callbackMesas, erro => {
        if (minhaGeracao !== geracao) return;
        console.warn('Listener de mesas interrompido; tentando recuperar:', erro);
        limparListener();
        agendarRetry();
      });
    } catch (erro) {
      if (minhaGeracao !== geracao) return;
      console.warn('Aguardando autenticação para sincronizar mesas:', erro);
      limparListener();
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
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const user = authPrincipal()?.currentUser || null;
    if (usuarioValido(user) && !conectadoUid) void conectar(user, true);
  });

  window.GarcomMesasAuth = Object.freeze({
    runtime: 'v38',
    reconectar: () => conectar(authPrincipal()?.currentUser, true),
    recarregar: () => conectar(authPrincipal()?.currentUser, true),
    desconectar,
    get conectado() { return Boolean(conectadoUid && refMesas && callbackMesas); }
  });
  iniciar();
})();
