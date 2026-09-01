import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("preservacao de estado das mesas durante reconexao", () => {
  it("nao zera o mapa de mesas quando o listener autenticado falha", () => {
    const code = read("client/public/garcom/mesas-auth-reconnect.js");
    expect(code).not.toContain("mesas = {}");
    expect(code).not.toContain("mesas = normalizar(null)");
    expect(code).toContain("const anteriores = (typeof mesas === 'object' && mesas) ? mesas : {};");
  });
});
