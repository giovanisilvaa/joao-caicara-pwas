import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const catalogo = JSON.parse(read('client/public/sorvetes-menu-20260905.json'));

const precosEsperados: Record<string, number> = {
  Ovomaltine: 18.5,
  Pistache: 22,
  Brigadeiro: 18.5,
  Brownie: 18.5,
  Speculoos: 18.5,
  Dubai: 22,
  'Avelã': 16,
  'Maracujá': 16,
  Morango: 16,
  'Açaí 90g': 16,
  '7 Belo': 11,
  'Doce de Leite Aviação': 11,
  Framboesa: 11,
  Limonada: 8.9,
  Uva: 8.9
};

describe('cardápio Sorvetes 2026-09-05', () => {
  it('mantém os 15 sabores aprovados na faixa reservada 400–414', () => {
    expect(catalogo.version).toBe('2026-09-05-v1');
    expect(catalogo.category).toEqual({ key: 'sorvetes', label: '🍨 Sorvetes' });
    expect(catalogo.items).toHaveLength(15);
    expect(catalogo.items.map((item: any) => item.id)).toEqual(Array.from({ length: 15 }, (_, i) => i + 400));
    expect(Object.fromEntries(catalogo.items.map((item: any) => [item.nome, item.preco]))).toEqual(precosEsperados);
  });

  it('envia todos os sorvetes para a cozinha e inicia os itens ativos', () => {
    for (const item of catalogo.items) {
      expect(item.categoria).toBe('sorvetes');
      expect(item.setor).toBe('cozinha');
      expect(item.ativo).toBe(true);
      expect(item.favorito).toBe(false);
      expect(item.servePara2).toBe(false);
      expect(Number.isFinite(Number(item.preco))).toBe(true);
    }
  });

  it('aplica a migração preservando produtos existentes e rejeita colisão de ID', async () => {
    const mod: any = await import('../scripts/sorvetes-cardapio-update.mjs');
    const base = [
      { id: 1, nome: 'Produto legado', preco: 10, categoria: 'outros', setor: 'cozinha', favorito: true },
      { id: 2, nome: 'Bebida legada', preco: 8, categoria: 'bebidas', setor: 'bar' }
    ];
    const atualizado = mod.aplicarSorvetesCardapio(base);
    expect(atualizado).toHaveLength(base.length + 15);
    expect(atualizado[0]).toEqual(base[0]);
    expect(atualizado[1]).toEqual(base[1]);
    expect(() => mod.validarSorvetesCardapio(atualizado)).not.toThrow();

    const colisao = base.concat([{ id: 400, nome: 'Outro produto', preco: 1, categoria: 'outros', setor: 'cozinha' }]);
    expect(() => mod.aplicarSorvetesCardapio(colisao)).toThrow(/Colisão na faixa Sorvetes/);
  });

  it('publica Sorvetes pela camada de cardápio já compartilhada por PDV e Garçom', () => {
    const menu = read('client/public/menu-20260828.js');
    expect(menu).toContain('const SORVETES = [');
    expect(menu).toContain("{ id:400, nome:'Ovomaltine', preco:18.5, categoria:'sorvetes'");
    expect(menu).toContain("{ id:414, nome:'Uva', preco:8.9, categoria:'sorvetes'");
    expect(menu).toContain("garantirCategoria('sorvetes', '🍨 Sorvetes', 'kids')");
    expect(menu).toContain("criarTabPdv('sorvetes', '🍨 Sorvetes', 'kids')");
    expect(menu).toContain('inserirAusentesNoFim(lista, SORVETES)');
  });

  it('mantém a camada de Sorvetes sem acesso a mesas, vendas ou pedidos de produção', () => {
    const menu = read('client/public/menu-20260828.js');
    expect(menu).not.toContain("db.ref('mesas')");
    expect(menu).not.toContain("db.ref('pedidosProducao')");
    expect(menu).not.toContain("db.ref('vendas')");
    expect(menu).not.toContain('MesaAtomic');
  });

  it('usa o deploy já protegido por ETag para persistir Sushi e Sorvetes na mesma atualização', () => {
    const workflow = read('.github/workflows/firebase-hosting-deploy.yml');
    const sushiUpdater = read('scripts/sushi-cardapio-update.mjs');
    expect(workflow).toContain('X-Firebase-ETag: true');
    expect(workflow).toContain('If-Match: ${ETAG}');
    expect(workflow).toContain('node scripts/sushi-cardapio-update.mjs "$ATUAL"');
    expect(sushiUpdater).toContain("import { aplicarSorvetesCardapio, validarSorvetesCardapio } from './sorvetes-cardapio-update.mjs'");
    expect(sushiUpdater).toContain('const atualizado = aplicarSorvetesCardapio(comSushi)');
    expect(sushiUpdater).toContain('validarSorvetesCardapio(atual)');
  });

  it('continua atualizando o menu compartilhado por rede primeiro nos dois PWAs', () => {
    const pdv = read('client/public/pdv/service-worker.js');
    const garcom = read('client/public/garcom/service-worker.js');
    for (const sw of [pdv, garcom]) {
      expect(sw).toContain("const MENU_UPDATE_ASSET = '/menu-20260828.js?v=1'");
      expect(sw).toContain("fetch(request, { cache: 'no-store' })");
      expect(sw).toContain("if (!html.includes('/menu-20260828.js'))");
    }
  });

  it('inclui os Sorvetes no health audit de produção', () => {
    const audit = read('scripts/production-health-audit.mjs');
    expect(audit).toContain("import { SORVETES_ITEMS, validarSorvetesCardapio } from './sorvetes-cardapio-update.mjs'");
    expect(audit).toContain('validarSorvetesCardapio(cardapio)');
    expect(audit).toContain('sorvetes_itens=');
  });
});
