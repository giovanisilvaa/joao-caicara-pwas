import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const catalogo = JSON.parse(read('client/public/sushi-menu-20260903.json'));

describe('cardápio Sushi 2026-09-03', () => {
  it('mantém 61 itens na faixa reservada 300–360 e todos seguem o fluxo da cozinha', () => {
    expect(catalogo.version).toBe('2026-09-03-v1');
    expect(catalogo.category).toEqual({ key: 'sushi', label: '🍣 Sushi' });
    expect(catalogo.items).toHaveLength(61);
    expect(catalogo.items.map((item: any) => item.id)).toEqual(Array.from({ length: 61 }, (_, i) => i + 300));
    for (const item of catalogo.items) {
      expect(item.categoria).toBe('sushi');
      expect(item.setor).toBe('cozinha');
      expect(item.servePara2).toBe(false);
      expect(Number.isFinite(Number(item.preco))).toBe(true);
      expect(item.sushiGrupo).toBeTruthy();
    }
  });

  it('preserva os principais preços e a sequência especial sem preço fictício para o combinado interno', () => {
    const porId = (id: number) => catalogo.items.find((item: any) => item.id === id);
    expect(porId(300).nome).toBe('Sequência Especial Caiçara');
    expect(porId(300).preco).toBe(165);
    expect(porId(300).sushiResumo).toContain('combinado de 26 peças');
    expect(JSON.stringify(porId(300).sushiDetalhes)).toContain('12 Sashimis · 4 Salmão + 4 Atum + 4 Peixe Branco');
    expect(catalogo.items.some((item: any) => item.nome === 'Combinado de Sushis e Sashimis · 26 peças')).toBe(false);
    expect(porId(301).preco).toBe(89);
    expect(porId(302).preco).toBe(220);
    expect(porId(303).preco).toBe(340);
    expect(porId(304).preco).toBe(245);
    expect(porId(305).preco).toBe(35);
    expect(porId(359).preco).toBe(65);
  });

  it('expõe os filtros internos aprovados sem transformar cada grupo em categoria principal', () => {
    expect(catalogo.groups.map((grupo: any) => grupo.key)).toEqual([
      'todos','sequencia','combinados','sashimis','uramakis','hossomakis','joy','niguiris','temakis','hot_rolls','entradas','yakisoba'
    ]);
    expect(new Set(catalogo.items.map((item: any) => item.categoria))).toEqual(new Set(['sushi']));
  });

  it('aplica a migração sem alterar produtos existentes e rejeita colisões de ID', async () => {
    const mod: any = await import('../scripts/sushi-cardapio-update.mjs');
    const base = [
      { id: 1, nome: 'Produto legado', preco: 10, categoria: 'outros', setor: 'cozinha', favorito: true },
      { id: 2, nome: 'Bebida legada', preco: 8, categoria: 'bebidas', setor: 'bar' }
    ];
    const atualizado = mod.aplicarSushiCardapio(base);
    expect(atualizado).toHaveLength(base.length + 61);
    expect(atualizado[0]).toEqual(base[0]);
    expect(atualizado[1]).toEqual(base[1]);
    expect(() => mod.validarSushiCardapio(atualizado)).not.toThrow();

    const colisao = base.concat([{ id: 300, nome: 'Outro produto', preco: 1, categoria: 'outros', setor: 'cozinha' }]);
    expect(() => mod.aplicarSushiCardapio(colisao)).toThrow(/Colisão na faixa Sushi/);
  });

  it('mantém a camada de Sushi apenas visual no navegador e não toca em mesas, pedidos ou vendas', () => {
    const runtime = read('client/public/menu-sushi-20260903.js');
    expect(runtime).toContain("const CATEGORIA = 'sushi'");
    expect(runtime).toContain('sushi-subfilters');
    expect(runtime).toContain('data-sushi-detail');
    expect(runtime).toContain("fetch(CATALOGO_URL, { cache:'no-store' })");
    expect(runtime).not.toContain("db.ref('mesas')");
    expect(runtime).not.toContain("db.ref('pedidosProducao')");
    expect(runtime).not.toContain("db.ref('vendas')");
    expect(runtime).not.toContain('MesaAtomic');
  });

  it('publica runtime e catálogo nos dois service workers e força atualização dos PWAs', () => {
    const pdv = read('client/public/pdv/service-worker.js');
    const garcom = read('client/public/garcom/service-worker.js');
    for (const sw of [pdv, garcom]) {
      expect(sw).toContain("const SUSHI_MENU_ASSET = '/menu-sushi-20260903.js?v=1'");
      expect(sw).toContain("const SUSHI_CATALOG_ASSET = '/sushi-menu-20260903.json?v=1'");
      expect(sw).toContain('SUSHI_MENU_ASSET');
      expect(sw).toContain('SUSHI_CATALOG_ASSET');
      expect(sw).toContain('<script src="/menu-sushi-20260903.js?v=1"></script>');
      expect(sw).toContain('client.navigate(client.url)');
    }
    expect(pdv).toContain('sushi-v45');
    expect(garcom).toContain('sushi-v34');
  });

  it('protege a escrita no Firebase com ETag e verifica a propagação dos novos assets', () => {
    const workflow = read('.github/workflows/firebase-hosting-deploy.yml');
    expect(workflow).toContain('X-Firebase-ETag: true');
    expect(workflow).toContain('If-Match: ${ETAG}');
    expect(workflow).toContain('node scripts/sushi-cardapio-update.mjs "$ATUAL"');
    expect(workflow).toContain("verificar_arquivo '/menu-sushi-20260903.js'");
    expect(workflow).toContain("verificar_arquivo '/sushi-menu-20260903.json'");
  });

  it('inclui o Sushi no health audit de produção', () => {
    const audit = read('scripts/production-health-audit.mjs');
    expect(audit).toContain("import { SUSHI_ITEMS, validarSushiCardapio } from './sushi-cardapio-update.mjs'");
    expect(audit).toContain('validarSushiCardapio(cardapio)');
    expect(audit).toContain('sushi_itens=');
  });
});