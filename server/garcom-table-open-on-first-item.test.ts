import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('Garçom abre mesa somente no primeiro item', () => {
  it('não grava abertura ao apenas selecionar a mesa', () => {
    const concurrency = read('client/public/garcom/mesa-concurrency.js');
    expect(concurrency).not.toContain('atomic().abrirMesa(numero');
    expect(concurrency).toContain('atomic().adicionarItem(mesaSelecionada, produto');
    expect(concurrency).toContain('const atual = atomic().normalizarMesa(mesas[numero] || atomic().mesaVazia())');
  });

  it('limpa mesa fantasma por transação e preserva concorrência', () => {
    const concurrency = read('client/public/garcom/mesa-concurrency.js');
    expect(concurrency).toContain("database.ref(`mesas/${numero}`).transaction(current => {");
    expect(concurrency).toContain('if (!mesaFantasma(atual)) return;');
    expect(concurrency).toContain('return atomic().mesaVazia();');
    expect(concurrency).toContain('!atomic().bloqueioAtivo(normalizada)');
  });

  it('mantém a abertura real no primeiro produto', () => {
    const atomic = read('client/public/mesa-atomic.js');
    expect(atomic).toContain('async function adicionarItem(numero, produto');
    expect(atomic).toContain('if (!mesa.abertura) {');
    expect(atomic).toContain('mesa.abertura = agora();');
    expect(atomic).toContain('registrarGarcom(mesa, identidade);');
  });

  it('remove nome de cliente somente do fluxo do Garçom e preserva o PDV', () => {
    const garcom = read('client/public/garcom/mesa-concurrency.js');
    const pdv = read('client/public/pdv/mesa-concurrency.js');
    expect(garcom).not.toContain('atomic().atualizarCliente(mesaSelecionada');
    expect(garcom).toContain("document.querySelector('.cliente-row')?.remove()");
    expect(garcom).toContain("document.getElementById('garcom-menu-client')?.remove()");
    expect(pdv).toContain('atomic().atualizarCliente(numero, nome)');
  });
});
