# Direção visual dos PWAs João Caiçara

## Abordagens consideradas

### Theme Name: Maré Operacional
Very Brief Intro: Uma interface clara, quente e direta, inspirada em madeira, mar e sinalização de restaurante. A prioridade é leitura rápida, contraste e ações grandes para uso em salão.
Probability: 0.07

### Theme Name: Noite do Caixa
Very Brief Intro: Um sistema escuro, denso e técnico, com acentos de coral para destacar estados de operação e fechamento. A proposta favorece controle e concentração no PDV.
Probability: 0.04

### Theme Name: Papel de Comanda
Very Brief Intro: Uma linguagem editorial, quase de caderno de pedidos, com textura clara, tipografia serifada e blocos de informação. A intenção é tornar o sistema familiar para a equipe.
Probability: 0.08

## Abordagem escolhida: Maré Operacional

### Design Movement
Modernismo tropical funcional, com referências de sinalização náutica e materiais de restaurante caiçara.

### Core Principles
1. Ação primária sempre visível e alcançável com uma mão.
2. Contraste alto para uso em ambientes com iluminação variável.
3. Estados operacionais explícitos: livre, ocupada, nova, pendente e fechada.
4. Identidade calorosa sem prejudicar velocidade e legibilidade.

### Color Philosophy
Azul petróleo representa confiança e estabilidade; coral marca ações e atenção; madeira funciona como camada humana e tátil; areia mantém o campo visual leve e reduz fadiga.

### Layout Paradigm
Fluxo vertical no garçom, com telas sucessivas e controles inferiores fixos; no PDV, painel lateral persistente para mesas e área central de operação.

### Signature Elements
Bordas inferiores coral nos cabeçalhos, botões em tons de madeira e marcadores de status em forma de sinalização de mesa.

### Interaction Philosophy
Cada toque deve produzir uma confirmação clara: mudança de cor, atualização do contador ou mensagem de sincronização. Ações destrutivas exigem contexto e confirmação.

### Animation
Transições curtas de 160–240ms, com destaque suave para novas comandas e pedidos pendentes. Respeitar `prefers-reduced-motion`.

### Typography System
Georgia para títulos institucionais e Segoe UI para operação, com números em peso forte e tamanho generoso em totais, mesas e contadores.

### Brand Essence
Sistemas operacionais para restaurantes caiçaras que conectam salão e caixa sem atrito; diretos, confiáveis e acolhedores.
Personality: atento, prático, caiçara.

### Brand Voice
Headlines e CTAs devem ser curtos e orientados à ação. Microcopy deve explicar estado e consequência sem jargão.
Exemplos: “Mesa 12 pronta para receber pedidos.” e “Fechamento confirmado no caixa.”

### Wordmark & Logo
Usar o símbolo do camarão/onda como marca gráfica sem depender do texto do nome, aplicado no favicon e nos manifests.

### Signature Brand Color
Azul petróleo `#0F4C5C`.

## Style Decisions

- Estados de mesa usam marcadores visíveis LIVRE, OCUPADA e NOVA, com petróleo para controle, madeira para disponibilidade e coral para atenção.
- A central de acesso usa a composição assimétrica e editorial como referência visual comum aos dois PWAs.
- O service worker é separado por função e limitado ao escopo `/garcom/` ou `/pdv/`, evitando colisão entre caches.
