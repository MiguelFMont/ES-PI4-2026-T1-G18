import { aplicarMascaraMoeda, ligarCampo } from '../../../../shared/components/campos.js';
import { ligarCalendario } from '../../../../shared/components/Calendario.js';
import { formatarMoeda, formatarPercentual, lerTaxa, lerValor } from '../../../../shared/utils/moeda.js';
import { TIPOS_DE_ATIVO } from '../../utils/constants.js';

const MENSAGENS = {
  nome: 'Informe o nome do ativo.',
  valor: 'Informe um valor maior que zero.',
  taxa: 'Informe uma taxa entre -100% e 100%.',
  data: 'Informe uma data válida.',
};

// campo da API -> campo do formulário
const CAMPO_DA_API = { nome: 'nome', valorInvestido: 'valor', taxaMensal: 'taxa', dataAplicacao: 'data' };

/**
 * Liga o portfólio (HTML em InvestmentsPortfolio.html): a tabela de ativos e o formulário de novo ativo. A tela decide o
 * que fazer em cada ação (`criar(dados)` devolve uma Promise e `remover(ativo)` pergunta e remove); aqui ficam só os
 * estados e o preenchimento das linhas, copiadas do <template>. Todo texto entra com textContent (vem da API).
 * Devolve { mostrar(carteira) }, com a resposta de GET /investments.
 */
export function iniciarPortfolio(raiz, { signal, criar, remover }) {
  const formulario = raiz.querySelector('#invest-ativo-form');
  const botaoNovo = raiz.querySelector('#invest-novo-ativo');
  const botaoSalvar = raiz.querySelector('#invest-ativo-salvar');
  const vazio = raiz.querySelector('#invest-portfolio-vazio');
  const tabela = raiz.querySelector('#invest-portfolio-tabela');
  const linhas = raiz.querySelector('#invest-portfolio-linhas');
  const modelo = raiz.querySelector('#modelo-ativo');
  const tipo = raiz.querySelector('#invest-ativo-tipo');

  const campos = {
    nome: ligarCampo(formulario, 'invest-ativo-nome'),
    valor: ligarCampo(formulario, 'invest-ativo-valor'),
    taxa: ligarCampo(formulario, 'invest-ativo-taxa'),
    data: ligarCalendario(formulario.querySelector('[data-calendario]'), { signal }),
  };
  aplicarMascaraMoeda(campos.valor.controle);

  const ativosPorId = new Map();

  function limparErros() {
    for (const campo of Object.values(campos)) campo.definirErro(null);
  }

  function abrir() {
    limparErros();
    formulario.hidden = false;
    botaoNovo.setAttribute('aria-expanded', 'true');
    campos.nome.focar();
  }

  function fechar() {
    formulario.hidden = true;
    botaoNovo.setAttribute('aria-expanded', 'false');
    formulario.reset();
    limparErros();
  }

  /** Lê e valida os campos. Devolve { erros, dados }: `dados` é null se houver erro. */
  function lerFormulario() {
    const erros = {};
    const nome = campos.nome.ler().trim();
    if (!nome || nome.length > 100) erros.nome = MENSAGENS.nome;

    const valor = lerValor(campos.valor.ler());
    if (!(valor > 0)) erros.valor = MENSAGENS.valor;

    const textoTaxa = campos.taxa.ler().trim();
    const taxa = textoTaxa === '' ? 0 : lerTaxa(textoTaxa);
    if (Number.isNaN(taxa) || taxa <= -100 || taxa > 100) erros.taxa = MENSAGENS.taxa;

    const textoData = campos.data.controle.value.trim();
    const data = campos.data.ler();
    if (textoData && !data) erros.data = MENSAGENS.data;

    if (Object.keys(erros).length > 0) return { erros, dados: null };
    return { erros, dados: { nome, tipo: tipo.value, valorInvestido: valor, taxaMensal: taxa, ...(data && { dataAplicacao: data }) } };
  }

  botaoNovo.addEventListener('click', () => (formulario.hidden ? abrir() : fechar()), { signal });
  raiz.querySelector('#invest-ativo-cancelar').addEventListener('click', fechar, { signal });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparErros();

    const { erros, dados } = lerFormulario();
    if (!dados) {
      for (const [campo, mensagem] of Object.entries(erros)) campos[campo].definirErro(mensagem);
      campos[Object.keys(erros)[0]].focar?.();
      return;
    }

    botaoSalvar.disabled = true;
    try {
      await criar(dados);
      fechar();
    } catch (erro) {
      // erros de campo da API ({ campo: [mensagens] }) aparecem junto do campo; o resto o chamador já avisou
      for (const campoApi of Object.keys(erro?.details ?? {})) {
        const campo = CAMPO_DA_API[campoApi];
        if (campo) campos[campo].definirErro(MENSAGENS[campo]);
      }
    } finally {
      botaoSalvar.disabled = false;
    }
  }, { signal });

  // Um só ouvinte para os botões de todas as linhas (delegação): as linhas são criadas e apagadas a cada carga.
  linhas.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button[data-acao]');
    const ativo = ativosPorId.get(botao?.closest('tr[data-id]')?.dataset.id);
    if (botao && ativo) remover(ativo);
  }, { signal });

  const campo = (linha, nome) => linha.querySelector(`[data-campo="${nome}"]`);

  function criarLinha(ativo) {
    const linha = modelo.content.firstElementChild.cloneNode(true);
    linha.dataset.id = ativo.id;

    campo(linha, 'nome').textContent = ativo.nome;
    campo(linha, 'tipo').textContent = TIPOS_DE_ATIVO[ativo.tipo] ?? ativo.tipo;
    campo(linha, 'investido').textContent = formatarMoeda(ativo.valorInvestido);
    campo(linha, 'atual').textContent = formatarMoeda(ativo.valorAtual);
    campo(linha, 'rendimento').textContent = formatarMoeda(ativo.rendimento);
    campo(linha, 'rentabilidade').textContent = `(${formatarPercentual(ativo.rentabilidade)})`;
    campo(linha, 'taxa').textContent = formatarPercentual(ativo.taxaMensal);
    campo(linha, 'carteira').textContent = formatarPercentual(ativo.percentualCarteira);

    const ganho = ativo.rendimento > 0 ? 'investments-positivo' : ativo.rendimento < 0 ? 'investments-negativo' : null;
    if (ganho) campo(linha, 'rendimento').classList.add(ganho);

    // o nome do ativo no rótulo diz qual ativo o botão remove (todas as linhas têm o mesmo botão)
    linha.querySelector('[data-acao="remover"]').setAttribute('aria-label', `Remover ${ativo.nome}`);
    return linha;
  }

  return {
    mostrar(carteira) {
      ativosPorId.clear();
      for (const ativo of carteira.ativos) ativosPorId.set(ativo.id, ativo);
      linhas.replaceChildren(...carteira.ativos.map(criarLinha));
      vazio.hidden = carteira.ativos.length > 0;
      tabela.hidden = carteira.ativos.length === 0;
    },
  };
}
