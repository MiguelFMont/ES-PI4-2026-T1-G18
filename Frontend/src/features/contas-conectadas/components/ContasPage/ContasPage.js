import {
  conectarSandbox,
  criarConnectToken,
  desconectarConta,
  listarContas,
  registrarItem,
  sincronizarConta,
} from '../../services/contasConectadasService.js';
import { notificar, confirmar, comCarregamento } from '../../../../shared/components/notificacao.js';
import { abrirWidget } from '../../utils/pluggyConnect.js';
import { mensagemDeErro } from '../../utils/erros.js';
import { iniciarConectar } from '../ContasConectar/ContasConectar.js';
import { iniciarLista } from '../ContasLista/ContasLista.js';
import { iniciarMinhas } from '../ContasMinhas/ContasMinhas.js';
import { iniciarContaForm } from '../ContaForm/ContaForm.js';
import { ligarSeletores } from '../../../../shared/components/seletor.js';
import { buscarPlano, desfazerExclusao, excluirConta, listarBancos, listarMinhasContas } from '../../services/contasService.js';

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
  const estado = { sequencia: 0, sequenciaMinhas: 0, registrando: false, conexoes: [], contas: [], plano: 'free' };

  // Ao desmontar a tela, uma resposta que ainda esteja a caminho deixa de valer.
  signal?.addEventListener('abort', () => { estado.sequencia += 1; estado.sequenciaMinhas += 1; });

  ligarSeletores(raiz, signal); // as listas dos campos da janela de conta (Banco e Conexão)

  // ---------------------------------------------------------------- minhas contas (manuais e Open Finance)
  const formulario = iniciarContaForm(raiz, { signal, aoSalvar: () => atualizarTudo() });

  const minhas = iniciarMinhas(raiz, {
    signal,
    aoNova: () => abrirFormulario(null),
    aoEditar: (conta) => abrirFormulario(conta),
    aoExcluir: excluir,
    tentarNovamente: () => carregarMinhas(),
  });

  // As conexões que ainda não viraram conta são as que a conta Open Finance pode usar.
  function abrirFormulario(conta) {
    const usadas = new Set(estado.contas.map((c) => c.conectadaId).filter(Boolean));
    const conexoes = estado.conexoes.filter((c) => !usadas.has(c.id));
    formulario.abrir({ conta, plano: estado.plano, conexoes });
  }

  async function carregarMinhas({ silencioso = false } = {}) {
    const minha = ++estado.sequenciaMinhas;
    if (!silencioso) minhas.iniciarCarga();
    try {
      const contas = await listarMinhasContas();
      if (minha !== estado.sequenciaMinhas) return;
      estado.contas = contas;
      minhas.mostrarContas(contas);
    } catch (erro) {
      if (minha !== estado.sequenciaMinhas) return;
      minhas.mostrarErro(mensagemDeErro(erro, 'Não foi possível carregar as suas contas.'));
    }
  }

  async function desfazer(desfazerId) {
    try {
      await desfazerExclusao(desfazerId);
      notificar('Exclusão desfeita.', 'sucesso');
      await atualizarTudo();
    } catch (erro) {
      notificar(mensagemDeErro(erro, 'Não foi possível desfazer a exclusão.'), 'erro');
    }
  }

  async function excluir(conta) {
    // Conta Open Finance não se exclui: desconectando, ela vira manual e então pode ser excluída.
    if (conta.tipo === 'open_finance') {
      const desconectarAgora = await confirmar(
        `"${conta.nome}" é Open Finance. Desconectar agora? Ela vira manual e pode ser excluída.`,
        'aviso'
      );
      if (!desconectarAgora || !conta.conectadaId) return;
      try {
        await comCarregamento('Desconectando...', () => desconectarConta(conta.conectadaId));
        notificar(`"${conta.nome}" agora é manual. Exclua de novo.`, 'sucesso');
        await atualizarTudo();
      } catch (erro) {
        notificar(mensagemDeErro(erro, 'Não foi possível desconectar a conta.'), 'erro');
      }
      return;
    }
    const confirmado = await confirmar(`Excluir "${conta.nome}" com seus cartões e lançamentos?`, 'aviso');
    if (!confirmado) return;
    try {
      const saida = await comCarregamento('Excluindo a conta...', () => excluirConta(conta.id));
      notificar(`Conta "${conta.nome}" excluída.`, 'sucesso', {
        duracao: 8000,
        acao: { rotulo: 'Desfazer', aoClicar: () => desfazer(saida.desfazerId) },
      });
      await carregarMinhas({ silencioso: true });
    } catch (erro) {
      notificar(mensagemDeErro(erro, 'Não foi possível excluir a conta.'), 'erro');
    }
  }

  // Conectar, sincronizar ou desconectar mexe nas conexões e pode criar a conta Open Finance: atualiza as duas listas.
  const atualizarTudo = () => Promise.all([carregar({ silencioso: true }), carregarMinhas({ silencioso: true })]);

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
      estado.conexoes = contas;
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
      notificar(`${conta.instituicao} conectada, mas a importação não terminou. Use Sincronizar.`, 'aviso');
    }
  }

  async function conectarBancoDeTeste() {
    conectar.mostrarAndamento(`Conectando ao banco de teste e importando as transações. ${AVISO_DEMORA}`);
    try {
      avisarConexao(await comCarregamento('Conectando ao banco de teste...', () => conectarSandbox()));
      formulario.fechar(); // a conta Open Finance já aparece na lista
    } catch (erro) {
      notificar(mensagemDeErro(erro, 'Não foi possível conectar o banco de teste.'), 'erro');
    } finally {
      conectar.mostrarAndamento(null);
      await atualizarTudo();
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
      avisarConexao(await comCarregamento('Importando as transações...', () => registrarItem(itemId)));
      formulario.fechar();
    } catch (erro) {
      notificar(mensagemDeErro(erro, 'Não foi possível registrar a conta conectada.'), 'erro');
    } finally {
      estado.registrando = false;
      conectar.mostrarAndamento(null);
      await atualizarTudo();
    }
  }

  async function sincronizar(conta) {
    lista.mostrarAndamento(conta.id, `Sincronizando... ${AVISO_DEMORA}`);
    try {
      const resultado = await comCarregamento('Sincronizando...', () => sincronizarConta(conta.id));
      notificar(`${conta.instituicao}: ${textoImportacao(resultado)}`, 'sucesso');
      await atualizarTudo();
    } catch (erro) {
      notificar(mensagemDeErro(erro, 'Não foi possível sincronizar a conta.'), 'erro');
      if (!signal?.aborted) lista.mostrarAndamento(conta.id, null);
    }
  }

  async function desconectar(conta) {
    const confirmado = await confirmar(
      `Desconectar ${conta.instituicao}? A conta vira manual e novas transações deixam de chegar.`,
      'aviso'
    );
    if (!confirmado) return;

    lista.mostrarAndamento(conta.id, 'Desconectando...');
    try {
      await comCarregamento('Desconectando...', () => desconectarConta(conta.id));
      notificar(`${conta.instituicao} desconectada.`, 'sucesso');
      await atualizarTudo();
    } catch (erro) {
      notificar(mensagemDeErro(erro, 'Não foi possível desconectar a conta.'), 'erro');
      if (!signal?.aborted) lista.mostrarAndamento(conta.id, null);
    }
  }

  // O plano decide se a opção Open Finance da janela de conta vale; a lista de bancos alimenta o campo Banco.
  buscarPlano().then((plano) => { estado.plano = plano; });
  listarBancos().then((bancos) => { if (!signal?.aborted) formulario.definirBancos(bancos); }).catch(() => {});

  carregarMinhas();
  carregar();
}
