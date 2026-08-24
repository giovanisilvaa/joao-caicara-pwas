import { describe, expect, it } from "vitest";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/firebase-hosting-deploy.yml", "utf8");

const UID_CORRETO = "2SMlsyBIW8P0bHZgcvx32XDFb793";
const UID_INCORRETO = "2SMlsyBIw8P0bHZgcvx32XDFb793";

describe("perfil remoto do administrador", () => {
  it("cadastra somente o UID exato da conta adm", () => {
    expect(workflow).toContain(`database:set /perfisAcesso/${UID_CORRETO} --data '{\"perfil\":\"administrador\"}'`);
    expect(workflow).not.toContain(`database:set /perfisAcesso/${UID_INCORRETO} --data '{\"perfil\":\"administrador\"}'`);
  });

  it("remove e verifica a ausencia da variante com caixa errada", () => {
    expect(workflow).toContain("Remove incorrect administrator UID");
    expect(workflow).toContain(`database:set /perfisAcesso/${UID_INCORRETO} --data 'null'`);
    expect(workflow).toContain(`database:get /perfisAcesso/${UID_INCORRETO}`);
    expect(workflow).toContain("UID administrativo incorreto removido com sucesso.");
  });
});
