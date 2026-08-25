import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('fluxo unico de producao com uma impressora', () => {
  it('pdv envia todos os pendentes de uma vez e separa cozinha e bar', () => {
    const production = read('client/public/pdv/pdv-production.js');
    expect(production).toContain('enviarProducaoCompletaPdv');
    expect(production).toContain('const porSetor = { cozinha: [], bar: [] }');
    expect(production).toContain("item.setor === 'bar' ? 'bar' : 'cozinha'");
    expect(production).toContain('reservarConfirmar(numeroMesa, null)');
    expect(production).toContain('PEDIDO COZINHA');
    expect(production).toContain('PEDIDO BAR');
    expect(production).toContain('ENVIAR PRODUÇÃO');
  });

  it('pedidos do garcom entram na fila automatica da impressora do pdv', () => {
    const auto = read('client/public/pdv/pdv-auto-production-print.js');
    expect(auto).toContain("pedido.origem !== 'garcom'");
    expect(auto).toContain("db.ref('pedidosProducao').on('child_added'");
    expect(auto).toContain("status: 'impresso'");
    expect(auto).toContain('window.print()');
  });

  it('service worker carrega producao nova e fila automatica', () => {
    const sw = read('client/public/pdv/service-worker.js');
    expect(sw).toContain('pdv-production.js?v=40&flow=1');
    expect(sw).toContain('pdv-auto-production-print.js?v=1');
    expect(sw.indexOf('/pdv/pdv-production.js')).toBeLessThan(sw.indexOf('/pdv/pdv-auto-production-print.js'));
  });

  it('garcom continua criando pedidos separados por setor', () => {
    const garcom = read('client/public/garcom/mesa-concurrency.js');
    expect(garcom).toContain('const porSetor = { cozinha: [], bar: [] }');
    expect(garcom).toContain("const setor = item.setor === 'bar' ? 'bar' : 'cozinha'");
    expect(garcom).toContain('pedidosProducao/${ref.key}');
  });
});
