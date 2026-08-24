/* Login administrativo do PDV. A senha nunca é armazenada no código. */
(() => {
  const LOGIN_ADMIN = 'adm';
  const EMAIL_ADMIN = 'adm@acesso.joaocaicara.app';
  const ESTADO = { autenticando: false };

  const auth = () => window.firebase?.auth?.();
  const usuarioEhAdmin = user => Boolean(user && !user.isAnonymous && String(user.email || '').toLowerCase() === EMAIL_ADMIN);

  function criarEstilos() {
    if (document.getElementById('pdv-admin-login-style')) return;
    const style = document.createElement('style');
    style.id = 'pdv-admin-login-style';
    style.textContent = `
      #pdv-admin-login-overlay{position:fixed;inset:0;z-index:5000;background:linear-gradient(180deg,rgba(15,76,92,.98),rgba(19,60,74,.99));display:flex;align-items:center;justify-content:center;padding:18px}
      #pdv-admin-login-card{width:min(400px,100%);background:#fff;border-radius:18px;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.36);color:#173d45}
      #pdv-admin-login-card h2{font-family:Georgia,serif;color:#0f4c5c;margin:0 0 6px;font-size:1.55rem}
      #pdv-admin-login-card p{font-size:.88rem;color:#617174;line-height:1.45;margin:0 0 18px}
      #pdv-admin-login-card label{display:block;font-size:.78rem;font-weight:800;margin:10px 0 5px;color:#123e48}
      #pdv-admin-login-card input{width:100%;padding:12px;border:1px solid #d8e2df;border-radius:10px;font-size:1rem;background:#fff}
      #pdv-admin-login-card input[readonly]{background:#f3f6f5;color:#52666b}
      #pdv-admin-login-msg{min-height:20px;margin-top:10px;font-size:.78rem;font-weight:700;color:#c05036}
      #pdv-admin-login-actions{display:flex;margin-top:16px}
      #pdv-admin-login-actions button{width:100%;border:0;border-radius:10px;padding:12px 10px;font-weight:800;cursor:pointer}
      #pdv-admin-login-submit{background:#0f4c5c;color:#fff}
      #pdv-admin-login-card.is-loading #pdv-admin-login-submit{opacity:.65;pointer-events:none}
      #pdv-admin-sair{border:0;border-radius:999px;padding:6px 9px;font-size:.68rem;font-weight:800;cursor:pointer;background:rgba(255,255,255,.15);color:#fff}
    `;
    document.head.appendChild(style);
  }

  function atualizarIndicador() {
    const user = auth()?.currentUser || null;
    const el = document.getElementById('usuario-logado-pdv');
    if (el) {
      el.textContent = usuarioEhAdmin(user) ? 'Administrador' : 'Bloqueado';
      el.title = usuarioEhAdmin(user) ? 'Sessão administrativa autenticada pelo Firebase Auth' : 'PDV aguardando autenticação administrativa';
    }
    if (usuarioEhAdmin(user)) garantirBotaoSair();
  }

  function garantirBotaoSair() {
    const usuario = document.getElementById('usuario-logado-pdv');
    if (!usuario || document.getElementById('pdv-admin-sair')) return;
    const botao = document.createElement('button');
    botao.id = 'pdv-admin-sair';
    botao.type = 'button';
    botao.textContent = 'Sair';
    botao.title = 'Bloquear o PDV';
    botao.addEventListener('click', sair);
    usuario.insertAdjacentElement('afterend', botao);
  }

  function esconderLogin() {
    document.getElementById('pdv-admin-login-overlay')?.remove();
    atualizarIndicador();
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
    return firebaseAuth.signInWithEmailAndPassword(EMAIL_ADMIN, senha);
  }

  function mostrarLogin() {
    if (document.getElementById('pdv-admin-login-overlay')) return;
    criarEstilos();
    const overlay = document.createElement('div');
    overlay.id = 'pdv-admin-login-overlay';
    overlay.innerHTML = `
      <div id="pdv-admin-login-card" role="dialog" aria-modal="true" aria-labelledby="pdv-admin-login-title">
        <h2 id="pdv-admin-login-title">Acesso Administrativo</h2>
        <p>Entre para liberar o PDV/Caixa e as funções administrativas.</p>
        <label for="pdv-admin-login-user">Usuário</label>
        <input id="pdv-admin-login-user" value="${LOGIN_ADMIN}" readonly autocomplete="username">
        <label for="pdv-admin-login-password">Senha</label>
        <input id="pdv-admin-login-password" type="password" inputmode="numeric" autocomplete="current-password" placeholder="Digite a senha do administrador">
        <div id="pdv-admin-login-msg" aria-live="polite"></div>
        <div id="pdv-admin-login-actions">
          <button id="pdv-admin-login-submit" type="button">Entrar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const senhaEl = document.getElementById('pdv-admin-login-password');
    const msgEl = document.getElementById('pdv-admin-login-msg');
    const card = document.getElementById('pdv-admin-login-card');
    const submit = document.getElementById('pdv-admin-login-submit');

    async function enviar() {
      if (ESTADO.autenticando) return;
      const senha = String(senhaEl?.value || '');
      if (senha.length < 6) {
        msgEl.textContent = 'Digite a senha do administrador.';
        senhaEl?.focus();
        return;
      }
      ESTADO.autenticando = true;
      card?.classList.add('is-loading');
      submit.textContent = 'Entrando...';
      msgEl.textContent = '';
      try {
        const credencial = await tentarEntrar(senha);
        if (!usuarioEhAdmin(credencial?.user)) {
          await auth()?.signOut?.();
          throw new Error('Conta autenticada não é a conta administrativa esperada');
        }
        if (window.PdvAcesso?.aplicarPerfilAutenticado) window.PdvAcesso.aplicarPerfilAutenticado('administrador', 'firebase-auth-adm');
        esconderLogin();
      } catch (erro) {
        console.warn('Falha no login administrativo do PDV:', erro);
        msgEl.textContent = mensagemErro(erro);
      } finally {
        ESTADO.autenticando = false;
        card?.classList.remove('is-loading');
        submit.textContent = 'Entrar';
      }
    }

    submit?.addEventListener('click', enviar);
    senhaEl?.addEventListener('keydown', event => { if (event.key === 'Enter') enviar(); });
    setTimeout(() => senhaEl?.focus(), 50);
  }

  async function sair() {
    try { await auth()?.signOut?.(); } catch (_) {}
    document.getElementById('pdv-admin-sair')?.remove();
    atualizarIndicador();
    mostrarLogin();
  }

  function iniciar() {
    const firebaseAuth = auth();
    if (!firebaseAuth || typeof firebaseAuth.onAuthStateChanged !== 'function') {
      setTimeout(iniciar, 150);
      return;
    }
    firebaseAuth.onAuthStateChanged(user => {
      atualizarIndicador();
      if (usuarioEhAdmin(user)) {
        if (window.PdvAcesso?.aplicarPerfilAutenticado) window.PdvAcesso.aplicarPerfilAutenticado('administrador', 'firebase-auth-adm');
        esconderLogin();
      } else {
        mostrarLogin();
      }
    });
    atualizarIndicador();
    if (!usuarioEhAdmin(firebaseAuth.currentUser)) mostrarLogin();
  }

  window.PdvAdminLogin = Object.freeze({
    login: LOGIN_ADMIN,
    emailInterno: EMAIL_ADMIN,
    mostrarLogin,
    sair,
    get autenticado() { return usuarioEhAdmin(auth()?.currentUser); },
    get uid() { return usuarioEhAdmin(auth()?.currentUser) ? auth().currentUser.uid : null; }
  });

  iniciar();
})();
