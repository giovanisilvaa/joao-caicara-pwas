/* Reconecta o cardápio depois que a conta compartilhada real do garçom autentica. */
(() => {
  const EMAIL_GARCOM = 'garcom@acesso.joaocaicara.app';
  let ultimoUidCarregado = null;
  let carregando = false;

  function usuarioGarcomValido(user) {
    return Boolean(user && !user.isAnonymous && String(user.email || '').toLowerCase() === EMAIL_GARCOM);
  }

  async function recarregarCardapioAutenticado(user) {
    if (!usuarioGarcomValido(user) || carregando || ultimoUidCarregado === user.uid) return;
    if (typeof db === 'undefined' || !db?.ref) return;
    carregando = true;
    try {
      const snapshot = await db.ref('cardapio').once('value');
      const dados = snapshot.val();
      let lista;
      if (Array.isArray(dados)) lista = dados.filter(Boolean);
      else if (dados && typeof dados === 'object') lista = Object.values(dados).filter(Boolean);
      else lista = [];

      if (typeof produtos !== 'undefined') produtos = lista;
      try { localStorage.setItem('cardapio_caicara_cache', JSON.stringify(lista)); } catch (_) {}

      if (typeof renderizarTabsG === 'function') renderizarTabsG();
      if (typeof filtrarCardapioG === 'function') filtrarCardapioG('favoritos');
      else if (typeof renderizarProdutosG === 'function') renderizarProdutosG();

      ultimoUidCarregado = user.uid;
      window.dispatchEvent(new CustomEvent('garcom:cardapio-autenticado', { detail: { uid: user.uid, itens: lista.length } }));
    } catch (erro) {
      console.error('Falha ao recarregar cardápio após autenticação do garçom:', erro);
      ultimoUidCarregado = null;
    } finally {
      carregando = false;
    }
  }

  function iniciar() {
    const firebaseAuth = window.firebase?.auth?.();
    if (!firebaseAuth || typeof firebaseAuth.onAuthStateChanged !== 'function') {
      setTimeout(iniciar, 150);
      return;
    }
    firebaseAuth.onAuthStateChanged(user => {
      if (!usuarioGarcomValido(user)) {
        ultimoUidCarregado = null;
        return;
      }
      setTimeout(() => void recarregarCardapioAutenticado(user), 0);
    });

    const atual = firebaseAuth.currentUser;
    if (usuarioGarcomValido(atual)) void recarregarCardapioAutenticado(atual);
  }

  window.GarcomCardapioAuthReconnect = Object.freeze({ recarregar: () => recarregarCardapioAutenticado(window.firebase?.auth?.().currentUser) });
  iniciar();
})();
