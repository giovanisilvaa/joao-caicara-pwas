/* Camada consolidada de segurança do PDV: limpeza de mesa e backup compatível com as regras do Firebase. */
(() => {
  const mesaVaziaLocal = () => ({ itens: [], cliente: '', abertura: null });
  const CAMINHOS_BACKUP_SEGUROS = ['mesas', 'vendas', 'pedidosProducao', 'cardapio', 'auditoria', 'cancelamentos', 'fechamentosCaixa'];
  const statusBackup = () => document.getElementById('backup-status');

  window.confirmarLimpezaMesa = async function confirmarLimpezaMesaRemovendoNoServidor() {
    const numeroMesa = mesaLimpezaPendente;
    if (!numeroMesa || !mesas[numeroMesa]) return cancelarLimpezaMesa();
    cancelarLimpezaMesa();

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

    if (typeof registrarAuditoriaPdv === 'function') {
      Promise.resolve(registrarAuditoriaPdv('limpar_mesa', { mesa: numeroMesa, modo: 'remove' }))
        .catch(erro => console.warn('Falha ao registrar auditoria da limpeza:', erro));
    }
  };

  window.exportarBackupFirebase = async function exportarBackupFirebaseSeguro() {
    const status = statusBackup();
    if (status) status.innerText = 'Lendo dados do Firebase...';
    try {
      const entradas = await Promise.all(
        CAMINHOS_BACKUP_SEGUROS.map(async caminho => [caminho, (await db.ref(caminho).once('value')).val()])
      );
      const pacote = {
        tipo: 'joao-caicara-firebase-backup',
        versao: 2,
        exportadoEm: new Date().toISOString(),
        caminhos: Object.fromEntries(entradas),
        observacao: 'configuracoes não incluído por ser um caminho protegido do sistema'
      };
      const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `joao-caicara-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      if (typeof registrarAuditoriaPdv === 'function') {
        Promise.resolve(registrarAuditoriaPdv('exportar_backup', { caminhos: CAMINHOS_BACKUP_SEGUROS, versao: 2 })).catch(console.error);
      }
      if (status) status.innerText = 'Backup exportado com sucesso. Guarde o arquivo em local seguro.';
    } catch (erro) {
      console.error('Falha ao exportar backup:', erro);
      if (status) status.innerText = 'Não foi possível exportar o backup. Verifique a conexão e tente novamente.';
    }
  };

  window.restaurarBackupFirebase = async function restaurarBackupFirebaseSeguro() {
    const status = statusBackup();
    const input = document.querySelector('#modal-backup input[type="file"]');
    const arquivo = input && input.files ? input.files[0] : null;
    if (!arquivo) {
      if (status) status.innerText = 'Selecione um arquivo de backup primeiro.';
      return;
    }
    if (status) status.innerText = 'Validando arquivo...';
    try {
      const pacote = JSON.parse(await arquivo.text());
      if (pacote?.tipo !== 'joao-caicara-firebase-backup' || !pacote.caminhos || typeof pacote.caminhos !== 'object') {
        throw new Error('Formato de backup inválido');
      }
      const atualizacoes = {};
      CAMINHOS_BACKUP_SEGUROS.forEach(caminho => {
        if (Object.prototype.hasOwnProperty.call(pacote.caminhos, caminho)) atualizacoes[caminho] = pacote.caminhos[caminho];
      });
      if (!Object.keys(atualizacoes).length) throw new Error('Backup sem caminhos restauráveis');
      await db.ref('/').update(atualizacoes);
      if (typeof registrarAuditoriaPdv === 'function') {
        Promise.resolve(registrarAuditoriaPdv('restaurar_backup', {
          caminhos: Object.keys(atualizacoes),
          exportadoEm: pacote.exportadoEm || null,
          versao: pacote.versao || 1
        })).catch(console.error);
      }
      if (status) status.innerText = 'Restauração concluída. Recarregue o PDV para atualizar a tela.';
    } catch (erro) {
      console.error('Falha ao restaurar backup:', erro);
      if (status) status.innerText = `Não foi possível restaurar o backup${erro?.message ? `: ${erro.message}` : '.'}`;
    }
  };
})();
