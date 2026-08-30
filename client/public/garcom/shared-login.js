/* Login compartilhado do Garçom. A senha nunca é armazenada no código. */
(() => {
  const LOGIN_COMPARTILHADO = 'garcom';
  const EMAIL_FIREBASE = 'garcom@acesso.joaocaicara.app';
  const CHAVE_NOME_SESSAO = 'joao_caicara_garcom_nome_sessao';
  const CHAVE_ENTRADA_SESSAO = 'joao_caicara_garcom_entrada_sessao';
  const ESTADO = {
    autenticando: false,
    entradaEm: Date.now()
  };

  const auth = () => window.firebase?.auth?.();

  function limparNome(nome) {
    return String(nome || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  }

  function nomeDaSessao() {
    try {
      const persistido = limparNome(localStorage.getItem(CHAVE_NOME_SESSAO));
      if (persistido) return persistido;
    } catch (_) {}
    try {
      const legado = limparNome(sessionStorage.getItem(CHAVE_NOME_SESSAO));
      if (legado) {
        try { localStorage.setItem(CHAVE_NOME_SESSAO, legado); } catch (_) {}
        try { sessionStorage.removeItem(CHAVE_NOME_SESSAO); } catch (_) {}
        return legado;
      }
    } catch (_) {}
    return '';
  }

  function entradaDaSessao() {
    try {
      const valor = Number(localStorage.getItem(CHAVE_ENTRADA_SESSAO));
      if (Number.isFinite(valor) && valor > 0) return valor;
    } catch (_) {}
    return Date.now();
  }

  function salvarNomeDaSessao(nome) {
    const limpo = limparNome(nome);
    if (!limpo) return false;
    const entradaEm = Date.now();
    let persistido = false;
    try {
      localStorage.setItem(CHAVE_NOME_SESSAO, limpo);
      localStorage.setItem(CHAVE_ENTRADA_SESSAO, String(entradaEm));
      persistido = true;
    } catch (_) {}
    if (!persistido) {
      try {
        sessionStorage.setItem(CHAVE_NOME_SESSAO, limpo);
        persistido = true;
      } catch (_) {}
    }
    ESTADO.entradaEm = entradaEm;
    return persistido;
  }

  function removerNomeDaSessao() {
    try {
      localStorage.removeItem(CHAVE_NOME_SESSAO);
      localStorage.removeItem(CHAVE_ENTRADA_SESSAO);
    } catch (_) {}
    try { sessionStorage.removeItem(CHAVE_NOME_SESSAO); } catch (_) {}
  }

  function usuarioEhCompartilhado(user) {
    return Boolean(user && !user.isAnonymous && String(user.email || '').toLowerCase() === EMAIL_FIREBASE);
  }

  async function configurarPersistenciaExpediente() {
    const firebaseAuth = auth();
    const modoLocal = window.firebase?.auth?.Auth?.Persistence?.LOCAL;
    if (!firebaseAuth || !modoLocal || typeof firebaseAuth.setPersistence !== 'function') {
      throw new Error('Persistência local do Firebase Auth indisponível');
    }
    await firebaseAuth.setPersistence(modoLocal);
    return true;
  }

  async function prepararPersistenciaExpediente() {
    try {
      const isolamento = window.FirebaseAuthSessionIsolationReady;
      if (isolamento && typeof isolamento.then === 'function') await isolamento;
      await configurarPersistenciaExpediente();
      return true;
    } catch (erro) {
      console.warn('Não foi possível ativar a persistência do expediente do Garçom:', erro);
      return false;
    }
  }

  function sessaoAtual() {
    const user = auth()?.currentUser || null;
    const nome = nomeDaSessao();
    if (usuarioEhCompartilhado(user) && nome) {
      return {
        funcionarioId: user.uid,
        uid: user.uid,
        login: LOGIN_COMPARTILHADO,
        nome,
        funcao: 'garcom',
        perfil: 'garcom',
        compartilhado: true,
        entradaEm: ESTADO.entradaEm
      };
    }
    return {
      funcionarioId: null,
      uid: user?.uid || null,
      login: 'bloqueado',
      nome: '',
      funcao: 'garcom',
      perfil: 'garcom',
      compartilhado: false,
      entradaEm: ESTADO.entradaEm
    };
  }

  function garantirBotaoSairGarcom() {
    const usuario = document.getElementById('usuario-logado-g');
    if (!usuario || document.getElementById('sair-garcom-g')) return;
    const botao = document.createElement('button');
    botao.id = 'sair-garcom-g';
    botao.type = 'button';
    botao.textContent = 'Sair';
    botao.title = 'Encerrar o expediente e sair deste aparelho';
    botao.style.cssText = 'border:0;border-radius:999px;padding:6px 8px;font-size:.68rem;font-weight:800;cursor:pointer;background:rgba(255,255,255,.15);color:#fff;';
    botao.addEventListener('click', () => sairGarcom());
    usuario.insertAdjacentElement('afterend', botao);
  }

  function instalarIdentidadeOperacional() {
    window.sessaoGarcomAtual = sessaoAtual;
    const user = auth()?.currentUser || null;
    const nome = nomeDaSessao();
    const el = document.getElementById('usuario-logado-g');
    if (el) {
      el.textContent = usuarioEhCompartilhado(user) && nome ? nome : 'Bloqueado';
      el.title = usuarioEhCompartilhado(user) && nome ? `Garçom: ${nome}` : 'Garçom precisa entrar com nome e senha da equipe';
    }
    if (usuarioEhCompartilhado(user) && nome) garantirBotaoSairGarcom();
    else document.getElementById('sair-garcom-g')?.remove();
  }

  function criarEstilos() {
    if (document.getElementById('garcom-login-style')) return;
    const style = document.createElement('style');
    style.id = 'garcom-login-style';
    style.textContent = `
      #garcom-login-overlay{position:fixed;inset:0;z-index:4000;background:linear-gradient(180deg,rgba(11,89,99,.97),rgba(18,62,72,.98));display:flex;align-items:center;justify-content:center;padding:18px}
      #garcom-login-card{width:min(390px,100%);background:#fff;border-radius:18px;padding:22px;box-shadow:0 22px 60px rgba(0,0,0,.32);color:#173d45}
      #garcom-login-card h2{font-family:Georgia,serif;color:#0b5963;margin:0 0 6px}
      #garcom-login-card p{font-size:.88rem;color:#5f7074;margin:0 0 18px;line-height:1.45}
      #garcom-login-card label{display:block;font-size:.78rem;font-weight:800;margin:10px 0 5px;color:#123e48}
      #garcom-login-card input{width:100%;padding:12px;border:1px solid #d8e2df;border-radius:10px;font-size:1rem;background:#fff}
      #garcom-login-actions{display:flex;margin-top:16px}
      #garcom-login-actions button{width:100%;border:0;border-radius:10px;padding:12px 10px;font-weight:800;cursor:pointer}
      #garcom-login-submit{background:#0b5963;color:#fff}
      #garcom-login-msg{min-height:20px;margin-top:10px;font-size:.78rem;font-weight:700;color:#c05036}
      #garcom-login-card.is-loading #garcom-login-submit{opacity:.65;pointer-events:none}
    `;
    document.head.appendChild(style);
  }

  function esconderLogin() {
    document.getElementById('garcom-login-overlay')?.remove();
    instalarIdentidadeOperacional();
  }

  function mensagemErro(erro) {
    const codigo = String(erro?.code || '');
    if (codigo.includes('wrong-password') || codigo.includes('invalid-credential') || codigo.includes('invalid-login-credentials') || codigo.includes('user-not-found')) return 'Usuário ou senha incorretos.';
    if (codigo.includes('too-many-requests')) return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
    if (codigo.includes('network-request-failed')) return 'Sem conexão com o Firebase. Verifique a internet.';
    if (codigo.includes('operation-not-allowed')) return 'O login por senha não está disponível no Firebase.';
    return `Não foi possível entrar (${codigo || 'erro de autenticação'}).`;
  }

  async function tentarEntrar(senha) {
    const firebaseAuth = auth();
    if (!firebaseAuth) throw new Error('Firebase Auth indisponível');
    await configurarPersistenciaExpediente();
    return firebaseAuth.signInWithEmailAndPassword(EMAIL_FIREBASE, senha);
  }

  function mostrarLogin() {
    if (document.getElementById('garcom-login-overlay')) return;
    criarEstilos();
    const overlay = document.createElement('div');
    overlay.id = 'garcom-login-overlay';
    overlay.innerHTML = `
      <div id="garcom-login-card" role="dialog" aria-modal="true" aria-labelledby="garcom-login-title">
        <h2 id="garcom-login-title">Acesso do Garçom</h2>
        <p>Digite seu nome e use a senha única da equipe. O acesso ficará ativo neste aparelho durante o expediente até você tocar em Sair.</p>
        <label for="garcom-login-name">Seu nome</label>
        <input id="garcom-login-name" maxlength="60" autocomplete="name" placeholder="Ex.: João">
        <label for="garcom-login-password">Senha da equipe</label>
        <input id="garcom-login-password" type="password" inputmode="numeric" autocomplete="current-password" placeholder="Digite a senha da equipe">
        <div id="garcom-login-msg" aria-live="polite"></div>
        <div id="garcom-login-actions">
          <button id="garcom-login-submit" type="button">Entrar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const nomeEl = document.getElementById('garcom-login-name');
    const senhaEl = document.getElementById('garcom-login-password');
    const msgEl = document.getElementById('garcom-login-msg');
    const card = document.getElementById('garcom-login-card');
    const submit = document.getElementById('garcom-login-submit');
    if (nomeDaSessao()) nomeEl.value = nomeDaSessao();

    async function enviar() {
      if (ESTADO.autenticando) return;
      const nome = limparNome(nomeEl?.value);
      const senha = String(senhaEl?.value || '');
      if (nome.length < 2) {
        msgEl.textContent = 'Digite seu nome.';
        nomeEl?.focus();
        return;
      }
      if (senha.length < 6) {
        msgEl.textContent = 'Digite a senha da equipe.';
        senhaEl?.focus();
        return;
      }
      ESTADO.autenticando = true;
      card?.classList.add('is-loading');
      submit.textContent = 'Entrando...';
      msgEl.textContent = '';
      try {
        const credencial = await tentarEntrar(senha);
        if (!usuarioEhCompartilhado(credencial?.user)) {
          await auth()?.signOut?.();
          throw new Error('Conta autenticada não é a conta compartilhada esperada');
        }
        salvarNomeDaSessao(nome);
        esconderLogin();
      } catch (erro) {
        console.warn('Falha no login compartilhado do Garçom:', erro);
        msgEl.textContent = mensagemErro(erro);
      } finally {
        ESTADO.autenticando = false;
        card?.classList.remove('is-loading');
        submit.textContent = 'Entrar';
      }
    }

    submit?.addEventListener('click', enviar);
    senhaEl?.addEventListener('keydown', event => { if (event.key === 'Enter') enviar(); });
    setTimeout(() => (nomeEl?.value ? senhaEl : nomeEl)?.focus(), 50);
  }

  async function sairGarcom() {
    removerNomeDaSessao();
    ESTADO.entradaEm = Date.now();
    try { await auth()?.signOut?.(); }
    catch (erro) { console.warn('Não foi possível encerrar a sessão Firebase do Garçom:', erro); }
    instalarIdentidadeOperacional();
    mostrarLogin();
  }

  function trocarGarcom() {
    return sairGarcom();
  }

  async function iniciar() {
    const firebaseAuth = auth();
    if (!firebaseAuth || typeof firebaseAuth.onAuthStateChanged !== 'function') {
      setTimeout(iniciar, 150);
      return;
    }

    ESTADO.entradaEm = entradaDaSessao();
    await prepararPersistenciaExpediente();

    firebaseAuth.onAuthStateChanged(user => {
      instalarIdentidadeOperacional();
      if (usuarioEhCompartilhado(user) && nomeDaSessao()) {
        esconderLogin();
      } else {
        mostrarLogin();
      }
    });
    instalarIdentidadeOperacional();
    if (!usuarioEhCompartilhado(firebaseAuth.currentUser) || !nomeDaSessao()) mostrarLogin();
  }

  window.GarcomLoginCompartilhado = Object.freeze({
    login: LOGIN_COMPARTILHADO,
    emailInterno: EMAIL_FIREBASE,
    sessaoAtual,
    mostrarLogin,
    sair: sairGarcom,
    trocarGarcom,
    prepararPersistenciaExpediente,
    get nomeAtual() { return nomeDaSessao(); },
    get autenticado() { return usuarioEhCompartilhado(auth()?.currentUser) && Boolean(nomeDaSessao()); },
    get uid() { return usuarioEhCompartilhado(auth()?.currentUser) ? auth().currentUser.uid : null; }
  });

  iniciar();
})();
