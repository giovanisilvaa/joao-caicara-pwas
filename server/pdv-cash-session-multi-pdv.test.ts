import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('sessão de caixa compartilhada entre múltiplos PDVs', () => {
  it('mantém uma única sessão global sincronizada em todos os PDVs', () => {
    const src = read('client/public/pdv/cash-session-v1.js');
    expect(src).toContain("const PATH = 'sessoesCaixa'");
    expect(src).toContain("refAtual = db().ref(`${PATH}/atual`)");
    expect(src).toContain('database.ref(PATH).transaction');
    expect(src).toContain('foi sincronizada neste PDV. Você pode continuar usando este computador normalmente.');
    expect(src).not.toContain('sessoesCaixaPorPdv');
    expect(src).not.toContain('deviceId');
  });

  it('congela a sessão alvo antes das leituras assíncronas de encerramento', () => {
    const src = read('client/public/pdv/cash-session-v1.js');
    expect(src).toContain('const sessaoAlvo = clone(sessaoAtual)');
    expect(src).toContain('const esperada = sessaoAlvo?.id || null');
    expect(src).toContain('resumoFinanceiroEstavelServidor(sessaoAlvo)');
    expect(src).toContain('sessaoAlvo.codigo || esperada');
  });

  it('trata fechamento concorrente já concluído como sucesso idempotente', () => {
    const src = read('client/public/pdv/cash-session-v1.js');
    expect(src).toContain('const registroEsperado = resultado.valor?.registros?.[esperada] || null');
    expect(src).toContain('registroEsperado?.status === STATUS_FECHADO');
    expect(src).toContain('já foi encerrada em outro PDV. Este computador foi sincronizado automaticamente.');
    expect(src).toContain('return true;');
  });

  it('preserva o bloqueio atômico para mudanças reais de sessão', () => {
    const src = read('client/public/pdv/cash-session-v1.js');
    expect(src).toContain('if (!ativa || ativa.status !== STATUS_ABERTO || ativa.id !== esperada) return;');
    expect(src).toContain('A sessão ativa mudou em outro PDV antes do encerramento. Nenhuma alteração foi gravada por este computador; o estado atual já foi sincronizado.');
    expect(src).toContain('delete proxima.atual');
  });
});
