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

  it("isola a persistencia local em uma segunda instancia Firebase", () => {
    const login = read("client/public/garcom/shared-login.js");
    expect(login).toContain("APP_AUTH_EXPEDIENTE = 'garcom-expediente-auth'");
    expect(login).toContain("sdk.app(APP_AUTH_EXPEDIENTE)");
    expect(login).toContain("sdk.initializeApp(config, APP_AUTH_EXPEDIENTE)");
    expect(login).toContain("authExpedienteCache = app.auth()");
    expect(login).toContain("Persistence?.LOCAL");
    expect(login).toContain("firebaseAuth.setPersistence(modoLocal)");
    expect(login).not.toContain("FirebaseAuthSessionIsolationReady");
  });

  it("sair encerra somente a identidade persistente do expediente", () => {
    const login = read("client/public/garcom/shared-login.js");
    expect(login).toContain("botao.textContent = 'Sair'");
    expect(login).toContain("async function sairGarcom()");
    expect(login).toContain("removerNomeDaSessao()");
    expect(login).toContain("await authExpediente()?.signOut?.()");
    expect(login).toContain("sair: sairGarcom");
  });

  it("mantem o Firebase principal do Garcom com a isolacao por sessao existente", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("AUTH_SESSION_ASSET = '/auth-session-isolation.js?v=20'");
    expect(sw).toContain("session-v26");
    expect(sw).toContain("/garcom/shared-login.js?v=18");
    expect(sw).toContain("replaceAll('<script src=\"/garcom/shared-login.js?v=17\"></script>', '')");
    expect(sw).not.toContain("protegerBootstrapAuthGarcom");
  });
});
