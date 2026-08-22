João Caiçara — Sistema de Operação do Restaurante

Sistema web progressivo para operação de salão, atendimento, produção e caixa do restaurante João Caiçara Tradição. O projeto reúne dois PWAs independentes, um para o Garçom e outro para o Caixa/PDV, com sincronização de dados em tempo real pelo Firebase Realtime Database.

Links oficiais

Use sempre os links abaixo. Eles correspondem à versão publicada no Firebase Hosting e não exibem a tela de PIN.

Módulo
Link
Garçom
Abrir PWA do Garçom
Caixa / PDV
Abrir PWA do Caixa
Firebase Hosting
Abrir projeto publicado





O endereço https://joaopwas-a8qonrlr.manus.space/ é uma publicação antiga e pode apresentar uma versão diferente do sistema. Enquanto não for sincronizado, ele não deve ser considerado o endereço oficial.

Objetivo do projeto

O sistema foi desenvolvido para reduzir o uso de papel e organizar o fluxo de atendimento do restaurante. O Garçom seleciona mesas, registra clientes, lança produtos e envia os pedidos para produção. O Caixa acompanha as comandas, controla a produção, imprime pedidos, divide contas, registra pagamentos e realiza o fechamento do caixa.

A interface segue a direção visual moderno caiçara, combinando azul-petróleo, coral, areia e referências visuais da identidade João Caiçara com componentes simples e rápidos para uso durante a operação.

Módulos do sistema

PWA do Garçom

O módulo do Garçom permite visualizar as mesas do salão e do deck/praia, abrir comandas, identificar opcionalmente o cliente, pesquisar produtos, navegar por categorias, ajustar quantidades, adicionar observações e enviar itens para cozinha e bar.

A tela possui comanda fixa em dispositivos menores, resumo do envio por setor, total da mesa, indicação de conexão e armazenamento local de pendências para reprocessamento posterior quando a conexão estiver disponível.

PWA do Caixa / PDV

O módulo do Caixa permite visualizar mesas, consultar e editar comandas, acompanhar pedidos de produção, imprimir pedidos para cozinha e bar, reimprimir pedidos, dividir contas, transferir ou juntar mesas, fechar contas e consultar relatórios, auditoria, backup e fechamento de caixa.

A comanda do PDV possui área de itens com rolagem independente, rodapé financeiro persistente, resumo operacional e ações principais acessíveis em telas pequenas.

Principais funcionalidades

Área
Funcionalidades
Mesas
Salão, deck/praia, estados livre, ocupada e pedido novo
Atendimento
Abertura de comanda, cliente, itens, quantidades e observações
Produção
Separação de itens para cozinha e bar, status e impressão
Caixa
Total, divisão de conta, pagamentos, troco e fechamento
Cardápio
Categorias, favoritos, busca e gerenciamento pelo PDV
Conectividade
Indicador de conexão, pendências locais e reprocessamento
Auditoria
Registro de operações críticas do Garçom e do PDV
Backup
Exportação e restauração controladas dos dados operacionais
PWA
Manifesto, service worker e instalação na tela inicial




Arquitetura resumida

Plain Text


Navegador / celular / tablet / computador
                |
        PWA do Garçom ou PWA do Caixa
                |
       Firebase Realtime Database
                |
  mesas · pedidosProducao · cardapio
  vendas · auditoria · cancelamentos
  fechamentosCaixa · configuracoes



O projeto também contém uma base full-stack com frontend, backend, rotas de API, Drizzle e integrações internas. Os PWAs operacionais utilizam arquivos estáticos em client/public/garcom e client/public/pdv, compartilhando a fundação visual em client/public/shared/pwa-theme.css.

Estrutura principal

Plain Text


.
├── client/
│   ├── public/
│   │   ├── garcom/              # PWA do Garçom
│   │   ├── pdv/                 # PWA do Caixa / PDV
│   │   ├── shared/              # Tema visual compartilhado
│   │   └── ...                  # Logos, imagens e recursos públicos
│   ├── index.html               # Entrada principal do frontend
│   └── src/                     # Código do frontend principal
├── server/
│   ├── _core/                   # Infraestrutura do servidor
│   ├── routers/                 # Rotas e procedimentos
│   └── *.test.ts                # Testes automatizados
├── shared/                      # Tipos e constantes compartilhadas
├── docs/                        # Documentação técnica e operacional
├── scripts/                     # Scripts auxiliares
├── firebase.json                # Configuração do Firebase Hosting
├── database.rules.json          # Regras versionadas do Realtime Database
├── package.json                 # Dependências e scripts
└── todo.md                      # Checklist e pendências do projeto



Tecnologias

Tecnologia
Uso
TypeScript
Tipagem e código da aplicação
React / Vite
Frontend principal e build
Express / tRPC
Backend e procedimentos de API
Drizzle
Camada de dados do backend
Firebase Realtime Database
Sincronização de mesas, pedidos, vendas e operações
Firebase Hosting
Publicação dos PWAs
Service Worker
Suporte a instalação e recursos do PWA
Vitest
Testes automatizados
pnpm
Gerenciamento de dependências e scripts




Requisitos para desenvolvimento

Para trabalhar localmente, instale:

•
Node.js compatível com o projeto;

•
pnpm;

•
acesso ao repositório GitHub;

•
configuração do Firebase para os fluxos que dependem de sincronização em tempo real.

As configurações públicas do Firebase ficam no código dos PWAs. Chaves administrativas, credenciais de serviço e tokens privados nunca devem ser colocados no repositório ou enviados por mensagem.

Instalação local

Clone o repositório e entre na pasta do projeto:

Bash


git clone https://github.com/giovanisilvaa/joao-caicara-pwas.git
cd joao-caicara-pwas



Instale as dependências:

Bash


pnpm install



Para iniciar o ambiente de desenvolvimento, utilize o script configurado no package.json:

Bash


pnpm dev



Os comandos disponíveis podem ser consultados com:

Bash


pnpm run



Validação do projeto

Antes de publicar alterações, execute a checagem de tipos, os testes e o build:

Bash


pnpm check
pnpm test
pnpm build



Também é recomendado verificar espaços ou erros básicos no diff:

Bash


git diff --check



A situação validada na última revisão foi:

Verificação
Resultado
TypeScript
Aprovado
Testes automatizados
14/14 aprovados
Build de produção
Aprovado
Fluxos de mesas e pedidos
Preservados
Comanda fixa do Garçom e do PDV
Implementada
Tema moderno caiçara
Implementado




Desenvolvimento dos PWAs

O Garçom está em:

Plain Text


client/public/garcom/index.html



O Caixa/PDV está em:

Plain Text


client/public/pdv/index.html



O tema visual comum está em:

Plain Text


client/public/shared/pwa-theme.css



Cada PWA possui manifesto e service worker próprios:

Plain Text


client/public/garcom/manifest.json
client/public/garcom/service-worker.js

client/public/pdv/manifest.json
client/public/pdv/service-worker.js



Ao alterar um PWA, preserve os caminhos /garcom/ e /pdv/, os manifestos e os respectivos escopos dos service workers.

Firebase Realtime Database

Os principais caminhos usados pelo sistema são:

Plain Text


mesas
pedidosProducao
cardapio
vendas
auditoria
cancelamentos
fechamentosCaixa
configuracoes



As regras estão versionadas em:

Plain Text


database.rules.json



A autenticação atualmente utilizada pelos PWAs é anônima. O PIN foi removido da versão oficial publicada por decisão operacional, mas as regras atuais do Firebase ainda não diferenciam os perfis de Garçom e Caixa.

Pendência de segurança

A migração para contas identificadas e custom claims continua planejada para uma etapa futura. Essa migração permitirá diferenciar permissões por perfil, por exemplo:

•
Garçom: leitura de mesas e cardápio e criação de pedidos;

•
Caixa: leitura e atualização de produção, vendas e fechamentos;

•
Administrador: gerenciamento de cardápio, configurações, auditoria e backups.

Até essa migração, não publique regras que dependam de auth.token.perfil, pois os usuários atuais não possuem essa claim.

Publicação no Firebase Hosting

O projeto Firebase utilizado é:

Plain Text


joaocaicaratradicao



Depois de configurar o Firebase CLI e autenticar uma conta autorizada, a publicação do Hosting pode ser feita com:

Bash


firebase deploy --only hosting --project joaocaicaratradicao



Antes da publicação, execute:

Bash


pnpm check
pnpm test
pnpm build
git diff --check



A publicação do Hosting não altera automaticamente o domínio antigo do Manus. São publicações independentes.

Instalação no celular

Android

Abra o link do Garçom ou do Caixa no Google Chrome, abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial.

iPhone

Abra o link no Safari, toque em Compartilhar, escolha Adicionar à Tela de Início e confirme. Se uma versão antiga estiver instalada, remova o atalho antigo antes de instalar novamente a versão atual.

Backup e operação segura

Antes de usar o sistema em produção, faça uma exportação dos dados pelo recurso de backup disponível no PDV. Guarde o arquivo com a data no nome e em local seguro.

A restauração pode substituir dados existentes. Por isso, deve ser executada somente após conferência do arquivo e, preferencialmente, em uma janela controlada de manutenção.

Monitoramento do Firebase

Acompanhe periodicamente no Firebase Console:

•
armazenamento;

•
downloads;

•
conexões simultâneas;

•
carga do banco;

•
erros de sincronização;

•
crescimento de vendas, auditoria e fechamentos.

No momento da última análise, o projeto apresentava aproximadamente 43,3 KB de armazenamento e 6,3 MB de downloads no período observado, muito abaixo dos limites exibidos no plano Spark. Esses valores devem ser acompanhados novamente após o início do uso real.

Boas práticas de alteração

Faça alterações pequenas e relacionadas em cada commit. Execute os testes antes de enviar código ao GitHub. Não altere regras do Firebase junto com uma mudança visual sem validar o acesso dos dois PWAs. Não armazene senhas, tokens administrativos ou chaves privadas no projeto.

Ao atualizar a interface, preserve a legibilidade em ambientes de atendimento, os alvos de toque, o foco acessível, o suporte a telas pequenas e o comportamento de sincronização offline ou instável.

Pendências conhecidas

Pendência
Situação
Sincronizar o domínio Manus antigo
Pendente; ele pode continuar exibindo PIN
Autenticação por perfis com custom claims
Adiada
Regras diferenciadas por função
Aguardando autenticação identificada
Domínio personalizado
Adiado por custo
Teste completo em celulares e rede real
Recomendado
Confirmação de alertas externos via WhatsApp
Não concluída




Histórico recente

As últimas melhorias realizadas incluem a remoção da tela de PIN da versão publicada no Firebase, a correção dos testes de reprocessamento de pendências, o carregamento condicional de analytics, a criação do tema moderno caiçara, a comanda fixa do Garçom, a comanda fixa do Caixa e os resumos operacionais separados por setor.

Licença e uso

Este projeto é destinado à operação do restaurante João Caiçara Tradição. A licença e as condições de redistribuição devem ser definidas pelo responsável pelo projeto antes de disponibilizar o código publicamente para terceiros.

Contato e manutenção

Para manutenção, registre as decisões e alterações em todo.md e na pasta docs/. Ao relatar um problema, informe o módulo afetado, o dispositivo, o navegador, o horário, a mesa ou operação de teste utilizada e se havia conexão com a internet.

