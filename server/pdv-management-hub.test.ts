import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const privacy = read('client/public/pdv/management-hub-v1.js');
const sw = read('client/public/pdv/service-worker.js');
const html = read('client/public/pdv/index.html');

describe('modo operacional privado do PDV', () => {
  it('substitui a antiga central Gestão por uma camada de privacidade operacional', () => {
    expect(privacy).toContain("window.PDV_MANAGEMENT_HUB_RUNTIME === 'v2'");
    expect(privacy).toContain("window.PDV_MANAGEMENT_HUB_RUNTIME = 'v2'");
    expect(privacy).toContain('window.PdvPrivacidadeOperacional = Object.freeze');
    expect(privacy).toContain("runtime: 'v2'");
    expect(privacy).toContain('get financeiroVisivel() { return false; }');
  });

  it('retira da interface os acessos e modais financeiros do PDV', () => {
    const alvos = [
      '.header-actions .btn-history[onclick*="abrirModalHistorico"]',
      '#painel-diario .indicador-diario.vendas',
      '#pdv-cash-session-totals',
      '#pcsh-btn',
      '#pdv-atalhos-gestao',
      '#btn-relatorio-garcons',
      '#rdu-btn',
      '#pdv-caixa-btn',
      '#pdv-gestao-btn',
      '#pdv-gestao-overlay',
      '#rdu-overlay',
      '#relatorio-garcons-overlay',
      '#pdv-caixa-overlay',
      '#modal-historico'
    ];
    alvos.forEach(alvo => expect(privacy).toContain(alvo));
    expect(privacy).toContain('display:none!important');
    expect(privacy).toContain("elemento.setAttribute('aria-hidden', 'true')");
    expect(privacy).toContain("elemento.setAttribute('tabindex', '-1')");
  });

  it('mantém Mesas abertas visível e compacta o resumo sem faturamento', () => {
    expect(privacy).toContain("painel.classList.add('pdv-operacional-privado')");
    expect(privacy).toContain('#painel-diario.pdv-operacional-privado .indicador-diario.mesas');
    expect(privacy).toContain('display:inline-flex!important');
    expect(privacy).toContain('border-radius:999px!important');
    expect(privacy).not.toContain('.indicador-diario.mesas{display:none');
  });

  it('preserva somente o ciclo da sessão sem exibir valores financeiros', () => {
    expect(privacy).toContain("botao.id = 'pdv-sessao-operacional-btn'");
    expect(privacy).toContain('Sessão operacional');
    expect(privacy).toContain('Este controle não exibe faturamento, formas de pagamento, fundo ou histórico.');
    expect(privacy).toContain('window.PdvSessaoCaixa');
    expect(privacy).toContain('await api.encerrar()');
    expect(privacy).toContain('await api.abrir()');
    expect(privacy).not.toContain('resumoFinal.totalVendas');
    expect(privacy).not.toContain('especieEsperada');
  });

  it('exige reautenticação administrativa antes de abrir ou encerrar a sessão', () => {
    expect(privacy).toContain("const ADMIN_EMAIL = 'adm@acesso.joaocaicara.app'");
    expect(privacy).toContain('const DESBLOQUEIO_MS = 60 * 1000');
    expect(privacy).toContain('EmailAuthProvider');
    expect(privacy).toContain('provider.credential(ADMIN_EMAIL, senha)');
    expect(privacy).toContain('await user.reauthenticateWithCredential(credencial)');
    expect(privacy).toContain('desbloqueadoAte = Date.now() + DESBLOQUEIO_MS');
    expect(privacy).not.toContain('signInWithEmailAndPassword');
    expect(privacy).not.toContain('localStorage');
  });

  it('não altera mesas, pedidos, impressão, vendas ou Firebase Database', () => {
    expect(privacy).not.toContain('database.ref');
    expect(privacy).not.toContain('db.ref');
    expect(privacy).not.toContain('pedidosProducao');
    expect(privacy).not.toContain('mesa-atomic');
    expect(privacy).not.toContain('window.print');
    expect(privacy).not.toContain('.transaction(');
  });

  it('não esconde Auditoria e Backup nesta fase', () => {
    expect(html).toContain('onclick="abrirModalAuditoria()"');
    expect(html).toContain('onclick="abrirModalBackup()"');
    expect(privacy).not.toContain('[onclick*="abrirModalAuditoria"]');
    expect(privacy).not.toContain('[onclick*="abrirModalBackup"]');
  });

  it('continua sendo carregado pelo service worker já existente', () => {
    expect(sw).toContain("const MANAGEMENT_HUB_ASSET = '/pdv/management-hub-v1.js?v=1'");
    expect(sw).toContain('MANAGEMENT_HUB_ASSET');
    expect(sw).toContain("if (!html.includes('/pdv/management-hub-v1.js'))");
    expect(sw).toContain('<script src="/pdv/management-hub-v1.js?v=1"></script>');
  });
});
