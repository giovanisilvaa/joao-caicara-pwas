import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('restrições operacionais do Garçom', () => {
  it('bloqueia qualquer redução de quantidade no Garçom', () => {
    const src = read('client/public/garcom/restricoes-operacionais.js');
    expect(src).toContain('if (Number(delta) < 0)');
    expect(src).toContain('Cancelamento ou redução de item deve ser feito pelo caixa/PDV.');
  });

  it('bloqueia limpeza de comanda no Garçom', () => {
    const src = read('client/public/garcom/restricoes-operacionais.js');
    expect(src).toContain('window.limparComandaG = protegidaLimpeza');
    expect(src).toContain('Limpar mesa é uma operação exclusiva do caixa/PDV.');
  });

  it('remove da interface os controles destrutivos e preserva o botão de aumento', () => {
    const src = read('client/public/garcom/restricoes-operacionais.js');
    expect(src).toContain('.btn-limpar-g{display:none!important}');
    expect(src).toContain('button[onclick*="alterarQtdG"][onclick*="-1"]');
    expect(src).not.toContain('button[onclick*="alterarQtdG"][onclick*="+1"]');
  });

  it('não toca diretamente em Firebase, mesas ou vendas', () => {
    const src = read('client/public/garcom/restricoes-operacionais.js');
    expect(src).not.toContain('db.ref(');
    expect(src).not.toContain('firebase.database');
    expect(src).not.toContain('/vendas');
    expect(src).not.toContain('/mesas');
  });
});
