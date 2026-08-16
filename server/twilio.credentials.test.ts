import { describe, expect, it } from "vitest";

describe("credenciais do Twilio WhatsApp", () => {
  it("autentica na API do Twilio", async () => {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;

    expect(sid, "TWILIO_ACCOUNT_SID não configurado").toMatch(/^AC[a-f0-9]{32}$/i);
    expect(token, "TWILIO_AUTH_TOKEN não configurado").toBeTruthy();

    const resposta = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      },
    });

    expect(resposta.status).toBe(200);
    const conta = await resposta.json() as { sid?: string };
    expect(conta.sid).toBe(sid);
  }, 15_000);
});
