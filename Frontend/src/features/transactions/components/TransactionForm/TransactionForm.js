import { criarTransacao } from '../../services/transactionsService.js';
import { aplicarMascaraMoeda, ligarCampo } from '../../../../shared/components/campos.js';
import { ligarCalendario } from '../../../../shared/components/Calendario.js';
import { notificar } from '../../../../shared/components/notificacao.js';
import { dataDeHoje } from '../../utils/format.js';
import { LIMITE_OBSERVACOES, MENSAGENS_CAMPO, validarFormulario } from '../../utils/formValidation.js';

const ORDEM_DOS_CAMPOS = ['tipo', 'descricao', 'valor', 'data', 'categoria', 'formaPagamento', 'observacoes'];
const TEXTO_BOTAO = 'Adicionar transação →';

/**
 * Liga a lógica ao formulário "Nova transação" (HTML em TransactionForm.html), que é um painel
 * que desce do topo da tela. O botão #botao-alternar-form da página o abre; ele fecha com o botão
 * "Fechar", com a tecla Esc ou clicando no fundo escuro.
 * Erros de preenchimento mostram uma mensagem curta no campo e uma notificação geral. Só atualiza a tela depois
 * que o Backend confirma a gravação. Depois de salvar, o painel fecha e `aoSalvar()` é chamado (e aguardado); o tipo
 * e a data escolhidos ficam para o próximo lançamento.
 */
export function iniciarFormulario(raiz, { aoSalvar, signal }) {
  const formulario = raiz.querySelector('#form-transacao');
  const botaoSalvar = raiz.querySelector('#botao-salvar');
  const contador = raiz.querySelector('#contador-observacoes');
  const painel = raiz.querySelector('#transactions-painel-form');
  const fundo = raiz.querySelector('#transactions-fundo');
  const botaoAbrir = raiz.querySelector('#botao-alternar-form');

  const campos = {
    tipo: ligarCampoTipo(raiz),
    descricao: ligarCampo(raiz, 'campo-descricao'),
    valor: ligarCampo(raiz, 'campo-valor'),
    data: ligarCalendario(formulario.querySelector('[data-calendario]'), { signal }),
    categoria: ligarCampo(raiz, 'campo-categoria'),
    formaPagamento: ligarCampo(raiz, 'campo-formaPagamento'),
    observacoes: ligarCampo(raiz, 'campo-observacoes'),
  };

  campos.data.definir(dataDeHoje());
  aplicarMascaraMoeda(campos.valor.controle); // o valor já aparece formatado (1 -> 0,01; 11 -> 0,11)

  campos.observacoes.controle.addEventListener('input', () => {
    contador.textContent = `${campos.observacoes.ler().length}/${LIMITE_OBSERVACOES}`;
  });

  const painelAberto = () => painel.classList.contains('transactions-painel--aberto');

  function abrirPainel() {
    painel.classList.add('transactions-painel--aberto');
    fundo.classList.add('transactions-fundo--aberto');
    document.body.classList.add('transactions-painel-aberto'); // trava a rolagem da página de trás
    botaoAbrir.setAttribute('aria-expanded', 'true');
    campos.descricao.focar();
  }

  function fecharPainel() {
    painel.classList.remove('transactions-painel--aberto');
    fundo.classList.remove('transactions-fundo--aberto');
    document.body.classList.remove('transactions-painel-aberto');
    botaoAbrir.setAttribute('aria-expanded', 'false');
    botaoAbrir.focus(); // devolve o foco a quem abriu
  }

  botaoAbrir.addEventListener('click', abrirPainel);
  raiz.querySelector('#botao-fechar-form').addEventListener('click', fecharPainel);
  fundo.addEventListener('click', fecharPainel);
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && painelAberto()) fecharPainel();
  }, { signal }); // `signal` tira este ouvinte do document quando a tela é desmontada
  // ao sair da tela com o painel aberto, destrava a rolagem da página (a classe fica no <body>, que não é desmontado)
  signal?.addEventListener('abort', () => document.body.classList.remove('transactions-painel-aberto'));

  // O Tab circula só dentro do painel enquanto ele está aberto.
  painel.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Tab') return;
    const focaveis = [...painel.querySelectorAll('input, select, textarea, button')].filter((el) => !el.disabled);
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  });

  function limparErros() {
    for (const campo of Object.values(campos)) campo.definirErro(null);
  }

  function mostrarErros(erros) {
    const comErro = ORDEM_DOS_CAMPOS.filter((nome) => erros[nome]);
    for (const nome of comErro) campos[nome].definirErro(erros[nome]);
    notificar(comErro.length === 1 ? 'Corrija o campo destacado.' : 'Corrija os campos destacados.', 'erro');
    campos[comErro[0]]?.focar();
  }

  function limparParaProximo() {
    for (const nome of ['descricao', 'valor', 'categoria', 'formaPagamento', 'observacoes']) campos[nome].definir('');
    contador.textContent = `0/${LIMITE_OBSERVACOES}`;
    campos.descricao.focar();
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparErros();

    const valores = Object.fromEntries(ORDEM_DOS_CAMPOS.map((nome) => [nome, campos[nome].ler()]));
    const { erros, dados } = validarFormulario(valores);
    if (!dados) {
      mostrarErros(erros);
      return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = 'Salvando...';
    try {
      await criarTransacao(dados);
    } catch (erro) {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = TEXTO_BOTAO;

      if (erro?.code === 'VALIDATION_ERROR' && erro.details) {
        // o Backend recusou campos: mostra a mensagem em português junto de cada um
        const errosApi = {};
        for (const nome of Object.keys(erro.details)) {
          if (campos[nome]) errosApi[nome] = MENSAGENS_CAMPO[nome];
        }
        if (Object.keys(errosApi).length > 0) {
          mostrarErros(errosApi);
          return;
        }
      }
      // falha de rede (mensagem já amigável) ou erro inesperado
      notificar(erro?.status ? 'Não foi possível salvar a transação. Tente novamente.' : (erro?.message ?? 'Erro inesperado.'), 'erro');
      return;
    }

    botaoSalvar.disabled = false;
    botaoSalvar.textContent = TEXTO_BOTAO;
    limparParaProximo();
    fecharPainel();
    notificar('Transação cadastrada.', 'sucesso');
    await aoSalvar();
  });

  return { abrir: abrirPainel, fechar: fecharPainel };
}

/** Escolha entre despesa e receita (botões de opção). Mesma interface dos outros campos. */
function ligarCampoTipo(raiz) {
  const erro = raiz.querySelector('#campo-tipo-erro');
  const opcoes = raiz.querySelectorAll('input[name="tipo"]');

  return {
    focar: () => opcoes[0]?.focus(),
    ler: () => raiz.querySelector('input[name="tipo"]:checked')?.value ?? '',
    definir: () => {},
    definirErro(mensagem) {
      erro.hidden = !mensagem;
      erro.textContent = mensagem ?? '';
    },
  };
}
