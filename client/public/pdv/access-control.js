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

  const DATABASE_URL = 'https://joaocaicaratradicao-default-rtdb.firebaseio.com';

  const estado = {
    modoCompatibilidade: true,
    perfilAtual: 'administrador',
    origemPerfil: 'compatibilidade',
    sessao: {
      authReady: false,
      uid: null,
      isAnonymous: null,
      origem: 'aguardando-firebase'
    },
    perfilRemoto: {
      carregado: false,
      encontrado: null,
      origem: 'nao-consultado',
      caminho: null
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

  async function lerPerfilViaRest(uid) {
    const auth = window.firebase?.auth?.();
    const user = auth?.currentUser || null;
    if (!user || user.uid !== uid || typeof user.getIdToken !== 'function') throw new Error('Sessão Firebase ainda não corresponde ao UID consultado');
    const token = await user.getIdToken(true);
    const resposta = await fetch(`${DATABASE_URL}/perfisAcesso/${encodeURIComponent(uid)}.json`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resposta.ok) throw new Error(`Realtime Database respondeu HTTP ${resposta.status}`);
    return resposta.json();
  }

  async function lerPerfilViaSdk(uid) {
    const database = window.firebase?.database?.();
    if (!database) throw new Error('Firebase Database indisponível');
    const snapshot = await database.ref(`perfisAcesso/${uid}`).once('value');
    return snapshot.val();
  }

  async function consultarPerfilRemoto(uid) {
    if (!uid) return null;
    estado.perfilRemoto.carregado = false;
    estado.perfilRemoto.encontrado = null;
    estado.perfilRemoto.origem = 'consultando';
    estado.perfilRemoto.caminho = `perfisAcesso/${uid}`;
    try {
      let valor;
      let origemLeitura = 'firebase-rest';
      try {
        valor = await lerPerfilViaRest(uid);
      } catch (erroRest) {
        console.warn('Leitura REST do perfil falhou; tentando SDK:', erroRest);
        valor = await lerPerfilViaSdk(uid);
        origemLeitura = 'firebase-sdk';
      }
      if (estado.sessao.uid !== uid) return null;
      const candidato = typeof valor === 'string' ? valor : valor?.perfil;
      estado.perfilRemoto.carregado = true;
      estado.perfilRemoto.encontrado = perfilValido(candidato) ? candidato : null;
      estado.perfilRemoto.origem = valor == null
        ? `${origemLeitura}-sem-cadastro`
        : (estado.perfilRemoto.encontrado ? `${origemLeitura}-database` : `${origemLeitura}-perfil-invalido`);
      window.dispatchEvent(new CustomEvent('pdv:perfil-remoto-consultado', {
        detail: {
          uid,
          perfilEncontrado: estado.perfilRemoto.encontrado,
          origem: estado.perfilRemoto.origem,
          caminho: estado.perfilRemoto.caminho,
          aplicado: false,
          modoCompatibilidade: estado.modoCompatibilidade
        }
      }));
      return estado.perfilRemoto.encontrado;
    } catch (erro) {
      if (estado.sessao.uid !== uid) return null;
      console.warn('Não foi possível consultar o perfil remoto do PDV; acesso atual foi preservado:', erro);
      estado.perfilRemoto.carregado = true;
      estado.perfilRemoto.encontrado = null;
      estado.perfilRemoto.origem = 'firebase-erro';
      return null;
    }
  }

  function identificarSessaoFirebase(user) {
    estado.sessao.authReady = true;
    estado.sessao.uid = user?.uid || null;
    estado.sessao.isAnonymous = typeof user?.isAnonymous === 'boolean' ? user.isAnonymous : null;
    estado.sessao.origem = user ? 'firebase-auth' : 'firebase-sem-usuario';
    if (user?.uid) {
      consultarPerfilRemoto(user.uid);
    } else {
      estado.perfilRemoto.carregado = true;
      estado.perfilRemoto.encontrado = null;
      estado.perfilRemoto.origem = 'sem-usuario';
      estado.perfilRemoto.caminho = null;
    }
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
    consultarPerfilRemoto,
    aplicarPerfilAutenticado,
    ativarControleEstrito,
    get perfilAtual() { return estado.perfilAtual; },
    get modoCompatibilidade() { return estado.modoCompatibilidade; },
    get sessao() { return { ...estado.sessao }; },
    get perfilRemoto() { return { ...estado.perfilRemoto }; }
  });

  document.documentElement.dataset.perfilAcesso = estado.perfilAtual;
  conectarSessaoFirebase();
})();
