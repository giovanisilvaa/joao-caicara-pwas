import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('persistência do resumo de vendas no logout do PDV', () => {
  it('restaura o último histórico local sem apagar vendas', () => {
    const src = read('client/public/pdv/vendas-auth-reconnect.js');
    expect(src).toContain("const CACHE_KEY = 'historico_vendas_caicara'");
    expect(src).toContain('vendasCacheDiario = lista.slice()');
    expect(src).toContain('restaurarCacheLocal()');
    expect(src).toContain("localStorage.setItem(CACHE_KEY, JSON.stringify(vendas))");
  });

  it('reconecta a leitura de /vendas quando o administrador autentica novamente', () => {
    const src = read('client/public/pdv/vendas-auth-reconnect.js');
    expect(src).toContain("refVendas = firebaseDb.ref('vendas')");
    expect(src).toContain("refVendas.on('value', aoValor, aoErro)");
    expect(src).toContain("refVendas.off('value', aoValor)");
    expect(src).toContain('firebaseAuth.onAuthStateChanged(user =>');
    expect(src).toContain('if (user) conectar()');
  });

  it('é somente leitura no Firebase', () => {
    const src = read('client/public/pdv/vendas-auth-reconnect.js');
    expect(src).not.toContain(".set(");
    expect(src).not.toContain(".update(");
    expect(src).not.toContain(".remove(");
    expect(src).not.toContain(".push(");
  });

  it('service worker publica e injeta a camada de reconexão', () => {
    const sw = read('client/public/pdv/service-worker.js');
    expect(sw).toContain('sales-v43');
    expect(sw).toContain("const PDV_VENDAS_AUTH_ASSET = '/pdv/' + 'vendas-auth-reconnect.js?v=1'");
    expect(sw).toContain('PDV_VENDAS_AUTH_ASSET');
    expect(sw).toContain('<script src="/pdv/vendas-auth-reconnect.js?v=1"></script>');
  });
});
