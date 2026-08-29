import fs from 'node:fs';

const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const cardapio = read(process.argv[2]);
const mesas = read(process.argv[3]);
const pedidos = read(process.argv[4]);
const vendas = read(process.argv[5]);

const erros = [];
const avisos = [];
const agora = Date.now();
const mesasValidas = new Set([...Array.from({ length: 25 }, (_, i) => i + 1), ...Array.from({ length: 16 }, (_, i) => i + 50)]);
const arr = valor => Array.isArray(valor) ? valor.filter(Boolean) : (valor && typeof valor === 'object' ? Object.values(valor).filter(Boolean) : []);
const num = valor => Number(valor);
const nomeNorm = valor => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function erro(msg) { erros.push(msg); }
function aviso(msg) { avisos.push(msg); }
function itemPorId(lista, id) { return lista.find(item => num(item?.id) === id); }
function exigirPreco(lista, id, nome, preco) {
  const item = itemPorId(lista, id);
  if (!item) return erro(`cardapio: item ${id} (${nome}) ausente`);
  if (nomeNorm(item.nome) !== nomeNorm(nome)) erro(`cardapio: item ${id} com nome inesperado`);
  if (num(item.preco) !== preco) erro(`cardapio: item ${id} (${nome}) com preço ${item.preco}, esperado ${preco}`);
}

if (!Array.isArray(cardapio)) erro('cardapio: raiz não é lista');
else {
  if (cardapio.length !== 125) erro(`cardapio: quantidade ${cardapio.length}, esperado 125`);
  const ids = cardapio.map(item => num(item?.id));
  if (ids.some(id => !Number.isFinite(id))) erro('cardapio: existe item sem ID numérico');
  if (new Set(ids).size !== ids.length) erro('cardapio: IDs duplicados');
  if (cardapio.some(item => num(item?.id) === 75 || nomeNorm(item?.nome) === nomeNorm('Heineken Zero · 600 ml'))) erro('cardapio: Heineken Zero 600 ml reapareceu');

  const esperados = [
    [16,'Ostras · 12 unid.',75],[17,'Ostras · 6 unid.',45],[38,'Peixe com Molho de Camarão',145],
    [40,'Filé de Peixe com Legumes',135],[41,'Moqueca de Peixe',220],[42,'Caldeirada',285],
    [51,'Macarrão ao Fundo do Mar',265],[103,'Suco de Laranja · 400 ml',20],
    [104,'Suco de Polpa · 400 ml',18],[105,'Suco de Laranja com Polpa · 400 ml',22],
    [115,'Mandioca + Batata + Camarão',110],[116,'Mandioca + Batata + Peixe',95],
    [117,'Mandioca + Batata + Carne',95],[118,'Risoto de Palmito e Champignon',65],
    [119,'Risoto de Shimeji',69],[120,'Espaguete ao Molho Branco com Palmito',65],
    [121,'Espaguete com Champignon, Alcaparras e Cebola Roxa, Puxado no Azeite',69],
    [122,'Baiacu à Caiçara',240],[123,'Baiacu à La Meunière',240],
    [124,'Filé Mignon à Parmegiana',210],[125,'Filé Mignon à Cubana',210],[126,'Filé Mignon com Fritas',195]
  ];
  for (const [id,nome,preco] of esperados) exigirPreco(cardapio,id,nome,preco);

  for (const item of cardapio) {
    if (!String(item?.nome || '').trim()) erro(`cardapio: item ${item?.id ?? '?'} sem nome`);
    if (!Number.isFinite(num(item?.preco)) || num(item?.preco) < 0) erro(`cardapio: item ${item?.id ?? '?'} com preço inválido`);
    if (!String(item?.categoria || '').trim()) erro(`cardapio: item ${item?.id ?? '?'} sem categoria`);
    if (!['cozinha','bar'].includes(String(item?.setor || ''))) aviso(`cardapio: item ${item?.id ?? '?'} sem setor padrão cozinha/bar`);
  }
}

const mesasObj = mesas && typeof mesas === 'object' ? mesas : {};
let mesasAbertas = 0;
let itensAbertos = 0;
let itensNovos = 0;
let bloqueiosAtivos = 0;
const enviosAbertos = [];

for (const [chave, valor] of Object.entries(mesasObj)) {
  const numero = num(chave);
  if (!mesasValidas.has(numero)) erro(`mesas: chave inválida ${chave}`);
  if (!valor || typeof valor !== 'object') { erro(`mesas/${chave}: registro inválido`); continue; }
  const itens = arr(valor.itens);
  const aberta = Boolean(valor.abertura || itens.length);
  if (aberta) mesasAbertas++;
  itensAbertos += itens.length;
  if (itens.length && !valor.abertura) erro(`mesas/${chave}: possui itens sem timestamp de abertura`);
  if (valor.abertura != null && !Number.isFinite(num(valor.abertura))) erro(`mesas/${chave}: abertura inválida`);

  const idsOperacao = new Set();
  for (const item of itens) {
    const qtd = num(item?.qtd);
    const preco = num(item?.preco);
    if (!String(item?.nome || '').trim()) erro(`mesas/${chave}: item sem nome`);
    if (!Number.isFinite(qtd) || qtd <= 0) erro(`mesas/${chave}: item com quantidade inválida`);
    if (!Number.isFinite(preco) || preco < 0) erro(`mesas/${chave}: item com preço inválido`);
    if (item?.itemOperacaoId) {
      if (idsOperacao.has(item.itemOperacaoId)) erro(`mesas/${chave}: itemOperacaoId duplicado`);
      idsOperacao.add(item.itemOperacaoId);
    }
    if (item?.enviado !== true && item?.rascunho !== true) itensNovos++;
    if (item?.enviado === true && item?.envioId) enviosAbertos.push({ mesa: numero, envioId: String(item.envioId), setor: item?.setor === 'bar' ? 'bar' : 'cozinha' });
  }

  const lock = valor.bloqueioOperacional;
  if (lock?.ativo === true) {
    bloqueiosAtivos++;
    const criadoEm = num(lock.criadoEm);
    if (!lock.id) erro(`mesas/${chave}: bloqueio ativo sem id`);
    if (Number.isFinite(criadoEm) && agora - criadoEm > 3 * 60 * 1000) erro(`mesas/${chave}: bloqueio operacional ativo há mais de 3 minutos`);
  }
}

const pedidosLista = arr(pedidos);
const combinacoesPedido = new Set();
let pedidosInvalidos = 0;
for (const pedido of pedidosLista) {
  const mesa = num(pedido?.mesa);
  const setor = String(pedido?.setor || '');
  const status = String(pedido?.status || '');
  const itens = arr(pedido?.itens);
  let invalido = false;
  if (!mesasValidas.has(mesa)) { erro('pedidosProducao: pedido com mesa inválida'); invalido = true; }
  if (!['cozinha','bar'].includes(setor)) { erro('pedidosProducao: pedido com setor inválido'); invalido = true; }
  if (!status) { erro('pedidosProducao: pedido sem status'); invalido = true; }
  if (!itens.length) { erro('pedidosProducao: pedido sem itens'); invalido = true; }
  if (invalido) pedidosInvalidos++;
  if (pedido?.envioId) {
    const chave = `${pedido.envioId}|${setor}`;
    if (combinacoesPedido.has(chave)) erro('pedidosProducao: envioId/setor duplicado');
    combinacoesPedido.add(chave);
  }
}

for (const envio of enviosAbertos) {
  const chave = `${envio.envioId}|${envio.setor}`;
  if (!combinacoesPedido.has(chave)) aviso(`sincronizacao: item enviado em mesa aberta sem ticket correspondente localizado (${envio.mesa}/${envio.setor})`);
}

const vendasLista = arr(vendas);
let vendasInvalidas = 0;
for (const venda of vendasLista) {
  const total = num(venda?.total);
  const mesa = num(venda?.mesa);
  let invalida = false;
  if (!Number.isFinite(total) || total < 0) { erro('vendas: registro com total inválido'); invalida = true; }
  if (!Number.isFinite(mesa)) { erro('vendas: registro sem mesa numérica'); invalida = true; }
  if (invalida) vendasInvalidas++;
}

console.log('=== HEALTH AUDIT PRODUÇÃO — SOMENTE LEITURA ===');
console.log(`cardapio_itens=${Array.isArray(cardapio) ? cardapio.length : 0}`);
console.log(`mesas_abertas=${mesasAbertas}`);
console.log(`itens_em_mesas_abertas=${itensAbertos}`);
console.log(`itens_novos_aguardando_envio=${itensNovos}`);
console.log(`bloqueios_operacionais_ativos=${bloqueiosAtivos}`);
console.log(`pedidos_producao_total=${pedidosLista.length}`);
console.log(`vendas_total=${vendasLista.length}`);
console.log(`erros=${erros.length}`);
console.log(`avisos=${avisos.length}`);
for (const msg of erros) console.log(`ERRO: ${msg}`);
for (const msg of avisos) console.log(`AVISO: ${msg}`);

if (erros.length) process.exit(1);
