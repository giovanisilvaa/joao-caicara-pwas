import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('central didatica de relatorios do PDV', () => {
  it('reutiliza a fonte e os calculos oficiais do relatorio financeiro', () => {
    const dashboard = read('client/public/pdv/report-dashboard-v1.js');
    expect(dashboard).toContain('window.PdvRelatorioFinanceiro');
    expect(dashboard).toContain("typeof api.vendasDaData === 'function'");
    expect(dashboard).toContain("typeof api.resumir === 'function'");
    expect(dashboard).toContain('api.resumir(vendas)');
  });

  it('separa resumo, vendas por garcom e 10 por cento em abas didaticas', () => {
    const dashboard = read('client/public/pdv/report-dashboard-v1.js');
    expect(dashboard).toContain('Central de Relatórios');
    expect(dashboard).toContain('Resumo do dia');
    expect(dashboard).toContain('Vendas por garçom');
    expect(dashboard).toContain('10% / Serviço');
    expect(dashboard).toContain('Formas de pagamento');
    expect(dashboard).toContain('Vendas detalhadas');
  });

  it('usa o valor real da taxa e rateia apenas para indicar a origem do servico', () => {
    const dashboard = read('client/public/pdv/report-dashboard-v1.js');
    expect(dashboard).toContain("const taxa = Math.max(0, numero(venda?.taxa))");
    expect(dashboard).toContain('linha.servico += taxa * (Math.max(0, contribuicao.valor) / baseRateio)');
    expect(dashboard).toContain('É um indicador de origem do serviço, não um registro de pagamento ao garçom.');
    expect(dashboard).toContain('taxa realmente registrada nas vendas');
  });

  it('permite hoje, ontem e data personalizada sem alterar vendas', () => {
    const dashboard = read('client/public/pdv/report-dashboard-v1.js');
    expect(dashboard).toContain('data-rdu-data="hoje"');
    expect(dashboard).toContain('data-rdu-data="ontem"');
    expect(dashboard).toContain('type="date" id="rdu-data"');
    expect(dashboard).not.toContain('db.ref(');
    expect(dashboard).not.toContain('.set(');
    expect(dashboard).not.toContain('.update(');
    expect(dashboard).not.toContain('.remove(');
    expect(dashboard).not.toContain('.transaction(');
  });

  it('mantem historico e impressao existentes como fonte operacional', () => {
    const dashboard = read('client/public/pdv/report-dashboard-v1.js');
    expect(dashboard).toContain("typeof window.abrirModalHistorico === 'function'");
    expect(dashboard).toContain("typeof window.imprimirRelatorioCaixa === 'function'");
    expect(dashboard).toContain('relatorio-financeiro-data');
  });

  it('service worker carrega o painel depois do relatorio financeiro e renova o cache', () => {
    const sw = read('client/public/pdv/service-worker.js');
    expect(sw).toContain('reports-v37');
    expect(sw).toContain("const REPORT_DASHBOARD_ASSET = '/pdv/report-dashboard-v1.js?v=1'");
    expect(sw).toContain('REPORT_DASHBOARD_ASSET');
    expect(sw).toContain('<script src="/pdv/report-dashboard-v1.js?v=1"></script>');
    expect(sw.indexOf("if (!html.includes('/pdv/daily-sales-report.js'))")).toBeLessThan(
      sw.indexOf("if (!html.includes('/pdv/report-dashboard-v1.js'))")
    );
  });

  it('deploy confere byte a byte o novo modulo publicado', () => {
    const workflow = read('.github/workflows/firebase-hosting-deploy.yml');
    expect(workflow).toContain("verificar_arquivo '/pdv/report-dashboard-v1.js' 'client/public/pdv/report-dashboard-v1.js'");
  });
});
