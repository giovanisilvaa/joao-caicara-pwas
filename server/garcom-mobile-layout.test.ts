import { describe, expect, it } from "vitest";
import fs from "node:fs";

const css = fs.readFileSync("client/public/garcom/waiter-speed.css", "utf8");

describe("layout móvel do Garçom", () => {
  it("mantém o body preso ao viewport dinâmico no celular", () => {
    expect(css).toContain("height:100dvh!important");
    expect(css).toContain("overflow:hidden!important");
    expect(css).toContain("background-attachment:scroll!important");
  });

  it("mantém o painel de pedido dentro do viewport sem rolagem do body", () => {
    expect(css).toMatch(/#tela-pedido\{[\s\S]*?min-height:0!important;[\s\S]*?overflow:hidden!important/);
  });

  it("deixa somente a grade do cardápio rolar", () => {
    expect(css).toMatch(/#grid-produtos-g\{[\s\S]*?flex:1 1 auto!important;[\s\S]*?overflow-y:auto!important/);
    expect(css).toContain("-webkit-overflow-scrolling:touch");
  });

  it("mantém a comanda ancorada no rodapé do painel", () => {
    expect(css).toMatch(/\.comanda-fixa-container\{position:absolute!important;left:0;right:0;bottom:0;z-index:30\}/);
  });

  it("usa uma coluna confortável em todo celular", () => {
    expect(css).toContain("grid-template-columns:1fr!important");
    expect(css).toContain("min-height:126px!important");
    expect(css).toContain("height:auto!important");
    expect(css).toContain("font-size:1.02rem!important");
    expect(css).toContain("font-size:1.12rem!important");
    expect(css).toContain("justify-content:flex-start!important");
    expect(css).not.toContain("@media(min-width:560px) and (max-width:600px)");
    expect(css).not.toContain("grid-template-columns:repeat(2,minmax(0,1fr))!important");
  });

  it("deixa resumo e detalhes do Sushi respirarem dentro dos cards", () => {
    expect(css).toContain("#grid-produtos-g .sushi-card-meta{");
    expect(css).toContain("font-size:.78rem!important");
    expect(css).toContain("#grid-produtos-g .sushi-detail-link{");
    expect(css).toContain("min-height:38px!important");
  });

  it("mantém ações de observação e meio prato com área de toque confortável", () => {
    expect(css).toContain("#grid-produtos-g .menu-opt-actions{");
    expect(css).toContain("min-height:36px!important");
    expect(css).toContain("padding:8px 11px!important");
  });
});
