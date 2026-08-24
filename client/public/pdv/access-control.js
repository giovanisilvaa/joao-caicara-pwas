/* Base de controle de acesso do PDV. Modo compatibilidade: não bloqueia o fluxo atual. */
(() => {
  const PERFIS = Object.freeze({
    garcom: Object.freeze([
      'mesas.visualizar',
      'mesas.abrir',
      'mesas.editar',
      'mesas.transferir',
      'pedidos.lancar',
      'producao.enviar'
    ]),
    caixa: Object.freeze([
      'mesas.visualizar',
      'mesas.abrir',
      'mesas.editar',
      'mesas.transferir',
      'pedidos.lancar',
      'producao.enviar',
      'conta.dividir',
      'conta.fechar',
      'pagamentos.receber',
      'vendas.visualizar'
    ]),
    administrador: Object.freeze(['*'])
  });

  const estado = {
    modoCompatibilidade: true,
    perfilAtual: 'administrador',
    origemPerfil: 'compatibilidade'
  };

  const perfilValido = perfil => Object.prototype.hasOwnProperty.call(PERFIS, perfil);
  const permissoesDoPerfil = perfil => PERFIS[perfilValido(perfil) ? perfil : 'garcom'];

  function pode(permissao) {
    if (estado.modoCompatibilidade) return true;
    const permissoes = permissoesDoPerfil(estado.perfilAtual);
    return permissoes.includes('*') || permissoes.includes(permissao);
  }

  function definirPerfil(perfil, origem = 'aplicacao') {
    if (!perfilValido(perfil)) throw new Error(`Perfil inválido: ${perfil}`);
    estado.perfilAtual = perfil;
    estado.origemPerfil = origem;
    document.documentElement.dataset.perfilAcesso = perfil;
    window.dispatchEvent(new CustomEvent('pdv:perfil-alterado', { detail: { perfil, origem } }));
  }

  function ativarControleEstrito() {
    estado.modoCompatibilidade = false;
    window.dispatchEvent(new CustomEvent('pdv:controle-acesso-ativado', { detail: { perfil: estado.perfilAtual } }));
  }

  window.PdvAcesso = Object.freeze({
    PERFIS,
    estado,
    pode,
    definirPerfil,
    ativarControleEstrito,
    get perfilAtual() { return estado.perfilAtual; },
    get modoCompatibilidade() { return estado.modoCompatibilidade; }
  });

  document.documentElement.dataset.perfilAcesso = estado.perfilAtual;
})();
