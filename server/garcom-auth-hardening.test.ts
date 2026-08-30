import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("seguranca do login compartilhado do garcom", () => {
  it("exige conta compartilhada real e nao oferece acesso temporario", () => {
    const login = read("client/public/garcom/shared-login.js");
    expect(login).toContain("LOGIN_COMPARTILHADO = 'garcom'");
    expect(login).toContain("EMAIL_FIREBASE = 'garcom@acesso.joaocaicara.app'");
    expect(login).toContain("signInWithEmailAndPassword");
    expect(login).not.toContain("createUserWithEmailAndPassword");
    expect(login).not.toContain("Acesso temporário");
    expect(login).not.toContain("garcom-login-fallback");
    expect(login).not.toContain("modoTemporario");
    expect(login).toContain("Garçom precisa entrar com nome e senha da equipe");
  });

  it("mantem identificacao individual persistente por nome sem armazenar a senha", () => {
    const login = read("client/public/garcom/shared-login.js");
    expect(login).toContain("garcom-login-name");
    expect(login).toContain("localStorage.setItem(CHAVE_NOME_SESSAO, limpo)");
    expect(login).toContain("CHAVE_ENTRADA_SESSAO");
    expect(login).toContain("funcionarioId: user.uid");
    expect(login).toContain("nome,");
    expect(login).toContain("compartilhado: true");
    expect(login).not.toContain("localStorage.setItem('senha");
    expect(login).not.toContain("sessionStorage.setItem('senha");
  });

  it("usa persistencia local do Firebase apenas no fluxo do garcom", () => {
    const login = read("client/public/garcom/shared-login.js");
    expect(login).toContain("Persistence?.LOCAL");
    expect(login).toContain("firebaseAuth.setPersistence(modoLocal)");
    expect(login).toContain("FirebaseAuthSessionIsolationReady");
    expect(login).toContain("await configurarPersistenciaExpediente()");
  });

  it("sair encerra identidade local e autenticacao Firebase", () => {
    const login = read("client/public/garcom/shared-login.js");
    expect(login).toContain("botao.textContent = 'Sair'");
    expect(login).toContain("async function sairGarcom()");
    expect(login).toContain("removerNomeDaSessao()");
    expect(login).toContain("await auth()?.signOut?.()");
    expect(login).toContain("sair: sairGarcom");
  });

  it("forca carregamento da versao persistente do login e protege o bootstrap anonimo", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("session-v26");
    expect(sw).toContain("/garcom/shared-login.js?v=18");
    expect(sw).toContain("protegerBootstrapAuthGarcom");
    expect(sw).toContain("pararAuthInicialG = firebase.auth().onAuthStateChanged");
    expect(sw).toContain("if (usuarioInicial) return");
  });
});
