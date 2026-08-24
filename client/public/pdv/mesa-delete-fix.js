/* Correção segura para limpar mesa no Firebase: remove o nó remoto em vez de gravar objeto vazio. */
(() => {
  const mesaVaziaLocal = () => ({ itens: [], cliente: '', abertura: null });

  window.confirmarLimpezaMesa = async function confirmarLimpezaMesaRemovendoNoServidor() {
    const numeroMesa = mesaLimpezaPendente;
    if (!numeroMesa || !mesas[numeroMesa]) return cancelarLimpezaMesa();

    cancelarLimpezaMesa();
    const mesaLimpa = mesaVaziaLocal();

    try {
      await db.ref(`mesas/${numeroMesa}`).remove();
      mesas[numeroMesa] = mesaLimpa;
      localStorage.setItem('mesas_abertas_caicara_cache', JSON.stringify(mesas));

      if (mesaAtualSelecionada === numeroMesa) {
        const nome = document.getElementById('nome-cliente');
        if (nome) nome.value = '';
        if (typeof renderizarComanda === 'function') renderizarComanda();
      }

      if (typeof gerarMesas === 'function') gerarMesas();
      if (typeof atualizarPainelDiario === 'function') atualizarPainelDiario();
      if (typeof registrarAuditoriaPdv === 'function') {
        registrarAuditoriaPdv('limpar_mesa', { mesa: numeroMesa, modo: 'remove' });
      }
    } catch (erro) {
      console.error('Falha ao remover mesa no Firebase:', erro);
      const codigo = erro && erro.code ? ` (${erro.code})` : '';
      alert(`Não foi possível limpar a mesa no servidor${codigo}.`);
    }
  };
})();
