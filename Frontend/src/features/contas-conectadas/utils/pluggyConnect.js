// Widget Pluggy Connect (a janela em que o usuário escolhe a instituição e faz o login). O Frontend não usa bundler,
// então o script oficial é carregado do CDN da Pluggy só quando o usuário pede para conectar, e não a cada visita.
// Ele expõe a classe global PluggyConnect (README do quickstart da Pluggy, seção HTML).
//
// ATENÇÃO: a versão abaixo é a que o quickstart oficial mostra para HTML puro. A documentação v2 da Pluggy cita
// mudanças a partir da 2.0.0 (assinatura do onEvent), então confira a versão atual ao testar de verdade com a Pluggy.
const PLUGGY_CONNECT_URL = 'https://cdn.pluggy.ai/pluggy-connect/v1.3.1/pluggy-connect.js';

let carregando = null;

function carregarScript() {
  if (window.PluggyConnect) return Promise.resolve();
  if (!carregando) {
    carregando = new Promise((resolver, rejeitar) => {
      const script = document.createElement('script');
      script.src = PLUGGY_CONNECT_URL;
      script.async = true;
      script.addEventListener('load', () => (window.PluggyConnect ? resolver() : rejeitar(new Error('O widget da Pluggy não foi encontrado depois de carregar.'))));
      script.addEventListener('error', () => rejeitar(new Error('Não foi possível carregar o widget da Pluggy. Verifique sua conexão.')));
      document.head.append(script);
    }).catch((erro) => {
      carregando = null; // permite tentar de novo
      document.querySelector(`script[src="${PLUGGY_CONNECT_URL}"]`)?.remove();
      throw erro;
    });
  }
  return carregando;
}

/**
 * Abre o widget com o token temporário pedido ao Backend. `aoConectar(itemId)` roda quando o usuário termina de conectar;
 * `aoFalhar(mensagem)` quando o widget acusa erro; `aoFechar()` quando a janela fecha (com ou sem sucesso).
 * `includeSandbox: true` mostra também os bancos de teste, que são os que o projeto usa.
 */
export async function abrirWidget({ connectToken, aoConectar, aoFalhar, aoFechar }) {
  await carregarScript();
  const widget = new window.PluggyConnect({
    connectToken,
    includeSandbox: true,
    // O argumento traz o item em `item` (formato da doc); aceita também o item solto, por garantia.
    onSuccess: (dados) => {
      const itemId = dados?.item?.id ?? dados?.id;
      if (itemId) aoConectar(itemId);
      else aoFalhar('O widget terminou, mas não informou qual conexão foi criada.');
    },
    onError: (erro) => aoFalhar(erro?.message ?? 'O widget da Pluggy acusou um erro.'),
    onClose: () => aoFechar?.(),
  });
  widget.init();
}
