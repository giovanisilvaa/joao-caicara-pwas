import { describe, expect, it } from "vitest";
import fs from "node:fs";

const css = fs.readFileSync("client/public/pdv/modern-hybrid.css", "utf8");

describe("layout do PDV em telas baixas", () => {
  it("ativa um breakpoint específico sem afetar telas grandes normais", () => {
    expect(css).toContain("@media (min-width:1101px) and (max-height:850px)");
    expect(css).toContain("width:clamp(365px,29vw,400px)!important");
  });

  it("reduz somente cabeçalho e vazio da comanda para preservar área útil", () => {
    expect(css).toContain("font-size:1.05rem!important");
    expect(css).toContain("min-height:120px!important");
    expect(css).toContain("#order-items .pdv-cmd-empty");
    expect(css).toContain("font-size:.78rem!important");
  });

  it("dá espaço suficiente ao rodapé sem esconder ações", () => {
    expect(css).toContain("max-height:330px!important");
    expect(css).toContain("overflow-y:auto!important");
    expect(css).toContain("grid-template-columns:repeat(2,minmax(0,1fr))!important");
    expect(css).toContain("min-height:36px!important");
    expect(css).toContain("white-space:normal!important");
  });

  it("mantém o fechamento destacado e legível", () => {
    expect(css).toContain(".action-buttons .btn-close");
    expect(css).toContain("min-height:40px!important");
    expect(css).toContain("font-size:.72rem!important");
  });

  it("possui ajuste adicional para alturas muito pequenas", () => {
    expect(css).toContain("@media (min-width:1101px) and (max-height:720px)");
    expect(css).toContain("max-height:315px!important");
  });
});
