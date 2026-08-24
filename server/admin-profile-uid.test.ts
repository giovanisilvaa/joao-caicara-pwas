import { describe, expect, it } from "vitest";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/firebase-hosting-deploy.yml", "utf8");

const UID_CORRETO = "2SMlsyBIW8P0bHZgcvx32XDFb793";
const UID_INCORRETO = "2SMlsyBIw8P0bHZgcvx32XDFb793";

describe("perfil remoto do administrador", () => {
  it("cadastra somente o UID exato da conta adm", () => {
    expect(workflow).toContain(`database:set /perfisAcesso/${UID_CORRETO} --data '{\"perfil\":\"administrador\"}'`);
    expect(workflow).not.toContain(`database:set /perfisAcesso/${UID_INCORRETO}`);
    expect(workflow).toContain(`database:get /perfisAcesso/${UID_CORRETO}`);
  });

  it("mantem verificacao do perfil administrador persistido", () => {
    expect(workflow).toContain("Verify administrator access profile");
    expect(workflow).toContain("Perfil administrativo confirmado no Firebase.");
  });
});
