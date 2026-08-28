import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('diagnostico preventivo de impressao do PDV', () => {
  it('invalida a confirmacao quando a versao do Chrome muda', () => {
    const js = read('client/public/pdv/pdv-print-health.js');
    expect(js).toContain("joao_caicara_print_health_v1");
    expect(js).toContain("/(?:Chrome|Chromium)\\/([\\d.]+)/i");
    expect(js).toContain('atual.versao !== versao');
    expect(js).toContain('Chrome atualizado');
  });

  it('mede o tempo de window.print e sinaliza possivel dialogo', () => {
    const js = read('client/public/pdv/pdv-print-health.js');
    expect(js).toContain('const LIMITE_DIALOGO_MS = 2500');
    expect(js).toContain('performance.now()');
    expect(js).toContain("status: 'suspeita'");
    expect(js).toContain("status: 'ok'");
    expect(js).toContain("window.print = function printMonitorado()");
  });

  it('avisa antes de enviar producao quando a impressao nao foi confirmada', () => {
    const js = read('client/public/pdv/pdv-print-health.js');
    expect(js).toContain("closest('#btn-enviar-producao-pdv,.btn-kitchen,.btn-bar')");
    expect(js).toContain("document.addEventListener('click', protegerCliqueDeEnvio, true)");
    expect(js).toContain('Use o botão “Testar” no aviso para confirmar sem criar pedido.');
    expect(js).toContain('event.stopImmediatePropagation()');
  });

  it('oferece teste separado que nao cria pedido', () => {
    const js = read('client/public/pdv/pdv-print-health.js');
    expect(js).toContain('TESTE DE IMPRESSÃO');
    expect(js).toContain('Este papel NÃO é um pedido.');
    expect(js).toContain("'teste_manual'");
    expect(js).not.toContain("db.ref('pedidosProducao')");
    expect(js).not.toContain('reservarEnvio');
  });

  it('service worker publica o diagnostico e força cache novo do PDV', () => {
    const sw = read('client/public/pdv/service-worker.js');
    expect(sw).toContain("joao-caicara-pdv-v28-report-v29-live-v30-print-v31");
    expect(sw).toContain("const PRINT_HEALTH_ASSET = '/pdv/' + 'pdv-print-health.js?v=1'");
    expect(sw).toContain('PRINT_HEALTH_ASSET');
    expect(sw).toContain("if (!html.includes('/pdv/pdv-print-health.js'))");
    expect(sw).toContain("client.navigate(client.url)");
  });
});
