import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("cardapio digital publico", () => {
  it("publica uma pagina de consulta sem controles operacionais", () => {
    const html = read("client/public/cardapio/index.html");
    expect(html).toContain("Cardápio exclusivo para consulta");
    expect(html).toContain('id="busca-cardapio"');
    expect(html).toContain('id="categorias"');
    expect(html).toContain("/cardapio/cardapio.js?v=1");
    expect(html).not.toMatch(/abrir mesa|fechar conta|enviar pedido/i);
  });

  it("consulta somente cardapio e oculta itens inativos ou indisponiveis", () => {
    const script = read("client/public/cardapio/cardapio.js");
    expect(script).toContain("firebase.database().ref('cardapio').on('value'");
    expect(script).not.toMatch(/\.ref\([^)]*\)\.(set|update|remove)\(/);
    expect(script).toContain("item.ativo !== false && item.disponivel !== false");
  });

  it("inclui a pagina nas verificacoes de deploy e monitoramento", () => {
    const deploy = read(".github/workflows/firebase-hosting-deploy.yml");
    const audit = read(".github/workflows/production-health-audit.yml");
    expect(deploy).toContain("verificar_arquivo '/cardapio/'");
    expect(deploy).toContain("Verify public menu read access");
    expect(audit).toContain("/cardapio/cardapio.js");
    expect(audit).toContain("Verify public menu read access");
  });
});
