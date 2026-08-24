/* Diagnóstico seguro de sessão do Garçom — somente leitura, sem alterar permissões. */
(() => {
  function resumoSessao() {
    const acesso = window.GarcomAcesso;
    if (!acesso) return 'Controle de acesso ainda não carregado.';
    const sessao = acesso.sessao || {};
    const remoto = acesso.perfilRemoto || {};
    return [
      'Sessão do Garçom',
      `UID: ${sessao.uid || 'aguardando autenticação'}`,
      `Sessão: ${sessao.isAnonymous === true ? 'anônima' : sessao.isAnonymous === false ? 'identificada' : 'aguardando'}`,
      `Perfil atual: ${acesso.perfilAtual}`,
      `Perfil remoto: ${remoto.encontrado || (remoto.carregado ? 'não cadastrado' : 'consultando')}`,
      `Origem remota: ${remoto.origem || 'não consultado'}`,
      `Modo compatibilidade: ${acesso.modoCompatibilidade ? 'ATIVO' : 'INATIVO'}`
    ].join('\n');
  }

  function mostrarDiagnostico() {
    alert(resumoSessao());
  }

  function conectar() {
    const indicador = document.getElementById('usuario-logado-g');
    if (!indicador || indicador.dataset.diagnosticoSessao === '1') return;
    indicador.dataset.diagnosticoSessao = '1';
    indicador.style.cursor = 'pointer';
    indicador.title = 'Toque para ver os dados da sessão';
    indicador.setAttribute('role', 'button');
    indicador.setAttribute('tabindex', '0');
    indicador.addEventListener('click', mostrarDiagnostico);
    indicador.addEventListener('keydown', evento => {
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        mostrarDiagnostico();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', conectar, { once: true });
  else conectar();

  window.addEventListener('garcom:sessao-identificada', conectar);
  window.addEventListener('garcom:perfil-remoto-consultado', conectar);
  window.GarcomDiagnosticoSessao = Object.freeze({ resumoSessao, mostrarDiagnostico });
})();
