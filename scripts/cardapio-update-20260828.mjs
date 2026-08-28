import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const normalizar = valor => String(valor ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const NOVOS = {
  combos: [
    { id: 115, nome: 'Mandioca + Batata + Camarão', preco: 110, categoria: 'combos_praia', setor: 'cozinha', favorito: false, ativo: true, servePara2: false },
    { id: 116, nome: 'Mandioca + Batata + Peixe', preco: 95, categoria: 'combos_praia', setor: 'cozinha', favorito: false, ativo: true, servePara2: false },
    { id: 117, nome: 'Mandioca + Batata + Carne', preco: 95, categoria: 'combos_praia', setor: 'cozinha', favorito: false, ativo: true, servePara2: false }
  ],
  veganos: [
    { id: 118, nome: 'Risoto de Palmito e Champignon', preco: 65, categoria: 'veganos_vegetarianos', setor: 'cozinha', favorito: false, ativo: true, servePara2: false, individual: true },
    { id: 119, nome: 'Risoto de Shimeji', preco: 69, categoria: 'veganos_vegetarianos', setor: 'cozinha', favorito: false, ativo: true, servePara2: false, individual: true },
    { id: 120, nome: 'Espaguete ao Molho Branco com Palmito', preco: 65, categoria: 'veganos_vegetarianos', setor: 'cozinha', favorito: false, ativo: true, servePara2: false, individual: true },
    { id: 121, nome: 'Espaguete com Champignon, Alcaparras e Cebola Roxa, Puxado no Azeite', preco: 69, categoria: 'veganos_vegetarianos', setor: 'cozinha', favorito: false, ativo: true, servePara2: false, individual: true }
  ],
  peixes: [
    { id: 122, nome: 'Baiacu à Caiçara', preco: 240, categoria: 'peixes_camaroes', setor: 'cozinha', favorito: false, ativo: true, servePara2: true },
    { id: 123, nome: 'Baiacu à La Meunière', preco: 240, categoria: 'peixes_camaroes', setor: 'cozinha', favorito: false, ativo: true, servePara2: true }
  ],
  carnes: [
    { id: 124, nome: 'Filé Mignon à Parmegiana', preco: 210, categoria: 'carnes', setor: 'cozinha', favorito: false, ativo: true, servePara2: true },
    { id: 125, nome: 'Filé Mignon à Cubana', preco: 210, categoria: 'carnes', setor: 'cozinha', favorito: false, ativo: true, servePara2: true },
    { id: 126, nome: 'Filé Mignon com Fritas', preco: 195, categoria: 'carnes', setor: 'cozinha', favorito: false, ativo: true, servePara2: true }
  ]
};

export const TODOS_NOVOS = Object.values(NOVOS).flat();

function porId(lista, id, nomeEsperado) {
  const item = lista.find(registro => Number(registro?.id) === Number(id));
  if (!item) throw new Error(`Item obrigatório id=${id} não encontrado.`);
  if (normalizar(item.nome) !== normalizar(nomeEsperado)) {
    throw new Error(`Item id=${id} mudou de nome: esperado "${nomeEsperado}", encontrado "${item.nome}".`);
  }
  return item;
}

function exigirPreco(item, esperado) {
  if (Number(item.preco) !== Number(esperado)) {
    throw new Error(`Preço de segurança divergente em "${item.nome}": esperado ${esperado}, encontrado ${item.preco}.`);
  }
}

function inserirAposCategoria(lista, categoria, registros) {
  let ultimo = -1;
  lista.forEach((item, indice) => { if (item?.categoria === categoria) ultimo = indice; });
  if (ultimo < 0) throw new Error(`Categoria obrigatória "${categoria}" não encontrada.`);
  lista.splice(ultimo + 1, 0, ...registros.map(item => ({ ...item })));
}

function validarIdsUnicos(lista) {
  const ids = new Set();
  for (const item of lista) {
    const id = Number(item?.id);
    if (!Number.isFinite(id)) throw new Error(`Item sem ID numérico: ${JSON.stringify(item)}`);
    if (ids.has(id)) throw new Error(`ID duplicado detectado: ${id}`);
    ids.add(id);
  }
}

export function validarAtualizacao(lista) {
  if (!Array.isArray(lista)) throw new Error('O cardápio final não é uma lista.');
  validarIdsUnicos(lista);

  const esperados = [
    [16, 'Ostras · 12 unid.', 75],
    [17, 'Ostras · 6 unid.', 45],
    [38, 'Peixe com Molho de Camarão', 145],
    [40, 'Filé de Peixe com Legumes', 135],
    [41, 'Moqueca de Peixe', 220],
    [42, 'Caldeirada', 285],
    [51, 'Macarrão ao Fundo do Mar', 265],
    [103, 'Suco de Laranja · 400 ml', 20],
    [104, 'Suco de Polpa · 400 ml', 18],
    [105, 'Suco de Laranja com Polpa · 400 ml', 22]
  ];
  for (const [id, nome, preco] of esperados) {
    const item = porId(lista, id, nome);
    if (Number(item.preco) !== preco) throw new Error(`Preço final incorreto em ${nome}.`);
  }

  if (lista.some(item => Number(item?.id) === 75 || normalizar(item?.nome) === normalizar('Heineken Zero · 600 ml'))) {
    throw new Error('Heineken Zero · 600 ml ainda está presente.');
  }

  for (const esperado of TODOS_NOVOS) {
    const item = porId(lista, esperado.id, esperado.nome);
    for (const campo of ['preco', 'categoria', 'setor', 'favorito', 'ativo', 'servePara2']) {
      if (item[campo] !== esperado[campo]) throw new Error(`Campo ${campo} incorreto em ${esperado.nome}.`);
    }
    if (esperado.individual === true && item.individual !== true) throw new Error(`${esperado.nome} não está marcado como individual.`);
  }

  const ordemCategorias = lista.map(item => item.categoria);
  const ultimoAperitivo = ordemCategorias.lastIndexOf('aperitivos');
  const primeiroCombo = ordemCategorias.indexOf('combos_praia');
  if (primeiroCombo !== ultimoAperitivo + 1) throw new Error('Combos Especiais Praia não estão imediatamente após Aperitivos.');

  return true;
}

export function aplicarAtualizacao(origem) {
  if (!Array.isArray(origem)) throw new Error('O /cardapio de produção não é uma lista.');
  const lista = JSON.parse(JSON.stringify(origem));
  validarIdsUnicos(lista);

  // Estado auditado em 28/08/2026. Se algo mudou antes da gravação, aborta para não sobrescrever edição alheia.
  if (lista.length !== 114) throw new Error(`Cardápio mudou desde a auditoria: esperado 114 itens, encontrado ${lista.length}.`);
  const maiorId = Math.max(...lista.map(item => Number(item?.id) || 0));
  if (maiorId !== 114) throw new Error(`Maior ID mudou desde a auditoria: esperado 114, encontrado ${maiorId}.`);
  if (TODOS_NOVOS.some(novo => lista.some(item => Number(item?.id) === novo.id))) throw new Error('Um dos IDs reservados 115-126 já está em uso.');

  const ostra12 = porId(lista, 16, 'Ostras · 12 unid.'); exigirPreco(ostra12, 175); ostra12.preco = 75;
  const ostra6 = porId(lista, 17, 'Ostras · 6 unid.'); exigirPreco(ostra6, 75); ostra6.preco = 45;

  const peixeCamarao = porId(lista, 38, 'Peixe com Molho de Camarão'); exigirPreco(peixeCamarao, 125); peixeCamarao.preco = 145;
  const peixeLegumes = porId(lista, 40, 'Filé de Peixe com Legumes'); exigirPreco(peixeLegumes, 125); peixeLegumes.preco = 135;
  const moqueca = porId(lista, 41, 'Moqueca de Peixe'); exigirPreco(moqueca, 285); moqueca.preco = 220;
  const caldeirada = porId(lista, 42, 'Caldeirada'); exigirPreco(caldeirada, 145); caldeirada.preco = 285;
  const fundoMar = porId(lista, 51, 'Macarrão ao Fundo do Mar'); exigirPreco(fundoMar, 225); fundoMar.preco = 265;

  const sucoLaranja = porId(lista, 103, 'Suco Natural · 400 ml'); exigirPreco(sucoLaranja, 18);
  sucoLaranja.nome = 'Suco de Laranja · 400 ml'; sucoLaranja.preco = 20;
  const sucoPolpa = porId(lista, 104, 'Suco de Polpa · 400 ml'); exigirPreco(sucoPolpa, 16); sucoPolpa.preco = 18;
  const sucoLaranjaPolpa = porId(lista, 105, 'Suco de Polpa com Laranja · 400 ml'); exigirPreco(sucoLaranjaPolpa, 20);
  sucoLaranjaPolpa.nome = 'Suco de Laranja com Polpa · 400 ml'; sucoLaranjaPolpa.preco = 22;

  const heineken = porId(lista, 75, 'Heineken Zero · 600 ml'); exigirPreco(heineken, 22);
  const indiceHeineken = lista.indexOf(heineken);
  lista.splice(indiceHeineken, 1);

  inserirAposCategoria(lista, 'aperitivos', NOVOS.combos);
  inserirAposCategoria(lista, 'saladas', NOVOS.veganos);
  inserirAposCategoria(lista, 'peixes_camaroes', NOVOS.peixes);
  inserirAposCategoria(lista, 'carnes', NOVOS.carnes);

  if (lista.length !== 125) throw new Error(`Quantidade final inesperada: ${lista.length}.`);
  validarAtualizacao(lista);
  return lista;
}

function resumo(lista) {
  return TODOS_NOVOS.map(item => `${item.id} ${item.nome} = R$ ${item.preco.toFixed(2)}`).join('\n');
}

const executadoDiretamente = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (executadoDiretamente) {
  const modo = process.argv[2];
  const entrada = process.argv[3];
  const saida = process.argv[4];
  if (!modo || !entrada) throw new Error('Uso: node cardapio-update-20260828.mjs <transform|verify> <entrada.json> [saida.json]');
  const dados = JSON.parse(fs.readFileSync(entrada, 'utf8'));
  if (modo === 'transform') {
    if (!saida) throw new Error('Informe o arquivo de saída.');
    const atualizado = aplicarAtualizacao(dados);
    fs.writeFileSync(saida, JSON.stringify(atualizado));
    console.log(`Transformação validada: ${dados.length} -> ${atualizado.length} itens.`);
    console.log(resumo(atualizado));
  } else if (modo === 'verify') {
    validarAtualizacao(dados);
    console.log(`Cardápio pós-gravação validado com ${dados.length} itens.`);
  } else {
    throw new Error(`Modo inválido: ${modo}`);
  }
}
