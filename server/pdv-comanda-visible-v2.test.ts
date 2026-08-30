import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('comanda sempre visível no PDV', () => {
  it('renderiza diretamente na área nativa da comanda', () => {
    const src = read('client/public/pdv/comanda-visible-v2.js');
    expect(src).toContain("PDV_COMANDA_VISIBLE_RUNTIME === 'v4'");
    expect(src).toContain("document.getElementById('order-items')");
    expect(src).toContain("el.style.setProperty('display', 'block', 'important')");
    expect(src).toContain('Itens da Mesa ${numero}');
    expect(src).not.toContain('.order-panel #order-items{display:none!important}');
  });

  it('usa runtime e só prefere cache quando a mesa do runtime está vazia', () => {
    const src = read('client/public/pdv/comanda-visible-v2.js');
    expect(src).toContain("const CACHE_KEY = 'mesas_abertas_caicara_cache'");
    expect(src).toContain('numeroPeloTitulo');
    expect(src).toContain('mesasDoRuntime');
    expect(src).toContain('mesasDoCache');
    expect(src).toContain('mesaTemConteudo');
    expect(src).toContain('if (mesaTemConteudo(mesaRuntime)) return mesaRuntime');
    expect(src).toContain('if (mesaTemConteudo(mesaCache)) return mesaCache');
    expect(src).toContain("item?.qtd ?? item?.quantidade ?? 0");
  });

  it('renderiza nome, quantidade, preço, subtotal, observação e estado de envio', () => {
    const src = read('client/public/pdv/comanda-visible-v2.js');
    expect(src).toContain('nome.textContent = `${item.qtd}x ${item.nome}`');
    expect(src).toContain('Unit.: ${formatar(item.preco)}');
    expect(src).toContain("item.enviado === true ? '✅ Enviado' : '🆕 Pendente'");
    expect(src).toContain('Obs.: ${item.obs}');
    expect(src).toContain('Subtotal: ${formatar(item.preco * item.qtd)}');
  });

  it('acompanha a renderização original, Firebase, título e total', () => {
    const src = read('client/public/pdv/comanda-visible-v2.js');
    expect(src).toContain('renderizarComanda = envolvida');
    expect(src).toContain("db.ref('mesas').on('value'");
    expect(src).toContain("document.getElementById('mesa-titulo')");
    expect(src).toContain("document.getElementById('total-valor')");
    expect(src).toContain('setInterval(() => renderizar(false), 1000)');
  });

  it('service worker força nova versão e injeta a camada v4', () => {
    const sw = read('client/public/pdv/service-worker.js');
    expect(sw).toContain('view-v42');
    expect(sw).toContain("const COMANDA_VISIBLE_ASSET = '/pdv/comanda-visible-v2.js?v=4'");
    expect(sw).toContain('COMANDA_VISIBLE_ASSET');
    expect(sw).toContain('<script src="/pdv/comanda-visible-v2.js?v=4"></script>');
  });
});
