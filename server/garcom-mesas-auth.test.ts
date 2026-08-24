import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("sincronizacao autenticada das mesas no Garcom", () => {
  it("reconecta /mesas somente para a conta real do garcom", () => {
    const code = read("client/public/garcom/mesas-auth-reconnect.js");
    expect(code).toContain("firebase.auth().onAuthStateChanged(conectar)");
    expect(code).toContain("firebase.database().ref('mesas')");
    expect(code).toContain("garcom@acesso.joaocaicara.app");
    expect(code).toContain("mesas = atualizadas");
    expect(code).toContain("renderizarMesasG()");
  });

  it("carrega a reconexao de mesas depois do login compartilhado", () => {
    const sw = read("client/public/garcom/service-worker.js");
    const login = sw.indexOf("shared-login.js?v=17");
    const mesas = sw.indexOf("<script src=\"/garcom/mesas-auth-reconnect.js?v=37\"");
    expect(login).toBeGreaterThanOrEqual(0);
    expect(mesas).toBeGreaterThan(login);
    expect(sw).toContain("/garcom/mesas-auth-reconnect.js?v=37");
  });
});
