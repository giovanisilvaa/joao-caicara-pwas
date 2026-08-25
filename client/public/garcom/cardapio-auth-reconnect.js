/* Mantém /cardapio sincronizado em tempo real depois do login real do Garçom. */
(() => {
  if (window.GARCOM_CARDAPIO_AUTH_RUNTIME === 'v20') return;
  window.GARCOM_CARDAPIO_AUTH_RUNTIME = 'v20';

  const EMAIL_GARCOM = 'garcom@acesso.joaocaicara.app';
  let refCardapio = null;
  let callbackCardapio = null;
  let conectadoUid = null;

  function usuarioValido(user) {
    return Boolean(user && !user.isAnonymous && String(user.email || '').toLowerCase() === EMAIL_GARCOM);
  }

  function normalizar(valor) {
    if (Array.isArray(valor)) return valor.filter(Boolean);
    if (valor && typeof valor === 'object') return Object.values(valor).filter(Boolean);
    return [];
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

  function desconectar() {
    if (refCardapio && callbackCardapio) {
      try { refCardapio.off('value', callbackCardapio); } catch (_) {}
    }
    refCardapio = null;
    callbackCardapio = null;
    conectadoUid = null;
  }

  function conectar(user) {
    if (!usuarioValido(user)) return desconectar();
    if (conectadoUid === user.uid && refCardapio && callbackCardapio) return;
    if (typeof db === 'undefined' || !db?.ref) return;

    desconectar();
    conectadoUid = user.uid;
    refCardapio = db.ref('cardapio');
    callbackCardapio = snapshot => {
      try { aplicar(normalizar(snapshot.val()), user); }
      catch (erro) { console.error('Falha ao aplicar cardápio autenticado no Garçom:', erro); }
    };
    refCardapio.on('value', callbackCardapio, erro => {
      console.error('Falha ao sincronizar cardápio autenticado no Garçom:', erro);
    });
  }

  function iniciar() {
    const auth = window.firebase?.auth?.();
    if (!auth || typeof auth.onAuthStateChanged !== 'function') {
      setTimeout(iniciar, 150);
      return;
    }
    auth.onAuthStateChanged(conectar);
    if (auth.currentUser) conectar(auth.currentUser);
  }

  window.GarcomCardapioAuthReconnect = Object.freeze({
    recarregar: () => conectar(window.firebase?.auth?.().currentUser),
    reconectar: () => conectar(window.firebase?.auth?.().currentUser),
    desconectar
  });
  iniciar();
})();
