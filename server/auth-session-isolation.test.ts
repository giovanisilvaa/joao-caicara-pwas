import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("isolamento de sessao entre PDV e Garcom", () => {
  it("usa persistencia SESSION para isolar cada aba", () => {
    const isolation = read("client/public/auth-session-isolation.js");
    expect(isolation).toContain("Auth?.Persistence?.SESSION");
    expect(isolation).toContain("setPersistence(sessionMode)");
    expect(isolation).not.toContain("Persistence.LOCAL");
  });

  it("carrega isolamento antes do login nos dois PWAs", () => {
    const pdv = read("client/public/pdv/service-worker.js");
    const garcom = read("client/public/garcom/service-worker.js");

    expect(pdv.indexOf("/auth-session-isolation.js?v=20")).toBeGreaterThanOrEqual(0);
    expect(pdv.indexOf("/auth-session-isolation.js?v=20")).toBeLessThan(pdv.indexOf("/pdv/admin-login.js?v=33"));

    expect(garcom.indexOf("/auth-session-isolation.js?v=20")).toBeGreaterThanOrEqual(0);
    expect(garcom.indexOf("/auth-session-isolation.js?v=20")).toBeLessThan(garcom.indexOf("/garcom/shared-login.js?v=17"));
  });
});
