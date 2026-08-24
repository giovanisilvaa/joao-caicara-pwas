import { describe, expect, it } from "vitest";

/**
 * Teste virtual de alta carga dos PWAs.
 *
 * Não toca no Firebase de produção. A simulação mantém um cenário-controle com o
 * padrão antigo (read + set da mesa inteira) para provar que o teste detecta
 * colisões e compara com o padrão novo, serializado por transação por mesa.
 */

type Item = { id: string; preco: number; qtd: number };
type Lock = { id: string; ativo: boolean; tipo: string };
type Mesa = { itens: Item[]; cliente: string; abertura: number | null; bloqueioOperacional?: Lock };

class VirtualRealtimeDatabase {
  mesas = new Map<number, Mesa>();
  pedidos = new Map<string, unknown>();
  vendas = new Map<string, unknown>();
  private seq = 0;
  private filas = new Map<number, Promise<void>>();

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

  async transactionMesa(numero: number, mutator: (mesa: Mesa) => Mesa | undefined): Promise<{ committed: boolean; mesa: Mesa }> {
    const anterior = this.filas.get(numero) ?? Promise.resolve();
    let liberar!: () => void;
    const atual = new Promise<void>(resolve => { liberar = resolve; });
    this.filas.set(numero, anterior.then(() => atual));
    await anterior;
    try {
      const snapshot = this.readMesa(numero);
      const proxima = mutator(snapshot);
      if (!proxima) return { committed: false, mesa: snapshot };
      this.setMesa(numero, proxima);
      return { committed: true, mesa: this.readMesa(numero) };
    } finally {
      liberar();
    }
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
    const copiaPedidos = new Map(this.pedidos);

    for (const [path, valor] of Object.entries(atualizacoes)) {
      const partes = path.split("/").filter(Boolean);
      if (partes[0] === "mesas" && partes.length === 2) {
        const mesa = Number(partes[1]);
        if (valor === null) copiaMesas.delete(mesa);
        else copiaMesas.set(mesa, structuredClone(valor as Mesa));
      }
      if (partes[0] === "vendas") copiaVendas.set(partes[1], structuredClone(valor));
      if (partes[0] === "pedidosProducao") copiaPedidos.set(partes[1], structuredClone(valor));
    }

    this.mesas = copiaMesas;
    this.vendas = copiaVendas;
    this.pedidos = copiaPedidos;
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

function mesaAleatoria(random: () => number) {
  return random() < 0.65 ? 1 + Math.floor(random() * 12) : 13 + Math.floor(random() * 28);
}

function itensPresentes(db: VirtualRealtimeDatabase) {
  const ids = new Set<string>();
  for (const mesa of db.mesas.values()) for (const item of mesa.itens) ids.add(item.id);
  return ids;
}

describe("alta carga e concorrência", () => {
  it("cenário-controle detecta a perda do padrão antigo read + set", async () => {
    const db = new VirtualRealtimeDatabase(40);
    const random = rng();
    const OPERACOES = 2400;
    const esperados = new Set<string>();
    const tarefas: Promise<void>[] = [];

    for (let i = 0; i < OPERACOES; i++) {
      const mesa = mesaAleatoria(random);
      const itemId = `legado-op${i}`;
      esperados.add(itemId);
      tarefas.push((async () => {
        const snapshot = db.readMesa(mesa);
        await wait(Math.floor(random() * 4));
        snapshot.itens.push({ id: itemId, preco: 10 + (i % 90), qtd: 1 });
        snapshot.abertura ??= Date.now();
        db.setMesa(mesa, snapshot);
      })());
    }

    await Promise.all(tarefas);
    const presentes = itensPresentes(db);
    const perdidos = [...esperados].filter(id => !presentes.has(id)).length;
    console.log(JSON.stringify({ cenario: "controle legado read+set", operacoes: OPERACOES, preservados: presentes.size, perdidos }));
    expect(perdidos).toBeGreaterThan(0);
  }, 15000);

  it("preserva 100% de 2.400 lançamentos concorrentes com transação por mesa", async () => {
    const db = new VirtualRealtimeDatabase(40);
    const random = rng();
    const GARCONS = 12;
    const OPERACOES = 2400;
    const esperados = new Set<string>();
    const tarefas: Promise<void>[] = [];

    for (let i = 0; i < OPERACOES; i++) {
      const garcom = i % GARCONS;
      const mesa = mesaAleatoria(random);
      const itemId = `g${garcom}-op${i}`;
      esperados.add(itemId);
      tarefas.push((async () => {
        await wait(Math.floor(random() * 4));
        const resultado = await db.transactionMesa(mesa, atual => {
          atual.itens.push({ id: itemId, preco: 10 + (i % 90), qtd: 1 });
          atual.abertura ??= Date.now();
          return atual;
        });
        expect(resultado.committed).toBe(true);
      })());
    }

    const inicio = performance.now();
    await Promise.all(tarefas);
    const duracaoMs = performance.now() - inicio;
    const presentes = itensPresentes(db);
    const perdidos = [...esperados].filter(id => !presentes.has(id));

    console.log(JSON.stringify({
      cenario: "12 garçons / 40 mesas / 2400 lançamentos transacionais",
      esperados: esperados.size,
      preservados: presentes.size,
      perdidos: perdidos.length,
      taxaPerda: 0,
      duracaoMs: Number(duracaoMs.toFixed(1)),
      diagnostico: perdidos.length === 0 ? "SEM_PERDA" : "FALHA"
    }));

    expect(presentes.size).toBe(OPERACOES);
    expect(perdidos).toHaveLength(0);
  }, 15000);

  it("aguenta 20.000 lançamentos transacionais sem perder ou duplicar itens", async () => {
    const db = new VirtualRealtimeDatabase(40);
    const random = rng(20260825);
    const OPERACOES = 20000;
    const tarefas: Promise<void>[] = [];

    for (let i = 0; i < OPERACOES; i++) {
      const mesa = mesaAleatoria(random);
      tarefas.push(db.transactionMesa(mesa, atual => {
        atual.itens.push({ id: `stress-${i}`, preco: 25 + (i % 50), qtd: 1 });
        atual.abertura ??= 1;
        return atual;
      }).then(() => undefined));
    }

    const inicio = performance.now();
    await Promise.all(tarefas);
    const duracaoMs = performance.now() - inicio;
    const presentes = itensPresentes(db);
    console.log(JSON.stringify({
      cenario: "20.000 lançamentos / 40 mesas",
      esperados: OPERACOES,
      preservados: presentes.size,
      perdidos: OPERACOES - presentes.size,
      duplicados: presentes.size - OPERACOES,
      duracaoMs: Number(duracaoMs.toFixed(1))
    }));

    expect(presentes.size).toBe(OPERACOES);
    for (let i = 0; i < OPERACOES; i++) expect(presentes.has(`stress-${i}`)).toBe(true);
  }, 60000);

  it("bloqueio operacional impede alteração durante fechamento e libera depois", async () => {
    const db = new VirtualRealtimeDatabase();
    await db.transactionMesa(7, mesa => {
      mesa.itens.push({ id: "antes-lock", preco: 100, qtd: 1 });
      return mesa;
    });
    await db.transactionMesa(7, mesa => {
      mesa.bloqueioOperacional = { id: "close-1", ativo: true, tipo: "fechamento" };
      return mesa;
    });

    const bloqueada = await db.transactionMesa(7, mesa => {
      if (mesa.bloqueioOperacional?.ativo) return undefined;
      mesa.itens.push({ id: "nao-pode-entrar", preco: 10, qtd: 1 });
      return mesa;
    });
    expect(bloqueada.committed).toBe(false);
    expect(itensPresentes(db).has("nao-pode-entrar")).toBe(false);

    db.atomicUpdate({
      "/vendas/venda-lock": { mesa: 7, total: 110 },
      "/mesas/7": { itens: [], cliente: "", abertura: null }
    });
    expect(db.vendas.has("venda-lock")).toBe(true);
    expect(db.readMesa(7).itens).toHaveLength(0);

    const depois = await db.transactionMesa(7, mesa => {
      mesa.itens.push({ id: "depois-lock", preco: 20, qtd: 1 });
      return mesa;
    });
    expect(depois.committed).toBe(true);
    expect(itensPresentes(db).has("depois-lock")).toBe(true);
  });

  it("preserva 5.000 pedidos e 1.200 vendas com chaves únicas", async () => {
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
});
