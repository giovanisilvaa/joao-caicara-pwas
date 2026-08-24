# João Caiçara — Sistema de Operação do Restaurante

Sistema web progressivo desenvolvido para a operação do **João Caiçara Tradição**, reunindo atendimento, comandas, produção, caixa e gestão em dois PWAs sincronizados em tempo real pelo Firebase.

O projeto possui dois módulos principais:

- **Garçom** — abertura de mesas, lançamento de pedidos, envio para cozinha/bar e fechamento de contas.
- **Caixa / PDV** — acompanhamento das mesas, pagamentos, relatórios, cardápio, auditoria, backup e administração.

## Links oficiais

| Módulo | Link |
| --- | --- |
| Garçom | https://joaocaicaratradicao.web.app/garcom/ |
| Caixa / PDV | https://joaocaicaratradicao.web.app/pdv/ |
| Firebase Hosting | https://joaocaicaratradicao.web.app/ |

> Os endereços publicados no Firebase Hosting são as versões oficiais do sistema.

## Objetivo

O sistema foi criado para reduzir processos manuais e centralizar a operação do restaurante.

O Garçom pode abrir uma mesa diretamente pelo próprio aparelho, lançar pedidos e enviá-los para produção. As mesas e comandas são sincronizadas automaticamente com o PDV.

O Caixa acompanha a operação em tempo real, controla pagamentos, transferência e junção de mesas, divisão de contas, relatórios, taxa de serviço, fechamento de caixa e funções administrativas.

## PWA do Garçom

Principais recursos:

- visualização das mesas do salão e deck/praia;
- abertura de comanda diretamente pelo Garçom;
- identificação do Garçom por nome em cada sessão;
- uma única conta autenticada da equipe de garçons;
- registro do responsável por cada item lançado;
- suporte a vários garçons atendendo a mesma mesa;
- pesquisa rápida de produtos;
- produtos favoritos em destaque;
- categorias do cardápio;
- ajuste de quantidade;
- observações nos itens;
- envio separado para cozinha e bar;
- indicador de sincronização;
- fechamento da conta pelo próprio Garçom;
- opção de **10% de taxa de serviço**, marcada por padrão;
- cálculo de total, pagamento e troco;
- sincronização automática da venda com o PDV.

O Garçom pode consultar o cardápio, mas **não possui permissão para alterá-lo**.

## PWA do Caixa / PDV

Principais recursos:

- acompanhamento das mesas em tempo real;
- abertura e edição de comandas;
- transferência e junção de mesas;
- separação de produção entre cozinha e bar;
- impressão e reimpressão de pedidos;
- divisão de conta;
- fechamento com múltiplas formas de pagamento;
- cálculo de troco;
- taxa de serviço de 10%;
- fechamento rápido de conta;
- histórico diário de vendas;
- relatório de vendas por Garçom;
- totalização da taxa de serviço por turno;
- gerenciamento do cardápio;
- auditoria de operações;
- backup e restauração;
- fechamento de caixa;
- zeragem operacional do caixa sem excluir o histórico salvo no Firebase.

## Sessões independentes

PDV e Garçom podem ser utilizados simultaneamente no mesmo computador, em abas diferentes.

A autenticação utiliza **persistência por sessão/aba**, evitando que o login administrativo do PDV derrube a sessão do Garçom ou vice-versa.

## Segurança

A segurança principal é aplicada no **Firebase Authentication + Realtime Database Rules**.

As contas possuem permissões diferentes no banco:

| Operação | Administrador | Garçom |
| --- | :---: | :---: |
| Ler mesas | ✅ | ✅ |
| Alterar mesas | ✅ | ✅ |
| Ler cardápio | ✅ | ✅ |
| Alterar cardápio | ✅ | ❌ |
| Criar pedidos de produção | ✅ | ✅ |
| Criar venda ao fechar mesa | ✅ | ✅ |
| Alterar venda existente | ✅ | ❌ |
| Consultar histórico de vendas | ✅ | ❌ |
| Consultar auditoria | ✅ | ❌ |
| Fechamento de caixa | ✅ | ❌ |
| Alterar perfis de acesso pelo navegador | ❌ | ❌ |

As regras ficam versionadas em:

```text
database.rules.json
```

Nenhuma senha operacional deve ser armazenada no código ou na documentação do repositório.

## Concorrência e integridade das comandas

As comandas são protegidas contra alterações simultâneas de vários aparelhos na mesma mesa.

O padrão anterior de **ler a mesa → alterar localmente → gravar a mesa inteira com `set()`** podia provocar uma condição de corrida: dois aparelhos podiam ler a mesma versão e a última gravação sobrescrever a alteração do outro.

A camada atual utiliza:

- `Firebase Realtime Database transaction()` para alterações concorrentes da comanda;
- `itemOperacaoId` único por linha de item, permitindo localizar a linha correta mesmo após outra alteração simultânea;
- `bloqueioOperacional` temporário durante fechamento, transferência e envio para produção;
- `update()` multipath para confirmar conjuntos de alterações críticas de uma só vez;
- envio para produção que altera apenas os itens reservados, sem sobrescrever a mesa inteira;
- fechamento que calcula a venda a partir de um snapshot autoritativo obtido após o bloqueio da mesa;
- transferência que bloqueia origem e destino antes de mover/juntar as comandas.

O núcleo compartilhado está em:

```text
client/public/mesa-atomic.js
```

As integrações específicas estão em:

```text
client/public/garcom/mesa-concurrency.js
client/public/pdv/mesa-concurrency.js
```

### Teste virtual de alta carga — 24/08/2026

Foi criada uma bateria determinística de concorrência que **não escreve no Firebase de produção**. Ela reproduz o comportamento de várias sessões alterando mesas ao mesmo tempo e mantém um cenário-controle com o algoritmo antigo para verificar se o teste é capaz de detectar perda.

Arquivos dos testes:

```text
server/virtual-load-diagnostic.test.ts
server/mesa-concurrency.test.ts
```

Resultado da execução isolada:

| Cenário | Esperado | Preservado | Perdido | Duplicado | Resultado |
| --- | ---: | ---: | ---: | ---: | --- |
| Controle legado `read + set`, carga simultânea artificial | 2.400 | 40 | 2.360 | — | colisão detectada |
| 12 garçons / 40 mesas / transações concorrentes | 2.400 | 2.400 | **0** | 0 | ✅ aprovado |
| Estresse transacional / 40 mesas | 20.000 | 20.000 | **0** | **0** | ✅ aprovado |
| Pedidos de produção com chave única | 5.000 | 5.000 | **0** | 0 | ✅ aprovado |
| Vendas com chave única | 1.200 | 1.200 | **0** | 0 | ✅ aprovado |
| Alteração durante lock de fechamento | bloqueada | bloqueada | 0 | 0 | ✅ aprovado |

> O cenário legado é propositalmente extremo e serve como **controle do teste**, não como estimativa de perda no restaurante. Ele demonstra que a simulação detecta a condição de corrida que motivou a correção.

O teste de 20.000 lançamentos também verificou individualmente a presença de cada identificador esperado e terminou com **zero item perdido e zero item duplicado**.

Para executar somente a bateria de concorrência:

```bash
pnpm test -- server/virtual-load-diagnostic.test.ts server/mesa-concurrency.test.ts
```

### O que este teste comprova — e o que não comprova

O teste valida a **integridade lógica da aplicação sob concorrência virtual**: lançamentos simultâneos não devem desaparecer nem ser sobrescritos pelo último aparelho a gravar.

Ele não deve ser interpretado como garantia de “20.000 pedidos por segundo” e não mede velocidade da internet do restaurante, latência real do Firebase, Wi-Fi, navegador ou impressora. Esses fatores continuam dependendo do ambiente físico e devem ser observados durante a operação real.

## Taxa de serviço — 10%

A taxa de serviço funciona tanto no PDV quanto no Garçom.

Quando uma conta é fechada pelo Garçom:

1. o subtotal é calculado;
2. a opção de 10% aparece marcada por padrão;
3. a taxa é adicionada ao total quando selecionada;
4. o valor é gravado na venda;
5. o PDV recebe a venda com `subtotal`, `taxa` e `total` corretamente registrados.

O relatório do PDV também apresenta a taxa de serviço acumulada e a separação por turno.

## Relatório por Garçom

Cada item lançado pode registrar o Garçom responsável pela inclusão.

Isso permite gerar o relatório **Vendas por Garçom** com base nos itens efetivamente lançados por cada profissional, inclusive quando mais de um Garçom atende a mesma mesa.

A taxa de serviço não é atribuída individualmente à venda do Garçom; ela é totalizada separadamente para posterior divisão da equipe.

## Zeragem do caixa

O botão **Zerar Caixa / Histórico** utiliza um marco operacional.

Ao zerar:

- os valores exibidos no caixa passam a considerar somente vendas realizadas após a zeragem;
- as vendas antigas permanecem armazenadas no Firebase;
- auditoria, relatórios históricos e backup continuam preservados.

Isso evita perda de dados financeiros.

## Cardápio

O cardápio é sincronizado em tempo real pelo Firebase.

O PDV permite:

- adicionar produtos;
- alterar nome e preço;
- alterar categoria;
- definir setor (`cozinha` ou `bar`);
- marcar favoritos;
- ativar/desativar produtos;
- configurar itens que servem duas pessoas;
- excluir itens;
- restaurar o cardápio padrão.

O Garçom recebe automaticamente as alterações publicadas pelo PDV após autenticação.

## Produção

Os pedidos são separados entre:

- **cozinha**;
- **bar**.

O sistema evita exibir um fluxo complexo de status de produção para não atrapalhar a operação da cozinha. Internamente os registros mantêm somente os campos necessários para sincronização e impressão.

O envio atual reserva os itens de uma mesa antes da confirmação e grava o pedido de produção junto com a marcação dos itens por `update()` multipath. Assim, outro aparelho não precisa regravar a comanda inteira para confirmar o envio.

## Firebase Realtime Database

Principais caminhos utilizados:

```text
mesas
pedidosProducao
cardapio
vendas
auditoria
cancelamentos
fechamentosCaixa
perfisAcesso
configuracoes
```

O projeto Firebase utilizado pela aplicação é:

```text
joaocaicaratradicao
```

## Arquitetura resumida

```text
Celular / tablet / computador
          │
          ├── PWA Garçom
          │
          └── PWA Caixa / PDV
                  │
          Firebase Authentication
                  │
          Firebase Realtime Database
                  │
      transaction por mesa + locks curtos
                  │
      mesas · cardapio · pedidosProducao
      vendas · auditoria · fechamentosCaixa
```

## Estrutura principal

```text
.
├── client/
│   └── public/
│       ├── mesa-atomic.js          # núcleo transacional compartilhado
│       ├── garcom/                 # PWA do Garçom
│       ├── pdv/                    # PWA do Caixa / PDV
│       └── ...                     # imagens e recursos públicos
│
├── server/
│   └── *.test.ts                   # testes automatizados
│
├── .github/
│   └── workflows/                  # deploy automático
│
├── database.rules.json             # regras do Realtime Database
├── firebase.json                   # configuração do Firebase
├── package.json
└── README.md
```

## Arquivos importantes do Garçom

```text
client/public/mesa-atomic.js
client/public/garcom/index.html
client/public/garcom/shared-login.js
client/public/garcom/cardapio-auth-reconnect.js
client/public/garcom/waiter-attribution.js
client/public/garcom/waiter-speed.js
client/public/garcom/garcom-service-fee.js
client/public/garcom/mesa-concurrency.js
client/public/garcom/service-worker.js
```

## Arquivos importantes do PDV

```text
client/public/mesa-atomic.js
client/public/pdv/index.html
client/public/pdv/admin-login.js
client/public/pdv/pdv-sync.js
client/public/pdv/pdv-safety.js
client/public/pdv/pdv-operations.js
client/public/pdv/pdv-checkout-core.js
client/public/pdv/pdv-production.js
client/public/pdv/mesa-concurrency.js
client/public/pdv/waiter-sales-report.js
client/public/pdv/service-fee-shifts.js
client/public/pdv/cash-reset.js
client/public/pdv/fast-checkout.js
client/public/pdv/fast-split.js
client/public/pdv/service-worker.js
```

## Tecnologias

- HTML, CSS e JavaScript nos PWAs operacionais;
- Firebase Authentication;
- Firebase Realtime Database;
- Firebase Hosting;
- Service Workers;
- PWA Manifest;
- TypeScript;
- Vitest;
- pnpm;
- GitHub Actions;
- Workload Identity Federation para autenticação do deploy.

## Desenvolvimento local

Clone o projeto:

```bash
git clone https://github.com/giovanisilvaa/joao-caicara-pwas.git
cd joao-caicara-pwas
```

Instale as dependências:

```bash
pnpm install
```

Para iniciar o ambiente de desenvolvimento:

```bash
pnpm dev
```

## Validação

Antes de publicar alterações:

```bash
pnpm check
pnpm test
pnpm build
git diff --check
```

Os testes automatizados possuem verificações específicas para evitar regressões em pontos críticos como:

- exclusão segura de mesas;
- concorrência de vários aparelhos na mesma mesa;
- identificação única de linhas da comanda;
- lock durante fechamento, transferência e envio;
- teste de carga com 2.400 e 20.000 lançamentos;
- envio para produção sem sobrescrever a mesa inteira;
- fechamento de conta com snapshot autoritativo;
- atribuição de Garçom;
- taxa de serviço;
- zeragem de caixa;
- login administrativo;
- login compartilhado do Garçom;
- isolamento de sessão entre PDV e Garçom;
- regras de segurança do Firebase;
- carregamento dos módulos pelos service workers.

## Deploy automático

As alterações enviadas para a branch principal passam pelo workflow do GitHub Actions.

O workflow executa, nesta ordem:

1. instalação das dependências;
2. verificação de TypeScript;
3. testes automatizados;
4. autenticação com Google Cloud;
5. publicação no Firebase Hosting;
6. publicação das regras do Realtime Database.

A autenticação do GitHub Actions com o Google Cloud/Firebase utiliza **Workload Identity Federation**, evitando o armazenamento de chaves permanentes de service account no repositório.

## Backup

O PDV possui exportação manual de backup em JSON contendo os principais dados operacionais, incluindo:

- mesas;
- vendas;
- pedidos de produção;
- cardápio;
- auditoria;
- cancelamentos;
- fechamentos de caixa.

A restauração deve ser feita somente após conferir o arquivo, pois pode substituir conjuntos de dados existentes.

## Instalação como PWA

### Android

Abra o módulo no Chrome e utilize **Instalar aplicativo** ou **Adicionar à tela inicial**.

### iPhone / iPad

Abra no Safari, toque em **Compartilhar → Adicionar à Tela de Início**.

Quando houver uma atualização importante e o aparelho continuar mostrando uma versão anterior, feche e abra novamente o PWA ou atualize a página para permitir a atualização do service worker.

## Boas práticas

- não armazenar senhas no código;
- não armazenar tokens ou chaves administrativas no repositório;
- fazer alterações pequenas e relacionadas;
- validar Garçom e PDV após alterações nas regras do Firebase;
- preservar o fluxo simples da cozinha;
- manter botões e alvos de toque adequados para celular;
- preservar a atribuição individual dos pedidos aos garçons;
- não apagar vendas do Firebase apenas para zerar o caixa;
- manter testes de regressão para funcionalidades críticas;
- não voltar a usar gravação da mesa inteira como mecanismo normal de edição concorrente.

## Estado atual

O sistema atualmente possui:

- ✅ sincronização em tempo real entre Garçom e PDV;
- ✅ abertura de mesas pelo Garçom;
- ✅ edição concorrente protegida por transações do Firebase;
- ✅ IDs únicos por linha da comanda;
- ✅ locks operacionais em fechamento, transferência e envio para produção;
- ✅ teste virtual com **20.000 lançamentos e zero perda/duplicação**;
- ✅ fechamento de conta pelo Garçom e PDV;
- ✅ taxa de serviço de 10% nos dois módulos;
- ✅ relatório de vendas por Garçom;
- ✅ taxa de serviço por turno;
- ✅ gerenciamento de cardápio pelo administrador;
- ✅ cardápio sincronizado no Garçom;
- ✅ login administrativo do PDV;
- ✅ login compartilhado autenticado do Garçom;
- ✅ sessões independentes por aba;
- ✅ regras Firebase separando permissões de Administrador e Garçom;
- ✅ zeragem segura do caixa;
- ✅ backup manual;
- ✅ deploy automático pelo GitHub Actions.

## Licença e uso

Projeto destinado à operação do **João Caiçara Tradição**. As condições de redistribuição e uso por terceiros devem ser definidas pelo responsável pelo projeto.
