/* Isola a sessão Firebase Auth por aba para permitir PDV e Garçom simultâneos no mesmo navegador. */
(() => {
  if (window.FirebaseAuthSessionIsolationReady) return;

  function configurar() {
    const firebaseAuth = window.firebase?.auth?.();
    const sessionMode = window.firebase?.auth?.Auth?.Persistence?.SESSION;
    if (!firebaseAuth || !sessionMode || typeof firebaseAuth.setPersistence !== 'function') {
      window.FirebaseAuthSessionIsolationReady = new Promise(resolve => {
        setTimeout(() => {
          window.FirebaseAuthSessionIsolationReady = null;
          configurar();
          resolve(window.FirebaseAuthSessionIsolationReady);
        }, 80);
      });
      return;
    }

    window.FirebaseAuthSessionIsolationReady = firebaseAuth
      .setPersistence(sessionMode)
      .then(() => {
        window.dispatchEvent(new CustomEvent('firebase-auth-session-isolated'));
        return true;
      })
      .catch(erro => {
        console.error('Não foi possível isolar a sessão Firebase por aba:', erro);
        return false;
      });
  }

  configurar();
})();
