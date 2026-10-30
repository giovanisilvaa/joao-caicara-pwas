import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transform } from './update.mjs';

const fixture = () => [
  { id: 9323, nome: 'sushi das Mulhres', preco: 119.9, categoria: 'sushi', ativo: true, setor: 'cozinha' },
  { id: 9324, nome: 'mulher', preco: 119.9, categoria: 'sushi', ativo: true, setor: 'cozinha' },
  { id: 9303, nome: 'Rodízio - DUPLINHA', preco: 249.9, categoria: 'sushi', ativo: true }
];

test('unifies only the name and duplicate visibility, preserving IDs, prices and source', () => {
  const source = fixture();
  const before = structuredClone(source);
  const { result, count } = transform(source);
  assert.equal(count, 2);
  assert.deepEqual(source, before);
  assert.deepEqual(result, [{ ...source[0], nome: 'Rodízio - MULHER' }, { ...source[1], ativo: false }, source[2]]);
  assert.equal(transform(result).count, 0);
  const mapped = Object.fromEntries(source.map(x => [`key_${x.id}`, x]));
  assert.deepEqual(Object.keys(transform(mapped).result), Object.keys(mapped));
});

test('aborts on changed identity, changed price, missing or duplicate IDs', () => {
  for (const mutate of [x => x.pop() && x.pop(), x => x[0].preco = 120,
    x => x[1].nome = 'outro', x => x.push(x[0]), x => x[0].ativo = false]) {
    const source = fixture(); mutate(source);
    const before = structuredClone(source);
    assert.throws(() => transform(source));
    assert.deepEqual(source, before);
  }
});

function runtime() {
  const elements = new Map();
  const make = () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {},
    appendChild(el) { if (el.id) elements.set(el.id, el); }, insertBefore(el) { this.appendChild(el); } });
  const selectors = new Map();
  const modal = { ...make(), querySelector(key) {
    if (!selectors.has(key)) selectors.set(key, make());
    return selectors.get(key);
  } };
  elements.set('rodizio-seletivo-modal', modal);
  elements.set('rodizio-pessoas', { value: '2' });
  const area = make();
  const document = { readyState: 'loading', documentElement: {}, body: make(), head: make(),
    addEventListener() {}, getElementById: key => elements.get(key) || null,
    createElement: make, querySelector: key => key === '.acoes-comanda-g' ? area : null,
    querySelectorAll: () => [] };
  const products = [
    { id: 9301, nome: 'Rodízio NORMAL', preco: 149.9 },
    { id: 9302, nome: 'Rodìzio - HOMEM', preco: 149.9 },
    { id: 9303, nome: 'Rodízio - DUPLINHA', preco: 249.9 },
    { id: 9304, nome: 'Festival - Sushi', preco: 119.9 },
    { id: 9323, nome: 'Rodízio - MULHER', preco: 119.9 }
  ];
  const charges = []; const updates = [];
  const context = vm.createContext({ document, console, produtos: products, mesaSelecionada: 1,
    mesas: { 1: { itens: [], cliente: 'Teste' } }, requestAnimationFrame() {}, setTimeout() {},
    MutationObserver: class { observe() {} }, renderizarComandaG() {}, renderizarMesasG() {}, alert() {},
    firebase: { auth: () => ({ currentUser: { email: 'garcom@acesso.joaocaicara.app', isAnonymous: false } }) },
    db: { ref: () => ({ push: () => ({ key: `order_${updates.length}_${Math.random()}` }),
      update: async value => { updates.push(value); } }) }, window: {} });
  context.window.MesaAtomic = {
    adicionarCobranca: async (numero, product, qtd) => {
      charges.push({ numero, product, qtd });
      const mesa = structuredClone(context.mesas[numero]);
      mesa.itens.push({ ...structuredClone(product), qtd, somenteCobranca: true, enviado: true });
      return { committed: true, mesa };
    },
    bloquearMesa: async numero => ({ committed: true, id: 'lock', mesa: structuredClone(context.mesas[numero]) }),
    normalizarMesa: value => structuredClone(value), cancelarBloqueio: async () => {}
  };
  const source = fs.readFileSync(new URL('../../client/public/garcom/rodizio-seletivo-v1.js', import.meta.url), 'utf8');
  const instrumented = source.replace(/\}\)\(\);\s*$/, `
    window.testHooks = { RODIZIOS_IDS, garantirBotao, quantidadePessoasRodizio, abrirAdesao, abrirItens,
      adicionarCobrancaRodizio, enviarItensRodizio, setSelecao: value => { selecao = value; } };
  })();`);
  vm.runInContext(instrumented, context);
  return { context, hooks: context.window.testHooks, products, elements, modal, selectors, charges, updates };
}

test('all five modalities get separate buttons and legacy MULHER charges remain recognized', () => {
  const r = runtime();
  const ids = r.hooks.RODIZIOS_IDS;
  assert.deepEqual(Array.from(ids), [9301, 9302, 9303, 9304, 9323]);
  const buttons = ids.map(id => r.hooks.garantirBotao(id));
  assert.equal(new Set(buttons.map(x => x.id)).size, 5);
  assert.equal(r.hooks.quantidadePessoasRodizio({ itens: [
    { id: 9323, qtd: 2 }, { id: 9324, qtd: 1 }, { id: 9302, qtd: 4 }
  ] }, 9323), 3);
  assert.equal(r.hooks.quantidadePessoasRodizio({ itens: [{ id: 9303, qtd: 2 }] }, 9303), 4);
});

test('each modality charges its own price once and sends selected dishes at zero extra cost', async () => {
  for (const id of [9301, 9302, 9303, 9304, 9323]) {
    const r = runtime(); const product = r.products.find(x => x.id === id);
    r.hooks.abrirAdesao(product);
    await r.hooks.adicionarCobrancaRodizio();
    assert.equal(r.charges.length, 1);
    assert.equal(r.charges[0].product.preco, product.preco);
    assert.equal(r.charges[0].product.produtoOriginalId, id);
    assert.equal(r.charges[0].qtd, 2);
    r.hooks.abrirItens(id);
    r.hooks.setSelecao({ shimeji: 1, sashimi_salmao: 3 });
    await r.hooks.enviarItensRodizio();
    assert.equal(r.charges.length, 1);
    const update = r.updates[0];
    assert.ok(Object.keys(update).every(key => key.startsWith('pedidosProducao/') || key.startsWith('mesas/1/bloqueioOperacional/')));
    const orders = Object.entries(update).filter(([key]) => key.startsWith('pedidosProducao/')).map(([, value]) => value);
    assert.equal(orders.length, 2);
    assert.deepEqual(orders.map(x => x.subSetor).sort(), ['cozinha', 'sushi']);
    for (const order of orders) {
      assert.equal(order.rodizioOrigemId, id);
      assert.equal(order.rodizioOrigemNome, product.nome);
      assert.ok(order.titulo.includes(product.nome));
      assert.equal(order.rodizioPessoas, id === 9303 ? 4 : 2);
      assert.ok(order.itens.every(x => x.preco === 0 && x.qtd > 0));
    }
    assert.equal(orders.flatMap(x => x.itens).reduce((n, x) => n + x.qtd, 0), 4);
  }
});

test('legacy MULHER orders can request dishes without being rewritten or charged again', async () => {
  const r = runtime();
  const historical = { id: 9324, nome: 'mulher', preco: 119.9, qtd: 1, enviado: true };
  r.context.mesas[1].itens.push(structuredClone(historical));
  r.hooks.abrirItens(9324);
  r.hooks.setSelecao({ hot_roll_salmao: 2 });
  await r.hooks.enviarItensRodizio();
  assert.equal(r.charges.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(r.context.mesas[1].itens[0])), historical);
  const order = Object.entries(r.updates[0]).find(([key]) => key.startsWith('pedidosProducao/'))[1];
  assert.equal(order.rodizioOrigemId, 9323);
  assert.equal(order.rodizioOrigemNome, 'Rodízio - MULHER');
});

test('blocks empty selections and closed accounts without sending orders', async () => {
  const r = runtime();
  r.context.mesas[1].itens.push({ id: 9304, qtd: 1, preco: 119.9 });
  r.hooks.abrirItens(9304);
  await assert.rejects(r.hooks.enviarItensRodizio(), /Selecione pelo menos/);
  r.hooks.setSelecao({ shimeji: 1 });
  r.context.mesas[1].estadoConta = 'aguardando_pagamento';
  await assert.rejects(r.hooks.enviarItensRodizio(), /aguardando pagamento/);
  assert.equal(r.updates.length, 0);
  assert.equal(r.charges.length, 0);
});
