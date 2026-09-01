import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("sincronizacao autenticada das mesas no Garcom", () => {
  it("reconecta /mesas somente para a conta real do garcom", () => {
    const code = read("client/public/garcom/mesas-auth-reconnect.js");
    expect(code).toContain("auth.onAuthStateChanged(user => void conectar(user))");
    expect(code).toContain("database.ref('mesas')");
    expect(code).toContain("garcom@acesso.joaocaicara.app");
    expect(code).toContain("!user.isAnonymous");
    expect(code).toContain("mesas = atualizadas");
    expect(code).toContain("renderizarMesasG()");
  });

  it("recupera listener cancelado sem apagar o ultimo estado conhecido", () => {
    const code = read("client/public/garcom/mesas-auth-reconnect.js");
    expect(code).toContain("RETRY_INICIAL_MS = 500");
    expect(code).toContain("RETRY_MAX_MS = 8000");
    expect(code).toContain("user.getIdToken()");
    expect(code).toContain("limparListener();");
    expect(code).toContain("agendarRetry();");
    expect(code).toContain("🟠 reconectando mesas");
    expect(code).toContain("window.addEventListener('online'");
    expect(code).toContain("window.addEventListener('focus'");
    expect(code).toContain("document.addEventListener('visibilitychange'");
    expect(code).not.toContain("mesas = normalizar(null)");
  });

  it("carrega a reconexao de mesas depois do login compartilhado", () => {
    const sw = read("client/public/garcom/service-worker.js");
    const login = sw.indexOf("shared-login.js?v=19");
    const mesas = sw.indexOf("<script src=\"/garcom/mesas-auth-reconnect.js?v=38\"");
    expect(login).toBeGreaterThanOrEqual(0);
    expect(mesas).toBeGreaterThan(login);
    expect(sw).toContain("/garcom/mesas-auth-reconnect.js?v=38");
    expect(sw).toContain("replaceAll('<script src=\"/garcom/mesas-auth-reconnect.js?v=37\"></script>', '')");
  });

  it("remove o bootstrap anonimo da pagina controlada pelo service worker", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("firebase.auth().signInAnonymously().catch((erro)");
    expect(sw).toContain("A autenticação operacional do Garçom é feita somente pela conta real compartilhada");
  });
});
