import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("corrida de autenticacao do Garcom", () => {
  it("service worker remove o login anonimo antes de executar a pagina controlada", () => {
    const sw = read("client/public/garcom/service-worker.js");
    expect(sw).toContain("html = html.replace(`    firebase.auth().signInAnonymously().catch((erro) => {");
    expect(sw).toContain("A autenticação operacional do Garçom é feita somente pela conta real compartilhada");
  });

  it("mesas nunca tratam usuario anonimo como sessao valida", () => {
    const mesas = read("client/public/garcom/mesas-auth-reconnect.js");
    expect(mesas).toContain("!user.isAnonymous");
    expect(mesas).toContain("garcom@acesso.joaocaicara.app");
    expect(mesas).toContain("user.getIdToken()");
  });
});
