import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("botao Gerenciar Cardapio do PDV", () => {
  it("destaca o botao de gerenciamento do cardapio sem afetar os demais", () => {
    const css = read("client/public/pdv/menu-admin-cta.css");
    expect(css).toContain('.btn-history[onclick="abrirModalCardapio()"]');
    expect(css).toContain("color: var(--primary");
    expect(css).toContain("background: linear-gradient");
    expect(css).toContain("box-shadow");
    expect(css).toContain("min-height: 38px");
  });

  it("carrega a camada visual pelo service worker com versao propria", () => {
    const sw = read("client/public/pdv/service-worker.js");
    expect(sw).toContain("/pdv/menu-admin-cta.css?v=34");
    expect(sw).toContain('<link rel="stylesheet" href="/pdv/menu-admin-cta.css?v=34">');
  });
});
