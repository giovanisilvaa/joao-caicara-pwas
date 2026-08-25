import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('fluxo unico de producao com uma impressora', () => {
  it('pdv envia todos os pendentes de uma vez e separa cozinha e bar em um unico trabalho de impressao', () => {
    const production = read('client/public/pdv/pdv-production.js');
    expect(production).toContain('enviarProducaoCompletaPdv');
    expect(production).toContain('const porSetor = { cozinha: [], bar: [] }');
    expect(production).toContain("item.setor === 'bar' ? 'bar' : 'cozinha'");
    expect(production).toContain('reservarConfirmar(numeroMesa, null)');
    expect(production).toContain('imprimirLote(documentos)');
    expect(production).toContain('print-mode-producao-lote');
    expect(production).toContain('page-break-after:always');
    expect(production).toContain('PEDIDO COZINHA');
    expect(production).toContain('PEDIDO BAR');
    expect(production).toContain('ENVIAR PRODUÇÃO');
  });

  it('pedidos do garcom entram em lote e usam uma unica chamada de impressao', () => {
    const auto = read('client/public/pdv/pdv-auto-production-print.js');
    expect(auto).toContain("pedido.origem !== 'garcom'");
    expect(auto).toContain("db.ref('pedidosProducao')");
    expect(auto).toContain('AGUARDO_LOTE_MS');
    expect(auto).toContain('fila.splice(0, fila.length)');
    expect(auto).toContain('window.PdvProducao?.imprimirLote');
    expect(auto).toContain("atualizacoes[`${base}/status`] = 'impresso'");
  });

  it('fila de producao reconecta apenas depois do login administrativo real', () => {
    const auto = read('client/public/pdv/pdv-auto-production-print.js');
    expect(auto).toContain("const EMAIL_PDV = 'adm@acesso.joaocaicara.app'");
    expect(auto).toContain('firebase.auth().onAuthStateChanged');
    expect(auto).toContain("refProducao = db.ref('pedidosProducao')");
    expect(auto).toContain("refProducao.once('value')");
    expect(auto).toContain('deveRecuperarInicial');
  });

  it('pdv reconecta mesas autenticadas e atualiza a comanda selecionada', () => {
    const mesasAuth = read('client/public/pdv/mesas-auth-reconnect.js');
    expect(mesasAuth).toContain("const EMAIL_PDV = 'adm@acesso.joaocaicara.app'");
    expect(mesasAuth).toContain("refMesas = db.ref('mesas')");
    expect(mesasAuth).toContain("refMesas.on('value'");
    expect(mesasAuth).toContain('mesas = normalizar(snap.val())');
    expect(mesasAuth).toContain('renderizarComanda');
    expect(mesasAuth).toContain('gerarMesas');
  });

  it('service worker carrega reconexao de mesas, producao em lote e fila automatica', () => {
    const sw = read('client/public/pdv/service-worker.js');
    expect(sw).toContain('mesas-auth-reconnect.js?v=1');
    expect(sw).toContain('pdv-production.js?v=40&flow=2');
    expect(sw).toContain('pdv-auto-production-print.js?v=3');
    expect(sw.indexOf('/pdv/pdv-sync.js')).toBeLessThan(sw.indexOf('/pdv/mesas-auth-reconnect.js'));
    expect(sw.indexOf('/pdv/pdv-production.js')).toBeLessThan(sw.indexOf('/pdv/pdv-auto-production-print.js'));
  });

  it('garcom continua criando pedidos separados por setor com id de envio nos itens', () => {
    const garcom = read('client/public/garcom/mesa-concurrency.js');
    expect(garcom).toContain('const porSetor = { cozinha: [], bar: [] }');
    expect(garcom).toContain("const setor = item.setor === 'bar' ? 'bar' : 'cozinha'");
    expect(garcom).toContain('envioId: reserva.envioId');
    expect(garcom).toContain('pedidosProducao/${ref.key}');
  });
});
