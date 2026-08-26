import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("proteção de acesso direto ao PDV", () => {
  it("redireciona /pdv/index.html para a rota canônica protegida", () => {
    const firebase = JSON.parse(read("firebase.json"));
    const redirects = firebase?.hosting?.redirects || [];
    expect(redirects).toContainEqual({
      source: "/pdv/index.html",
      destination: "/pdv/",
      type: 302,
    });
  });

  it("força recarga quando o primeiro service worker assume o PDV", () => {
    const sw = read("client/public/pdv/service-worker.js");
    expect(sw).toContain("self.clients.claim()");
    expect(sw).toContain("self.clients.matchAll({ type: 'window', includeUncontrolled: true })");
    expect(sw).toContain("client.navigate(client.url)");
  });
});
