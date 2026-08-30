import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('impressao automatica do fechamento feito pelo garcom', () => {
  it('garcom continua registrando a venda completa antes de liberar a mesa', () => {
    const garcom = read('client/public/garcom/mesa-concurrency.js');
    expect(garcom).toContain("origem: 'garcom'");
    expect(garcom).toContain('pagamentos');
    expect(garcom).toContain('troco');
    expect(garcom).toContain('vendas/${vendaRef.key}');
    expect(garcom).toContain('mesas/${numero}');
  });

  it('pdv normaliza arrays e objetos retornados pelo realtime database', () => {
    const auto = read('client/public/pdv/pdv-auto-close-print.js');
    expect(auto).toContain("PDV_AUTO_CLOSE_RUNTIME === 'v3'");
    expect(auto).toContain('if (Array.isArray(valor))');
    expect(auto).toContain('Object.values(valor).filter(Boolean)');
    expect(auto).toContain('normalizarVenda');
    expect(auto).toContain('normalizarMesa');
    expect(auto).toContain("String(venda.origem || '').toLowerCase() === 'garcom'");
  });

  it('imprime a conta de conferencia no PDV quando o garcom fecha a conta sem liberar a mesa', () => {
    const auto = read('client/public/pdv/pdv-auto-close-print.js');
    expect(auto).toContain("STATUS_CONFERENCIA = 'aguardando_pagamento'");
    expect(auto).toContain("String(mesa.fechamentoPendente?.origem || '').toLowerCase() === 'garcom'");
    expect(auto).toContain("db.ref('mesas')");
    expect(auto).toContain("refMesas.on('child_changed'");
    expect(auto).toContain('impressaoConferenciaPdv');
    expect(auto).toContain('CONTA PARA CONFERÊNCIA');
    expect(auto).toContain('Pagamento ainda não finalizado.');
    expect(auto).toContain('A mesa continua ocupada.');
  });

  it('protege a conferencia contra duplicidade e contra recriar mesa ja liberada', () => {
    const auto = read('client/public/pdv/pdv-auto-close-print.js');
    expect(auto).toContain('reivindicarConferencia');
    expect(auto).toContain("ref.transaction(atual =>");
    expect(auto).toContain("if (!atual || atual.estadoConta !== STATUS_CONFERENCIA) return;");
    expect(auto).toContain('atualFechadoEm !== Number(fechadoEm)');
    expect(auto).toContain("estado: 'impresso'");
    expect(auto).toContain('contaFechadaEm: atualFechadoEm');
  });

  it('mantem a impressao final automatica no PDV depois que o garcom recebe e finaliza', () => {
    const auto = read('client/public/pdv/pdv-auto-close-print.js');
    expect(auto).toContain("db.ref('vendas')");
    expect(auto).toContain("refVendas.once('value')");
    expect(auto).toContain("refVendas.on('child_added'");
    expect(auto).toContain("refVendas.on('value'");
    expect(auto).toContain('impressaoFechamentoPdv');
    expect(auto).toContain('CONTA FINALIZADA');
    expect(auto).toContain('fechamentoImpressoNoPdv: true');
  });

  it('serializa conferencia e fechamento na mesma fila de impressao', () => {
    const auto = read('client/public/pdv/pdv-auto-close-print.js');
    expect(auto).toContain("registro.tipo === 'conferencia'");
    expect(auto).toContain("fila.push({ tipo: 'conferencia'");
    expect(auto).toContain("fila.push({ tipo: 'final'");
    expect(auto).toContain("document.body.classList.contains('print-mode-caixa')");
    expect(auto).toContain("document.body.classList.add('print-mode-caixa')");
    expect(auto).toContain('window.print()');
  });

  it('nao imprime conferencias ou vendas anteriores a ativacao da versao nova', () => {
    const auto = read('client/public/pdv/pdv-auto-close-print.js');
    expect(auto).toContain("CHECKPOINT_KEY = 'joao_caicara_auto_close_activation_v3'");
    expect(auto).toContain("CONFERENCE_CHECKPOINT_KEY = 'joao_caicara_auto_conference_activation_v1'");
    expect(auto).toContain('criadoEm >= ativadoEm');
    expect(auto).toContain('fechadoEm >= conferenciaAtivadaEm');
  });

  it('service worker entrega imediatamente a versao nova da impressao de fechamento', () => {
    const sw = read('client/public/pdv/service-worker.js');
    expect(sw).toContain('checkoutprint-v38');
    expect(sw).toContain('pdv-auto-close-print.js?v=3');
    expect(sw.indexOf('/pdv/pdv-auto-close-print.js')).toBeGreaterThan(sw.indexOf('/pdv/pdv-auto-production-print.js'));
  });
});
