import { describe, expect, it } from "vitest";
import fs from "node:fs";

const css = fs.readFileSync("client/public/pdv/modern-hybrid.css", "utf8");

describe("layout do PDV em telas baixas", () => {
  it("mantém a lista da comanda explicitamente visível e rolável", () => {
    expect(css).toContain("display:block!important");
    expect(css).toContain("visibility:visible!important");
    expect(css).toContain("min-height:180px!important");
    expect(css).toContain("overflow-y:auto!important");
  });

  it("preserva espaço mínimo para os itens em desktops de pouca altura", () => {
    expect(css).toContain("@media (min-width:1101px) and (max-height:800px)");
    expect(css).toContain(".order-items{min-height:160px!important;}");
    expect(css).toContain(".order-footer{max-height:48vh;}");
  });

  it("não permite que o hotfix visual comprima a lista para 120px", () => {
    expect(css).not.toContain("min-height:120px!important");
    expect(css).not.toContain("max-height:330px!important");
    expect(css).not.toContain("max-height:315px!important");
  });

  it("não mantém o breakpoint agressivo que causou a regressão", () => {
    expect(css).not.toContain("@media (min-width:1101px) and (max-height:850px)");
    expect(css).not.toContain("width:clamp(365px,29vw,400px)!important");
  });
});
