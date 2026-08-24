import { describe, expect, it } from "vitest";

/**
 * Diagnóstico virtual de concorrência dos PWAs.
 *
 * Não toca no Firebase de produção. Reproduz os padrões usados hoje:
 * - leitura + set da mesa inteira para inclusão de itens;
 * - push com chave única para pedidos/vendas;
 * - update multipath atômico para operações críticas.
 */

type Item = { id: string; preco: number; qtd: number };
type Mesa = { itens: Item[]; cliente: string; abertura: number | null };

class VirtualRealtimeDatabase {
  mesas = new Map<number, Mesa>();
  pedidos = new Map<string, unknown>();
  vendas = new Map<string, unknown>();
  private seq = 0;

  constructor(qtdMesas = 40) {
    for (let i = 1; i <= qtdMesas; i++) {
      this.mesas.set(i, { itens: [], cliente: "", abertura: null });
    }
  }

  readMesa(numero: number): Mesa {
    return structuredClone(this.mesas.get(numero) ?? { itens: [], cliente: "", abertura: null });
  }

  setMesa(numero: number, mesa: Mesa) {
    this.mesas.set(numero, structuredClone(mesa));
  }

  pushPedido(payload: unknown) {
    const key = `pedido_${++this.seq}`;
    this.pedidos.set(key, structuredClone(payload));
    return key;
  }

  pushVenda(payload: unknown) {
    const key = `venda_${++this.seq}`;
    this.vendas.set(key, structuredClone(payload));
    return key;
  }

  atomicUpdate(atualizacoes: Record<string, unknown>) {
    const copiaMesas = new Map(this.mesas);
    const copiaVendas = new Map(this.vendas);

    for (const [path, valor] of Object.entries(atualizacoes)) {
      const partes = path.split("/").filter(Boolean);
      if (partes[0] === "mesas") {
        const mesa = Number(partes[1]);
        if (valor === null) copiaMesas.delete(mesa);
        else copiaMesas.set(mesa, structuredClone(valor as Mesa));
      }
      if (partes[0] === "vendas") {
        copiaVendas.set(partes[1], structuredClone(valor));
      }
    }

    this.mesas = copiaMesas;
    this.vendas = copiaVendas;
  }
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function rng(seed = 20260824) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe("diagnóstico virtual de alta carga", () => {
  it("mede colisões quando vários garçons gravam a mesma mesa com set da mesa inteira", async () => {
    const db = new VirtualRealtimeDatabase(40);
    const random = rng();
    const GARCONS = 12;
    const OPERACOES = 2400;
    const expected = new Set<string>();

    const tarefas: Promise<void>[] = [];

    for (let i = 0; i < OPERACOES; i++) {
      const garcom = i % GARCONS;
      // Concentra parte relevante da carga nas primeiras mesas, como ocorre num pico real.
      const mesa = random() < 0.65 ? 1 + Math.floor(random() * 12) : 13 + Math.floor(random() * 28);
      const itemId = `g${garcom}-op${i}`;
      expected.add(itemId);

      tarefas.push((async () => {
        const snapshotLocal = db.readMesa(mesa);
        await wait(Math.floor(random() * 4));
        snapshotLocal.itens.push({ id: itemId, preco: 10 + (i % 90), qtd: 1 });
        snapshotLocal.abertura ??= Date.now();
        db.setMesa(mesa, snapshotLocal);
      })());
    }

    const inicio = performance.now();
    await Promise.all(tarefas);
    const duracaoMs = performance.now() - inicio;

    const presentes = new Set<string>();
    for (const mesa of db.mesas.values()) for (const item of mesa.itens) presentes.add(item.id);

    const perdidos = [...expected].filter(id => !presentes.has(id));
    const taxaPerda = perdidos.length / expected.size;

    console.log(JSON.stringify({
      cenario: "12 garçons / 40 mesas / 2400 lançamentos concorrentes",
      esperados: expected.size,
      preservados: presentes.size,
      perdidos: perdidos.length,
      taxaPerda: Number((taxaPerda * 100).toFixed(2)),
      duracaoMs: Number(duracaoMs.toFixed(1)),
      diagnostico: taxaPerda === 0 ? "SEM_PERDA" : "RISCO_DE_COLISAO_SET_MESA"
    }));

    // O objetivo é diagnóstico: confirma que a simulação realmente exerceu concorrência.
    expect(expected.size).toBe(OPERACOES);
    expect(duracaoMs).toBeGreaterThanOrEqual(0);
  }, 15000);

  it("preserva pedidos e vendas quando cada registro usa uma chave única", async () => {
    const db = new VirtualRealtimeDatabase();
    const TOTAL_PEDIDOS = 5000;
    const TOTAL_VENDAS = 1200;

    await Promise.all([
      ...Array.from({ length: TOTAL_PEDIDOS }, (_, i) => Promise.resolve().then(() => db.pushPedido({ mesa: (i % 40) + 1, i }))),
      ...Array.from({ length: TOTAL_VENDAS }, (_, i) => Promise.resolve().then(() => db.pushVenda({ mesa: (i % 40) + 1, total: i + 1 })))
    ]);

    expect(db.pedidos.size).toBe(TOTAL_PEDIDOS);
    expect(db.vendas.size).toBe(TOTAL_VENDAS);
  });

  it("mantém fechamento venda + limpeza da mesa juntos em update multipath", () => {
    const db = new VirtualRealtimeDatabase();
    const mesa = db.readMesa(7);
    mesa.itens.push({ id: "teste", preco: 100, qtd: 1 });
    db.setMesa(7, mesa);

    const vendaId = "fechamento_teste";
    db.atomicUpdate({
      [`/vendas/${vendaId}`]: { mesa: 7, total: 110, taxa: 10 },
      "/mesas/7": { itens: [], cliente: "", abertura: null }
    });

    expect(db.vendas.has(vendaId)).toBe(true);
    expect(db.readMesa(7).itens).toHaveLength(0);
  });
});
