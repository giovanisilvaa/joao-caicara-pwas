/* Mantém /cardapio sincronizado em tempo real depois do login real do PDV. */
(() => {
  if (window.PDV_CARDAPIO_AUTH_RUNTIME === 'v1') return;
  window.PDV_CARDAPIO_AUTH_RUNTIME = 'v1';

  const EMAIL_PDV = 'adm@acesso.joaocaicara.app';
  let refCardapio = null;
  let callbackCardapio = null;
  let conectadoUid = null;

  function normalizar(valor) {
    if (Array.isArray(valor)) return valor.filter(Boolean);
    if (valor && typeof valor === 'object') return Object.values(valor).filter(Boolean);
    return [];
  }

  function aplicar(lista) {
    try { produtos = lista; } catch (_) {}
    try { localStorage.setItem('cardapio_caicara_cache', JSON.stringify(lista)); } catch (_) {}
    try { if (typeof renderizarCardapio === 'function') renderizarCardapio(categoriaAtual); } catch (_) {}
    try {
      const modal = document.getElementById('modal-cardapio');
      if (modal?.style.display === 'flex' && typeof renderizarAdminCardapio === 'function') {
        renderizarAdminCardapio(document.getElementById('busca-admin-cardapio')?.value || '');
      }
    } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('pdv:cardapio-sincronizado', { detail: { itens: lista.length } })); } catch (_) {}
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
    const email = String(user?.email || '').toLowerCase();
    if (!user || user.isAnonymous || email !== EMAIL_PDV) return desconectar();
    if (conectadoUid === user.uid && refCardapio && callbackCardapio) return;

    desconectar();
    conectadoUid = user.uid;
    refCardapio = db.ref('cardapio');
    callbackCardapio = snapshot => {
      try { aplicar(normalizar(snapshot.val())); }
      catch (erro) { console.error('Falha ao aplicar cardápio autenticado no PDV:', erro); }
    };
    refCardapio.on('value', callbackCardapio, erro => console.error('Falha ao sincronizar cardápio autenticado no PDV:', erro));
  }

  function iniciar() {
    const auth = window.firebase?.auth?.();
    if (!auth || typeof auth.onAuthStateChanged !== 'function' || typeof db === 'undefined') {
      setTimeout(iniciar, 150);
      return;
    }
    auth.onAuthStateChanged(conectar);
    if (auth.currentUser) conectar(auth.currentUser);
  }

  window.PdvCardapioAuth = Object.freeze({ reconectar: () => conectar(window.firebase?.auth?.().currentUser), desconectar });
  iniciar();
})();
