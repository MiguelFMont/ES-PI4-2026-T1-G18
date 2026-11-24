/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
import { criarCartao } from '../../../investments/services/investmentsService.js';
import { definirAvatar, iniciais } from '../../../../shared/utils/avatar.js';
import { aplicarMascaraMoeda, ligarCampo } from '../../../../shared/components/campos.js';
import { comCarregamento, notificar } from '../../../../shared/components/notificacao.js';
import { liberarRolagem, travarRolagem } from '../../../../shared/utils/rolagem.js';
import { lerValor, valorParaCampo } from '../../../../shared/utils/moeda.js';

const LIMITE_PADRAO = 5000;
const DIA_PADRAO = 3; // a fatura fecha no dia 3 e vence 7 dias depois (o mesmo padrão da aba Cartão)
const MENSAGENS = {
  nome: 'Informe um nome de até 40 caracteres.',
  nomeEmUso: 'Já existe um cartão com esse nome.',
  conta: 'Escolha a conta do cartão.',
  limite: 'Informe um limite maior que zero.',
  dia: 'Informe um dia de 1 a 28.',
};

/**
 * Liga a janela "Novo cartão" (HTML em TransactionCartao.html), aberta por cima do formulário de lançamento ou do painel de detalhes.
 * `abrir({ contaId, contas })` já escolhe a conta e preenche o limite e o fechamento padrão: o usuário só digita o nome. Depois que o Backend
 * confirma, a janela fecha e `aoCriar(cartao)` é chamado (e aguardado): quem abriu atualiza a lista de cartões e escolhe o novo.
 * Fecha com o X, com Esc ou clicando no fundo. Devolve { abrir, fechar }.
 */
export function iniciarCartaoRapido(raiz, { aoCriar, signal }) {
  const painel = raiz.querySelector('#cartao-rapido');
  const fundo = raiz.querySelector('#cartao-rapido-fundo');
  const formulario = raiz.querySelector('#cartao-rapido-form');
  const botaoSalvar = raiz.querySelector('#cartao-rapido-salvar');

  const campos = {
    nome: ligarCampo(raiz, 'cartao-rapido-nome'),
    conta: ligarCampo(raiz, 'cartao-rapido-conta'),
    limite: ligarCampo(raiz, 'cartao-rapido-limite'),
    dia: ligarCampo(raiz, 'cartao-rapido-dia'),
  };
  aplicarMascaraMoeda(campos.limite.controle);

  let rolagemTravada = false;
  const travar = () => { if (!rolagemTravada) { travarRolagem(); rolagemTravada = true; } };
  const liberar = () => { if (rolagemTravada) { liberarRolagem(); rolagemTravada = false; } };
  const aberta = () => painel.classList.contains('transactions-painel--aberto');

  function limparErros() {
    for (const campo of Object.values(campos)) campo.definirErro(null);
  }

  function fechar() {
    painel.classList.remove('transactions-painel--aberto');
    fundo.classList.remove('transactions-fundo--aberto');
    liberar();
  }

  function abrir({ contaId, contas: todas }) {
    limparErros();
    const contas = todas.filter((c) => c.tipo === 'manual'); // numa conta Open Finance os cartões vêm do banco: o usuário só cria cartão em conta manual
    // troca só as <option>: o <select> tem dentro o <button><selectedcontent>
    const select = campos.conta.controle;
    for (const antiga of select.querySelectorAll('option')) antiga.remove();
    for (const conta of contas) { const opcao = new Option(`${conta.nome} (${conta.bancoNome})`, conta.id); definirAvatar(opcao, { banco: conta.banco, sigla: iniciais(conta.nome), titulo: conta.nome, subtitulo: conta.bancoNome, icone: conta.icone, cor: conta.cor }); select.add(opcao); }
    campos.conta.definir(contas.some((c) => c.id === contaId) ? contaId : (contas[0]?.id ?? ''));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    campos.nome.definir('');
    campos.limite.definir(valorParaCampo(LIMITE_PADRAO));
    campos.dia.definir(String(DIA_PADRAO));

    painel.classList.add('transactions-painel--aberto');
    fundo.classList.add('transactions-fundo--aberto');
    travar();
    campos.nome.focar();
  }

  raiz.querySelector('#cartao-rapido-fechar').addEventListener('click', fechar, { signal });
  fundo.addEventListener('click', fechar, { signal });
  // Esc fecha só esta janela (a de baixo, do lançamento, continua): captura antes dos outros ouvintes do documento
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && aberta()) {
      evento.stopImmediatePropagation();
      fechar();
    }
  }, { signal, capture: true });
  signal?.addEventListener('abort', liberar);

  // O Tab circula só dentro da janela enquanto ela está aberta.
  painel.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Tab') return;
    const focaveis = [...painel.querySelectorAll('input, select, textarea, button')].filter((el) => !el.disabled && el.offsetParent !== null);
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }, { signal });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparErros();

    const nome = campos.nome.ler().trim();
    const contaId = campos.conta.ler();
    const limite = lerValor(campos.limite.ler());
    const textoDia = campos.dia.ler().trim();
    const dia = /^\d+$/.test(textoDia) ? Number(textoDia) : NaN;
    const erros = {};
    if (!nome || nome.length > 40) erros.nome = MENSAGENS.nome;
    if (!contaId) erros.conta = MENSAGENS.conta;
    if (!(limite > 0)) erros.limite = MENSAGENS.limite;
    if (!(dia >= 1 && dia <= 28)) erros.dia = MENSAGENS.dia;
    if (Object.keys(erros).length > 0) {
      for (const [nomeDoCampo, mensagem] of Object.entries(erros)) campos[nomeDoCampo].definirErro(mensagem);
      campos[Object.keys(erros)[0]].focar();
      return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.setAttribute('aria-busy', 'true');
    try {
      const cartao = await comCarregamento('Criando o cartão...', () => criarCartao({ nome, contaId, limite, diaFechamento: dia }));
      fechar();
      notificar('Cartão criado.', 'sucesso');
      await aoCriar(cartao);
    } catch (erro) {
      if (erro?.code === 'CARD_NAME_TAKEN') {
        campos.nome.definirErro(MENSAGENS.nomeEmUso);
        campos.nome.focar();
      } else if (erro?.code === 'CARD_LIMIT_REACHED') {
        notificar('Limite de cartões atingido. Exclua um para criar outro.', 'erro');
      } else {
        notificar(erro?.status ? 'Não foi possível criar o cartão. Tente novamente.' : (erro?.message ?? 'Erro inesperado.'), 'erro');
      }
    } finally {
      botaoSalvar.disabled = false;
      botaoSalvar.removeAttribute('aria-busy');
    }
  }, { signal });

  return { abrir, fechar };
}
