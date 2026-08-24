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
    origemPerfil: 'compatibilidade',
    sessao: {
      authReady: false,
      uid: null,
      isAnonymous: null,
      origem: 'aguardando-firebase'
    }
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

  function identificarSessaoFirebase(user) {
    estado.sessao.authReady = true;
    estado.sessao.uid = user?.uid || null;
    estado.sessao.isAnonymous = typeof user?.isAnonymous === 'boolean' ? user.isAnonymous : null;
    estado.sessao.origem = user ? 'firebase-auth' : 'firebase-sem-usuario';
    window.dispatchEvent(new CustomEvent('pdv:sessao-identificada', {
      detail: {
        uid: estado.sessao.uid,
        isAnonymous: estado.sessao.isAnonymous,
        perfil: estado.perfilAtual,
        modoCompatibilidade: estado.modoCompatibilidade
      }
    }));
  }

  function conectarSessaoFirebase() {
    try {
      const auth = window.firebase?.auth?.();
      if (!auth || typeof auth.onAuthStateChanged !== 'function') {
        estado.sessao.origem = 'firebase-indisponivel';
        return false;
      }
      auth.onAuthStateChanged(
        user => identificarSessaoFirebase(user),
        erro => {
          console.warn('Não foi possível identificar a sessão Firebase do PDV:', erro);
          estado.sessao.authReady = true;
          estado.sessao.origem = 'firebase-erro';
        }
      );
      return true;
    } catch (erro) {
      console.warn('Falha não bloqueante ao conectar controle de acesso do PDV ao Firebase:', erro);
      estado.sessao.origem = 'firebase-erro';
      return false;
    }
  }

  function aplicarPerfilAutenticado(perfil, origem = 'firebase-perfil') {
    if (!perfilValido(perfil)) return false;
    definirPerfil(perfil, origem);
    return true;
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
    identificarSessaoFirebase,
    conectarSessaoFirebase,
    aplicarPerfilAutenticado,
    ativarControleEstrito,
    get perfilAtual() { return estado.perfilAtual; },
    get modoCompatibilidade() { return estado.modoCompatibilidade; },
    get sessao() { return { ...estado.sessao }; }
  });

  document.documentElement.dataset.perfilAcesso = estado.perfilAtual;
  conectarSessaoFirebase();
})();
