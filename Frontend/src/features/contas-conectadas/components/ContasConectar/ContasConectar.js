import { MAX_CONTAS } from '../../utils/constants.js';

/**
 * Liga o cartão "Conectar uma conta" (HTML em ContasConectar.html). A tela decide o que fazer em cada clique
 * (`aoConectarBancoDeTeste` e `aoAbrirWidget`); aqui ficam só os botões, o texto de andamento e o aviso de limite.
 * Devolve { mostrarAndamento(texto | null), definirTotal(quantidade) }.
 */
export function iniciarConectar(raiz, { signal, aoConectarBancoDeTeste, aoAbrirWidget }) {
  const botaoTeste = raiz.querySelector('#contas-conectar-sandbox');
  const botaoWidget = raiz.querySelector('#contas-conectar-widget');
  const andamento = raiz.querySelector('#contas-conectar-status');
  const aviso = raiz.querySelector('#contas-limite');

  let ocupado = false;
  let limiteAtingido = false;

  function atualizarBotoes() {
    botaoTeste.disabled = ocupado || limiteAtingido;
    botaoWidget.disabled = ocupado || limiteAtingido;
  }

  botaoTeste.addEventListener('click', aoConectarBancoDeTeste, { signal });
  botaoWidget.addEventListener('click', aoAbrirWidget, { signal });

  return {
    /** Com texto, bloqueia os botões e mostra o andamento; com null, libera e esconde. */
    mostrarAndamento(texto) {
      ocupado = texto !== null;
      andamento.hidden = !ocupado;
      andamento.textContent = texto ?? '';
      atualizarBotoes();
    },

    /** Avisa quando o usuário já tem o máximo de contas (o Backend recusaria a próxima). */
    definirTotal(quantidade) {
      limiteAtingido = quantidade >= MAX_CONTAS;
      aviso.hidden = !limiteAtingido;
      aviso.textContent = limiteAtingido
        ? `Você chegou ao limite de ${MAX_CONTAS} contas conectadas. Desconecte uma para adicionar outra.`
        : '';
      atualizarBotoes();
    },
  };
}
