import {
  conectarSandbox,
  criarConnectToken,
  desconectarConta,
  listarContas,
  registrarItem,
  sincronizarConta,
} from '../../services/contasConectadasService.js';
import { notificar, confirmar } from '../../../../shared/components/notificacao.js';
import { abrirWidget } from '../../utils/pluggyConnect.js';
import { mensagemDeErro } from '../../utils/erros.js';
import { iniciarConectar } from '../ContasConectar/ContasConectar.js';
import { iniciarLista } from '../ContasLista/ContasLista.js';

const AVISO_DEMORA = 'Isso pode levar até 30 segundos. Pode continuar nesta tela.';

/** "47 transações importadas." / "Nenhuma transação nova." a partir do resultado da importação da API. */
function textoImportacao({ importadas }) {
  if (importadas === 0) return 'Nenhuma transação nova.';
  return importadas === 1 ? '1 transação importada.' : `${importadas} transações importadas.`;
}

/**
 * Liga a página de Contas conectadas ao HTML de views/contas-conectadas.html (já dentro do container): o cartão de
 * conectar e a lista de conexões, com sincronizar e desconectar. A estrutura da tela está toda no HTML; aqui ficam só as
 * partes que mudam com os dados. `signal` (de um AbortController) avisa que a tela foi desmontada.
 */
export function iniciarPaginaContas(raiz, { signal } = {}) {
  const estado = { sequencia: 0, registrando: false };

  // Ao desmontar a tela, uma resposta que ainda esteja a caminho deixa de valer.
  signal?.addEventListener('abort', () => { estado.sequencia += 1; });

  const conectar = iniciarConectar(raiz, {
    signal,
    aoConectarBancoDeTeste: conectarBancoDeTeste,
    aoAbrirWidget: abrirWidgetDaPluggy,
  });

  const lista = iniciarLista(raiz, {
    signal,
    aoSincronizar: sincronizar,
    aoDesconectar: desconectar,
    tentarNovamente: () => carregar(),
  });

  /** Busca as contas. `silencioso` atualiza sem trocar a lista por "Carregando..." (depois de sincronizar, por exemplo). */
  async function carregar({ silencioso = false } = {}) {
    const minha = ++estado.sequencia; // ignora respostas antigas
    if (!silencioso) lista.iniciarCarga();

    try {
      const contas = await listarContas();
      if (minha !== estado.sequencia) return;
      lista.mostrarContas(contas);
      conectar.definirTotal(contas.length);
    } catch (erro) {
      if (minha !== estado.sequencia) return;
      lista.mostrarErro(mensagemDeErro(erro, 'Não foi possível carregar as contas conectadas.'));
    }
  }

  // Resposta de conectar: { conta, importacao, avisoImportacao? }. A conta fica conectada mesmo se a importação falhar.
  function avisarConexao({ conta, importacao, avisoImportacao }) {
    if (importacao) {
      notificar(`${conta.instituicao} conectada. ${textoImportacao(importacao)}`, 'sucesso');
    } else {
      const motivo = avisoImportacao ? ` ${avisoImportacao.message}` : '';
      notificar(`${conta.instituicao} conectada, mas a importação não terminou.${motivo} Use Sincronizar para tentar de novo.`, 'aviso');
    }
  }

  async function conectarBancoDeTeste() {
    conectar.mostrarAndamento(`Conectando ao banco de teste e importando as transações. ${AVISO_DEMORA}`);
    try {
      avisarConexao(await conectarSandbox());
    } catch (erro) {
      notificar(mensagemDeErro(erro, 'Não foi possível conectar o banco de teste.'), 'erro');
    } finally {
      conectar.mostrarAndamento(null);
      await carregar({ silencioso: true });
    }
  }

  async function abrirWidgetDaPluggy() {
    conectar.mostrarAndamento('Abrindo a janela da Pluggy...');
    try {
      const { accessToken } = await criarConnectToken();
      await abrirWidget({
        connectToken: accessToken,
        aoConectar: registrarConexao,
        aoFalhar: (mensagem) => {
          notificar(mensagem, 'erro');
          conectar.mostrarAndamento(null);
        },
        aoFechar: () => {
          if (!estado.registrando) conectar.mostrarAndamento(null); // fechou sem conectar
        },
      });
      conectar.mostrarAndamento(null); // a janela da Pluggy cobre a tela; os botões voltam a valer se ela for fechada
    } catch (erro) {
      notificar(mensagemDeErro(erro, 'Não foi possível abrir a janela da Pluggy.'), 'erro');
      conectar.mostrarAndamento(null);
    }
  }

  // O widget terminou: o Backend confere que o item é deste usuário, registra e importa.
  async function registrarConexao(itemId) {
    estado.registrando = true;
    conectar.mostrarAndamento(`Importando as transações da nova conta. ${AVISO_DEMORA}`);
    try {
      avisarConexao(await registrarItem(itemId));
    } catch (erro) {
      notificar(mensagemDeErro(erro, 'Não foi possível registrar a conta conectada.'), 'erro');
    } finally {
      estado.registrando = false;
      conectar.mostrarAndamento(null);
      await carregar({ silencioso: true });
    }
  }

  async function sincronizar(conta) {
    lista.mostrarAndamento(conta.id, `Sincronizando... ${AVISO_DEMORA}`);
    try {
      const resultado = await sincronizarConta(conta.id);
      notificar(`${conta.instituicao}: ${textoImportacao(resultado)}`, 'sucesso');
      await carregar({ silencioso: true });
    } catch (erro) {
      notificar(mensagemDeErro(erro, 'Não foi possível sincronizar a conta.'), 'erro');
      if (!signal?.aborted) lista.mostrarAndamento(conta.id, null);
    }
  }

  async function desconectar(conta) {
    const confirmado = await confirmar(
      `Desconectar ${conta.instituicao}? As transações já importadas continuam no seu extrato, mas novas deixam de chegar.`,
      'aviso'
    );
    if (!confirmado) return;

    lista.mostrarAndamento(conta.id, 'Desconectando...');
    try {
      await desconectarConta(conta.id);
      notificar(`${conta.instituicao} desconectada.`, 'sucesso');
      await carregar({ silencioso: true });
    } catch (erro) {
      notificar(mensagemDeErro(erro, 'Não foi possível desconectar a conta.'), 'erro');
      if (!signal?.aborted) lista.mostrarAndamento(conta.id, null);
    }
  }

  carregar();
}
