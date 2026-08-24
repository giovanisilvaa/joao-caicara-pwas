import { describe, expect, it } from "vitest";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/firebase-hosting-deploy.yml", "utf8");

describe("perfil remoto do administrador", () => {
  it("usa o UID exato da conta adm e rejeita a variante com caixa errada", () => {
    expect(workflow).toContain("/perfisAcesso/2SMlsyBIW8P0bHZgcvx32XDFb793");
    expect(workflow).not.toContain("/perfisAcesso/2SMlsyBIw8P0bHZgcvx32XDFb793");
    expect(workflow).toContain("--data '{\"perfil\":\"administrador\"}'");
  });
});
