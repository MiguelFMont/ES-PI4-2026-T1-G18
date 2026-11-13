import { STATUS, TIPOS_DE_CONTA } from '../../utils/constants.js';
import { formatarDataHora, formatarSaldo } from '../../utils/format.js';

/**
 * Liga a lista de contas conectadas (HTML em ContasLista.html). A tela decide o que fazer em cada ação
 * (`aoSincronizar(conta)`, `aoDesconectar(conta)`, `tentarNovamente()`); aqui ficam só os estados e o preenchimento dos
 * cartões, copiados dos <template> do HTML. Todo texto entra com textContent (vem da API).
 * Devolve { iniciarCarga, mostrarContas(contas), mostrarErro(mensagem), mostrarAndamento(id, texto | null) }.
 */
export function iniciarLista(raiz, { signal, aoSincronizar, aoDesconectar, tentarNovamente }) {
  const carregando = raiz.querySelector('#contas-carregando');
  const erro = raiz.querySelector('#contas-erro');
  const erroTexto = raiz.querySelector('#contas-erro-texto');
  const vazio = raiz.querySelector('#contas-vazio');
  const conteudo = raiz.querySelector('#contas-conteudo');
  const itens = raiz.querySelector('#contas-itens');
  const modeloConta = raiz.querySelector('#modelo-conta');
  const modeloSubconta = raiz.querySelector('#modelo-subconta');

  const contasPorId = new Map(); // id da conexão -> conta (dados da API)

  raiz.querySelector('#contas-tentar-novamente').addEventListener('click', tentarNovamente, { signal });

  // Um só ouvinte para os botões de todos os cartões (delegação): os cartões são criados e apagados a cada carga.
  itens.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button[data-acao]');
    if (!botao || botao.disabled) return;
    const conta = contasPorId.get(botao.closest('li[data-id]')?.dataset.id);
    if (!conta) return;
    if (botao.dataset.acao === 'sincronizar') aoSincronizar(conta);
    else if (botao.dataset.acao === 'desconectar') aoDesconectar(conta);
  }, { signal });

  /** Mostra só um dos estados. */
  function mostrar(estado) {
    carregando.hidden = estado !== 'carregando';
    erro.hidden = estado !== 'erro';
    vazio.hidden = estado !== 'vazio';
    conteudo.hidden = estado !== 'lista';
  }

  const campo = (cartao, nome) => cartao.querySelector(`[data-campo="${nome}"]`);

  function criarSubconta(subconta) {
    const linha = modeloSubconta.content.firstElementChild.cloneNode(true);
    campo(linha, 'nome').textContent = subconta.nome;
    campo(linha, 'tipo').textContent = TIPOS_DE_CONTA[subconta.tipo] ?? subconta.tipo;
    campo(linha, 'saldo').textContent = subconta.saldo === undefined ? '' : formatarSaldo(subconta.saldo, subconta.moeda);
    return linha;
  }

  function criarCartao(conta) {
    const cartao = modeloConta.content.firstElementChild.cloneNode(true);
    cartao.dataset.id = conta.id;

    campo(cartao, 'instituicao').textContent = conta.instituicao;
    campo(cartao, 'detalhe').textContent = conta.ultimaSincronizacao
      ? `Última sincronização: ${formatarDataHora(conta.ultimaSincronizacao)}`
      : 'Ainda não sincronizada.';

    const status = STATUS[conta.status] ?? { rotulo: conta.status, situacao: 'atencao' };
    const etiqueta = campo(cartao, 'status');
    etiqueta.textContent = status.rotulo;
    etiqueta.classList.add(`contas-status--${status.situacao}`);

    campo(cartao, 'subcontas').append(...conta.contas.map(criarSubconta));

    // O nome da instituição no rótulo diz qual conexão o botão afeta (vários cartões têm os mesmos botões).
    cartao.querySelector('[data-acao="sincronizar"]').setAttribute('aria-label', `Sincronizar ${conta.instituicao}`);
    cartao.querySelector('[data-acao="desconectar"]').setAttribute('aria-label', `Desconectar ${conta.instituicao}`);
    return cartao;
  }

  return {
    iniciarCarga() {
      mostrar('carregando');
    },

    mostrarContas(contas) {
      contasPorId.clear();
      for (const conta of contas) contasPorId.set(conta.id, conta);
      itens.replaceChildren(...contas.map(criarCartao));
      mostrar(contas.length === 0 ? 'vazio' : 'lista');
    },

    mostrarErro(mensagem) {
      erroTexto.textContent = mensagem;
      mostrar('erro');
    },

    /** Com texto, o cartão mostra o andamento ("Sincronizando...") e trava os botões dele; com null, libera. */
    mostrarAndamento(id, texto) {
      const cartao = itens.querySelector(`li[data-id="${CSS.escape(id)}"]`);
      if (!cartao) return;
      const mensagem = campo(cartao, 'andamento');
      mensagem.hidden = texto === null;
      mensagem.textContent = texto ?? '';
      for (const botao of cartao.querySelectorAll('button[data-acao]')) botao.disabled = texto !== null;
    },
  };
}
