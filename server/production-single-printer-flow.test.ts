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

  it('remove os botoes separados de envio e instala um unico botao de producao', () => {
    const production = read('client/public/pdv/pdv-production.js');
    expect(production).toContain("b.classList.contains('btn-kitchen')");
    expect(production).toContain("b.classList.contains('btn-bar')");
    expect(production).toContain("cozinha.style.display = 'none'");
    expect(production).toContain("bar.style.display = 'none'");
    expect(production).toContain("botao.id = 'btn-enviar-producao-pdv'");
    expect(production).toContain('window.enviarProducaoCompletaPdv()');
  });

  it('pedidos do garcom reconectam apos autenticacao e entram na fila automatica', () => {
    const auto = read('client/public/pdv/pdv-auto-production-print.js');
    expect(auto).toContain("PDV_AUTO_PRODUCTION_RUNTIME = 'v2'");
    expect(auto).toContain('firebase.auth().onAuthStateChanged');
    expect(auto).toContain("EMAIL_PDV = 'adm@acesso.joaocaicara.app'");
    expect(auto).toContain("refProducao.once('value')");
    expect(auto).toContain("refProducao.on('value'");
    expect(auto).toContain("refProducao.on('child_added'");
    expect(auto).toContain("pedido.origem !== 'garcom'");
    expect(auto).toContain('sincronizarPainel');
  });

  it('fila automatica reivindica cada pedido antes de imprimir para evitar duplicidade', () => {
    const auto = read('client/public/pdv/pdv-auto-production-print.js');
    expect(auto).toContain('reivindicarImpressao');
    expect(auto).toContain("impressaoPdv`);");
    expect(auto).toContain('.transaction(atual =>');
    expect(auto).toContain("estado: 'processando'");
    expect(auto).toContain("estado: 'impresso'");
    expect(auto).toContain('window.print()');
  });

  it('service worker carrega producao nova e central automatica', () => {
    const sw = read('client/public/pdv/service-worker.js');
    expect(sw).toContain('pdv-production.js?v=40&flow=2');
    expect(sw).toContain('pdv-auto-production-print.js?v=2');
    expect(sw.indexOf('/pdv/pdv-production.js')).toBeLessThan(sw.indexOf('/pdv/pdv-auto-production-print.js'));
  });

  it('garcom continua criando pedidos separados por setor', () => {
    const garcom = read('client/public/garcom/mesa-concurrency.js');
    expect(garcom).toContain('const porSetor = { cozinha: [], bar: [] }');
    expect(garcom).toContain("const setor = item.setor === 'bar' ? 'bar' : 'cozinha'");
    expect(garcom).toContain('pedidosProducao/${ref.key}');
  });
});
