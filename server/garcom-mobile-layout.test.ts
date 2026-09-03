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

  it("mantém uma coluna compacta e legível em celulares comuns", () => {
    expect(css).toContain("grid-template-columns:1fr!important");
    expect(css).toContain("min-height:108px!important");
    expect(css).toContain("font-size:.96rem!important");
    expect(css).toContain("font-size:1.08rem!important");
    expect(css).toContain("justify-content:flex-start!important");
  });

  it("usa duas colunas apenas em larguras móveis maiores", () => {
    expect(css).toContain("@media(min-width:560px) and (max-width:600px)");
    expect(css).toContain("grid-template-columns:repeat(2,minmax(0,1fr))!important");
    expect(css).toContain("min-height:116px!important");
  });

  it("mantém ações de observação e meio prato com área de toque confortável", () => {
    expect(css).toContain(".menu-opt-actions{");
    expect(css).toContain("min-height:34px!important");
    expect(css).toContain("padding:7px 10px!important");
  });
});
