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
      mesas · cardapio · pedidosProducao
      vendas · auditoria · fechamentosCaixa
```

## Estrutura principal

```text
.
├── client/
│   └── public/
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
client/public/garcom/index.html
client/public/garcom/shared-login.js
client/public/garcom/cardapio-auth-reconnect.js
client/public/garcom/waiter-attribution.js
client/public/garcom/waiter-speed.js
client/public/garcom/garcom-service-fee.js
client/public/garcom/service-worker.js
```

## Arquivos importantes do PDV

```text
client/public/pdv/index.html
client/public/pdv/admin-login.js
client/public/pdv/pdv-sync.js
client/public/pdv/pdv-safety.js
client/public/pdv/pdv-operations.js
client/public/pdv/pdv-checkout-core.js
client/public/pdv/pdv-production.js
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
- envio para produção;
- fechamento de conta;
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

O processo executa validações e publica automaticamente:

- Firebase Hosting;
- regras do Realtime Database.

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
- manter testes de regressão para funcionalidades críticas.

## Estado atual

O sistema atualmente possui:

- ✅ sincronização em tempo real entre Garçom e PDV;
- ✅ abertura de mesas pelo Garçom;
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
