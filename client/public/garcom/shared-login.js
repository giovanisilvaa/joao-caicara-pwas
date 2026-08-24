/* Login compartilhado do Garçom. A senha nunca é armazenada no código. */
(() => {
  const LOGIN_COMPARTILHADO = 'garcom';
  const EMAIL_FIREBASE = 'garcom@acesso.joaocaicara.app';
  const NOME_COMPARTILHADO = 'Garçom compartilhado';
  const ESTADO = {
    autenticando: false,
    entradaEm: Date.now(),
    modoTemporario: false
  };

  const auth = () => window.firebase?.auth?.();

  function usuarioEhCompartilhado(user) {
    return Boolean(user && !user.isAnonymous && String(user.email || '').toLowerCase() === EMAIL_FIREBASE);
  }

  function sessaoAtual() {
    const user = auth()?.currentUser || null;
    if (usuarioEhCompartilhado(user)) {
      return {
        funcionarioId: user.uid,
        uid: user.uid,
        login: LOGIN_COMPARTILHADO,
        nome: NOME_COMPARTILHADO,
        funcao: 'garcom',
        perfil: 'garcom',
        compartilhado: true,
        entradaEm: ESTADO.entradaEm
      };
    }
    return {
      funcionarioId: user?.uid || 'acesso-temporario',
      uid: user?.uid || null,
      login: 'temporario',
      nome: 'Acesso temporário',
      funcao: 'operacao',
      perfil: 'garcom',
      compartilhado: false,
      entradaEm: ESTADO.entradaEm
    };
  }

  function instalarIdentidadeOperacional() {
    window.sessaoGarcomAtual = sessaoAtual;
    const user = auth()?.currentUser || null;
    const el = document.getElementById('usuario-logado-g');
    if (el) {
      el.textContent = usuarioEhCompartilhado(user) ? 'Garçom' : 'Acesso temporário';
      el.title = usuarioEhCompartilhado(user) ? 'Login compartilhado: garcom' : 'Modo compatibilidade temporário';
    }
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
      #garcom-login-card input[readonly]{background:#f3f6f5;color:#52666b}
      #garcom-login-actions{display:flex;gap:8px;margin-top:16px}
      #garcom-login-actions button{flex:1;border:0;border-radius:10px;padding:12px 10px;font-weight:800;cursor:pointer}
      #garcom-login-submit{background:#0b5963;color:#fff}
      #garcom-login-fallback{background:#e7ecea;color:#345057}
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
    if (codigo.includes('wrong-password') || codigo.includes('invalid-credential') || codigo.includes('invalid-login-credentials')) return 'Senha incorreta.';
    if (codigo.includes('too-many-requests')) return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
    if (codigo.includes('network-request-failed')) return 'Sem conexão com o Firebase. Verifique a internet.';
    if (codigo.includes('operation-not-allowed')) return 'O login por senha ainda precisa ser habilitado no Firebase. Use o acesso temporário por enquanto.';
    if (codigo.includes('weak-password')) return 'A senha precisa ter pelo menos 6 caracteres.';
    return `Não foi possível entrar (${codigo || 'erro de autenticação'}).`;
  }

  async function tentarEntrar(senha) {
    const firebaseAuth = auth();
    if (!firebaseAuth) throw new Error('Firebase Auth indisponível');
    try {
      return await firebaseAuth.signInWithEmailAndPassword(EMAIL_FIREBASE, senha);
    } catch (erroLogin) {
      const codigo = String(erroLogin?.code || '');
      const podeTentarCriar = codigo.includes('user-not-found') || codigo.includes('invalid-credential') || codigo.includes('invalid-login-credentials');
      if (!podeTentarCriar) throw erroLogin;
      try {
        return await firebaseAuth.createUserWithEmailAndPassword(EMAIL_FIREBASE, senha);
      } catch (erroCriacao) {
        const codigoCriacao = String(erroCriacao?.code || '');
        if (codigoCriacao.includes('email-already-in-use')) throw erroLogin;
        throw erroCriacao;
      }
    }
  }

  function mostrarLogin() {
    if (document.getElementById('garcom-login-overlay')) return;
    criarEstilos();
    const overlay = document.createElement('div');
    overlay.id = 'garcom-login-overlay';
    overlay.innerHTML = `
      <div id="garcom-login-card" role="dialog" aria-modal="true" aria-labelledby="garcom-login-title">
        <h2 id="garcom-login-title">Acesso do Garçom</h2>
        <p>Use o login compartilhado da equipe. Futuramente cada garçom poderá ter seu próprio usuário para relatório individual de vendas.</p>
        <label for="garcom-login-user">Usuário</label>
        <input id="garcom-login-user" value="${LOGIN_COMPARTILHADO}" readonly autocomplete="username">
        <label for="garcom-login-password">Senha</label>
        <input id="garcom-login-password" type="password" inputmode="numeric" autocomplete="current-password" placeholder="Digite a senha da equipe">
        <div id="garcom-login-msg" aria-live="polite"></div>
        <div id="garcom-login-actions">
          <button id="garcom-login-fallback" type="button">Acesso temporário</button>
          <button id="garcom-login-submit" type="button">Entrar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const senhaEl = document.getElementById('garcom-login-password');
    const msgEl = document.getElementById('garcom-login-msg');
    const card = document.getElementById('garcom-login-card');
    const submit = document.getElementById('garcom-login-submit');

    async function enviar() {
      if (ESTADO.autenticando) return;
      const senha = String(senhaEl?.value || '');
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
        await tentarEntrar(senha);
        ESTADO.modoTemporario = false;
        ESTADO.entradaEm = Date.now();
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
    document.getElementById('garcom-login-fallback')?.addEventListener('click', () => {
      ESTADO.modoTemporario = true;
      ESTADO.entradaEm = Date.now();
      esconderLogin();
    });
    setTimeout(() => senhaEl?.focus(), 50);
  }

  function iniciar() {
    const firebaseAuth = auth();
    if (!firebaseAuth || typeof firebaseAuth.onAuthStateChanged !== 'function') {
      setTimeout(iniciar, 150);
      return;
    }
    firebaseAuth.onAuthStateChanged(user => {
      instalarIdentidadeOperacional();
      if (usuarioEhCompartilhado(user)) {
        esconderLogin();
      } else if (!ESTADO.modoTemporario) {
        mostrarLogin();
      }
    });
    instalarIdentidadeOperacional();
    if (!usuarioEhCompartilhado(firebaseAuth.currentUser)) mostrarLogin();
  }

  window.GarcomLoginCompartilhado = Object.freeze({
    login: LOGIN_COMPARTILHADO,
    emailInterno: EMAIL_FIREBASE,
    sessaoAtual,
    mostrarLogin,
    get autenticado() { return usuarioEhCompartilhado(auth()?.currentUser); },
    get modoTemporario() { return ESTADO.modoTemporario; }
  });

  iniciar();
})();
