/* Correção segura para limpar mesa no Firebase: remove o nó remoto em vez de gravar objeto vazio. */
(() => {
  const mesaVaziaLocal = () => ({ itens: [], cliente: '', abertura: null });

  window.confirmarLimpezaMesa = async function confirmarLimpezaMesaRemovendoNoServidor() {
    const numeroMesa = mesaLimpezaPendente;
    if (!numeroMesa || !mesas[numeroMesa]) return cancelarLimpezaMesa();

    cancelarLimpezaMesa();

    // O alerta de erro deve refletir apenas a operação remota.
    // Atualizações de interface ficam fora deste try/catch para não gerar falso negativo.
    try {
      await db.ref(`mesas/${numeroMesa}`).remove();
    } catch (erro) {
      console.error('Falha ao remover mesa no Firebase:', erro);
      const codigo = erro && erro.code ? ` (${erro.code})` : '';
      alert(`Não foi possível limpar a mesa no servidor${codigo}.`);
      return;
    }

    const mesaLimpa = mesaVaziaLocal();
    mesas[numeroMesa] = mesaLimpa;

    try {
      localStorage.setItem('mesas_abertas_caicara_cache', JSON.stringify(mesas));
    } catch (erro) {
      console.warn('Não foi possível atualizar o cache local após limpar a mesa:', erro);
    }

    try {
      if (mesaAtualSelecionada === numeroMesa) {
        const nome = document.getElementById('nome-cliente');
        if (nome) nome.value = '';
        if (typeof renderizarComanda === 'function') renderizarComanda();
      }
      if (typeof gerarMesas === 'function') gerarMesas();
      if (typeof atualizarPainelDiario === 'function') atualizarPainelDiario();
    } catch (erro) {
      console.warn('Mesa removida do Firebase, mas houve falha ao atualizar a interface:', erro);
    }

    try {
      if (typeof registrarAuditoriaPdv === 'function') {
        Promise.resolve(registrarAuditoriaPdv('limpar_mesa', { mesa: numeroMesa, modo: 'remove' }))
          .catch(erro => console.warn('Falha ao registrar auditoria da limpeza:', erro));
      }
    } catch (erro) {
      console.warn('Falha ao iniciar auditoria da limpeza:', erro);
    }
  };
})();
