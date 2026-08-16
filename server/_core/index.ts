import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { getSystemMonitor, upsertSystemMonitor } from "../db";
import { sdk } from "./sdk";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

const MONITOR_SERVICE = "public-site";

async function enviarAlertaWhatsApp(mensagem: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.TWILIO_WHATSAPP_TO;
  if (!sid || !token || !from || !to) throw new Error("Twilio WhatsApp is not configured");
  const body = new URLSearchParams({ Body: mensagem, From: from, To: to });
  const resposta = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!resposta.ok) throw new Error(`Twilio returned HTTP ${resposta.status}`);
  return resposta.json();
}

async function verificarMonitoramento(req: any, res: any) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const now = new Date();
    const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
    const host = req.headers.host;
    if (!host) return res.status(400).json({ error: "missing-host" });
    const healthResponse = await fetch(`${proto}://${host}/api/health`, { signal: AbortSignal.timeout(8000) });
    const currentStatus = healthResponse.ok ? "up" : "down";
    const previous = await getSystemMonitor(MONITOR_SERVICE);
    if (previous?.scheduleCronTaskUid && previous.scheduleCronTaskUid !== user.taskUid) {
      return res.json({ ok: true, skipped: "orphan" });
    }
    let lastAlertAt = previous?.lastAlertAt ?? null;
    if (previous && previous.status !== "unknown" && previous.status !== currentStatus) {
      const mensagem = currentStatus === "down"
        ? `⚠️ João Caiçara: o sistema ficou indisponível em ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`
        : `✅ João Caiçara: o sistema voltou a responder em ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`;
      await enviarAlertaWhatsApp(mensagem);
      lastAlertAt = now;
    }
    await upsertSystemMonitor(MONITOR_SERVICE, currentStatus, now, lastAlertAt);
    return res.json({ ok: true, status: currentStatus, changed: Boolean(previous && previous.status !== currentStatus) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: detail, timestamp: new Date().toISOString() });
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true, service: 'joao-caicara-pwas', timestamp: new Date().toISOString() });
  });
  app.post('/api/scheduled/monitorWhatsApp', verificarMonitoramento);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
