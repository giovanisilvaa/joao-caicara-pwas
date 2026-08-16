# Auditoria de login e cadastro

## Verificações realizadas

- O PWA do garçom publicado carrega o campo de identificador do funcionário, PIN de 4 dígitos e botão Entrar.
- O PWA do garçom aparece online e renderiza as mesas no domínio publicado.
- O PWA do PDV publicado carrega o campo de PIN, aparece online, renderiza mesas, cardápio e produção.
- O teste controlado no Firebase cadastrou funcionário temporário, verificou hash de PIN, ativação/inativação e alteração/restauração do PIN do caixa.
- A validação estrutural dos arquivos atuais em client/public, TypeScript e build foram aprovados.

## Melhorias aplicadas

- Identificador do garçom validado por formato seguro e normalizado.
- Sessão do garçom vinculada ao registro do funcionário, com expiração de 12 horas e monitoramento de inativação no Firebase.
- Edição de observação passou a exigir autorização por função.
- Bloqueio temporário após cinco tentativas inválidas no garçom e no caixa.
- Campo do PIN do caixa limitado a quatro dígitos.
- Cadastro de funcionário com validação de nome, identificador, função e confirmação do PIN.
- Redefinição de PIN de funcionário e troca do PIN do caixa com confirmação do novo valor.

## Limitação de segurança pendente

A autenticação ainda é executada no cliente usando Firebase Authentication anônimo e hashes SHA-256 armazenados no Realtime Database. Para segurança forte contra leitura indevida do banco ou força bruta, a validação de PIN deverá migrar para regras/backend com identidade autenticada real. A melhoria atual reduz erros operacionais e tentativas casuais, mas não substitui esse endurecimento de segurança.
