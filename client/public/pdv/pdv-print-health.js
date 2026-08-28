/* Diagnóstico preventivo da impressão silenciosa do PDV. */
(() => {
  if (window.PDV_PRINT_HEALTH_RUNTIME === 'v1') return;
  window.PDV_PRINT_HEALTH_RUNTIME = 'v1';

  const CHAVE = 'joao_caicara_print_health_v1';
  const LIMITE_DIALOGO_MS = 2500;
  const PRINT_ORIGINAL = typeof window.print === 'function' ? window.print.bind(window) : null;
  let monitorGlobalInstalado = false;

  function versaoNavegador() {
    const ua = String(navigator.userAgent || '');
    const match = ua.match(/(?:Chrome|Chromium)\/([\d.]+)/i);
    return match?.[1] || ua.slice(0, 120) || 'desconhecida';
  }

  function ler() {
    try {
      const valor = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      return valor && typeof valor === 'object' ? valor : {};
    } catch (_) {
      return {};
    }
  }

  function salvar(parcial) {
    const atual = ler();
    const proximo = { ...atual, ...parcial, atualizadoEm: Date.now() };
    localStorage.setItem(CHAVE, JSON.stringify(proximo));
    atualizarAviso();
    return proximo;
  }

  function diagnostico() {
    const atual = ler();
    const versao = versaoNavegador();
    if (atual.status === 'suspeita' && atual.versao === versao) {
      return { ok: false, nivel: 'erro', motivo: 'A última impressão parece ter aberto a janela do navegador.', atual, versao };
    }
    if (!atual.verificadoEm || atual.versao !== versao || atual.status !== 'ok') {
      const mudou = Boolean(atual.versao && atual.versao !== versao);
      return {
        ok: false,
        nivel: 'aviso',
        motivo: mudou
          ? `Chrome atualizado (${atual.versao} → ${versao}). Confirme a impressão automática antes de enviar pedidos.`
          : 'Impressão automática ainda não confirmada nesta versão do Chrome.',
        atual,
        versao
      };
    }
    return { ok: true, nivel: 'ok', motivo: 'Impressão automática verificada.', atual, versao };
  }

  function garantirEstilo() {
    if (document.getElementById('pdv-print-health-style')) return;
    const style = document.createElement('style');
    style.id = 'pdv-print-health-style';
    style.textContent = `
      #pdv-print-health-banner{position:fixed;left:14px;right:14px;top:76px;z-index:5000;display:none;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;border-radius:10px;background:#fff3cd;border:2px solid #e3a008;color:#5f4600;box-shadow:0 8px 22px rgba(0,0,0,.18);font-size:.82rem;font-weight:700}
      #pdv-print-health-banner.erro{background:#ffe5df;border-color:#d95d39;color:#762b1b}
      #pdv-print-health-banner .acoes{display:flex;gap:7px;flex-shrink:0}
      #pdv-print-health-banner button{border:0;border-radius:7px;padding:7px 9px;cursor:pointer;font-weight:800;background:#0f4c5c;color:#fff}
      #pdv-print-health-banner button.sec{background:#68787b}
      #pdv-print-health-teste{display:none}
      @media(max-width:700px){#pdv-print-health-banner{top:70px;flex-direction:column;align-items:stretch}#pdv-print-health-banner .acoes{justify-content:flex-end}}
      @media print{
        body.print-mode-health-test > *{display:none!important}
        body.print-mode-health-test #pdv-print-health-teste{display:block!important;width:80mm!important;margin:0 auto!important;padding:5mm!important;box-sizing:border-box!important;background:#fff!important;color:#000!important;font-family:'Courier New',monospace!important;text-align:center!important}
      }
    `;
    document.head.appendChild(style);
  }

  function garantirInterface() {
    garantirEstilo();
    if (!document.getElementById('pdv-print-health-banner')) {
      const banner = document.createElement('div');
      banner.id = 'pdv-print-health-banner';
      banner.innerHTML = '<span id="pdv-print-health-msg"></span><div class="acoes"><button type="button" id="pdv-print-health-testar">🖨️ Testar</button><button type="button" class="sec" id="pdv-print-health-ocultar">Ocultar</button></div>';
      document.body.appendChild(banner);
      banner.querySelector('#pdv-print-health-testar')?.addEventListener('click', () => void testar());
      banner.querySelector('#pdv-print-health-ocultar')?.addEventListener('click', () => { banner.style.display = 'none'; });
    }
    if (!document.getElementById('pdv-print-health-teste')) {
      const teste = document.createElement('div');
      teste.id = 'pdv-print-health-teste';
      teste.innerHTML = '<h2>TESTE DE IMPRESSÃO</h2><p>João Caiçara - PDV</p><p>Este papel NÃO é um pedido.</p><p>Se saiu direto sem abrir janela, a impressão automática está ativa.</p>';
      document.body.appendChild(teste);
    }
    atualizarAviso();
  }

  function atualizarAviso() {
    const banner = document.getElementById('pdv-print-health-banner');
    const msg = document.getElementById('pdv-print-health-msg');
    if (!banner || !msg) return;
    const d = diagnostico();
    if (d.ok) {
      banner.style.display = 'none';
      banner.classList.remove('erro');
      return;
    }
    msg.textContent = `⚠️ ${d.motivo}`;
    banner.classList.toggle('erro', d.nivel === 'erro');
    banner.style.display = 'flex';
  }

  function registrarResultado(duracaoMs, origem = 'producao') {
    const versao = versaoNavegador();
    const duracao = Math.max(0, Math.round(Number(duracaoMs) || 0));
    if (duracao > LIMITE_DIALOGO_MS) {
      salvar({ status: 'suspeita', versao, ultimaDuracaoMs: duracao, ultimaOrigem: origem, suspeitaEm: Date.now() });
      return false;
    }
    salvar({ status: 'ok', versao, verificadoEm: Date.now(), ultimaDuracaoMs: duracao, ultimaOrigem: origem, suspeitaEm: null });
    return true;
  }

  function imprimirMonitorado(executar, origem = 'producao') {
    const inicio = performance.now();
    try {
      return executar();
    } finally {
      const duracao = performance.now() - inicio;
      const ok = registrarResultado(duracao, origem);
      if (!ok) {
        setTimeout(() => alert('⚠️ A impressão demorou como se a janela do Chrome tivesse sido aberta. Feche o Chrome completamente e reabra o PDV pelo atalho com --kiosk-printing antes do próximo pedido.'), 0);
      }
    }
  }

  function instalarMonitorGlobal() {
    if (monitorGlobalInstalado || !PRINT_ORIGINAL) return;
    try {
      window.print = function printMonitorado() {
        return imprimirMonitorado(() => PRINT_ORIGINAL(), 'window_print');
      };
      monitorGlobalInstalado = true;
    } catch (erro) {
      console.warn('Não foi possível instalar monitor de impressão:', erro);
    }
  }

  function antesDeEnviar() {
    const d = diagnostico();
    if (d.ok) return true;
    garantirInterface();
    const texto = d.nivel === 'erro'
      ? `${d.motivo}\n\nRecomendação: não envie o pedido até testar a impressão silenciosa.\n\nDeseja enviar mesmo assim?`
      : `${d.motivo}\n\nUse o botão “Testar” no aviso para confirmar sem criar pedido.\n\nDeseja enviar mesmo assim?`;
    return window.confirm(texto);
  }

  function protegerCliqueDeEnvio(event) {
    const alvo = event.target instanceof Element ? event.target.closest('#btn-enviar-producao-pdv,.btn-kitchen,.btn-bar') : null;
    if (!alvo || alvo.disabled || /reimprimir/i.test(alvo.textContent || '')) return;
    if (antesDeEnviar()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  async function testar() {
    garantirInterface();
    if (!PRINT_ORIGINAL) return alert('Não foi possível acessar a função de impressão do navegador.');
    document.body.classList.add('print-mode-health-test');
    try {
      imprimirMonitorado(() => PRINT_ORIGINAL(), 'teste_manual');
    } finally {
      document.body.classList.remove('print-mode-health-test');
    }
    const d = diagnostico();
    if (d.ok) {
      alert('✅ Teste concluído rapidamente. A impressão automática foi marcada como verificada para esta versão do Chrome.');
    }
  }

  function iniciar() {
    garantirInterface();
    instalarMonitorGlobal();
    document.addEventListener('click', protegerCliqueDeEnvio, true);
    window.addEventListener('focus', atualizarAviso);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') atualizarAviso();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.PdvPrintHealth = Object.freeze({
    diagnostico,
    atualizarAviso,
    antesDeEnviar,
    imprimirMonitorado,
    registrarResultado,
    testar,
    versaoNavegador
  });
})();
