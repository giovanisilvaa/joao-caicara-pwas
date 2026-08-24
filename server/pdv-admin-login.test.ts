import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("login administrativo do PDV", () => {
  it("carrega o login admin antes dos modulos operacionais", () => {
    const sw = read("client/public/pdv/service-worker.js");
    const access = sw.indexOf("/pdv/access-control.js");
    const adminLogin = sw.indexOf("/pdv/admin-login.js");
    const diagnostics = sw.indexOf("/pdv/access-diagnostics.js");
    const sync = sw.indexOf("/pdv/pdv-sync.js");
    expect(access).toBeGreaterThanOrEqual(0);
    expect(adminLogin).toBeGreaterThan(access);
    expect(diagnostics).toBeGreaterThan(adminLogin);
    expect(sync).toBeGreaterThan(diagnostics);
  });

  it("usa credencial digitada e perfil administrador sem criar conta nem liberar fallback", () => {
    const login = read("client/public/pdv/admin-login.js");
    expect(login).toContain("LOGIN_ADMIN = 'adm'");
    expect(login).toContain("EMAIL_ADMIN = 'adm@acesso.joaocaicara.app'");
    expect(login).toContain('type=\"password\"');
    expect(login).toContain("signInWithEmailAndPassword");
    expect(login).not.toContain("createUserWithEmailAndPassword");
    expect(login).toContain("aplicarPerfilAutenticado('administrador'");
    expect(login).toContain("firebase-auth-adm");
    expect(login).toContain("pdv-admin-sair");
    expect(login).not.toContain("Acesso temporário");
    expect(login).not.toContain("fallback-temporario");
    expect(login).not.toContain("pdv-admin-login-fallback");
    expect(login).not.toContain("temporario:");
    expect(login).not.toMatch(/(?:SENHA|PASSWORD|PASS)_[A-Z_]*\s*=\s*['\"][^'\"]+['\"]/i);
  });

  it("diagnostico separa autenticacao admin do perfil remoto", () => {
    const diagnostics = read("client/public/pdv/access-diagnostics.js");
    expect(diagnostics).toContain("Administrador autenticado:");
    expect(diagnostics).toContain("Firebase Auth (conta adm)");
    expect(diagnostics).toContain("Perfil remoto (diagnóstico):");
  });
});
