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

  it("mantem identificacao individual por nome com a mesma conta da equipe", () => {
    const login = read("client/public/garcom/shared-login.js");
    expect(login).toContain("garcom-login-name");
    expect(login).toContain("sessionStorage");
    expect(login).toContain("funcionarioId: user.uid");
    expect(login).toContain("nome,");
    expect(login).toContain("compartilhado: true");
  });

  it("forca carregamento da versao segura do login", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("/garcom/shared-login.js?v=17");
  });
});
