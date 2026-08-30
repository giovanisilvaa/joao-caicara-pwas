import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

const src = read('client/public/pdv/pdv-item-transfer.js');
const pdvSw = read('client/public/pdv/service-worker.js');
const garcomSw = read('client/public/garcom/service-worker.js');
const deploy = read('.github/workflows/firebase-hosting-deploy.yml');

describe('transferência de itens entre mesas pelo PDV', () => {
  it('é exclusiva do PDV administrador e não é carregada no Garçom', () => {
    expect(src).toContain("const ADMIN_EMAIL = 'adm@acesso.joaocaicara.app'");
    expect(src).toContain("usuarioAdmin()");
    expect(pdvSw).toContain("const ITEM_TRANSFER_ASSET = '/pdv/pdv-item-transfer.js?v=1'");
    expect(pdvSw).toContain('<script src="/pdv/pdv-item-transfer.js?v=1"></script>');
    expect(garcomSw).not.toContain('pdv-item-transfer.js');
  });

  it('bloqueia origem e destino antes de mover qualquer item', () => {
    expect(src).toContain("bloquearMesa(origem, { tipo: 'transferencia_item', origem: 'pdv' })");
    expect(src).toContain("bloquearMesa(destino, { tipo: 'receber_transferencia_item', origem: 'pdv' })");
    expect(src).toContain("cancelarBloqueio(destino, lockDestino.id, 'falha_transferencia')");
    expect(src).toContain("cancelarBloqueio(origem, lockOrigem.id, 'falha_transferencia')");
  });

  it('impede transferência se alguma conta estiver fechada aguardando pagamento', () => {
    expect(src).toContain("const STATUS_FECHADA = 'aguardando_pagamento'");
    expect(src).toContain('if (contaFechada(mesaOrigem) || contaFechada(mesaDestino))');
  });

  it('permite transferência parcial sem apagar o restante da origem', () => {
    expect(src).toContain('const restante = qtdDisponivel - qtdMover');
    expect(src).toContain('if (restante <= 0) finalOrigem.itens.splice(index, 1)');
    expect(src).toContain('else itemOrigemFinal.qtd = restante');
    expect(src).toContain('itemTransferido.qtd = qtdMover');
  });

  it('preserva os dados do item e cria nova identidade operacional no destino', () => {
    expect(src).toContain('const itemTransferido = clone(itemOriginal)');
    expect(src).toContain("itemTransferido.itemOperacaoId = atomic().novoId('item_transferido')");
    expect(src).toContain('itemTransferido.transferidoDeMesa = origem');
    expect(src).toContain('itemTransferido.transferidoPor = \'pdv\'');
  });

  it('confirma origem, destino e auditoria em uma única atualização raiz', () => {
    expect(src).toContain('[`mesas/${origem}`]: finalOrigem');
    expect(src).toContain('[`mesas/${destino}`]: finalDestino');
    expect(src).toContain("acao: 'transferir_item_mesa'");
    expect(src).toContain("await db.ref('/').update(atualizacoes)");
  });

  it('força atualização do PWA e verifica o arquivo publicado', () => {
    expect(pdvSw).toContain('transfer-v36');
    expect(deploy).toContain("verificar_arquivo '/pdv/pdv-item-transfer.js' 'client/public/pdv/pdv-item-transfer.js'");
  });
});
